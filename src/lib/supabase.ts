'use client'

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { localDB } from './local-db'

// ============================================================
// SUPABASE CLIENT - Online cloud database
// ============================================================
// Configured via:
// 1. Environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
// 2. Or via Settings → Sync tab at runtime
// ============================================================

let client: SupabaseClient | null = null
let configuredUrl = ''
let configuredKey = ''

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (client) return client

  try {
    // Try env first
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (url && key) {
      client = createClient(url, key)
      configuredUrl = url
      configuredKey = key
      return client
    }

    // Try fetching from settings API
    const res = await fetch('/api/settings')
    if (!res.ok) return null
    const data = await res.json()
    const flat = data.data?.flat || []
    const settings: Record<string, string> = {}
    for (const s of flat) settings[s.key] = s.value

    const sUrl = settings['supabase.url']
    const sKey = settings['supabase.key']
    if (sUrl && sKey) {
      client = createClient(sUrl, sKey)
      configuredUrl = sUrl
      configuredKey = sKey
      return client
    }
  } catch (e) {
    console.error('Supabase init error:', e)
  }
  return null
}

export function isSupabaseConfigured(): boolean {
  return client !== null || (!!configuredUrl && !!configuredKey)
}

export function getConfiguredUrl(): string {
  return configuredUrl
}

// ============================================================
// SYNC OPERATIONS - Push local data to Supabase
// ============================================================

// Export ALL local data to Supabase (initial upload)
export async function exportLocalToSupabase(): Promise<{ success: boolean; uploaded: number; message: string }> {
  const supabase = await getSupabaseClient()
  if (!supabase) {
    return { success: false, uploaded: 0, message: 'Supabase غير مُعد. أدخل URL و Anon Key في الإعدادات.' }
  }

  let uploaded = 0
  const errors: string[] = []

  try {
    // Upload products
    const products = await localDB.products.toArray()
    if (products.length > 0) {
      const productsData = products.map(p => ({
        id: p.id,
        name: p.name,
        name_ar: p.nameAr,
        sku: p.sku,
        barcode: p.barcode,
        category_id: p.categoryId,
        brand_id: p.brandId,
        unit_id: p.unitId,
        supplier_id: p.supplierId,
        purchase_cost: p.purchaseCost,
        selling_price: p.sellingPrice,
        wholesale_price: p.wholesalePrice,
        tax_rate: p.taxRate,
        min_stock: p.minStock,
        reorder_level: p.reorderLevel,
        track_stock: p.trackStock,
        allow_negative_stock: p.allowNegativeStock,
        avg_cost: p.avgCost,
        image: p.image,
        description: p.description,
        active: p.active,
        current_stock: p.currentStock,
      }))
      const { error } = await supabase.from('products').upsert(productsData, { onConflict: 'id' })
      if (error) errors.push(`products: ${error.message}`)
      else uploaded += products.length
    }

    // Upload categories
    const categories = await localDB.categories.toArray()
    if (categories.length > 0) {
      const catData = categories.map(c => ({
        id: c.id,
        name: c.name,
        name_ar: c.nameAr,
        parent_id: c.parentId,
        color: c.color,
        icon: c.icon,
      }))
      const { error } = await supabase.from('categories').upsert(catData, { onConflict: 'id' })
      if (error) errors.push(`categories: ${error.message}`)
      else uploaded += categories.length
    }

    // Upload customers
    const customers = await localDB.customers.toArray()
    if (customers.length > 0) {
      const custData = customers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        tier: c.tier,
        active: c.active,
        loyalty_points: c.loyaltyPoints,
        total_earned: c.totalEarned,
        total_redeemed: c.totalRedeemed,
      }))
      const { error } = await supabase.from('customers').upsert(custData, { onConflict: 'id' })
      if (error) errors.push(`customers: ${error.message}`)
      else uploaded += customers.length
    }

    // Upload sales
    const sales = await localDB.sales.toArray()
    if (sales.length > 0) {
      const salesData = sales.map(s => ({
        id: s.id,
        invoice_number: s.invoiceNumber,
        customer_id: s.customerId,
        user_id: s.userId,
        items: s.items,
        subtotal: s.subtotal,
        discount_amount: s.discountAmount,
        tax_amount: s.taxAmount,
        total: s.total,
        paid_amount: s.paidAmount,
        change_amount: s.changeAmount,
        payment_method: s.paymentMethod,
        payment_details: s.paymentDetails ? JSON.parse(s.paymentDetails) : null,
        loyalty_earned: s.loyaltyEarned,
        loyalty_redeemed: s.loyaltyRedeemed,
        note: s.note,
        status: 'COMPLETED',
        created_at: s.createdAt,
      }))
      const { error } = await supabase.from('sales').upsert(salesData, { onConflict: 'id' })
      if (error) errors.push(`sales: ${error.message}`)
      else uploaded += sales.length
    }

    // Upload loyalty transactions
    const loyaltyTxns = await localDB.loyaltyTransactions.toArray()
    if (loyaltyTxns.length > 0) {
      const txnData = loyaltyTxns.map(t => ({
        id: t.id,
        customer_id: t.customerId,
        type: t.type,
        points: t.points,
        ref_type: t.refType,
        ref_id: t.refId,
        note: t.note,
        created_at: t.createdAt,
      }))
      const { error } = await supabase.from('loyalty_transactions').upsert(txnData, { onConflict: 'id' })
      if (error) errors.push(`loyalty: ${error.message}`)
      else uploaded += loyaltyTxns.length
    }

    // Upload stock movements
    const stockMovements = await localDB.stockMovements.toArray()
    if (stockMovements.length > 0) {
      const movData = stockMovements.map(m => ({
        id: m.id,
        product_id: m.productId,
        type: m.type,
        quantity: m.quantity,
        ref_type: m.refType,
        ref_id: m.refId,
        note: m.note,
        created_at: m.createdAt,
      }))
      const { error } = await supabase.from('stock_movements').upsert(movData, { onConflict: 'id' })
      if (error) errors.push(`stock: ${error.message}`)
      else uploaded += stockMovements.length
    }

    if (errors.length > 0) {
      return {
        success: false,
        uploaded,
        message: `تم رفع ${uploaded} سجل لكن حدثت أخطاء: ${errors.join('; ')}`,
      }
    }

    return {
      success: true,
      uploaded,
      message: `تم رفع ${uploaded} سجل إلى Supabase بنجاح`,
    }
  } catch (e: any) {
    return { success: false, uploaded: 0, message: e.message }
  }
}

// Pull all data from Supabase to local DB
export async function importFromSupabase(): Promise<{ success: boolean; downloaded: number; message: string }> {
  const supabase = await getSupabaseClient()
  if (!supabase) {
    return { success: false, downloaded: 0, message: 'Supabase غير مُعد' }
  }

  let downloaded = 0
  const now = Date.now()

  try {
    // Pull products
    const { data: products, error: pErr } = await supabase.from('products').select('*')
    if (!pErr && products) {
      for (const p of products) {
        await localDB.products.put({
          id: p.id,
          name: p.name,
          nameAr: p.name_ar,
          sku: p.sku,
          barcode: p.barcode,
          categoryId: p.category_id,
          purchaseCost: p.purchase_cost || 0,
          sellingPrice: p.selling_price || 0,
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
        downloaded++
      }
    }

    // Pull customers
    const { data: customers, error: cErr } = await supabase.from('customers').select('*')
    if (!cErr && customers) {
      for (const c of customers) {
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
        downloaded++
      }
    }

    return {
      success: true,
      downloaded,
      message: `تم تحميل ${downloaded} سجل من Supabase`,
    }
  } catch (e: any) {
    return { success: false, downloaded: 0, message: e.message }
  }
}
