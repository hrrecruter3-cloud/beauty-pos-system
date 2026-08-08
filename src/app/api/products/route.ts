import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/products - list with search, filter, include stock
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const categoryId = searchParams.get('categoryId')
    const barcode = searchParams.get('barcode')
    const lowStock = searchParams.get('lowStock') === 'true'
    const active = searchParams.get('active')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Barcode quick lookup
    if (barcode) {
      const product = await db.product.findFirst({
        where: { OR: [{ barcode }, { barcodes: { contains: barcode } }] },
        include: { category: true, brand: true, unit: true, stockLevels: true }
      })
      if (!product) return successResponse(null, 'المنتج غير موجود')
      return successResponse(product)
    }

    const where: any = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nameAr: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ]
    }
    if (categoryId) where.categoryId = categoryId
    if (active !== null && active !== undefined) where.active = active === 'true'

    let products = await db.product.findMany({
      where,
      include: {
        category: true, brand: true, unit: true, supplier: true,
        stockLevels: { include: { warehouse: true } }
      },
      take: limit,
      orderBy: { name: 'asc' }
    })

    if (lowStock) {
      products = products.filter(p => {
        const stock = p.stockLevels.reduce((s, l) => s + l.quantity, 0)
        return stock <= p.reorderLevel
      })
    }

    // Compute current stock
    const result = products.map(p => ({
      ...p,
      currentStock: p.stockLevels.reduce((s, l) => s + l.quantity, 0),
    }))

    return successResponse(result)
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

// POST /api/products - create
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, nameAr, sku, barcode, categoryId, brandId, unitId, supplierId,
      purchaseCost, sellingPrice, wholesalePrice, taxRate, minStock, reorderLevel,
      openingStock, image, description, active } = body

    if (!name || !sku) return errorResponse('الاسم ورمز SKU مطلوبان')

    // Check unique SKU
    const exists = await db.product.findUnique({ where: { sku } })
    if (exists) return errorResponse('رمز SKU مستخدم بالفعل', 409)

    const product = await db.product.create({
      data: {
        name, nameAr, sku, barcode, categoryId, brandId, unitId, supplierId,
        purchaseCost: parseFloat(purchaseCost) || 0,
        sellingPrice: parseFloat(sellingPrice) || 0,
        wholesalePrice: parseFloat(wholesalePrice) || 0,
        taxRate: parseFloat(taxRate) || 0,
        minStock: parseInt(minStock) || 0,
        reorderLevel: parseInt(reorderLevel) || 0,
        avgCost: parseFloat(purchaseCost) || 0,
        image, description, active: active !== false,
      }
    })

    // Create opening stock if provided
    if (openingStock && openingStock > 0) {
      const warehouse = await db.warehouse.findFirst()
      if (warehouse) {
        await db.stockLevel.create({
          data: { productId: product.id, warehouseId: warehouse.id, quantity: openingStock }
        })
        await db.stockMovement.create({
          data: { productId: product.id, warehouseId: warehouse.id,
            type: 'OPENING_STOCK', quantity: openingStock, refType: 'Opening' }
        })
      }
    }

    return successResponse(product, 'تم إنشاء المنتج بنجاح')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
