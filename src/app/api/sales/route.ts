import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/sales - list with filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const customerId = searchParams.get('customerId')
    const userId = searchParams.get('userId')
    const paymentMethod = searchParams.get('paymentMethod')
    const period = searchParams.get('period') // today, week, month
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = { held: false }
    if (search) {
      where.OR = [{ invoiceNumber: { contains: search } }]
    }
    if (customerId) where.customerId = customerId
    if (userId) where.userId = userId
    if (paymentMethod) where.paymentMethod = paymentMethod

    const now = new Date()
    if (period === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      where.createdAt = { gte: start }
    } else if (period === 'week') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      where.createdAt = { gte: start }
    } else if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      where.createdAt = { gte: start }
    } else if (dateFrom && dateTo) {
      where.createdAt = { gte: new Date(dateFrom), lte: new Date(dateTo) }
    }

    const sales = await db.sale.findMany({
      where,
      include: {
        customer: true, user: true, items: { include: { product: true } },
      },
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    return successResponse(sales)
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

// POST /api/sales - create a sale (atomic transaction)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { items, customerId, userId, discountAmount, discountType,
      paymentMethod, paymentDetails, paidAmount, note, loyaltyRedeem } = body

    if (!items || items.length === 0) return errorResponse('لا توجد أصناف في الفاتورة')
    if (!userId) return errorResponse('المستخدم مطلوب')

    // Get warehouse
    const warehouse = await db.warehouse.findFirst()
    if (!warehouse) return errorResponse('لا يوجد مخزن', 500)

    // Validate stock & compute totals
    let subtotal = 0
    let taxAmount = 0
    const saleItemsData: any[] = []

    for (const item of items) {
      const product = await db.product.findUnique({
        where: { id: item.productId },
        include: { stockLevels: true }
      })
      if (!product) return errorResponse(`المنتج غير موجود`, 404)

      const currentStock = product.stockLevels
        .filter(s => s.warehouseId === warehouse.id)
        .reduce((s, l) => s + l.quantity, 0)

      if (!product.allowNegativeStock && currentStock < item.quantity) {
        return errorResponse(`المخزون غير كافي للمنتج: ${product.nameAr || product.name} (متاح: ${currentStock})`)
      }

      const lineTotal = product.sellingPrice * item.quantity
      const lineTax = lineTotal * (product.taxRate / 100)
      subtotal += lineTotal
      taxAmount += lineTax

      saleItemsData.push({
        productId: product.id, quantity: item.quantity,
        unitPrice: product.sellingPrice, discountAmount: 0,
        taxAmount: lineTax, total: lineTotal + lineTax,
        costAtSale: product.avgCost,
      })
    }

    const discAmt = parseFloat(discountAmount) || 0
    const total = subtotal - discAmt + taxAmount
    const paid = parseFloat(paidAmount) || total
    const change = Math.max(0, paid - total)

    // Generate invoice number - find the max existing number
    const allSales = await db.sale.findMany({ select: { invoiceNumber: true } })
    let maxNum = 1000
    for (const s of allSales) {
      const m = s.invoiceNumber.match(/INV-(\d+)/)
      if (m) {
        const n = parseInt(m[1])
        if (n > maxNum) maxNum = n
      }
    }
    const invoiceNumber = `INV-${maxNum + 1}`

    // Loyalty calculation
    let loyaltyEarned = 0
    let loyaltyRedeemed = 0
    if (customerId && !loyaltyRedeem) {
      const setting = await db.setting.findUnique({ where: { key: 'loyalty.pointsPerEgp' } })
      const rate = setting ? parseFloat(setting.value) : 0.1
      loyaltyEarned = Math.floor(total * rate)
    }
    if (loyaltyRedeem && customerId) {
      const acct = await db.loyaltyAccount.findUnique({ where: { customerId } })
      if (!acct || acct.points < loyaltyRedeem) {
        return errorResponse('نقاط الولاء غير كافية', 400)
      }
      const redeemSetting = await db.setting.findUnique({ where: { key: 'loyalty.egpPerPoint' } })
      const egpPerPoint = redeemSetting ? parseFloat(redeemSetting.value) : 0.05
      loyaltyRedeemed = loyaltyRedeem
      // The discount from loyalty is already in discountAmount or we add it
    }

    // Use a transaction to ensure atomicity
    const sale = await db.$transaction(async (tx) => {
      // Create sale
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber, customerId: customerId || null, userId,
          subtotal, discountAmount: discAmt, discountType: discountType || null,
          taxAmount, total, paidAmount: paid, changeAmount: change,
          status: 'COMPLETED', paymentMethod: paymentMethod || 'CASH',
          paymentDetails: JSON.stringify(paymentDetails || {}),
          loyaltyEarned, loyaltyRedeemed, note,
          items: { create: saleItemsData },
          payments: { create: (paymentDetails?.splits || [{ method: paymentMethod || 'CASH', amount: total }])
            .map((p: any) => ({ method: p.method, amount: parseFloat(p.amount) })) },
        },
        include: { items: true }
      })

      // Deduct stock & create movements
      for (const item of saleItemsData) {
        await tx.stockLevel.updateMany({
          where: { productId: item.productId, warehouseId: warehouse.id },
          data: { quantity: { decrement: item.quantity } }
        })
        await tx.stockMovement.create({
          data: { productId: item.productId, warehouseId: warehouse.id,
            type: 'SALE', quantity: -item.quantity, refType: 'Sale', refId: newSale.id }
        })
      }

      // Loyalty
      if (customerId) {
        if (loyaltyEarned > 0) {
          await tx.loyaltyAccount.upsert({
            where: { customerId },
            create: { customerId, points: loyaltyEarned, totalEarned: loyaltyEarned },
            update: { points: { increment: loyaltyEarned }, totalEarned: { increment: loyaltyEarned } }
          })
          await tx.loyaltyTransaction.create({
            data: { customerId, type: 'EARN', points: loyaltyEarned,
              refType: 'Sale', refId: newSale.id, note: `نقاط من ${invoiceNumber}` }
          })
        }
        if (loyaltyRedeemed > 0) {
          await tx.loyaltyAccount.update({
            where: { customerId },
            data: { points: { decrement: loyaltyRedeemed }, totalRedeemed: { increment: loyaltyRedeemed } }
          })
          await tx.loyaltyTransaction.create({
            data: { customerId, type: 'REDEEM', points: -loyaltyRedeemed,
              refType: 'Sale', refId: newSale.id, note: `استبدال نقاط من ${invoiceNumber}` }
          })
        }
      }

      // Cash movement
      if (paymentMethod === 'CASH' || (paymentDetails?.splits || []).some((s:any) => s.method === 'CASH')) {
        const cashSession = await tx.cashSession.findFirst({ where: { status: 'OPEN' } })
        if (cashSession) {
          await tx.cashMovement.create({
            data: { sessionId: cashSession.id, type: 'SALE', amount: total,
              refType: 'Sale', refId: newSale.id, note: invoiceNumber }
          })
        }
      }

      // Audit log
      await tx.auditLog.create({
        data: { userId, action: 'SALE_CREATED', entity: 'Sale', entityId: newSale.id,
          after: JSON.stringify({ invoiceNumber, total }) }
      })

      return newSale
    })

    return successResponse(sale, 'تم إنشاء الفاتورة بنجاح')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
