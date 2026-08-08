import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/expenses/categories
export async function GET() {
  try {
    const categories = await db.expenseCategory.findMany({
      include: {
        _count: { select: { expenses: true } },
      },
      orderBy: { name: 'asc' },
    })

    const result = categories.map((c) => ({
      ...c,
      expenseCount: c._count.expenses,
    }))

    return successResponse(result)
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

// POST /api/expenses/categories
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, nameAr, color } = body

    if (!name) return errorResponse('اسم الفئة مطلوب')

    const category = await db.expenseCategory.create({
      data: {
        name,
        nameAr: nameAr || null,
        color: color || null,
      },
    })

    return successResponse(category, 'تم إنشاء فئة المصروف')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
