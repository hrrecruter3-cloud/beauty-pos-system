import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/platform/lock - lock or unlock the system
export async function POST(req: NextRequest) {
  try {
    const { locked, reason, userId } = await req.json()

    // Upsert lock status
    await db.setting.upsert({
      where: { key: 'system.locked' },
      create: { key: 'system.locked', value: locked ? 'true' : 'false', category: 'system' },
      update: { value: locked ? 'true' : 'false' },
    })

    await db.setting.upsert({
      where: { key: 'system.lockedReason' },
      create: { key: 'system.lockedReason', value: reason || '', category: 'system' },
      update: { value: reason || '' },
    })

    // Log audit
    await db.auditLog.create({
      data: {
        userId: userId || null,
        action: locked ? 'SYSTEM_LOCKED' : 'SYSTEM_UNLOCKED',
        entity: 'System',
        after: JSON.stringify({ locked, reason }),
      }
    })

    return successResponse({
      locked,
      reason: reason || '',
    }, locked ? 'تم قفل النظام' : 'تم فتح النظام')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
