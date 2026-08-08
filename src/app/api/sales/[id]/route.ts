import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      customer: true, user: true, register: true,
      items: { include: { product: true } },
      payments: true, returns: { include: { items: true } },
    }
  })
  if (!sale) return errorResponse('الفاتورة غير موجودة', 404)
  return successResponse(sale)
}
