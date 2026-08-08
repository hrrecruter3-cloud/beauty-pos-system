'use client'

import { useEffect } from 'react'
import { useAuthStore, useUIStore } from '@/lib/store'
import { LoginScreen } from '@/components/pos/login-screen'
import { Sidebar } from '@/components/layout/sidebar'
import { DashboardModule } from '@/components/modules/dashboard'
import { POSModule } from '@/components/modules/pos'
import { ProductsModule } from '@/components/modules/products'
import { InventoryModule } from '@/components/modules/inventory'
import { SalesModule } from '@/components/modules/sales'
import { CustomersModule } from '@/components/modules/customers'
import { LoyaltyModule } from '@/components/modules/loyalty'
import { PurchasesModule } from '@/components/modules/purchases'
import { SuppliersModule } from '@/components/modules/suppliers'
import { CashModule } from '@/components/modules/cash'
import { ExpensesModule } from '@/components/modules/expenses'
import { ReportsModule } from '@/components/modules/reports'
import { AuditModule } from '@/components/modules/audit'
import { SettingsModule } from '@/components/modules/settings'

export default function Home() {
  const { user } = useAuthStore()
  const { activeModule, theme } = useUIStore()

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  if (!user) return <LoginScreen />

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return <DashboardModule />
      case 'pos': return <POSModule />
      case 'products': return <ProductsModule />
      case 'inventory': return <InventoryModule />
      case 'sales': return <SalesModule />
      case 'customers': return <CustomersModule />
      case 'loyalty': return <LoyaltyModule />
      case 'purchases': return <PurchasesModule />
      case 'suppliers': return <SuppliersModule />
      case 'cash': return <CashModule />
      case 'expenses': return <ExpensesModule />
      case 'reports': return <ReportsModule />
      case 'audit': return <AuditModule />
      case 'settings': return <SettingsModule />
      default: return <DashboardModule />
    }
  }

  return (
    <div className="flex min-h-screen bg-background" dir="rtl">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1">
          {renderModule()}
        </div>
      </main>
    </div>
  )
}
