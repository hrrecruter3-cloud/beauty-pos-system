import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/suppliers/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supplier = await db.supplier.findUnique({
      where: { id },
      include: {
        purchases: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { product: { select: { name: true, nameAr: true, sku: true } } } } },
        },
        products: { select: { id: true, name: true, nameAr: true, sku: true }, take: 50 },
      },
    })
    if (!supplier) return errorResponse('المورد غير موجود', 404)

    const totalPurchases = supplier.purchases.reduce((s, p) => s + p.total, 0)
    const totalPaid = supplier.purchases.reduce((s, p) => s + p.paidAmount, 0)

    return successResponse({
      ...supplier,
      summary: {
        totalPurchases,
        totalPaid,
        balance: supplier.balance,
        purchaseCount: supplier.purchases.length,
      },
    })
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

// PUT /api/suppliers/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, phone, email, address, taxId, balance } = body

    const existing = await db.supplier.findUnique({ where: { id } })
    if (!existing) return errorResponse('المورد غير موجود', 404)

    const supplier = await db.supplier.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(email !== undefined && { email: email || null }),
        ...(address !== undefined && { address: address || null }),
        ...(taxId !== undefined && { taxId: taxId || null }),
        ...(balance !== undefined && { balance: parseFloat(balance) }),
      },
    })

    return successResponse(supplier, 'تم تحديث المورد')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
