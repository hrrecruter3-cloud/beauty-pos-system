import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/cash/movement
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, type, amount, note, userId, refType, refId } = body

    if (!sessionId) return errorResponse('رقم الجلسة مطلوب')
    if (!type) return errorResponse('النوع مطلوب')
    if (!['CASH_IN', 'CASH_OUT'].includes(type)) {
      return errorResponse('النوع غير صالح (CASH_IN أو CASH_OUT فقط)', 400)
    }
    if (!amount || amount <= 0) return errorResponse('المبلغ يجب أن يكون أكبر من صفر')

    const session = await db.cashSession.findUnique({ where: { id: sessionId } })
    if (!session) return errorResponse('الجلسة غير موجودة', 404)
    if (session.status !== 'OPEN') return errorResponse('الجلسة ليست مفتوحة', 400)

    const movement = await db.cashMovement.create({
      data: {
        sessionId,
        type,
        amount: parseFloat(amount),
        note: note || null,
        refType: refType || null,
        refId: refId || null,
      },
    })

    // Audit log
    if (userId) {
      await db.auditLog.create({
        data: {
          userId,
          action: type === 'CASH_IN' ? 'CASH_IN' : 'CASH_OUT',
          entity: 'CashMovement',
          entityId: movement.id,
          after: JSON.stringify({ sessionId, type, amount }),
        },
      })
    }

    return successResponse(movement, type === 'CASH_IN' ? 'تم إضافة نقدية' : 'تم سحب نقدية')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
