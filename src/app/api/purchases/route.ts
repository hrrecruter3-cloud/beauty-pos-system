import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/purchases - list with filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const supplierId = searchParams.get('supplierId')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = {}
    if (supplierId) where.supplierId = supplierId
    if (status) where.status = status
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    const purchases = await db.purchase.findMany({
      where,
      include: {
        supplier: true,
        user: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, nameAr: true, sku: true } } } },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(purchases)
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

// POST /api/purchases - create purchase
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      supplierId,
      warehouseId,
      userId,
      items,
      taxAmount,
      discountAmount,
      paidAmount,
      note,
    } = body

    if (!supplierId) return errorResponse('المورد مطلوب')
    if (!warehouseId) return errorResponse('المخزن مطلوب')
    if (!userId) return errorResponse('المستخدم مطلوب')
    if (!items || items.length === 0) return errorResponse('الأصناف مطلوبة')

    // Validate supplier & warehouse
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } })
    if (!supplier) return errorResponse('المورد غير موجود', 404)

    const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } })
    if (!warehouse) return errorResponse('المخزن غير موجود', 404)

    // Calculate subtotal and build items
    let subtotal = 0
    const purchaseItems: any[] = []

    for (const item of items) {
      const product = await db.product.findUnique({
        where: { id: item.productId },
        include: { stockLevels: { where: { warehouseId } } },
      })
      if (!product) return errorResponse(`المنتج غير موجود: ${item.productId}`, 404)

      const quantity = parseInt(item.quantity) || 0
      const unitCost = parseFloat(item.unitCost) || 0
      if (quantity <= 0) return errorResponse('الكمية يجب أن تكون أكبر من صفر')
      if (unitCost < 0) return errorResponse('التكلفة غير صالحة')

      const lineTotal = quantity * unitCost
      subtotal += lineTotal

      purchaseItems.push({
        productId: item.productId,
        quantity,
        unitCost,
        taxRate: product.taxRate,
        total: lineTotal,
        // store current avg cost + current stock for later use
        _currentStock: product.stockLevels.reduce((s, l) => s + l.quantity, 0),
        _currentAvgCost: product.avgCost,
      })
    }

    const tax = parseFloat(taxAmount) || 0
    const discount = parseFloat(discountAmount) || 0
    const total = subtotal + tax - discount
    const paid = parseFloat(paidAmount) || 0
    const balance = total - paid
    const status = paid >= total ? 'PAID' : paid > 0 ? 'PARTIAL' : 'RECEIVED'

    // Generate invoice number
    const lastPurchase = await db.purchase.findFirst({ orderBy: { createdAt: 'desc' } })
    let nextNum = 1001
    if (lastPurchase?.invoiceNumber) {
      const m = lastPurchase.invoiceNumber.match(/PUR-(\d+)/)
      if (m) nextNum = parseInt(m[1]) + 1
    }
    const invoiceNumber = `PUR-${nextNum}`

    const purchase = await db.$transaction(async (tx) => {
      // Create purchase with items
      const newPurchase = await tx.purchase.create({
        data: {
          invoiceNumber,
          supplierId,
          warehouseId,
          userId,
          subtotal,
          taxAmount: tax,
          discountAmount: discount,
          total,
          paidAmount: paid,
          status,
          note: note || null,
          items: {
            create: purchaseItems.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              unitCost: it.unitCost,
              taxRate: it.taxRate,
              total: it.total,
            })),
          },
        },
        include: { items: true },
      })

      // Increase stock, update avgCost, create movements
      for (const it of purchaseItems) {
        // Weighted average cost
        const oldStock = it._currentStock
        const oldAvg = it._currentAvgCost
        const newAvg =
          oldStock + it.quantity > 0
            ? (oldStock * oldAvg + it.quantity * it.unitCost) / (oldStock + it.quantity)
            : it.unitCost

        // Upsert stock level
        await tx.stockLevel.upsert({
          where: {
            productId_warehouseId: { productId: it.productId, warehouseId },
          },
          update: { quantity: { increment: it.quantity } },
          create: {
            productId: it.productId,
            warehouseId,
            quantity: it.quantity,
          },
        })

        // Update product avgCost and purchaseCost
        await tx.product.update({
          where: { id: it.productId },
          data: { avgCost: newAvg, purchaseCost: it.unitCost },
        })

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            productId: it.productId,
            warehouseId,
            type: 'PURCHASE',
            quantity: it.quantity,
            refType: 'Purchase',
            refId: newPurchase.id,
            note: `فاتورة شراء ${invoiceNumber}`,
            userId,
          },
        })
      }

      // Update supplier balance if not fully paid
      if (balance > 0) {
        await tx.supplier.update({
          where: { id: supplierId },
          data: { balance: { increment: balance } },
        })
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'PURCHASE_CREATED',
          entity: 'Purchase',
          entityId: newPurchase.id,
          after: JSON.stringify({ invoiceNumber, total, status }),
        },
      })

      return newPurchase
    })

    return successResponse(purchase, 'تم إنشاء فاتورة الشراء بنجاح')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
