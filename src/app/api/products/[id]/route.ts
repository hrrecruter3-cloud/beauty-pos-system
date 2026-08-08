import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await db.product.findUnique({
    where: { id },
    include: {
      category: true, brand: true, unit: true, supplier: true,
      stockLevels: { include: { warehouse: true } },
      stockMovements: { take: 20, orderBy: { createdAt: 'desc' } },
    }
  })
  if (!product) return errorResponse('المنتج غير موجود', 404)
  return successResponse({ ...product, currentStock: product.stockLevels.reduce((s, l) => s + l.quantity, 0) })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { name, nameAr, sku, barcode, categoryId, brandId, unitId, supplierId,
    purchaseCost, sellingPrice, wholesalePrice, taxRate, minStock, reorderLevel,
    image, description, active } = body

  if (sku) {
    const exists = await db.product.findFirst({ where: { sku, NOT: { id } } })
    if (exists) return errorResponse('رمز SKU مستخدم بالفعل', 409)
  }

  const product = await db.product.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(nameAr !== undefined && { nameAr }),
      ...(sku !== undefined && { sku }),
      ...(barcode !== undefined && { barcode }),
      ...(categoryId !== undefined && { categoryId: categoryId || null }),
      ...(brandId !== undefined && { brandId: brandId || null }),
      ...(unitId !== undefined && { unitId: unitId || null }),
      ...(supplierId !== undefined && { supplierId: supplierId || null }),
      ...(purchaseCost !== undefined && { purchaseCost: parseFloat(purchaseCost) }),
      ...(sellingPrice !== undefined && { sellingPrice: parseFloat(sellingPrice) }),
      ...(wholesalePrice !== undefined && { wholesalePrice: parseFloat(wholesalePrice) }),
      ...(taxRate !== undefined && { taxRate: parseFloat(taxRate) }),
      ...(minStock !== undefined && { minStock: parseInt(minStock) }),
      ...(reorderLevel !== undefined && { reorderLevel: parseInt(reorderLevel) }),
      ...(image !== undefined && { image }),
      ...(description !== undefined && { description }),
      ...(active !== undefined && { active }),
    }
  })
  return successResponse(product, 'تم تحديث المنتج')
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Soft delete - deactivate
  const product = await db.product.update({
    where: { id }, data: { active: false }
  })
  return successResponse(product, 'تم أرشفة المنتج')
}
