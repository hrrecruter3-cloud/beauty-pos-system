import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/settings - all settings grouped by category
export async function GET() {
  try {
    const settings = await db.setting.findMany({
      orderBy: { category: 'asc' },
    })

    const grouped: Record<string, Record<string, string>> = {}
    for (const s of settings) {
      if (!grouped[s.category]) grouped[s.category] = {}
      grouped[s.category][s.key] = s.value
    }

    return successResponse({ grouped, flat: settings })
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

// PUT /api/settings - update settings { settings: [{key, value, category?}] }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { settings } = body

    if (!Array.isArray(settings)) return errorResponse('settings يجب أن تكون مصفوفة')

    const results = await db.$transaction(
      settings.map((s: any) =>
        db.setting.upsert({
          where: { key: s.key },
          update: { value: String(s.value) },
          create: {
            key: s.key,
            value: String(s.value),
            category: s.category || 'general',
          },
        })
      )
    )

    return successResponse(results, 'تم حفظ الإعدادات')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
