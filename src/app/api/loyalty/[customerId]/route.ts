import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/loyalty/[customerId] - customer loyalty account + transactions
export async function GET(req: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  try {
    const { customerId } = await params

    const account = await db.loyaltyAccount.findUnique({
      where: { customerId },
      include: { customer: true },
    })
    if (!account) return errorResponse('حساب الولاء غير موجود', 404)

    const transactions = await db.loyaltyTransaction.findMany({
      where: { customerId },
      take: 50,
      orderBy: { createdAt: 'desc' },
    })

    const tier = await db.loyaltyTier.findFirst({ where: { name: account.tier } })

    return successResponse({
      ...account,
      tierInfo: tier,
      transactions,
    })
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
