import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/sales/[id]/refund - process a return/refund
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { items, reason, refundMethod, userId } = await req.json()

    const sale = await db.sale.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, customer: true }
    })
    if (!sale) return errorResponse('الفاتورة غير موجودة', 404)
    if (sale.status === 'REFUNDED') return errorResponse('الفاتورة مستردة بالكعل', 400)

    const warehouse = await db.warehouse.findFirst()
    if (!warehouse) return errorResponse('لا يوجد مخزن', 500)

    // Validate return quantities
    let refundTotal = 0
    let refundTax = 0
    let loyaltyReversed = 0
    const returnItems: any[] = []

    for (const ret of items) {
      const saleItem = sale.items.find(si => si.id === ret.saleItemId)
      if (!saleItem) return errorResponse('صنف غير موجود في الفاتورة', 400)
      if (ret.quantity > saleItem.quantity) {
        return errorResponse('كمية الإرجاع أكبر من المباعة', 400)
      }
      const lineTotal = (saleItem.total / saleItem.quantity) * ret.quantity
      refundTotal += lineTotal
      refundTax += (saleItem.taxAmount / saleItem.quantity) * ret.quantity
      returnItems.push({
        saleItemId: saleItem.id, productId: saleItem.productId,
        quantity: ret.quantity, unitPrice: saleItem.unitPrice, total: lineTotal
      })
    }

    // Reverse loyalty proportionally
    if (sale.loyaltyEarned > 0 && sale.customerId) {
      loyaltyReversed = Math.floor(sale.loyaltyEarned * (refundTotal / sale.total))
    }

    // Generate return number - find max existing
    const allReturns = await db.saleReturn.findMany({ select: { returnNumber: true } })
    let maxRetNum = 5000
    for (const r of allReturns) {
      const m = r.returnNumber.match(/RET-(\d+)/)
      if (m) {
        const n = parseInt(m[1])
        if (n > maxRetNum) maxRetNum = n
      }
    }
    const returnNumber = `RET-${maxRetNum + 1}`

    const result = await db.$transaction(async (tx) => {
      const saleReturn = await tx.saleReturn.create({
        data: {
          returnNumber, saleId: sale.id, userId,
          subtotal: refundTotal - refundTax, taxAmount: refundTax, total: refundTotal,
          refundMethod: refundMethod || 'CASH', reason, status: 'COMPLETED',
          loyaltyReversed,
          items: { create: returnItems }
        }
      })

      // Return stock
      for (const ret of returnItems) {
        await tx.stockLevel.updateMany({
          where: { productId: ret.productId, warehouseId: warehouse.id },
          data: { quantity: { increment: ret.quantity } }
        })
        await tx.stockMovement.create({
          data: { productId: ret.productId, warehouseId: warehouse.id,
            type: 'RETURN', quantity: ret.quantity, refType: 'SaleReturn', refId: saleReturn.id }
        })
      }

      // Reverse loyalty
      if (loyaltyReversed > 0 && sale.customerId) {
        await tx.loyaltyAccount.update({
          where: { customerId: sale.customerId },
          data: { points: { decrement: loyaltyReversed } }
        })
        await tx.loyaltyTransaction.create({
          data: { customerId: sale.customerId, type: 'REVERSE', points: -loyaltyReversed,
            refType: 'SaleReturn', refId: saleReturn.id, note: `عكس نقاط من ${returnNumber}` }
        })
      }

      // Cash movement for refund
      if (refundMethod === 'CASH') {
        const session = await tx.cashSession.findFirst({ where: { status: 'OPEN' } })
        if (session) {
          await tx.cashMovement.create({
            data: { sessionId: session.id, type: 'REFUND', amount: -refundTotal,
              refType: 'SaleReturn', refId: saleReturn.id, note: returnNumber }
          })
        }
      }

      // Update sale status
      await tx.sale.update({ where: { id: sale.id }, data: { status: 'PARTIAL_REFUND' } })

      await tx.auditLog.create({
        data: { userId, action: 'SALE_REFUNDED', entity: 'SaleReturn', entityId: saleReturn.id,
          before: JSON.stringify({ saleTotal: sale.total }),
          after: JSON.stringify({ refundTotal }) }
      })

      return saleReturn
    })

    return successResponse(result, 'تم معالجة المرتجع بنجاح')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
