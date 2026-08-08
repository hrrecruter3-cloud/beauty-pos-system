import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/cash/open
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, registerId, openingBalance } = body

    if (!userId) return errorResponse('المستخدم مطلوب')

    // Check for existing open session for this user
    const existingOpen = await db.cashSession.findFirst({
      where: { userId, status: 'OPEN' },
    })
    if (existingOpen) {
      return errorResponse('يوجد جلسة كاش مفتوحة بالفعل لهذا المستخدم', 409)
    }

    // Resolve register
    let regId = registerId
    if (!regId) {
      const register = await db.register.findFirst({ where: { active: true } })
      if (!register) return errorResponse('لا يوجد درج نقدية. أنشئ درج أولاً', 500)
      regId = register.id
    } else {
      const r = await db.register.findUnique({ where: { id: regId } })
      if (!r) return errorResponse('الدرج غير موجود', 404)
    }

    const opening = parseFloat(openingBalance) || 0

    const session = await db.$transaction(async (tx) => {
      const newSession = await tx.cashSession.create({
        data: {
          registerId: regId,
          userId,
          openingBalance: opening,
          status: 'OPEN',
        },
        include: {
          user: { select: { id: true, name: true, username: true } },
          register: true,
        },
      })

      // Create OPENING movement
      await tx.cashMovement.create({
        data: {
          sessionId: newSession.id,
          type: 'OPENING',
          amount: opening,
          note: 'رصيد افتتاحي',
        },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CASH_OPENED',
          entity: 'CashSession',
          entityId: newSession.id,
          after: JSON.stringify({ openingBalance: opening }),
        },
      })

      return newSession
    })

    return successResponse(session, 'تم فتح درج الكاش')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
