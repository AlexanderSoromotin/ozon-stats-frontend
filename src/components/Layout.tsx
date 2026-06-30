import { useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import SettingsDialog from '@/components/SettingsDialog'
import {
  Package,
  Factory,
  Warehouse,
  Truck,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Boxes,
  Printer,
  Box,
  Users,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Дашборд' },
  { to: '/skus', icon: Package, label: 'Каталог SKU' },
  { to: '/components', icon: Boxes, label: 'Расходники' },
  { to: '/printers', icon: Printer, label: 'Оборудование' },
  { to: '/production', icon: Factory, label: 'Производство' },
  { to: '/inventory', icon: Warehouse, label: 'Свой склад' },
  { to: '/supply', icon: Truck, label: 'Поставки' },
  { to: '/finance', icon: DollarSign, label: 'Финансы' },
  { to: '/box-types', icon: Box, label: 'Короба' },
  { to: '/partners', icon: Users, label: 'Партнёры' },
]

export default function Layout() {
  const { user, logout, isOwner } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/settings/export')
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ozon-settings-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Ошибка при экспорте настроек')
    } finally {
      setExporting(false)
    }
  }

  async function handleImport(file: File) {
    setImporting(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      await api.post('/settings/import', json)
      alert('Настройки импортированы')
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Ошибка при импорте настроек')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-60 shrink-0 border-r border-border/60 bg-sidebar/60 backdrop-blur-sm flex flex-col overflow-y-auto">
        <div className="px-4 py-5">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src="/logo.png" alt="Логотип" className="size-8 rounded-lg object-contain group-hover:scale-105 transition-transform" />
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm tracking-tight">SASeller</span>
              <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">{user?.name}</span>
            </div>
          </Link>
        </div>
        <nav className="flex-1 px-3 pb-2 flex flex-col gap-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'group/nav relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-xs'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r-full bg-primary" />
                  )}
                  <Icon className={cn('size-4 shrink-0 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground group-hover/nav:text-foreground')} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-2 border-t border-border/60 flex flex-col gap-0.5">
          <SettingsDialog
            isOwner={!!isOwner}
            onExport={handleExport}
            onImport={handleImport}
            exporting={exporting}
            importing={importing}
          />
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2.5 text-muted-foreground hover:text-foreground" onClick={handleLogout}>
            <LogOut className="size-4" />
            Выйти
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="relative min-h-full p-6 lg:p-8">
          <div
            className="pointer-events-none fixed top-0 right-0 -z-10 size-[600px] rounded-full opacity-40"
            style={{
              background:
                'radial-gradient(circle at center, oklch(0.93 0.04 250 / 0.5), transparent 60%)',
              transform: 'translate(30%, -40%)',
            }}
          />
          <Outlet />
        </div>
      </main>
    </div>
  )
}
