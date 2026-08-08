import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('🌱 Seeding database...')

  // Clear existing data
  await db.syncQueue.deleteMany()
  await db.auditLog.deleteMany()
  await db.expense.deleteMany()
  await db.expenseCategory.deleteMany()
  await db.cashMovement.deleteMany()
  await db.cashSession.deleteMany()
  await db.saleReturnItem.deleteMany()
  await db.saleReturn.deleteMany()
  await db.salePayment.deleteMany()
  await db.saleItem.deleteMany()
  await db.sale.deleteMany()
  await db.loyaltyTransaction.deleteMany()
  await db.loyaltyAccount.deleteMany()
  await db.loyaltyCampaign.deleteMany()
  await db.loyaltyTier.deleteMany()
  await db.stockAdjustment.deleteMany()
  await db.stockMovement.deleteMany()
  await db.stockLevel.deleteMany()
  await db.purchaseItem.deleteMany()
  await db.purchase.deleteMany()
  await db.supplier.deleteMany()
  await db.product.deleteMany()
  await db.category.deleteMany()
  await db.brand.deleteMany()
  await db.unit.deleteMany()
  await db.customer.deleteMany()
  await db.register.deleteMany()
  await db.warehouse.deleteMany()
  await db.store.deleteMany()
  await db.user.deleteMany()
  await db.setting.deleteMany()

  // ============ USERS ============
  const adminPass = await bcrypt.hash('admin123', 10)
  const managerPass = await bcrypt.hash('manager123', 10)
  const cashierPass = await bcrypt.hash('cashier123', 10)

  const admin = await db.user.create({
    data: {
      email: 'admin@pos.com', username: 'admin', passwordHash: adminPass,
      name: 'أحمد المدير', role: 'ADMIN', phone: '01000000001',
      permissions: JSON.stringify(['all']),
      pin: '1111',
    }
  })
  const manager = await db.user.create({
    data: {
      email: 'manager@pos.com', username: 'manager', passwordHash: managerPass,
      name: 'محمد المدير', role: 'MANAGER', phone: '01000000002',
      permissions: JSON.stringify(['sale.create','sale.refund','sale.discount','product.edit','inventory.adjust','report.view','profit.view','cash.open','cash.close']),
      pin: '2222',
    }
  })
  const cashier = await db.user.create({
    data: {
      email: 'cashier@pos.com', username: 'cashier', passwordHash: cashierPass,
      name: 'سارة الكاشير', role: 'CASHIER', phone: '01000000003',
      permissions: JSON.stringify(['sale.create','cash.open','cash.close']),
      pin: '3333',
    }
  })

  // ============ STORE & WAREHOUSE ============
  const store = await db.store.create({
    data: {
      name: 'متجر النجاح', address: 'شارع الجمهورية، القاهرة',
      phone: '0223456789', email: 'info@success.com', currency: 'EGP',
      receiptFooter: 'شكراً لزيارتكم - نتمنى لكم يوماً سعيداً',
    }
  })
  const warehouse = await db.warehouse.create({
    data: { name: 'المخزن الرئيسي', storeId: store.id, location: 'القاهرة' }
  })
  const register = await db.register.create({
    data: { name: 'كاشير 1', storeId: store.id }
  })

  // ============ CATEGORIES ============
  const categories = [
    { name: 'Drinks', nameAr: 'مشروبات', color: '#3b82f6', icon: 'CupSoda' },
    { name: 'Snacks', nameAr: 'وجبات خفيفة', color: '#f59e0b', icon: 'Cookie' },
    { name: 'Food', nameAr: 'طعام', color: '#10b981', icon: 'UtensilsCrossed' },
    { name: 'Dairy', nameAr: 'ألبان', color: '#8b5cf6', icon: 'Milk' },
    { name: 'Bakery', nameAr: 'مخبوزات', color: '#ec4899', icon: 'Wheat' },
    { name: 'Household', nameAr: 'منزلية', color: '#14b8a6', icon: 'Home' },
    { name: 'Personal Care', nameAr: 'عناية شخصية', color: '#ef4444', icon: 'Sparkles' },
    { name: 'Other', nameAr: 'أخرى', color: '#6b7280', icon: 'Package' },
  ]
  const categoryRecords = await Promise.all(
    categories.map(c => db.category.create({ data: c }))
  )
  const catMap = Object.fromEntries(categoryRecords.map(c => [c.name, c]))

  // ============ BRANDS ============
  const brands = ['Coca-Cola','Pepsi','Nestle','Lay\'s','Cadbury','Nabisco','Kellogg\'s','Local','Galaxy','Juhayna']
  const brandRecords = await Promise.all(brands.map(b => db.brand.create({ data: { name: b } })))

  // ============ UNITS ============
  const units = [
    { name: 'Piece', shortName: 'pcs' },
    { name: 'Box', shortName: 'box' },
    { name: 'Pack', shortName: 'pack' },
    { name: 'Bottle', shortName: 'btl' },
    { name: 'Can', shortName: 'can' },
    { name: 'Bag', shortName: 'bag' },
    { name: 'Kg', shortName: 'kg' },
  ]
  const unitRecords = await Promise.all(units.map(u => db.unit.create({ data: u })))
  const unitMap = new Map(unitRecords.map(u => [u.name, u]))

  // ============ SUPPLIERS ============
  const suppliers = [
    { name: 'شركة المشروبات المتحدة', phone: '01111111111', email: 'info@united-drinks.com', address: 'القاهرة', balance: 0 },
    { name: 'مورد الألبان المصري', phone: '01122222222', email: 'info@egypt-dairy.com', address: 'الجيزة', balance: 5000 },
    { name: 'شركة الوجبات الخفيفة', phone: '01133333333', email: 'info@snacks-co.com', address: 'الإسكندرية', balance: 0 },
    { name: 'مخبوزات الشرق', phone: '01144444444', address: 'القاهرة', balance: 2500 },
    { name: 'مورد المنتجات المنزلية', phone: '01155555555', email: 'info@home-prod.com', address: 'المنوفية', balance: 0 },
    { name: 'شركة العناية الشخصية', phone: '01166666666', address: 'القاهرة', balance: 0 },
    { name: 'المورد المتحد للأغذية', phone: '01177777777', email: 'info@united-foods.com', address: 'أسيوط', balance: 8000 },
    { name: 'مصنع الحلويات', phone: '01188888888', address: 'القاهرة', balance: 0 },
    { name: 'مورد المياه المعدنية', phone: '01199999999', address: 'العين السخنة', balance: 0 },
    { name: 'شركة التوزيع الحديثة', phone: '01200000000', email: 'info@modern-dist.com', address: 'القاهرة', balance: 3000 },
  ]
  const supplierRecords = await Promise.all(suppliers.map(s => db.supplier.create({ data: s })))

  // ============ PRODUCTS (50+) ============
  const productsData = [
    { name: 'Coca Cola 330ml', nameAr: 'كوكاكولا 330مل', cat: 'Drinks', brand: 'Coca-Cola', unit: 'Can', supplier: 0, cost: 5, price: 8, stock: 240, barcode: '5449000000996', min: 50 },
    { name: 'Coca Cola 1L', nameAr: 'كوكاكولا 1 لتر', cat: 'Drinks', brand: 'Coca-Cola', unit: 'Bottle', supplier: 0, cost: 12, price: 18, stock: 120, barcode: '5449000011888', min: 30 },
    { name: 'Coca Cola 2L', nameAr: 'كوكاكولا 2 لتر', cat: 'Drinks', brand: 'Coca-Cola', unit: 'Bottle', supplier: 0, cost: 20, price: 30, stock: 80, barcode: '5449000022777', min: 20 },
    { name: 'Pepsi 330ml', nameAr: 'بيبسي 330مل', cat: 'Drinks', brand: 'Pepsi', unit: 'Can', supplier: 0, cost: 5, price: 8, stock: 200, barcode: '4060800001234', min: 50 },
    { name: 'Pepsi 1L', nameAr: 'بيبسي 1 لتر', cat: 'Drinks', brand: 'Pepsi', unit: 'Bottle', supplier: 0, cost: 12, price: 18, stock: 90, barcode: '4060800012345', min: 30 },
    { name: 'Sprite 330ml', nameAr: 'سبرايت 330مل', cat: 'Drinks', brand: 'Coca-Cola', unit: 'Can', supplier: 0, cost: 5, price: 8, stock: 180, barcode: '5449000033666', min: 40 },
    { name: 'Fanta 330ml', nameAr: 'فانتا 330مل', cat: 'Drinks', brand: 'Coca-Cola', unit: 'Can', supplier: 0, cost: 5, price: 8, stock: 160, barcode: '5449000044555', min: 40 },
    { name: 'Mountain Dew 330ml', nameAr: 'ماونتن ديو 330مل', cat: 'Drinks', brand: 'Pepsi', unit: 'Can', supplier: 0, cost: 5, price: 8, stock: 140, barcode: '4060800023456', min: 30 },
    { name: 'Mineral Water 500ml', nameAr: 'مياه معدنية 500مل', cat: 'Drinks', brand: 'Nestle', unit: 'Bottle', supplier: 8, cost: 2.5, price: 5, stock: 500, barcode: '7622210448183', min: 100 },
    { name: 'Mineral Water 1.5L', nameAr: 'مياه معدنية 1.5 لتر', cat: 'Drinks', brand: 'Nestle', unit: 'Bottle', supplier: 8, cost: 5, price: 9, stock: 300, barcode: '7622210448190', min: 80 },
    { name: 'Orange Juice 1L', nameAr: 'عصير برتقال 1 لتر', cat: 'Drinks', brand: 'Juhayna', unit: 'Bottle', supplier: 0, cost: 15, price: 25, stock: 100, barcode: '6221033111111', min: 30 },
    { name: 'Mango Juice 1L', nameAr: 'عصير مانجو 1 لتر', cat: 'Drinks', brand: 'Juhayna', unit: 'Bottle', supplier: 0, cost: 15, price: 25, stock: 85, barcode: '6221033222222', min: 30 },
    { name: 'Lay\'s Classic 50g', nameAr: 'ليز كلاسيك 50جم', cat: 'Snacks', brand: 'Lay\'s', unit: 'Bag', supplier: 2, cost: 6, price: 10, stock: 300, barcode: '6042148000012', min: 60 },
    { name: 'Lay\'s Cheese 50g', nameAr: 'ليز جبنة 50جم', cat: 'Snacks', brand: 'Lay\'s', unit: 'Bag', supplier: 2, cost: 6, price: 10, stock: 250, barcode: '6042148000029', min: 60 },
    { name: 'Doritos 70g', nameAr: 'دوريتوس 70جم', cat: 'Snacks', brand: 'Lay\'s', unit: 'Bag', supplier: 2, cost: 8, price: 14, stock: 180, barcode: '6042148000036', min: 40 },
    { name: 'Cheetos 50g', nameAr: 'سيتوس 50جم', cat: 'Snacks', brand: 'Lay\'s', unit: 'Bag', supplier: 2, cost: 6, price: 10, stock: 160, barcode: '6042148000043', min: 40 },
    { name: 'Pringles 110g', nameAr: 'برينجلز 110جم', cat: 'Snacks', brand: 'Kellogg\'s', unit: 'Can', supplier: 2, cost: 20, price: 35, stock: 90, barcode: '5050083010101', min: 20 },
    { name: 'Oreo Original', nameAr: 'أوريو', cat: 'Snacks', brand: 'Nabisco', unit: 'Pack', supplier: 7, cost: 8, price: 15, stock: 140, barcode: '7622210041111', min: 30 },
    { name: 'Chocolate Wafer', nameAr: 'ويفر شوكولاتة', cat: 'Snacks', brand: 'Cadbury', unit: 'Pack', supplier: 7, cost: 5, price: 9, stock: 200, barcode: '7622210042222', min: 50 },
    { name: 'Galaxy Chocolate 45g', nameAr: 'جالاكسي 45جم', cat: 'Snacks', brand: 'Galaxy', unit: 'Piece', supplier: 7, cost: 7, price: 12, stock: 130, barcode: '7622210043333', min: 30 },
    { name: 'KitKat 4 Finger', nameAr: 'كيت كات', cat: 'Snacks', brand: 'Nestle', unit: 'Piece', supplier: 7, cost: 6, price: 11, stock: 110, barcode: '7613034626844', min: 30 },
    { name: 'Croissant Pack', nameAr: 'باكيت كرواسون', cat: 'Bakery', brand: 'Local', unit: 'Pack', supplier: 3, cost: 8, price: 15, stock: 70, barcode: '2000000000017', min: 20 },
    { name: 'White Bread', nameAr: 'خبز أبيض', cat: 'Bakery', brand: 'Local', unit: 'Piece', supplier: 3, cost: 3, price: 6, stock: 150, barcode: '2000000000024', min: 50 },
    { name: 'Buns Pack', nameAr: 'باكيت خبز برجر', cat: 'Bakery', brand: 'Local', unit: 'Pack', supplier: 3, cost: 5, price: 10, stock: 80, barcode: '2000000000031', min: 20 },
    { name: 'Cake Chocolate', nameAr: 'كيك شوكولاتة', cat: 'Bakery', brand: 'Local', unit: 'Piece', supplier: 7, cost: 15, price: 28, stock: 45, barcode: '2000000000048', min: 15 },
    { name: 'Milk 1L', nameAr: 'لبن 1 لتر', cat: 'Dairy', brand: 'Juhayna', unit: 'Bottle', supplier: 1, cost: 18, price: 28, stock: 100, barcode: '6221033000111', min: 30 },
    { name: 'Yogurt 150g', nameAr: 'زبادي 150جم', cat: 'Dairy', brand: 'Juhayna', unit: 'Piece', supplier: 1, cost: 5, price: 9, stock: 180, barcode: '6221033000222', min: 50 },
    { name: 'Cheese Portions 12', nameAr: 'جبنة شرائح 12', cat: 'Dairy', brand: 'Nestle', unit: 'Pack', supplier: 1, cost: 25, price: 42, stock: 60, barcode: '7622210990011', min: 15 },
    { name: 'Butter 200g', nameAr: 'زبدة 200جم', cat: 'Dairy', brand: 'Nestle', unit: 'Pack', supplier: 1, cost: 30, price: 48, stock: 50, barcode: '7622210990022', min: 15 },
    { name: 'Cream 200ml', nameAr: 'قشطة 200مل', cat: 'Dairy', brand: 'Nestle', unit: 'Can', supplier: 1, cost: 12, price: 20, stock: 90, barcode: '7622210990033', min: 20 },
    { name: 'Eggs 30 Pack', nameAr: 'بيض 30 بيضة', cat: 'Dairy', brand: 'Local', unit: 'Box', supplier: 6, cost: 60, price: 95, stock: 40, barcode: '2000000000055', min: 10 },
    { name: 'Corn Flakes 500g', nameAr: 'كورن فليكس 500جم', cat: 'Food', brand: 'Kellogg\'s', unit: 'Box', supplier: 6, cost: 35, price: 60, stock: 55, barcode: '5050083011111', min: 15 },
    { name: 'Pasta 500g', nameAr: 'مكرونة 500جم', cat: 'Food', brand: 'Local', unit: 'Pack', supplier: 6, cost: 8, price: 15, stock: 200, barcode: '2000000000062', min: 50 },
    { name: 'Rice 1Kg', nameAr: 'أرز 1 كجم', cat: 'Food', brand: 'Local', unit: 'Kg', supplier: 6, cost: 20, price: 32, stock: 150, barcode: '2000000000079', min: 40 },
    { name: 'Sugar 1Kg', nameAr: 'سكر 1 كجم', cat: 'Food', brand: 'Local', unit: 'Kg', supplier: 6, cost: 22, price: 35, stock: 130, barcode: '2000000000086', min: 40 },
    { name: 'Cooking Oil 1L', nameAr: 'زيت طعام 1 لتر', cat: 'Food', brand: 'Local', unit: 'Bottle', supplier: 6, cost: 40, price: 62, stock: 90, barcode: '2000000000093', min: 25 },
    { name: 'Tea 250g', nameAr: 'شاي 250جم', cat: 'Food', brand: 'Local', unit: 'Pack', supplier: 6, cost: 25, price: 42, stock: 100, barcode: '2000000000109', min: 30 },
    { name: 'Coffee 200g', nameAr: 'قهوة 200جم', cat: 'Food', brand: 'Nestle', unit: 'Pack', supplier: 6, cost: 45, price: 75, stock: 70, barcode: '7622210880011', min: 20 },
    { name: 'Salt 1Kg', nameAr: 'ملح 1 كجم', cat: 'Food', brand: 'Local', unit: 'Kg', supplier: 6, cost: 5, price: 10, stock: 200, barcode: '2000000000116', min: 50 },
    { name: 'Tuna Can', nameAr: 'تونة معلبة', cat: 'Food', brand: 'Local', unit: 'Can', supplier: 6, cost: 15, price: 25, stock: 120, barcode: '2000000000123', min: 30 },
    { name: 'Tomato Sauce', nameAr: 'صلصة طماطم', cat: 'Food', brand: 'Local', unit: 'Can', supplier: 6, cost: 8, price: 14, stock: 140, barcode: '2000000000130', min: 30 },
    { name: 'Instant Noodles', nameAr: 'شوربة سريعة', cat: 'Food', brand: 'Local', unit: 'Pack', supplier: 6, cost: 3, price: 6, stock: 300, barcode: '2000000000147', min: 80 },
    { name: 'Biscuits Assorted', nameAr: 'بسكويت متنوع', cat: 'Snacks', brand: 'Local', unit: 'Pack', supplier: 7, cost: 4, price: 7, stock: 250, barcode: '2000000000154', min: 60 },
    { name: 'Soap Bar', nameAr: 'صابون', cat: 'Personal Care', brand: 'Local', unit: 'Piece', supplier: 5, cost: 6, price: 12, stock: 180, barcode: '3000000000018', min: 40 },
    { name: 'Shampoo 400ml', nameAr: 'شامبو 400مل', cat: 'Personal Care', brand: 'Local', unit: 'Bottle', supplier: 5, cost: 25, price: 45, stock: 80, barcode: '3000000000025', min: 20 },
    { name: 'Toothpaste', nameAr: 'معجون أسنان', cat: 'Personal Care', brand: 'Nestle', unit: 'Piece', supplier: 5, cost: 15, price: 28, stock: 100, barcode: '3000000000032', min: 25 },
    { name: 'Toilet Paper 6', nameAr: 'مناديل 6 لفات', cat: 'Household', brand: 'Local', unit: 'Pack', supplier: 4, cost: 30, price: 50, stock: 70, barcode: '4000000000015', min: 20 },
    { name: 'Dish Soap 500ml', nameAr: 'سائل غسيل 500مل', cat: 'Household', brand: 'Local', unit: 'Bottle', supplier: 4, cost: 12, price: 22, stock: 90, barcode: '4000000000022', min: 25 },
    { name: 'Detergent 1Kg', nameAr: 'مسحوق غسيل 1كجم', cat: 'Household', brand: 'Local', unit: 'Pack', supplier: 4, cost: 35, price: 58, stock: 60, barcode: '4000000000039', min: 15 },
    { name: 'Trash Bags 30', nameAr: 'أكياس قمامة 30', cat: 'Household', brand: 'Local', unit: 'Pack', supplier: 4, cost: 15, price: 28, stock: 85, barcode: '4000000000046', min: 20 },
    { name: 'Aluminum Foil', nameAr: 'ورق ألمنيوم', cat: 'Household', brand: 'Local', unit: 'Pack', supplier: 4, cost: 18, price: 32, stock: 50, barcode: '4000000000053', min: 15 },
    { name: 'Matches', nameAr: 'كبريت', cat: 'Other', brand: 'Local', unit: 'Box', supplier: 9, cost: 1, price: 3, stock: 300, barcode: '5000000000012', min: 100 },
    { name: 'Lighter', nameAr: 'ولاعة', cat: 'Other', brand: 'Local', unit: 'Piece', supplier: 9, cost: 3, price: 7, stock: 150, barcode: '5000000000029', min: 50 },
  ]

  const productRecords = []
  for (let i = 0; i < productsData.length; i++) {
    const p = productsData[i]
    const category = catMap[p.cat]
    const brand = brandRecords.find(b => b.name === p.brand)
    const unit = unitMap.get(p.unit)
    const supplier = supplierRecords[p.supplier]
    const product = await db.product.create({
      data: {
        name: p.name, nameAr: p.nameAr, sku: `SKU-${String(i+1).padStart(4,'0')}`,
        barcode: p.barcode, categoryId: category.id, brandId: brand?.id, unitId: unit?.id,
        supplierId: supplier.id, storeId: store.id,
        purchaseCost: p.cost, sellingPrice: p.price, wholesalePrice: p.price * 0.85,
        taxRate: 14, minStock: p.min, reorderLevel: Math.floor(p.min * 1.5),
        avgCost: p.cost, active: true,
      }
    })
    // Set stock level
    await db.stockLevel.create({
      data: { productId: product.id, warehouseId: warehouse.id, quantity: p.stock }
    })
    // Create opening stock movement
    await db.stockMovement.create({
      data: { productId: product.id, warehouseId: warehouse.id, type: 'OPENING_STOCK',
        quantity: p.stock, refType: 'Opening', note: 'رصيد افتتاحي' }
    })
    productRecords.push({ ...product, cost: p.cost, price: p.price })
  }

  // ============ CUSTOMERS (20) ============
  const customerNames = [
    'محمد علي','فاطمة أحمد','خالد حسن','منى محمود','عبدالله سعيد','نورا إبراهيم',
    'أحمد عبدالرحمن','سارة محمد','يوسف كمال','هدى مصطفى','عمر فاروق','ليلى ناصر',
    'كريم عادل','ريم حسني','طارق فؤاد','أمل زكي','ماجد سمير','دعاء أنور',
    'حسام الدين','فريدة جمال'
  ]
  const customers = []
  for (let i = 0; i < customerNames.length; i++) {
    const c = await db.customer.create({
      data: {
        name: customerNames[i], phone: `010${String(i+1).padStart(8,'0')}`,
        email: `customer${i+1}@email.com`, address: `العنوان ${i+1}`,
        tier: i < 3 ? 'VIP' : i < 8 ? 'GOLD' : i < 14 ? 'SILVER' : 'BRONZE',
        birthday: new Date(1990 + i, i % 12, (i % 28) + 1),
      }
    })
    await db.loyaltyAccount.create({
      data: {
        customerId: c.id, points: Math.floor(Math.random() * 3000) + 100,
        totalEarned: Math.floor(Math.random() * 5000) + 500,
        totalRedeemed: Math.floor(Math.random() * 1000),
        tier: c.tier,
      }
    })
    customers.push(c)
  }

  // ============ LOYALTY TIERS ============
  await db.loyaltyTier.createMany({
    data: [
      { name: 'BRONZE', displayName: 'برونزي', minPoints: 0, earningMultiplier: 1.0, discountPercent: 0, color: '#cd7f32' },
      { name: 'SILVER', displayName: 'فضي', minPoints: 500, earningMultiplier: 1.2, discountPercent: 5, color: '#c0c0c0' },
      { name: 'GOLD', displayName: 'ذهبي', minPoints: 1500, earningMultiplier: 1.5, discountPercent: 10, color: '#ffd700' },
      { name: 'VIP', displayName: 'VIP', minPoints: 3000, earningMultiplier: 2.0, discountPercent: 15, color: '#9333ea' },
    ]
  })

  // ============ LOYALTY CAMPAIGN ============
  await db.loyaltyCampaign.create({
    data: {
      name: 'عرض نهاية الأسبوع - نقاط مضاعفة',
      description: 'نقاط مضاعفة يومي الجمعة والسبت',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      pointsMultiplier: 2.0, bonusPoints: 0, minPurchase: 50, active: true,
    }
  })

  // ============ EXPENSE CATEGORIES ============
  const expCats = [
    { name: 'Rent', nameAr: 'إيجار', color: '#ef4444' },
    { name: 'Electricity', nameAr: 'كهرباء', color: '#f59e0b' },
    { name: 'Internet', nameAr: 'إنترنت', color: '#3b82f6' },
    { name: 'Salary', nameAr: 'رواتب', color: '#10b981' },
    { name: 'Transport', nameAr: 'مواصلات', color: '#8b5cf6' },
    { name: 'Maintenance', nameAr: 'صيانة', color: '#ec4899' },
    { name: 'Other', nameAr: 'أخرى', color: '#6b7280' },
  ]
  const expCatRecords = await Promise.all(expCats.map(c => db.expenseCategory.create({ data: c })))

  // ============ SALES (100+) ============
  const paymentMethods = ['CASH','CASH','CASH','CASH','CARD','CARD','TRANSFER']
  let invoiceCounter = 1001
  const now = new Date()
  
  for (let day = 30; day >= 0; day--) {
    const salesPerDay = Math.floor(Math.random() * 5) + 3 // 3-7 sales per day
    for (let s = 0; s < salesPerDay; s++) {
      const saleDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000 - Math.random() * 8 * 60 * 60 * 1000)
      const itemCount = Math.floor(Math.random() * 4) + 1
      const items: any[] = []
      let subtotal = 0
      for (let it = 0; it < itemCount; it++) {
        const prod = productRecords[Math.floor(Math.random() * productRecords.length)]
        const qty = Math.floor(Math.random() * 3) + 1
        const total = prod.price * qty
        items.push({ product: prod, qty, unitPrice: prod.price, total, cost: prod.cost })
        subtotal += total
      }
      const discountAmount = Math.random() > 0.7 ? Math.round(subtotal * 0.05) : 0
      const taxAmount = Math.round((subtotal - discountAmount) * 0.14 * 100) / 100
      const total = subtotal - discountAmount + taxAmount
      const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)]
      const hasCustomer = Math.random() > 0.4
      const customer = hasCustomer ? customers[Math.floor(Math.random() * customers.length)] : null
      const user = Math.random() > 0.5 ? cashier : manager

      const sale = await db.sale.create({
        data: {
          invoiceNumber: `INV-${invoiceCounter++}`,
          customerId: customer?.id, userId: user.id, storeId: store.id, registerId: register.id,
          subtotal, discountAmount, discountType: discountAmount > 0 ? 'FIXED' : null,
          taxAmount, total, paidAmount: total, changeAmount: 0,
          status: 'COMPLETED', paymentMethod: method,
          loyaltyEarned: customer ? Math.floor(total / 10) : 0,
          createdAt: saleDate, updatedAt: saleDate,
          items: { create: items.map(it => ({
            productId: it.product.id, quantity: it.qty, unitPrice: it.unitPrice,
            discountAmount: 0, taxAmount: it.total * 0.14, total: it.total * 1.14, costAtSale: it.cost
          }))},
          payments: { create: { method, amount: total, createdAt: saleDate } },
        }
      })

      // Deduct stock & movements
      for (const it of items) {
        await db.stockLevel.updateMany({
          where: { productId: it.product.id, warehouseId: warehouse.id },
          data: { quantity: { decrement: it.qty } }
        })
        await db.stockMovement.create({
          data: { productId: it.product.id, warehouseId: warehouse.id, type: 'SALE',
            quantity: -it.qty, refType: 'Sale', refId: sale.id }
        })
      }

      // Loyalty
      if (customer && sale.loyaltyEarned > 0) {
        await db.loyaltyAccount.update({
          where: { customerId: customer.id },
          data: { points: { increment: sale.loyaltyEarned }, totalEarned: { increment: sale.loyaltyEarned } }
        })
        await db.loyaltyTransaction.create({
          data: { customerId: customer.id, type: 'EARN', points: sale.loyaltyEarned,
            refType: 'Sale', refId: sale.id, note: `نقاط من فاتورة ${sale.invoiceNumber}` }
        })
      }
    }
  }

  // ============ EXPENSES ============
  for (let day = 30; day >= 0; day -= 7) {
    const eDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000)
    await db.expense.create({
      data: { categoryId: expCatRecords[0].id, userId: admin.id, amount: 5000,
        paymentMethod: 'CASH', note: 'إيجار الشهر', date: eDate }
    })
    await db.expense.create({
      data: { categoryId: expCatRecords[1].id, userId: admin.id, amount: 800,
        paymentMethod: 'CASH', note: 'فاتورة كهرباء', date: eDate }
    })
    await db.expense.create({
      data: { categoryId: expCatRecords[2].id, userId: admin.id, amount: 300,
        paymentMethod: 'CASH', note: 'إنترنت', date: eDate }
    })
    await db.expense.create({
      data: { categoryId: expCatRecords[3].id, userId: admin.id, amount: 3000,
        paymentMethod: 'CASH', note: 'رواتب', date: eDate }
    })
  }

  // ============ SETTINGS ============
  await db.setting.createMany({
    data: [
      { key: 'loyalty.enabled', value: 'true', category: 'loyalty' },
      { key: 'loyalty.pointsPerEgp', value: '0.1', category: 'loyalty' },
      { key: 'loyalty.egpPerPoint', value: '0.05', category: 'loyalty' },
      { key: 'loyalty.minRedeem', value: '500', category: 'loyalty' },
      { key: 'tax.defaultRate', value: '14', category: 'tax' },
      { key: 'receipt.width', value: '80', category: 'receipt' },
      { key: 'receipt.showLogo', value: 'false', category: 'receipt' },
      { key: 'receipt.autoPrint', value: 'true', category: 'receipt' },
      { key: 'receipt.cutPaper', value: 'true', category: 'receipt' },
      { key: 'receipt.openDrawer', value: 'true', category: 'receipt' },
      { key: 'currency', value: 'EGP', category: 'general' },
      { key: 'language', value: 'ar', category: 'general' },
      { key: 'store.name', value: store.name, category: 'general' },
    ]
  })

  console.log('✅ Seed complete!')
  console.log(`   Products: ${productRecords.length}`)
  console.log(`   Customers: ${customers.length}`)
  console.log(`   Suppliers: ${supplierRecords.length}`)
  console.log(`   Demo login: admin/admin123, manager/manager123, cashier/cashier123`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
