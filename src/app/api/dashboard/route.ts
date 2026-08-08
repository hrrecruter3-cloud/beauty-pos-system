import { db } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      todaySalesAgg, weekSalesAgg, monthSalesAgg, lastWeekSalesAgg,
      todaySaleItems, monthExpensesAgg, totalCustomers, newCustomersThisMonth,
      totalProducts, inventoryProducts, last7DaysSales,
      todaySalesByCategory, topProductsMonth, todayPaymentMethods,
      soldProductIds30,
    ] = await Promise.all([
      db.sale.aggregate({ where: { createdAt: { gte: todayStart }, held: false }, _sum: { total: true }, _count: true, _avg: { total: true } }),
      db.sale.aggregate({ where: { createdAt: { gte: weekStart }, held: false }, _sum: { total: true } }),
      db.sale.aggregate({ where: { createdAt: { gte: monthStart }, held: false }, _sum: { total: true } }),
      db.sale.aggregate({ where: { createdAt: { gte: lastWeekStart, lt: weekStart }, held: false }, _sum: { total: true } }),
      db.saleItem.findMany({ where: { sale: { createdAt: { gte: todayStart }, held: false } }, select: { quantity: true, unitPrice: true, costAtSale: true, total: true } }),
      db.expense.aggregate({ where: { date: { gte: monthStart } }, _sum: { amount: true } }),
      db.customer.count(),
      db.customer.count({ where: { createdAt: { gte: monthStart } } }),
      db.product.count(),
      db.product.findMany({ where: { trackStock: true }, select: { id: true, name: true, nameAr: true, avgCost: true, reorderLevel: true, stockLevels: { select: { quantity: true } } } }),
      db.sale.findMany({ where: { createdAt: { gte: weekStart }, held: false }, select: { total: true, createdAt: true } }),
      db.saleItem.findMany({ where: { sale: { createdAt: { gte: todayStart }, held: false } }, include: { product: { select: { category: { select: { id: true, name: true, nameAr: true } } } } } }),
      db.saleItem.findMany({ where: { sale: { createdAt: { gte: monthStart }, held: false } }, include: { product: { select: { id: true, name: true, nameAr: true } } } }),
      db.sale.findMany({ where: { createdAt: { gte: todayStart }, held: false }, select: { paymentMethod: true, total: true } }),
      db.saleItem.findMany({ where: { sale: { createdAt: { gte: last30Days } } }, select: { productId: true }, distinct: ['productId'] }),
    ])

    // Profit
    const grossProfitToday = todaySaleItems.reduce((sum, it) => sum + (it.unitPrice - it.costAtSale) * it.quantity, 0)
    const totalExpensesThisMonth = monthExpensesAgg._sum.amount || 0
    const todaySalesTotal = todaySalesAgg._sum.total || 0
    const profitMargin = todaySalesTotal > 0 ? (grossProfitToday / todaySalesTotal) * 100 : 0

    // Inventory
    let inventoryValue = 0, lowStockCount = 0, outOfStockCount = 0
    const deadStockProducts: any[] = []
    const soldIds = new Set(soldProductIds30.map(s => s.productId))
    for (const p of inventoryProducts) {
      const stock = p.stockLevels.reduce((s, l) => s + l.quantity, 0)
      inventoryValue += stock * p.avgCost
      if (stock <= 0) outOfStockCount++
      else if (stock <= p.reorderLevel) lowStockCount++
      if (stock > 0 && !soldIds.has(p.id)) {
        deadStockProducts.push({ name: p.name, nameAr: p.nameAr, stock, value: stock * p.avgCost })
      }
    }

    // Sales by day
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    const dayMap = new Map<string, { sales: number; profit: number }>()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = `${d.getMonth()+1}/${d.getDate()}`
      dayMap.set(key, { sales: 0, profit: 0 })
    }
    for (const s of last7DaysSales) {
      const key = `${s.createdAt.getMonth()+1}/${s.createdAt.getDate()}`
      if (dayMap.has(key)) {
        const entry = dayMap.get(key)!
        entry.sales += s.total
      }
    }
    const salesByDay = Array.from(dayMap.entries()).map(([date, v]) => ({ day: date, sales: v.sales, profit: v.sales * 0.3 }))

    // Sales by category (today)
    const catMap = new Map<string, number>()
    for (const it of todaySalesByCategory) {
      const cat = it.product?.category
      if (!cat) continue
      const name = cat.nameAr || cat.name
      catMap.set(name, (catMap.get(name) || 0) + it.total)
    }
    const salesByCategory = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }))

    // Top products (month)
    const prodMap = new Map<string, { name: string; nameAr: string | null; quantity: number; revenue: number }>()
    for (const it of topProductsMonth) {
      if (!it.product) continue
      const key = it.product.id
      if (!prodMap.has(key)) prodMap.set(key, { name: it.product.name, nameAr: it.product.nameAr, quantity: 0, revenue: 0 })
      const entry = prodMap.get(key)!
      entry.quantity += it.quantity
      entry.revenue += it.total
    }
    const topProducts = Array.from(prodMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

    // Payment methods
    const methodLabels: Record<string, string> = { CASH: 'نقدي', CARD: 'بطاقة', TRANSFER: 'تحويل', SPLIT: 'مقسّم', OTHER: 'أخرى' }
    const payMap = new Map<string, number>()
    for (const s of todayPaymentMethods) {
      payMap.set(s.paymentMethod, (payMap.get(s.paymentMethod) || 0) + s.total)
    }
    const salesByPaymentMethod = Array.from(payMap.entries()).map(([method, value]) => ({ name: methodLabels[method] || method, value }))

    // Growth
    const thisWeekTotal = weekSalesAgg._sum.total || 0
    const lastWeekTotal = lastWeekSalesAgg._sum.total || 0
    const weekGrowth = lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 : thisWeekTotal > 0 ? 100 : 0

    // Smart insights
    const insights: { type: string; message: string }[] = []
    if (weekGrowth > 5) {
      insights.push({ type: 'positive', message: `المبيعات ارتفعت ${weekGrowth.toFixed(1)}% مقارنة بالأسبوع الماضي` })
    } else if (weekGrowth < -5) {
      insights.push({ type: 'negative', message: `المبيعات انخفضت ${Math.abs(weekGrowth).toFixed(1)}% مقارنة بالأسبوع الماضي` })
    }
    if (outOfStockCount > 0) {
      insights.push({ type: 'warning', message: `${outOfStockCount} منتج نفد من المخزون` })
    }
    if (lowStockCount > 0) {
      insights.push({ type: 'warning', message: `${lowStockCount} منتج منخفض المخزون يحتاج إعادة طلب` })
    }
    if (deadStockProducts.length > 0) {
      insights.push({ type: 'warning', message: `${deadStockProducts.length} منتج لم يُبع منذ 30 يوم` })
    }
    if (newCustomersThisMonth > 0) {
      insights.push({ type: 'positive', message: `${newCustomersThisMonth} عميل جديد هذا الشهر` })
    }
    insights.push({ type: 'info', message: `قيمة المخزون الحالية: ${inventoryValue.toFixed(2)} ج.م` })
    if (profitMargin > 30) {
      insights.push({ type: 'positive', message: `هامش الربح ممتاز: ${profitMargin.toFixed(1)}%` })
    }

    const dashboard = {
      todaySales: todaySalesTotal,
      todayCount: todaySalesAgg._count || 0,
      avgOrderValue: todaySalesAgg._avg.total || 0,
      todayProfit: grossProfitToday,
      profitMargin: parseFloat(profitMargin.toFixed(1)),
      weekSales: thisWeekTotal,
      monthSales: monthSalesAgg._sum.total || 0,
      weekGrowth: parseFloat(weekGrowth.toFixed(1)),
      totalCustomers,
      newCustomersThisMonth,
      totalProducts,
      lowStockCount,
      outOfStockCount,
      inventoryValue,
      totalExpensesThisMonth,
      salesByDay,
      salesByCategory,
      salesByPaymentMethod,
      topProducts,
      insights,
    }

    return successResponse(dashboard)
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}
