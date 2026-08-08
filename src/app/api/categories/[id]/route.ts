import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/categories/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const category = await db.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: { include: { children: true } },
        products: { select: { id: true } },
      },
    })
    if (!category) return errorResponse('الفئة غير موجودة', 404)

    return successResponse({ ...category, productCount: category.products.length })
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

// PUT /api/categories/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, nameAr, parentId, color, icon } = body

    const existing = await db.category.findUnique({ where: { id } })
    if (!existing) return errorResponse('الفئة غير موجودة', 404)

    if (!name) return errorResponse('اسم الفئة مطلوب')

    // Prevent setting parent to itself or to one of its own descendants (cycle guard)
    if (parentId) {
      if (parentId === id) {
        return errorResponse('لا يمكن تعيين الفئة كأب لنفسها', 400)
      }
      // Walk up the chain to ensure no cycle
      let currentParentId: string | null = parentId
      const visited = new Set<string>([id])
      while (currentParentId) {
        if (visited.has(currentParentId)) {
          return errorResponse('تتشكل دورة في تسلسل الفئات', 400)
        }
        visited.add(currentParentId)
        const node: any = await db.category.findUnique({
          where: { id: currentParentId },
          select: { parentId: true },
        })
        if (!node) break
        currentParentId = node.parentId
      }

      const parent = await db.category.findUnique({ where: { id: parentId } })
      if (!parent) return errorResponse('الفئة الأب غير موجودة', 404)
    }

    const category = await db.category.update({
      where: { id },
      data: {
        name,
        nameAr: nameAr || null,
        parentId: parentId || null,
        color: color || null,
        icon: icon || null,
      },
      include: { parent: true, children: true },
    })

    return successResponse(category, 'تم تحديث الفئة بنجاح')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

// DELETE /api/categories/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.category.findUnique({
      where: { id },
      include: {
        children: { select: { id: true } },
        products: { select: { id: true } },
      },
    })
    if (!existing) return errorResponse('الفئة غير موجودة', 404)

    if (existing.children.length > 0) {
      return errorResponse('لا يمكن حذف فئة تحتوي على فئات فرعية. احذف الفئات الفرعية أولاً.', 409)
    }
    if (existing.products.length > 0) {
      return errorResponse(
        `لا يمكن حذف الفئة لأنها مرتبطة بـ ${existing.products.length} منتج. انقل المنتجات أولاً.`,
        409,
      )
    }

    await db.category.delete({ where: { id } })
    return successResponse(null, 'تم حذف الفئة بنجاح')
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
