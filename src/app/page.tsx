'use client'

import { useEffect, useState } from 'react'
import { useAuthStore, useUIStore } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import { LoginScreen } from '@/components/pos/login-screen'
import { Sidebar } from '@/components/layout/sidebar'
import { DashboardModule } from '@/components/modules/dashboard'
import { POSModule } from '@/components/modules/pos'
import { ProductsModule } from '@/components/modules/products'
import { CategoriesModule } from '@/components/modules/categories'
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
import { PlatformAdminModule } from '@/components/modules/platform-admin'
import { SystemLockedScreen } from '@/components/pos/system-locked'
import { startSyncEngine, stopSyncEngine } from '@/lib/sync-engine'
import { initLocalDB } from '@/lib/local-db'

export default function Home() {
  const { user } = useAuthStore()
  const { activeModule, theme } = useUIStore()
  const [systemLocked, setSystemLocked] = useState(false)
  const [lockReason, setLockReason] = useState('')

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  const checkSystemLock = async () => {
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) return
      const data = await res.json()
      const flat = data.data?.flat || []
      const settings: Record<string, string> = {}
      for (const s of flat) settings[s.key] = s.value
      setSystemLocked(settings['system.locked'] === 'true')
      setLockReason(settings['system.lockedReason'] || '')
    } catch (e) {
      // ignore
    }
  }

  // Start sync engine and init local DB when logged in
  useEffect(() => {
    if (user) {
      startSyncEngine()
      initLocalDB()
      // Check system lock status periodically (for non-platform admins)
      if (user.role !== 'PLATFORM_ADMIN') {
        checkSystemLock()
        const interval = setInterval(checkSystemLock, 15000)
        return () => {
          clearInterval(interval)
          stopSyncEngine()
        }
      }
    }
    return () => stopSyncEngine()
  }, [user])

  if (!user) return <LoginScreen />

  // Platform admin gets its own dashboard
  if (user.role === 'PLATFORM_ADMIN') {
    return <PlatformAdminModule />
  }

  // System locked screen (for regular users when platform admin locks system)
  if (systemLocked) {
    return <SystemLockedScreen reason={lockReason} userName={user.name} />
  }

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return <DashboardModule />
      case 'pos': return <POSModule />
      case 'products': return <ProductsModule />
      case 'categories': return <CategoriesModule />
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
