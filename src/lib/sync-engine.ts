'use client'

import { localDB, getPendingSyncCount, type LocalSale } from './local-db'
import { getSupabaseClient, isSupabaseConfigured } from './supabase'
import { useConnectionStore, useAuthStore } from './store'
import { apiFetch } from './api'

// ============================================================
// SYNC ENGINE - Bidirectional sync between local DB and Supabase
// ============================================================
//
// ARCHITECTURE:
// 1. Local DB (Dexie/IndexedDB) is the PRIMARY data store
// 2. All POS operations write to local DB first (instant, offline)
// 3. Sync Engine runs in background:
//    a. PUSH: Send pending local changes to server API + Supabase
//    b. PULL: Fetch remote changes from Supabase and update local DB
// 4. Idempotency: Each local record has a clientId (UUID) to prevent duplicates
// 5. Conflict resolution: Server wins (last-write-wins) with client notification
//
// ============================================================

let syncInterval: NodeJS.Timeout | null = null
let isSyncing = false
let lastSyncTime = 0

export function startSyncEngine() {
  if (typeof window === 'undefined') return

  // Monitor online/offline status
  const updateOnlineStatus = () => {
    const online = navigator.onLine
    useConnectionStore.getState().setOnline(online)
    if (online) {
      // Trigger full sync when back online
      setTimeout(() => runFullSync(), 1000)
    }
  }

  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
  updateOnlineStatus()

  // Run sync every 30 seconds when online
  syncInterval = setInterval(async () => {
    if (navigator.onLine && !isSyncing) {
      const pending = await getPendingSyncCount()
      useConnectionStore.getState().setPendingSync(pending)
      if (pending > 0 || Date.now() - lastSyncTime > 60000) {
        runFullSync()
      }
    }
  }, 30000)
}

export function stopSyncEngine() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

// ============================================================
// FULL SYNC - Push + Pull
// ============================================================

export async function runFullSync(): Promise<{ pushed: number; pulled: number; errors: number }> {
  if (isSyncing) return { pushed: 0, pulled: 0, errors: 0 }
  isSyncing = true
  useConnectionStore.getState().setSyncing(true)

  let pushed = 0
  let pulled = 0
  let errors = 0

  try {
    // STEP 1: Push pending changes to server
    pushed = await pushPendingChanges()

    // STEP 2: Pull remote changes from Supabase (if configured)
    if (isSupabaseConfigured()) {
      pulled = await pullRemoteChanges()
    }

    // Update pending count
    const remaining = await getPendingSyncCount()
    useConnectionStore.getState().setPendingSync(remaining)
    lastSyncTime = Date.now()

    // Update sync timestamp in settings
    if (remaining === 0) {
      await localDB.settings.put({
        key: 'sync.lastSync',
        value: new Date().toISOString(),
        category: 'sync',
        lastSynced: Date.now(),
      })
    }
  } catch (e) {
    console.error('[Sync] Full sync error:', e)
    errors++
  } finally {
    isSyncing = false
    useConnectionStore.getState().setSyncing(false)
  }

  return { pushed, pulled, errors }
}

// ============================================================
// PUSH - Send local changes to server
// ============================================================

async function pushPendingChanges(): Promise<number> {
  const pending = await localDB.syncQueue.where('status').equals('PENDING').toArray()
  let pushed = 0

  for (const item of pending) {
    if (item.attempts >= item.maxAttempts) {
      await localDB.syncQueue.update(item.id!, { status: 'FAILED' })
      continue
    }

    try {
      const payload = JSON.parse(item.payload)
      const token = useAuthStore.getState().token
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Client-Id': item.clientId, // Idempotency key
      }
      if (token) headers['Authorization'] = `Bearer ${token}`

      let success = false

      // Route to appropriate API endpoint based on entity type
      if (item.entityType === 'Sale') {
        const res = await fetch('/api/sales', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        success = res.ok && data.success

        if (success) {
          // Update local sale with server invoice number
          const localSale = await localDB.sales.get(item.entityId)
          if (localSale && data.data?.invoiceNumber) {
            localSale.invoiceNumber = data.data.invoiceNumber
            localSale.syncStatus = 'SYNCED'
            localSale.lastSyncedAt = Date.now()
            await localDB.sales.put(localSale)
          }
          pushed++
        }
      } else if (item.entityType === 'StockMovement') {
        // Stock movements are handled as part of sales
        success = true
      } else if (item.entityType === 'LoyaltyTransaction') {
        // Loyalty transactions are handled as part of sales
        success = true
      } else if (item.entityType === 'Customer') {
        const res = await fetch('/api/customers', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        })
        success = res.ok && (await res.json()).success
        if (success) pushed++
      }

      if (success) {
        await localDB.syncQueue.update(item.id!, {
          status: 'SYNCED',
          syncedAt: Date.now(),
        })
      } else {
        await localDB.syncQueue.update(item.id!, {
          attempts: item.attempts + 1,
        })
      }
    } catch (e: any) {
      console.error(`[Sync] Push error for ${item.entityType}:${item.entityId}`, e)
      await localDB.syncQueue.update(item.id!, {
        attempts: item.attempts + 1,
        error: e.message,
      })
    }
  }

  return pushed
}

// ============================================================
// PULL - Fetch remote changes from Supabase
// ============================================================

async function pullRemoteChanges(): Promise<number> {
  const supabase = await getSupabaseClient()
  if (!supabase) return 0

  let pulled = 0
  const lastSync = await localDB.settings.get('sync.lastSync')
  const since = lastSync?.value ? new Date(lastSync.value) : new Date(0)

  try {
    // Pull products
    const { data: remoteProducts, error: pErr } = await supabase
      .from('products')
      .select('*')
      .gt('updated_at', since.toISOString())

    if (!pErr && remoteProducts) {
      const now = Date.now()
      for (const p of remoteProducts) {
        await localDB.products.put({
          id: p.id,
          name: p.name,
          nameAr: p.name_ar,
          sku: p.sku,
          barcode: p.barcode,
          categoryId: p.category_id,
          purchaseCost: p.purchase_cost,
          sellingPrice: p.selling_price,
          wholesalePrice: p.wholesale_price || 0,
          taxRate: p.tax_rate || 0,
          minStock: p.min_stock || 0,
          reorderLevel: p.reorder_level || 0,
          trackStock: p.track_stock !== false,
          allowNegativeStock: p.allow_negative_stock || false,
          avgCost: p.avg_cost || 0,
          image: p.image,
          active: p.active !== false,
          currentStock: p.current_stock || 0,
          lastSynced: now,
        })
        pulled++
      }
    }

    // Pull customers
    const { data: remoteCustomers, error: cErr } = await supabase
      .from('customers')
      .select('*')
      .gt('updated_at', since.toISOString())

    if (!cErr && remoteCustomers) {
      const now = Date.now()
      for (const c of remoteCustomers) {
        await localDB.customers.put({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          tier: c.tier || 'BRONZE',
          active: c.active !== false,
          loyaltyPoints: c.loyalty_points || 0,
          totalEarned: c.total_earned || 0,
          totalRedeemed: c.total_redeemed || 0,
          lastSynced: now,
        })
        pulled++
      }
    }

    // Pull sales (for reporting when offline)
    const { data: remoteSales, error: sErr } = await supabase
      .from('sales')
      .select('*')
      .gt('created_at', since.toISOString())

    if (!sErr && remoteSales) {
      const now = Date.now()
      for (const s of remoteSales) {
        // Only add if not already in local DB (avoid overwriting pending)
        const existing = await localDB.sales.get(s.id)
        if (!existing) {
          await localDB.sales.put({
            id: s.id,
            invoiceNumber: s.invoice_number,
            items: s.items || [],
            customerId: s.customer_id,
            userId: s.user_id,
            subtotal: s.subtotal || 0,
            discountAmount: s.discount_amount || 0,
            taxAmount: s.tax_amount || 0,
            total: s.total || 0,
            paidAmount: s.paid_amount || 0,
            changeAmount: s.change_amount || 0,
            paymentMethod: s.payment_method || 'CASH',
            loyaltyEarned: s.loyalty_earned || 0,
            loyaltyRedeemed: s.loyalty_redeemed || 0,
            createdAt: s.created_at,
            syncStatus: 'SYNCED',
            syncAttempts: 0,
            lastSyncedAt: now,
          })
          pulled++
        }
      }
    }
  } catch (e) {
    console.error('[Sync] Pull error:', e)
  }

  return pulled
}

// ============================================================
// MANUAL TRIGGERS
// ============================================================

export async function syncNow() {
  return runFullSync()
}

export function simulateOffline() {
  useConnectionStore.getState().setOnline(false)
}

export function simulateOnline() {
  useConnectionStore.getState().setOnline(true)
  return runFullSync()
}

// ============================================================
// SUPABASE SETUP HELPER
// ============================================================

// Test Supabase connection
export async function testSupabaseConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const client = createClient(url, key)

    // Try a simple query
    const { error } = await client.from('products').select('id').limit(1)

    if (error) {
      // Table might not exist yet
      if (error.message.includes('does not exist') || error.message.includes('relation')) {
        return {
          success: false,
          message: 'الاتصال ناجح لكن الجداول غير موجودة. اضغط "إنشاء الجداول" لإنشائها.',
        }
      }
      return { success: false, message: error.message }
    }

    return { success: true, message: 'تم الاتصال بـ Supabase بنجاح والجداول موجودة' }
  } catch (e: any) {
    return { success: false, message: e.message || 'فشل الاتصال' }
  }
}

// Create Supabase tables (runs SQL via RPC)
export async function createSupabaseTables(url: string, key: string): Promise<{ success: boolean; message: string }> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const client = createClient(url, key)

    // Execute SQL to create tables
    const sql = `
      -- Products table
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_ar TEXT,
        sku TEXT UNIQUE,
        barcode TEXT,
        category_id TEXT,
        brand_id TEXT,
        unit_id TEXT,
        supplier_id TEXT,
        purchase_cost REAL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        wholesale_price REAL DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        min_stock INTEGER DEFAULT 0,
        reorder_level INTEGER DEFAULT 0,
        track_stock BOOLEAN DEFAULT TRUE,
        allow_negative_stock BOOLEAN DEFAULT FALSE,
        avg_cost REAL DEFAULT 0,
        image TEXT,
        active BOOLEAN DEFAULT TRUE,
        current_stock INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Customers table
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        tier TEXT DEFAULT 'BRONZE',
        active BOOLEAN DEFAULT TRUE,
        loyalty_points INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0,
        total_redeemed INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Sales table
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        invoice_number TEXT UNIQUE,
        customer_id TEXT,
        user_id TEXT,
        items JSONB,
        subtotal REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        paid_amount REAL DEFAULT 0,
        change_amount REAL DEFAULT 0,
        payment_method TEXT DEFAULT 'CASH',
        payment_details JSONB,
        loyalty_earned INTEGER DEFAULT 0,
        loyalty_redeemed INTEGER DEFAULT 0,
        note TEXT,
        status TEXT DEFAULT 'COMPLETED',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Stock movements table
      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        ref_type TEXT,
        ref_id TEXT,
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Loyalty transactions table
      CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        type TEXT NOT NULL,
        points INTEGER NOT NULL,
        ref_type TEXT,
        ref_id TEXT,
        note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Categories table
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_ar TEXT,
        parent_id TEXT,
        color TEXT,
        icon TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
      CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
      CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
      CREATE INDEX IF NOT EXISTS idx_stock_product ON stock_movements(product_id);

      -- Enable Row Level Security (RLS) with permissive policies for now
      ALTER TABLE products ENABLE ROW LEVEL SECURITY;
      ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
      ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
      ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
      ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

      -- Permissive policies (adjust for production)
      CREATE POLICY "Enable all for all" ON products FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY "Enable all for all" ON customers FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY "Enable all for all" ON sales FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY "Enable all for all" ON stock_movements FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY "Enable all for all" ON loyalty_transactions FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY "Enable all for all" ON categories FOR ALL USING (true) WITH CHECK (true);
    `

    // Execute via RPC
    const { error } = await client.rpc('exec_sql', { sql })

    if (error) {
      // Try alternative: use individual table creation via REST
      // Supabase doesn't support raw SQL via RPC by default
      return {
        success: false,
        message: 'لا يمكن إنشاء الجداول تلقائياً. يرجى نسخ SQL من ملف supabase-schema.sql وتشغيله في Supabase SQL Editor.',
      }
    }

    return { success: true, message: 'تم إنشاء جميع الجداول بنجاح' }
  } catch (e: any) {
    return { success: false, message: e.message }
  }
}
