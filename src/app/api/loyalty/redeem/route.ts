import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/loyalty/redeem - redeem points
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customerId, points, note } = body

    if (!customerId) return errorResponse('العميل مطلوب')
    if (!points || points <= 0) return errorResponse('النقاط يجب أن تكون أكبر من صفر')

    const account = await db.loyaltyAccount.findUnique({ where: { customerId } })
    if (!account) return errorResponse('حساب الولاء غير موجود', 404)
    if (account.points < points) {
      return errorResponse(`الرصيد غير كافي. المتاح: ${account.points} نقطة`)
    }

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.loyaltyAccount.update({
        where: { customerId },
        data: {
          points: { decrement: points },
          totalRedeemed: { increment: points },
        },
      })

      const txn = await tx.loyaltyTransaction.create({
        data: {
          customerId,
          type: 'REDEEM',
          points: -points,
          note: note || 'استبدال نقاط',
        },
      })

      return { account: updated, transaction: txn }
    })

    return successResponse(result, 'تم استبدال النقاط بنجاح')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
