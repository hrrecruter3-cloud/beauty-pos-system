'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Loader2, Lock, User, Shield } from 'lucide-react'
import { toast } from 'sonner'

export function LoginScreen() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)

  const handleLogin = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      login(data.user, data.token)
      toast.success(`مرحباً ${data.user.name}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = (user: string, pass: string) => {
    setUsername(user)
    setPassword(pass)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/20 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold">لمسة جمال</h1>
          <p className="text-muted-foreground mt-2">نظام إدارة مستحضرات التجميل</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-center">تسجيل الدخول</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    className="pr-9"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    placeholder="admin / manager / cashier / platform"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    className="pr-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>
              </div>
              <Button
                className="w-full h-11"
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'دخول'}
              </Button>

              <div className="grid grid-cols-2 gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickLogin('admin', 'admin123')}
                  className="flex-col h-auto py-2"
                >
                  <span className="font-bold">مدير المتجر</span>
                  <span className="text-xs text-muted-foreground">admin</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickLogin('manager', 'manager123')}
                  className="flex-col h-auto py-2"
                >
                  <span className="font-bold">مشرف</span>
                  <span className="text-xs text-muted-foreground">manager</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickLogin('cashier', 'cashier123')}
                  className="flex-col h-auto py-2"
                >
                  <span className="font-bold">كاشير</span>
                  <span className="text-xs text-muted-foreground">cashier</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => quickLogin('platform', 'platform123')}
                  className="flex-col h-auto py-2 border-primary/50 text-primary"
                >
                  <Shield className="w-3 h-3" />
                  <span className="font-bold">مدير المنصة</span>
                  <span className="text-xs text-muted-foreground">platform</span>
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground pt-2">
                كلمات المرور: admin123 / manager123 / cashier123 / platform123
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
