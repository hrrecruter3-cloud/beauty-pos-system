'use client'

import Dexie, { Table } from 'dexie'

// ============================================================
// OFFLINE-FIRST LOCAL DATABASE (Dexie / IndexedDB)
// ============================================================
// This is a COMPLETE local database that mirrors the server schema.
// On first install, it pulls ALL data from the server API and stores it locally.
// The POS works 100% offline - sales, stock updates, loyalty all work locally.
// When online, the Sync Engine pushes local changes to Supabase and pulls remote updates.
// ============================================================

export interface LocalProduct {
  id: string
  name: string
  nameAr?: string
  sku: string
  barcode?: string
  barcodes?: string
  categoryId?: string
  brandId?: string
  unitId?: string
  supplierId?: string
  purchaseCost: number
  sellingPrice: number
  wholesalePrice: number
  taxRate: number
  minStock: number
  reorderLevel: number
  trackStock: boolean
  allowNegativeStock: boolean
  avgCost: number
  image?: string
  description?: string
  active: boolean
  currentStock: number
  lastSynced: number
  // For offline stock tracking
  pendingStockDelta?: number
}

export interface LocalCategory {
  id: string
  name: string
  nameAr?: string
  parentId?: string
  color?: string
  icon?: string
  lastSynced: number
}

export interface LocalCustomer {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  birthday?: string
  tier: string
  active: boolean
  loyaltyPoints: number
  totalEarned: number
  totalRedeemed: number
  lastSynced: number
}

export interface LocalSale {
  id: string // UUID generated locally
  invoiceNumber: string
  items: LocalSaleItem[]
  customerId?: string
  customerName?: string
  userId: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  paidAmount: number
  changeAmount: number
  paymentMethod: string
  paymentDetails?: string
  loyaltyEarned: number
  loyaltyRedeemed: number
  note?: string
  createdAt: string
  // Sync tracking
  syncStatus: 'PENDING' | 'SYNCED' | 'FAILED' | 'CONFLICT'
  syncError?: string
  syncAttempts: number
  lastSyncedAt?: number
}

export interface LocalSaleItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  taxRate: number
  total: number
  costAtSale: number
}

export interface LocalStockMovement {
  id: string
  productId: string
  type: string // SALE, PURCHASE, RETURN, ADJUSTMENT
  quantity: number
  refType?: string
  refId?: string
  note?: string
  createdAt: string
  syncStatus: 'PENDING' | 'SYNCED' | 'FAILED'
}

export interface LocalLoyaltyTransaction {
  id: string
  customerId: string
  type: string // EARN, REDEEM, REVERSE
  points: number
  refType?: string
  refId?: string
  note?: string
  createdAt: string
  syncStatus: 'PENDING' | 'SYNCED' | 'FAILED'
}

export interface LocalSetting {
  key: string
  value: string
  category: string
  lastSynced: number
}

export interface LocalUser {
  id: string
  username: string
  name: string
  role: string
  permissions: string[]
  phone?: string
  pin?: string
  lastSynced: number
}

export interface SyncQueueItem {
  id?: number
  entityType: string // Sale, StockMovement, LoyaltyTransaction, etc.
  entityId: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  payload: string // JSON
  status: 'PENDING' | 'SYNCED' | 'FAILED' | 'CONFLICT'
  attempts: number
  maxAttempts: number
  error?: string
  createdAt: number
  syncedAt?: number
  // For idempotency - server will use this to prevent duplicates
  clientId: string
}

class BeautyPOSDatabase extends Dexie {
  products!: Table<LocalProduct, string>
  categories!: Table<LocalCategory, string>
  customers!: Table<LocalCustomer, string>
  sales!: Table<LocalSale, string>
  stockMovements!: Table<LocalStockMovement, string>
  loyaltyTransactions!: Table<LocalLoyaltyTransaction, string>
  settings!: Table<LocalSetting, string>
  users!: Table<LocalUser, string>
  syncQueue!: Table<SyncQueueItem, number>

  constructor() {
    super('BeautyPOSDB_v2')
    this.version(1).stores({
      // Primary keys + indexed fields for fast queries
      products: 'id, sku, barcode, name, nameAr, categoryId, active, lastSynced',
      categories: 'id, name, nameAr, parentId, lastSynced',
      customers: 'id, name, phone, email, tier, active, lastSynced',
      sales: 'id, invoiceNumber, createdAt, syncStatus, customerId, userId',
      stockMovements: 'id, productId, type, createdAt, syncStatus',
      loyaltyTransactions: 'id, customerId, type, createdAt, syncStatus',
      settings: 'key, category, lastSynced',
      users: 'id, username, role, lastSynced',
      syncQueue: '++id, entityType, entityId, status, createdAt, syncedAt, clientId',
    })
  }
}

export const localDB = new BeautyPOSDatabase()

// ============================================================
// INITIALIZATION - First install builds complete local DB
// ============================================================

let initPromise: Promise<void> | null = null
let isInitialized = false

export async function initLocalDB(): Promise<void> {
  if (isInitialized) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      console.log('[LocalDB] Starting initialization...')
      const productCount = await localDB.products.count()

      if (productCount === 0) {
        console.log('[LocalDB] First install detected - building local database from server...')
        await pullAllFromServer()
      } else {
        console.log(`[LocalDB] Local DB has ${productCount} products, checking for updates...`)
        // Quick sync - just get recent changes
        await syncRecentChanges()
      }

      isInitialized = true
      console.log('[LocalDB] Initialization complete')
    } catch (e) {
      console.error('[LocalDB] Init error:', e)
      // Don't throw - allow offline mode even if sync fails
    }
  })()

  return initPromise
}

// Pull ALL data from server to build complete local DB
async function pullAllFromServer() {
  const token = getAuthToken()

  // Fetch all data in parallel
  const [productsRes, categoriesRes, customersRes, settingsRes, usersRes] = await Promise.all([
    fetch('/api/products?limit=1000', token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    fetch('/api/categories', token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    fetch('/api/customers?limit=1000', token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    fetch('/api/settings', token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    fetch('/api/auth/me', token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  ])

  const now = Date.now()

  // Products
  if (productsRes.ok) {
    const data = await productsRes.json()
    if (data.success && data.data) {
      const products: LocalProduct[] = data.data.map((p: any) => ({
        ...p,
        currentStock: p.currentStock ?? (p.stockLevels?.reduce((s: number, l: any) => s + l.quantity, 0) || 0),
        lastSynced: now,
        pendingStockDelta: 0,
      }))
      await localDB.products.bulkPut(products)
      console.log(`[LocalDB] Cached ${products.length} products`)
    }
  }

  // Categories
  if (categoriesRes.ok) {
    const data = await categoriesRes.json()
    if (data.success && data.data) {
      const categories: LocalCategory[] = data.data.map((c: any) => ({ ...c, lastSynced: now }))
      await localDB.categories.bulkPut(categories)
      console.log(`[LocalDB] Cached ${categories.length} categories`)
    }
  }

  // Customers
  if (customersRes.ok) {
    const data = await customersRes.json()
    if (data.success && data.data) {
      const customers: LocalCustomer[] = data.data.map((c: any) => ({
        id: c.id, name: c.name, phone: c.phone, email: c.email,
        address: c.address, notes: c.notes, birthday: c.birthday,
        tier: c.tier || 'BRONZE', active: c.active !== false,
        loyaltyPoints: c.loyaltyAccount?.points || 0,
        totalEarned: c.loyaltyAccount?.totalEarned || 0,
        totalRedeemed: c.loyaltyAccount?.totalRedeemed || 0,
        lastSynced: now,
      }))
      await localDB.customers.bulkPut(customers)
      console.log(`[LocalDB] Cached ${customers.length} customers`)
    }
  }

  // Settings
  if (settingsRes.ok) {
    const data = await settingsRes.json()
    if (data.success && data.data?.flat) {
      const settings: LocalSetting[] = data.data.flat.map((s: any) => ({
        key: s.key, value: s.value, category: s.category, lastSynced: now,
      }))
      await localDB.settings.bulkPut(settings)
      console.log(`[LocalDB] Cached ${settings.length} settings`)
    }
  }

  // Current user (for offline auth)
  if (usersRes.ok) {
    const data = await usersRes.json()
    if (data.success && data.data) {
      const user: LocalUser = { ...data.data, lastSynced: now }
      await localDB.users.put(user)
    }
  }
}

// Sync only recent changes (delta sync)
async function syncRecentChanges() {
  // Get last synced timestamp
  const oldestSync = await localDB.products.orderBy('lastSynced').first()
  const since = oldestSync?.lastSynced || 0

  // For now, do a full product refresh if online
  // In production, this would use a /api/sync/changes?since=timestamp endpoint
  try {
    const token = getAuthToken()
    const res = await fetch('/api/products?limit=1000', token ? { headers: { Authorization: `Bearer ${token}` } } : {})
    if (res.ok) {
      const data = await res.json()
      if (data.success && data.data) {
        const now = Date.now()
        const products: LocalProduct[] = data.data.map((p: any) => ({
          ...p,
          currentStock: p.currentStock ?? (p.stockLevels?.reduce((s: number, l: any) => s + l.quantity, 0) || 0),
          lastSynced: now,
        }))
        await localDB.products.bulkPut(products)
      }
    }
  } catch (e) {
    console.error('[LocalDB] Delta sync error:', e)
  }
}

function getAuthToken(): string | null {
  try {
    const stored = localStorage.getItem('pos-auth')
    if (stored) {
      const parsed = JSON.parse(stored)
      return parsed.state?.token || null
    }
  } catch (e) {
    // ignore
  }
  return null
}

// ============================================================
// OFFLINE QUERIES - Fast local lookups
// ============================================================

export async function searchLocalProducts(query: string, categoryId?: string): Promise<LocalProduct[]> {
  const all = await localDB.products.toArray()
  let results = all.filter(p => p.active !== false)

  if (query) {
    const q = query.toLowerCase()
    results = results.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.nameAr?.includes(query) ||
      p.barcode?.includes(query) ||
      p.sku?.toLowerCase().includes(q)
    )
  }

  if (categoryId) {
    results = results.filter(p => p.categoryId === categoryId)
  }

  return results.slice(0, 200)
}

export async function findProductByBarcode(barcode: string): Promise<LocalProduct | undefined> {
  return localDB.products.where('barcode').equals(barcode).first()
}

export async function findProductById(id: string): Promise<LocalProduct | undefined> {
  return localDB.products.get(id)
}

export async function getAllCategories(): Promise<LocalCategory[]> {
  return localDB.categories.toArray()
}

export async function searchLocalCustomers(query: string): Promise<LocalCustomer[]> {
  const all = await localDB.customers.toArray()
  if (!query) return all.filter(c => c.active !== false).slice(0, 100)
  const q = query.toLowerCase()
  return all.filter(c =>
    c.active !== false && (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(query) ||
      c.email?.toLowerCase().includes(q)
    )
  ).slice(0, 100)
}

export async function getLocalCustomerById(id: string): Promise<LocalCustomer | undefined> {
  return localDB.customers.get(id)
}

export async function getLocalSales(limit = 100): Promise<LocalSale[]> {
  return localDB.sales.orderBy('createdAt').reverse().limit(limit).toArray()
}

export async function getPendingSyncCount(): Promise<number> {
  return localDB.syncQueue.where('status').equals('PENDING').count()
}

export async function getLocalSetting(key: string): Promise<string | null> {
  const setting = await localDB.settings.get(key)
  return setting?.value || null
}

// ============================================================
// OFFLINE WRITE OPERATIONS - Create sales, update stock, etc.
// ============================================================

// Generate UUID for local records
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Create a sale OFFLINE - saves to local DB and queues for sync
export async function createLocalSale(saleData: {
  items: LocalSaleItem[]
  customerId?: string
  customerName?: string
  userId: string
  discountAmount: number
  taxAmount: number
  total: number
  paidAmount: number
  paymentMethod: string
  paymentDetails?: string
  loyaltyEarned: number
  loyaltyRedeemed: number
  note?: string
}): Promise<LocalSale> {
  const now = new Date().toISOString()
  const saleId = generateUUID()
  const invoiceNumber = `LOCAL-${Date.now()}`
  const subtotal = saleData.items.reduce((s, i) => s + i.total, 0) - saleData.taxAmount
  const changeAmount = Math.max(0, saleData.paidAmount - saleData.total)

  const sale: LocalSale = {
    id: saleId,
    invoiceNumber,
    items: saleData.items,
    customerId: saleData.customerId,
    customerName: saleData.customerName,
    userId: saleData.userId,
    subtotal,
    discountAmount: saleData.discountAmount,
    taxAmount: saleData.taxAmount,
    total: saleData.total,
    paidAmount: saleData.paidAmount,
    changeAmount,
    paymentMethod: saleData.paymentMethod,
    paymentDetails: saleData.paymentDetails,
    loyaltyEarned: saleData.loyaltyEarned,
    loyaltyRedeemed: saleData.loyaltyRedeemed,
    note: saleData.note,
    createdAt: now,
    syncStatus: 'PENDING',
    syncAttempts: 0,
  }

  // Save sale to local DB
  await localDB.sales.put(sale)

  // Update local stock (decrement)
  for (const item of saleData.items) {
    const product = await localDB.products.get(item.productId)
    if (product) {
      product.currentStock -= item.quantity
      product.pendingStockDelta = (product.pendingStockDelta || 0) - item.quantity
      await localDB.products.put(product)
    }

    // Create stock movement
    const movement: LocalStockMovement = {
      id: generateUUID(),
      productId: item.productId,
      type: 'SALE',
      quantity: -item.quantity,
      refType: 'Sale',
      refId: saleId,
      note: invoiceNumber,
      createdAt: now,
      syncStatus: 'PENDING',
    }
    await localDB.stockMovements.put(movement)
  }

  // Update customer loyalty
  if (saleData.customerId && saleData.loyaltyEarned > 0) {
    const customer = await localDB.customers.get(saleData.customerId)
    if (customer) {
      customer.loyaltyPoints += saleData.loyaltyEarned
      customer.totalEarned += saleData.loyaltyEarned
      await localDB.customers.put(customer)
    }

    const loyaltyTxn: LocalLoyaltyTransaction = {
      id: generateUUID(),
      customerId: saleData.customerId,
      type: 'EARN',
      points: saleData.loyaltyEarned,
      refType: 'Sale',
      refId: saleId,
      note: `نقاط من ${invoiceNumber}`,
      createdAt: now,
      syncStatus: 'PENDING',
    }
    await localDB.loyaltyTransactions.put(loyaltyTxn)
  }

  // Queue for sync
  await localDB.syncQueue.add({
    entityType: 'Sale',
    entityId: saleId,
    operation: 'CREATE',
    payload: JSON.stringify({
      ...sale,
      // Include original server-format data for the API
      items: saleData.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      userId: saleData.userId,
      customerId: saleData.customerId,
      discountAmount: saleData.discountAmount,
      paymentMethod: saleData.paymentMethod,
      paymentDetails: saleData.paymentDetails ? JSON.parse(saleData.paymentDetails) : undefined,
      paidAmount: saleData.paidAmount,
      loyaltyRedeem: saleData.loyaltyRedeemed,
      note: saleData.note,
      // Important: client-generated ID for idempotency
      clientId: saleId,
    }),
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 5,
    createdAt: Date.now(),
    clientId: saleId,
  })

  console.log(`[LocalDB] Sale created offline: ${invoiceNumber}`)
  return sale
}

// ============================================================
// MAINTENANCE
// ============================================================

export async function clearLocalDB() {
  await localDB.products.clear()
  await localDB.categories.clear()
  await localDB.customers.clear()
  await localDB.sales.clear()
  await localDB.stockMovements.clear()
  await localDB.loyaltyTransactions.clear()
  await localDB.settings.clear()
  await localDB.users.clear()
  await localDB.syncQueue.clear()
  isInitialized = false
  initPromise = null
}

export async function refreshLocalData() {
  await clearLocalDB()
  await initLocalDB()
}

export async function getLocalDBStats() {
  const [products, categories, customers, sales, pendingSync, stockMovements, loyaltyTxns] = await Promise.all([
    localDB.products.count(),
    localDB.categories.count(),
    localDB.customers.count(),
    localDB.sales.count(),
    getPendingSyncCount(),
    localDB.stockMovements.count(),
    localDB.loyaltyTransactions.count(),
  ])
  return { products, categories, customers, sales, pendingSync, stockMovements, loyaltyTxns }
}
