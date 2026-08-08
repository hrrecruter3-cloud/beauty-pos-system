'use client'

import Dexie, { Table } from 'dexie'

// Offline-first local database using IndexedDB (Dexie)
// This stores a local copy of products, customers, and pending transactions
// so the POS can work completely offline

export interface LocalProduct {
  id: string
  name: string
  nameAr?: string
  sku: string
  barcode?: string
  categoryId?: string
  brandId?: string
  unitId?: string
  sellingPrice: number
  purchaseCost: number
  avgCost: number
  taxRate: number
  minStock: number
  reorderLevel: number
  allowNegativeStock: boolean
  image?: string
  active: boolean
  currentStock: number
  lastSynced: number
}

export interface LocalCustomer {
  id: string
  name: string
  phone?: string
  email?: string
  tier: string
  loyaltyPoints: number
  lastSynced: number
}

export interface LocalSale {
  id: string
  invoiceNumber: string
  items: any[]
  total: number
  paymentMethod: string
  customerId?: string
  userId: string
  createdAt: string
  synced: number // 0 = pending, 1 = synced
  syncError?: string
}

export interface LocalSyncQueue {
  id?: number
  entityType: string
  entityId: string
  operation: string
  payload: string
  status: string // PENDING, SYNCED, FAILED
  attempts: number
  error?: string
  createdAt: number
  syncedAt?: number
}

class POSDatabase extends Dexie {
  products!: Table<LocalProduct, string>
  customers!: Table<LocalCustomer, string>
  sales!: Table<LocalSale, string>
  syncQueue!: Table<LocalSyncQueue, number>

  constructor() {
    super('BeautyPOSDB')
    this.version(1).stores({
      products: 'id, sku, barcode, name, nameAr, active, lastSynced',
      customers: 'id, name, phone, tier, lastSynced',
      sales: 'id, invoiceNumber, createdAt, synced, customerId, userId',
      syncQueue: '++id, entityType, status, createdAt, syncedAt',
    })
  }
}

export const localDB = new POSDatabase()

// Initialize - check if local DB has data, if not, seed from API
export async function initLocalDB() {
  try {
    const productCount = await localDB.products.count()
    if (productCount === 0) {
      // Fetch from API and cache locally
      const res = await fetch('/api/products?limit=500')
      const data = await res.json()
      if (data.success && data.data) {
        const products: LocalProduct[] = data.data.map((p: any) => ({
          ...p,
          currentStock: p.currentStock ?? (p.stockLevels?.reduce((s: number, l: any) => s + l.quantity, 0) || 0),
          lastSynced: Date.now(),
        }))
        await localDB.products.bulkPut(products)
      }
    }

    const customerCount = await localDB.customers.count()
    if (customerCount === 0) {
      const res = await fetch('/api/customers?limit=500')
      const data = await res.json()
      if (data.success && data.data) {
        const customers: LocalCustomer[] = data.data.map((c: any) => ({
          ...c,
          loyaltyPoints: c.loyaltyAccount?.points || 0,
          lastSynced: Date.now(),
        }))
        await localDB.customers.bulkPut(customers)
      }
    }
  } catch (e) {
    console.error('Local DB init error:', e)
  }
}

// Search products locally (instant, offline)
export async function searchLocalProducts(query: string, categoryId?: string): Promise<LocalProduct[]> {
  let collection = localDB.products.where('active').equals(1 as any)
  
  // Dexie filter approach
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

// Find product by barcode (instant, offline)
export async function findProductByBarcode(barcode: string): Promise<LocalProduct | undefined> {
  return localDB.products.where('barcode').equals(barcode).first()
}

// Add sale to local DB (offline-capable)
export async function addLocalSale(sale: LocalSale) {
  await localDB.sales.put(sale)
  // Add to sync queue
  await localDB.syncQueue.add({
    entityType: 'Sale',
    entityId: sale.id,
    operation: 'CREATE',
    payload: JSON.stringify(sale),
    status: 'PENDING',
    attempts: 0,
    createdAt: Date.now(),
  })
}

// Get pending sync count
export async function getPendingSyncCount(): Promise<number> {
  return localDB.syncQueue.where('status').equals('PENDING').count()
}

// Update local stock (offline)
export async function updateLocalStock(productId: string, delta: number) {
  const product = await localDB.products.get(productId)
  if (product) {
    product.currentStock += delta
    await localDB.products.put(product)
  }
}

// Clear all local data (for reset)
export async function clearLocalDB() {
  await localDB.products.clear()
  await localDB.customers.clear()
  await localDB.sales.clear()
  await localDB.syncQueue.clear()
}

// Refresh local data from server
export async function refreshLocalData() {
  await clearLocalDB()
  await initLocalDB()
}
