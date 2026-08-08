import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/inventory/adjust - adjust stock
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { productId, warehouseId, newQuantity, reason, note, userId } = body

    if (!productId) return errorResponse('المنتج مطلوب')
    if (!warehouseId) return errorResponse('المخزن مطلوب')
    if (newQuantity === undefined || newQuantity === null)
      return errorResponse('الكمية الجديدة مطلوبة')
    if (!reason) return errorResponse('سبب التعديل مطلوب')

    const result = await db.$transaction(async (tx) => {
      // Get current stock level
      let stockLevel = await tx.stockLevel.findUnique({
        where: {
          productId_warehouseId: { productId, warehouseId },
        },
      })

      const oldQuantity = stockLevel?.quantity || 0
      const diff = (parseInt(newQuantity) || 0) - oldQuantity

      // Upsert stock level
      stockLevel = await tx.stockLevel.upsert({
        where: { productId_warehouseId: { productId, warehouseId } },
        update: { quantity: parseInt(newQuantity) || 0 },
        create: {
          productId,
          warehouseId,
          quantity: parseInt(newQuantity) || 0,
        },
      })

      // Create adjustment record
      const adjustment = await tx.stockAdjustment.create({
        data: {
          productId,
          warehouseId,
          oldQuantity,
          newQuantity: parseInt(newQuantity) || 0,
          reason,
          note: note || null,
          userId: userId || null,
        },
      })

      // Create stock movement
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          warehouseId,
          type: 'ADJUSTMENT',
          quantity: diff,
          refType: 'StockAdjustment',
          refId: adjustment.id,
          note: note || reason,
          userId: userId || null,
        },
      })

      // Audit log
      if (userId) {
        await tx.auditLog.create({
          data: {
            userId,
            action: 'STOCK_ADJUSTMENT',
            entity: 'StockLevel',
            entityId: stockLevel.id,
            before: JSON.stringify({ quantity: oldQuantity }),
            after: JSON.stringify({ quantity: parseInt(newQuantity) || 0 }),
          },
        })
      }

      return { stockLevel, adjustment, movement }
    })

    return successResponse(result, 'تم تعديل المخزون بنجاح')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
