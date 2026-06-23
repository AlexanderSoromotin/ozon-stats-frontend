import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
  Clock,
  ArrowRightLeft,
  Box,
  Settings2,
  Users,
  Receipt,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Дашборд' },
  { to: '/skus', icon: Package, label: 'Каталог SKU' },
  { to: '/components', icon: Boxes, label: 'Расходники' },
  { to: '/printers', icon: Printer, label: 'Оборудование' },
  { to: '/production', icon: Factory, label: 'Производство' },
  { to: '/inventory', icon: Warehouse, label: 'Склад и спрос' },
  { to: '/supply', icon: Truck, label: 'Поставки' },
  { to: '/finance', icon: DollarSign, label: 'Финансы' },
  { to: '/analytics/print-hour', icon: Clock, label: 'Прибыль/час' },
  { to: '/strategy/fbs-to-fbo', icon: ArrowRightLeft, label: 'Стратегия FBO' },
  { to: '/print-profiles', icon: Settings2, label: 'Профили печати' },
  { to: '/box-types', icon: Box, label: 'Короба' },
  { to: '/partners', icon: Users, label: 'Партнёры' },
  { to: '/expenses', icon: Receipt, label: 'Расходы' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r bg-sidebar flex flex-col">
        <div className="px-4 py-5 border-b">
          <Link to="/" className="font-semibold text-sm">Ozon Stats</Link>
          <p className="text-xs text-muted-foreground mt-0.5">{user?.name}</p>
        </div>
        <nav className="flex-1 p-2 flex flex-col gap-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2.5" onClick={handleLogout}>
            <LogOut className="size-4" />
            Выйти
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
