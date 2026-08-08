import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return errorResponse('اسم المستخدم وكلمة المرور مطلوبان')
    }
    const user = await db.user.findFirst({
      where: { OR: [{ username }, { email: username }] }
    })
    if (!user) return errorResponse('المستخدم غير موجود', 404)
    if (!user.active) return errorResponse('الحساب غير مفعل', 403)
    
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return errorResponse('كلمة المرور غير صحيحة', 401)

    // Log audit
    await db.auditLog.create({
      data: { userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id }
    })

    return successResponse({
      token: user.id,
      user: {
        id: user.id, username: user.username, name: user.name,
        role: user.role, permissions: JSON.parse(user.permissions || '[]'),
        phone: user.phone, pin: user.pin,
      }
    }, 'تم تسجيل الدخول بنجاح')
  } catch (e: any) {
    return errorResponse(e.message || 'فشل تسجيل الدخول', 500)
  }
}
