'use client'

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Supabase client - configured via settings API
// In production, set SUPABASE_URL and SUPABASE_ANON_KEY env vars
// or configure via Settings → Sync tab

let client: SupabaseClient | null = null
let configured = false

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (client) return client

  try {
    // Try env first
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (url && key) {
      client = createClient(url, key)
      configured = true
      return client
    }

    // Try fetching from settings API
    const res = await fetch('/api/settings')
    if (!res.ok) return null
    const data = await res.json()
    const settings: Record<string, string> = {}
    for (const cat of Object.values(data.data || {})) {
      for (const s of cat as any[]) settings[s.key] = s.value
    }
    const sUrl = settings['supabase.url']
    const sKey = settings['supabase.key']
    if (sUrl && sKey) {
      client = createClient(sUrl, sKey)
      configured = true
      return client
    }
  } catch (e) {
    console.error('Supabase init error:', e)
  }
  return null
}

export function isSupabaseConfigured() {
  return configured
}

// Sync queue operations
export async function pushToSupabase(entityType: string, entityId: string, payload: any) {
  const supabase = await getSupabaseClient()
  if (!supabase) return false

  try {
    const table = entityType.toLowerCase() + 's'
    const { error } = await supabase.from(table).upsert({
      id: entityId,
      data: payload,
      synced_at: new Date().toISOString(),
    })
    return !error
  } catch (e) {
    console.error('Sync push error:', e)
    return false
  }
}

export async function pullFromSupabase(entityType: string, since: Date) {
  const supabase = await getSupabaseClient()
  if (!supabase) return []

  try {
    const table = entityType.toLowerCase() + 's'
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gt('updated_at', since.toISOString())
    return data || []
  } catch (e) {
    console.error('Sync pull error:', e)
    return []
  }
}
