import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/categories - list all categories with parent/children relations
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rootOnly = searchParams.get('rootOnly') === 'true'

    const where: any = {}
    if (rootOnly) where.parentId = null

    const categories = await db.category.findMany({
      where,
      include: {
        parent: true,
        children: { include: { children: true } },
        products: { select: { id: true } },
      },
      orderBy: { name: 'asc' },
    })

    const result = categories.map((c) => ({
      ...c,
      productCount: c.products.length,
    }))

    return successResponse(result)
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

// POST /api/categories - create
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, nameAr, parentId, color, icon } = body

    if (!name) return errorResponse('اسم الفئة مطلوب')

    if (parentId) {
      const parent = await db.category.findUnique({ where: { id: parentId } })
      if (!parent) return errorResponse('الفئة الأب غير موجودة', 404)
    }

    const category = await db.category.create({
      data: {
        name,
        nameAr: nameAr || null,
        parentId: parentId || null,
        color: color || null,
        icon: icon || null,
      },
      include: { parent: true, children: true },
    })

    return successResponse(category, 'تم إنشاء الفئة بنجاح')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
