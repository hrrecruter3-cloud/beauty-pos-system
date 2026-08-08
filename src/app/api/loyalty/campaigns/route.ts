import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/loyalty/campaigns
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const active = searchParams.get('active')

    const where: any = {}
    if (active !== null && active !== undefined) where.active = active === 'true'

    const campaigns = await db.loyaltyCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(campaigns)
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

// POST /api/loyalty/campaigns
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name,
      description,
      startDate,
      endDate,
      tierFilter,
      pointsMultiplier,
      bonusPoints,
      minPurchase,
      active,
    } = body

    if (!name) return errorResponse('اسم الحملة مطلوب')
    if (!startDate || !endDate) return errorResponse('تاريخ البداية والنهاية مطلوبان')

    const campaign = await db.loyaltyCampaign.create({
      data: {
        name,
        description: description || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        tierFilter: tierFilter || null,
        pointsMultiplier: parseFloat(pointsMultiplier) || 1.0,
        bonusPoints: parseInt(bonusPoints) || 0,
        minPurchase: parseFloat(minPurchase) || 0,
        active: active !== false,
      },
    })

    return successResponse(campaign, 'تم إنشاء الحملة بنجاح')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
