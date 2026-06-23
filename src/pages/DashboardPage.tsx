import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PeriodPicker, { presetPeriod, type PeriodValue } from '@/components/PeriodPicker'
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format'
import { Package, TrendingUp, TrendingDown, AlertTriangle, Boxes, MapPin, Truck, ChevronRight } from 'lucide-react'

const GLOBAL_WIDGETS = [
  'sku_count', 'sku_active_count', 'sales_30d_units', 'sales_30d_revenue_minor',
  'profitable_skus_count', 'unprofitable_skus_count', 'out_of_stock_skus_count',
] as const

const PERIOD_WIDGETS = [
  'period_sales', 'period_returns', 'period_net_sales',
  'top_skus', 'top_cities', 'supply_urgency', 'lost_sales',
] as const

function Stat({ icon: Icon, label, value, sub, trend, to }: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  trend?: number | null
  to?: string
}) {
  const inner = (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-3 hover:bg-accent/40 transition-colors h-full">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="flex items-center gap-2">
        {trend != null && (
          <Badge variant={trend >= 0 ? 'success' : 'destructive'} className="gap-1">
            {trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {fmtPct(trend)}
          </Badge>
        )}
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [period, setPeriod] = useState<PeriodValue>(() => presetPeriod('month'))
  const { from, to } = period

  const { data: globalData } = useQuery({
    queryKey: ['analytics', 'global'],
    queryFn: () => api.post('/analytics/dashboard', { widgets: GLOBAL_WIDGETS }).then(r => r.data.data),
  })

  const { data: periodData } = useQuery({
    queryKey: ['analytics', 'period', from, to],
    queryFn: () => api.post('/analytics/dashboard', { widgets: PERIOD_WIDGETS, from, to }).then(r => r.data.data),
  })

  const g = globalData ?? {}
  const p = periodData ?? {}

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Добро пожаловать, {user?.name}</p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Package} label="Активных SKU" value={fmtNum(g.sku_active_count)} sub={`Всего: ${fmtNum(g.sku_count)}`} to="/skus" />
        <Stat icon={Boxes} label="Прибыльных SKU" value={fmtNum(g.profitable_skus_count)} sub={`Убыточных: ${fmtNum(g.unprofitable_skus_count)}`} />
        <Stat icon={AlertTriangle} label="Нет в наличии" value={fmtNum(g.out_of_stock_skus_count)} sub="SKU без остатка" />
        <Stat icon={TrendingUp} label="Продажи 30 дней" value={fmtMoney(g.sales_30d_revenue_minor)} sub={`${fmtNum(g.sales_30d_units)} шт`} />
      </div>

      {/* Period stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat
          icon={TrendingUp}
          label="Продажи за период"
          value={fmtMoney(p.period_sales?.revenue_minor)}
          sub={`${fmtNum(p.period_sales?.units)} шт`}
          trend={p.period_sales?.change_revenue_pct}
        />
        <Stat
          icon={TrendingDown}
          label="Возвраты"
          value={fmtMoney(p.period_returns?.amount_minor)}
          sub={`${fmtNum(p.period_returns?.count)} шт · ${p.period_returns?.percent_of_orders?.toFixed(1)}% заказов`}
        />
        <Stat
          icon={Boxes}
          label="Чистые продажи"
          value={fmtMoney(p.period_net_sales?.revenue_minor)}
          sub={`${fmtNum(p.period_net_sales?.units)} шт`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top SKUs */}
        <div className="rounded-xl border bg-card">
          <div className="px-5 py-4 border-b">
            <p className="font-semibold text-sm">Топ-10 SKU по продажам</p>
            <p className="text-xs text-muted-foreground mt-0.5">За выбранный период</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Шт</TableHead>
                <TableHead className="text-right">Выручка</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!p.top_skus || p.top_skus.length === 0) && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-sm">Нет данных</TableCell></TableRow>
              )}
              {p.top_skus?.map((s: any) => (
                <TableRow key={s.sku_id}>
                  <TableCell>
                    <Link to={`/skus/${s.sku_id}`} className="hover:underline text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{s.article}</span>{' '}
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-medium">{fmtNum(s.units)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmtMoney(s.revenue_minor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Top Cities */}
        <div className="rounded-xl border bg-card">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <MapPin className="size-4" />
            <p className="font-semibold text-sm">Топ городов</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Город</TableHead>
                <TableHead className="text-right">Шт</TableHead>
                <TableHead className="text-right">Выручка</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!p.top_cities || p.top_cities.length === 0) && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-sm">Нет данных</TableCell></TableRow>
              )}
              {p.top_cities?.map((c: any) => (
                <TableRow key={c.cluster_id}>
                  <TableCell className="font-medium text-sm">{c.cluster_name}</TableCell>
                  <TableCell className="text-right">{fmtNum(c.units)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmtMoney(c.revenue_minor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supply urgency */}
        <div className="rounded-xl border bg-card">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="size-4" />
              <p className="font-semibold text-sm">Срочные поставки</p>
            </div>
            <Link to="/supply" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Перейти <ChevronRight className="size-3" />
            </Link>
          </div>
          {p.supply_urgency ? (
            <div className="p-5 flex flex-col gap-4">
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">SKU срочно</p>
                  <p className="text-2xl font-bold">{fmtNum(p.supply_urgency.urgent_skus_count)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Всего штук</p>
                  <p className="text-2xl font-bold">{fmtNum(p.supply_urgency.total_units_to_ship)}</p>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {p.supply_urgency.by_top_warehouses?.map((w: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{w.cluster_name}</span>
                    <span className="font-medium">{fmtNum(w.units_needed)} шт</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground px-5 py-6">Нет данных</p>
          )}
        </div>

        {/* Lost sales */}
        <div className="rounded-xl border bg-card">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <AlertTriangle className="size-4 text-yellow-500" />
            <p className="font-semibold text-sm">Упущенные продажи</p>
          </div>
          {p.lost_sales ? (
            <div className="p-5 flex gap-8">
              <div>
                <p className="text-xs text-muted-foreground">Штук</p>
                <p className="text-2xl font-bold">{fmtNum(p.lost_sales.units)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Сумма</p>
                <p className="text-2xl font-bold">{fmtMoney(p.lost_sales.revenue_minor)}</p>
              </div>
              <div className="flex items-end pb-1">
                <p className="text-xs text-muted-foreground">из-за нулевого остатка</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground px-5 py-6">Нет данных</p>
          )}
        </div>
      </div>
    </div>
  )
}
