'use client'

import { localDB, getPendingSyncCount } from './local-db'
import { useConnectionStore, useAuthStore } from './store'

// Sync Engine - handles online/offline synchronization
// - Monitors connection status
// - Pushes pending local transactions to server
// - Pulls updates from Supabase when configured

let syncInterval: NodeJS.Timeout | null = null
let isSyncing = false

export function startSyncEngine() {
  if (typeof window === 'undefined') return

  // Monitor online/offline status
  const updateOnlineStatus = () => {
    const online = navigator.onLine
    useConnectionStore.getState().setOnline(online)
    if (online) {
      // Trigger sync when back online
      syncPendingTransactions()
    }
  }

  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
  updateOnlineStatus()

  // Check for pending sync every 30 seconds
  syncInterval = setInterval(async () => {
    if (navigator.onLine) {
      const pending = await getPendingSyncCount()
      useConnectionStore.getState().setPendingSync(pending)
      if (pending > 0 && !isSyncing) {
        syncPendingTransactions()
      }
    }
  }, 30000)
}

export function stopSyncEngine() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

export async function syncPendingTransactions() {
  if (isSyncing) return
  isSyncing = true
  useConnectionStore.getState().setSyncing(true)

  try {
    const pending = await localDB.syncQueue.where('status').equals('PENDING').toArray()
    
    for (const item of pending) {
      try {
        const payload = JSON.parse(item.payload)
        
        // Push to server API
        const token = useAuthStore.getState().token
        const res = await fetch('/api/sales', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          // Mark as synced
          await localDB.syncQueue.update(item.id!, {
            status: 'SYNCED',
            syncedAt: Date.now(),
          })
        } else {
          // Increment attempts
          await localDB.syncQueue.update(item.id!, {
            attempts: item.attempts + 1,
            error: `HTTP ${res.status}`,
          })
          
          // If too many attempts, mark as failed
          if (item.attempts >= 5) {
            await localDB.syncQueue.update(item.id!, { status: 'FAILED' })
          }
        }
      } catch (e: any) {
        await localDB.syncQueue.update(item.id!, {
          attempts: item.attempts + 1,
          error: e.message,
        })
      }
    }

    // Update pending count
    const remaining = await getPendingSyncCount()
    useConnectionStore.getState().setPendingSync(remaining)
  } catch (e) {
    console.error('Sync error:', e)
  } finally {
    isSyncing = false
    useConnectionStore.getState().setSyncing(false)
  }
}

// Simulate offline mode (for testing)
export function simulateOffline() {
  useConnectionStore.getState().setOnline(false)
}

export function simulateOnline() {
  useConnectionStore.getState().setOnline(true)
  syncPendingTransactions()
}
