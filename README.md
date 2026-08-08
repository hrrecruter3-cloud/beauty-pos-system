# لمسة جمال - نظام نقاط البيع لمستحضرات التجميل

نظام POS احترافي متكامل لإدارة محلات مستحضرات التجميل، مع دعم كامل للأوفلين/الأونلاين، QR Codes، الفئات الفرعية، نظام الولاء، ولوحة تحكم منفصلة لمدير المنصة.

## ✨ الميزات الرئيسية

### 🏪 إدارة المتجر
- **14 وحدة كاملة**: لوحة التحكم، نقطة البيع، المنتجات، الفئات، المخزون، المبيعات، العملاء، نقاط الولاء، المشتريات، الموردون، الخزنة، المصروفات، التقارير، الإعدادات
- **محل مستحضرات تجميل**: 72 منتج، 8 فئات رئيسية، 18 فئة فرعية، 10 موردين، 20 عميل
- **ألوان وردية/بنفسجية** أنيقة مناسبة لمحلات التجميل

### 🛡️ مدير المنصة (Platform Admin)
- لوحة تحكم منفصلة完全不 تتدخل في تفاصيل المتجر
- عرض حجم البيانات الإجمالي (عدد السجلات، الحجم بالميجابايت)
- إحصائيات المستخدمين حسب الدور
- **قفل/فتح النظام** بالكامل مع ذكر السبب
- عند قفل النظام، يرى المستخدمون العاديون شاشة "النظام مقفل"

### 📱 نقطة البيع (POS)
- قارئ باركود سريع (USB Keyboard Wedge)
- اختصارات لوحة المفاتيح (F2-F8)
- دفع نقدي/بطاقة/تحويل/مقسّم
- تعليق الفواتير واسترجاعها
- اختيار العميل وعرض نقاط الولاء
- طباعة إيصال حراري

### 🏷️ المنتجات والفئات
- **QR Code**: توليد وطباعة QR Code لكل منتج أو دفعة منتجات
- **تغيير السعر السريع**: تحديث سعر المنتج بنقرة واحدة
- **فئات هرمية**: فئات رئيسية وفرعية مع عرض شجري
- استيراد/تصدير CSV
- بحث متقدم وفلترة حسب الفئة

### 🔄 الأوفلين والأونلاين
- **قاعدة بيانات محلية (Dexie/IndexedDB)**: تعمل بدون إنترنت
- **Supabase**: تخزين البيانات أونلاين ومزامنتها
- **محرك المزامنة**: مزامنة تلقائية عند عودة الإنترنت
- مؤشر حالة الاتصال (متصل/جاري المزامنة/غير متصل)
- محاكاة وضع الأوفلين للاختبار

### 💎 نظام الولاء
- 4 فئات: برونزي، فضي، ذهبي، VIP
- نقاط مضاعفة، حملات ترويجية
- استبدال النقاط
- سجل كامل لمعاملات النقاط

### 📊 التقارير والتحليلات
- 10 أنواع تقارير (مبيعات، أرباح، مخزون، عملاء، إلخ)
- رسوم بيانية تفاعلية
- رؤى ذكية تلقائية
- تصدير CSV

## 🛠️ التقنيات المستخدمة

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS 4, shadcn/ui
- **State**: Zustand, TanStack Query
- **Database**: Prisma ORM + SQLite
- **Offline**: Dexie (IndexedDB)
- **Online Sync**: Supabase
- **Charts**: Recharts
- **QR Codes**: qrcode library
- **Auth**: bcryptjs + token-based

## 🚀 التشغيل

```bash
# تثبيت الحزم
bun install

# تشغيل قاعدة البيانات
bun run db:push

# تحميل البيانات الأولية
bun run prisma/seed.ts

# تشغيل خادم التطوير
bun run dev
```

## 🔑 بيانات الدخول

| المستخدم | كلمة المرور | الدور |
|---------|------------|-------|
| `admin` | `admin123` | مدير المتجر |
| `manager` | `manager123` | مشرف |
| `cashier` | `cashier123` | كاشير |
| `platform` | `platform123` | مدير المنصة |

## 📁 هيكل المشروع

```
src/
├── app/
│   ├── api/              # API Routes (30+ endpoints)
│   │   ├── auth/         # المصادقة
│   │   ├── products/     # المنتجات
│   │   ├── categories/   # الفئات
│   │   ├── sales/        # المبيعات والمرتجعات
│   │   ├── customers/    # العملاء
│   │   ├── loyalty/      # نقاط الولاء
│   │   ├── inventory/    # المخزون
│   │   ├── purchases/    # المشتريات
│   │   ├── suppliers/    # الموردون
│   │   ├── cash/         # الخزنة
│   │   ├── expenses/     # المصروفات
│   │   ├── dashboard/    # لوحة التحكم
│   │   ├── reports/      # التقارير
│   │   ├── platform/     # مدير المنصة
│   │   └── settings/     # الإعدادات
│   ├── page.tsx          # الصفحة الرئيسية
│   ├── layout.tsx        # التخطيط الرئيسي
│   └── globals.css       # الأنماط
├── components/
│   ├── layout/           # التخطيط (Sidebar)
│   ├── modules/          # وحدات النظام (15 module)
│   ├── pos/              # مكونات POS (Login, Receipt, QR, System Lock)
│   └── ui/               # مكونات shadcn/ui
└── lib/
    ├── db.ts             # Prisma client
    ├── auth.ts           # المصادقة
    ├── api.ts            # API helper
    ├── store.ts          # Zustand stores
    ├── supabase.ts       # Supabase client
    ├── local-db.ts       # Dexie offline DB
    └── sync-engine.ts    # محرك المزامنة
prisma/
├── schema.prisma         # مخطط قاعدة البيانات (30+ model)
└── seed.ts               # بيانات أولية
```

## 🗄️ قاعدة البيانات

25+ جدال مترابط:
- Users, Stores, Registers, Warehouses
- Categories (with subcategories), Brands, Units, Products
- StockLevels, StockMovements, StockAdjustments
- Suppliers, Purchases, PurchaseItems
- Customers, LoyaltyAccounts, LoyaltyTransactions, LoyaltyTiers, LoyaltyCampaigns
- Sales, SaleItems, SalePayments, SaleReturns, SaleReturnItems
- CashSessions, CashMovements, Expenses, ExpenseCategories
- Settings, AuditLogs, SyncQueue

## 🔒 الأمان

- RBAC (Role-Based Access Control)
- تسجيل جميع العمليات الحساسة في Audit Log
- معاملات ذرية (Atomic Transactions) لضمان سلامة البيانات
- قفل النظام من مدير المنصة

## 📝 الترخيص

MIT License
