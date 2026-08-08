import { NextRequest } from 'next/server'
import { db } from './db'

// Simple session management using cookies (demo mode - no JWT for simplicity)
// In production, use proper JWT + httpOnly cookies

const SESSION_COOKIE = 'pos_session'

export interface SessionUser {
  id: string
  username: string
  name: string
  role: string
  permissions: string[]
}

export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    // token format: userId
    const user = await db.user.findUnique({ where: { id: token } })
    if (user && user.active) {
      return {
        id: user.id, username: user.username, name: user.name,
        role: user.role, permissions: JSON.parse(user.permissions || '[]')
      }
    }
  }
  return null
}

export function hasPermission(user: SessionUser | null, permission: string): boolean {
  if (!user) return false
  if (user.permissions.includes('all')) return true
  return user.permissions.includes(permission)
}

export function defaultUserId(): string {
  // For demo, return the first user (admin)
  return 'admin'
}

export async function getDefaultUser(): Promise<string> {
  const user = await db.user.findFirst({ where: { role: 'ADMIN' } })
  return user?.id || ''
}

export function successResponse(data: any, message?: string) {
  return Response.json({ success: true, data, message })
}

export function errorResponse(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 2
  }).format(amount)
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(date)
}
