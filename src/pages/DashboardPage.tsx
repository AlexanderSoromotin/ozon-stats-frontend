import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PeriodPicker, { presetPeriod, type PeriodValue } from '@/components/PeriodPicker'
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format'
import {
  Package, TrendingUp, TrendingDown, AlertTriangle, Boxes, MapPin,
  Truck, ChevronRight, ReceiptText, ShoppingCart, Undo2, Wallet,
} from 'lucide-react'
import { Skeleton, SkeletonStatCard, SkeletonTableRows } from '@/components/ui/skeleton'

const GLOBAL_WIDGETS = [
  'sku_count', 'sku_active_count', 'sales_30d_units', 'sales_30d_revenue_minor',
  'profitable_skus_count', 'unprofitable_skus_count', 'out_of_stock_skus_count',
] as const

const PERIOD_WIDGETS = [
  'period_sales', 'period_returns', 'period_net_sales',
  'top_skus', 'top_cities', 'supply_urgency', 'lost_sales',
] as const

function Stat({ icon: Icon, label, value, sub, trend, trendLabel, to, accent }: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  trend?: number | null
  trendLabel?: string
  to?: string
  accent?: 'green' | 'red' | 'yellow'
}) {
  const accentClasses = accent === 'green' ? 'border-green-200 bg-green-50/30' : accent === 'red' ? 'border-red-200 bg-red-50/30' : accent === 'yellow' ? 'border-yellow-200 bg-yellow-50/30' : 'bg-card'
  const inner = (
    <div className={`rounded-xl border p-5 flex flex-col gap-3 hover:bg-accent/40 transition-colors h-full ${accentClasses}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="flex items-center gap-2 flex-wrap">
        {trend != null && (
          <Badge variant={trend >= 0 ? 'success' : 'destructive'} className="gap-1">
            {trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {fmtPct(trend)}
          </Badge>
        )}
        {trendLabel && <p className="text-xs text-muted-foreground">{trendLabel}</p>}
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className={`h-1.5 rounded-full bg-muted overflow-hidden ${className ?? ''}`}>
      <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [period, setPeriod] = useState<PeriodValue>(() => presetPeriod('month'))
  const { from, to } = period

  const { data: globalData, isLoading: globalLoading } = useQuery({
    queryKey: ['analytics', 'global'],
    queryFn: () => api.post('/analytics/dashboard', { widgets: GLOBAL_WIDGETS }).then(r => r.data.data),
  })

  const { data: periodData, isLoading: periodLoading } = useQuery({
    queryKey: ['analytics', 'period', from, to],
    queryFn: () => api.post('/analytics/dashboard', { widgets: PERIOD_WIDGETS, from, to }).then(r => r.data.data),
  })

  const g = globalData ?? {}
  const p = periodData ?? {}

  const avgCheck = p.period_sales?.units > 0
    ? Math.round(p.period_sales.revenue_minor / p.period_sales.units)
    : null

  const returnRate = p.period_returns?.percent_of_orders

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Добро пожаловать, {user?.name}</p>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {globalLoading ? (
          <>{Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}</>
        ) : (
          <>
            <Stat icon={Package} label="Активных SKU" value={fmtNum(g.sku_active_count)} sub={`Всего: ${fmtNum(g.sku_count)}`} to="/skus" />
            <Stat icon={Boxes} label="Прибыльных SKU" value={fmtNum(g.profitable_skus_count)} sub={`Убыточных: ${fmtNum(g.unprofitable_skus_count)}`} accent={g.unprofitable_skus_count > 0 ? 'yellow' : undefined} />
            <Stat icon={AlertTriangle} label="Нет в наличии" value={fmtNum(g.out_of_stock_skus_count)} sub="SKU без остатка" accent={g.out_of_stock_skus_count > 0 ? 'red' : undefined} />
            <Stat icon={TrendingUp} label="Продажи 30 дней" value={fmtMoney(g.sales_30d_revenue_minor)} sub={`${fmtNum(g.sales_30d_units)} шт`} />
          </>
        )}
      </div>

      {/* Period analytics header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Аналитика за период</h2>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      {/* Period KPI cards - 4 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {periodLoading ? (
          <>{Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}</>
        ) : (
          <>
            <Stat
              icon={ShoppingCart}
              label="Выручка"
              value={fmtMoney(p.period_sales?.revenue_minor)}
              trend={p.period_sales?.change_revenue_pct}
              trendLabel="к пред. периоду"
            />
            <Stat
              icon={Boxes}
              label="Продано штук"
              value={fmtNum(p.period_sales?.units)}
              trend={p.period_sales?.change_units_pct}
              trendLabel={p.period_sales?.prev_units != null ? `было ${fmtNum(p.period_sales.prev_units)}` : undefined}
            />
            <Stat
              icon={ReceiptText}
              label="Средний чек"
              value={avgCheck != null ? fmtMoney(avgCheck) : '—'}
              sub="выручка / штуки"
            />
            <Stat
              icon={Undo2}
              label="Возвраты"
              value={fmtNum(p.period_returns?.count)}
              sub={returnRate != null ? `${returnRate.toFixed(1)}% заказов · ${fmtMoney(p.period_returns?.amount_minor)}` : undefined}
              accent={returnRate != null && returnRate > 10 ? 'red' : returnRate != null && returnRate > 5 ? 'yellow' : undefined}
            />
          </>
        )}
      </div>

      {/* Net sales summary bar */}
      {!periodLoading && p.period_net_sales && p.period_sales && (
        <div className="rounded-xl border bg-card p-5 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Чистые продажи</span>
          </div>
          <span className="text-xl font-bold">{fmtMoney(p.period_net_sales.revenue_minor)}</span>
          <span className="text-sm text-muted-foreground">{fmtNum(p.period_net_sales.units)} шт</span>
          {p.period_sales.revenue_minor > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              Удержано возвратами: {fmtMoney((p.period_sales.revenue_minor ?? 0) - (p.period_net_sales.revenue_minor ?? 0))}
            </span>
          )}
        </div>
      )}

        {/* Lost sales */}
        <div className="rounded-xl border bg-card">
            <div className="px-5 py-4 border-b flex items-center gap-2">
                <AlertTriangle className="size-4 text-yellow-500" />
                <p className="font-semibold text-sm">Упущенные продажи</p>
            </div>
            {periodLoading ? (
                <div className="p-5 flex gap-8">
                    <div className="flex flex-col gap-1.5">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-7 w-16" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-7 w-20" />
                    </div>
                </div>
            ) : p.lost_sales && (p.lost_sales.units > 0 || p.lost_sales.revenue_minor > 0) ? (
                <div className="p-5 flex flex-col gap-4 animate-fade-in">
                    <div className="flex gap-8">
                        <div>
                            <p className="text-xs text-muted-foreground">Штук</p>
                            <p className="text-2xl font-bold text-yellow-600">{fmtNum(p.lost_sales.units)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Упущенная выручка</p>
                            <p className="text-2xl font-bold text-yellow-600">{fmtMoney(p.lost_sales.revenue_minor)}</p>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Потери из-за нулевого остатка на складах Ozon. Пополните запасы через срочные поставки.</p>
                </div>
            ) : (
                <div className="p-5 text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-green-500">●</span> Упущенных продаж нет
                </div>
            )}
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top SKUs */}
        <div className="rounded-xl border bg-card">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">Топ SKU по продажам</p>
              <p className="text-xs text-muted-foreground mt-0.5">За выбранный период</p>
            </div>
            <Link to="/skus" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Все SKU <ChevronRight className="size-3" />
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Шт</TableHead>
                <TableHead className="text-right">Выручка</TableHead>
                <TableHead className="w-20">Доля</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periodLoading && <SkeletonTableRows cols={4} rows={5} />}
              {!periodLoading && (!p.top_skus || p.top_skus.length === 0) && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-sm">Нет данных</TableCell></TableRow>
              )}
              {p.top_skus?.map((s: any) => {
                const share = p.period_sales?.revenue_minor > 0
                  ? (s.revenue_minor / p.period_sales.revenue_minor) * 100
                  : 0
                return (
                  <TableRow key={s.sku_id}>
                    <TableCell>
                      <Link to={`/skus/${s.sku_id}`} className="hover:underline">
                        <div className="text-sm font-medium truncate max-w-[180px]">{s.name || s.article}</div>
                        <div className="font-mono text-xs text-muted-foreground">{s.article}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmtNum(s.units)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtMoney(s.revenue_minor)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">{share.toFixed(1)}%</span>
                        <ProgressBar value={share} max={100} />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* Top Cities */}
        <div className="rounded-xl border bg-card">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <MapPin className="size-4" />
            <p className="font-semibold text-sm">География продаж</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Город</TableHead>
                <TableHead className="text-right">Шт</TableHead>
                <TableHead className="text-right">Выручка</TableHead>
                <TableHead className="w-20">Доля</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periodLoading && <SkeletonTableRows cols={4} rows={5} />}
              {!periodLoading && (!p.top_cities || p.top_cities.length === 0) && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-sm">Нет данных</TableCell></TableRow>
              )}
              {p.top_cities?.map((c: any) => {
                const share = p.period_sales?.revenue_minor > 0
                  ? (c.revenue_minor / p.period_sales.revenue_minor) * 100
                  : 0
                return (
                  <TableRow key={c.cluster_id}>
                    <TableCell className="font-medium text-sm">{c.cluster_name}</TableCell>
                    <TableCell className="text-right">{fmtNum(c.units)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtMoney(c.revenue_minor)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">{share.toFixed(1)}%</span>
                        <ProgressBar value={share} max={100} />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
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
          {periodLoading ? (
            <div className="p-5 flex flex-col gap-4">
              <div className="flex gap-6">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-12" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-12" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            </div>
          ) : p.supply_urgency ? (
            <div className="p-5 flex flex-col gap-4 animate-fade-in">
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
              {p.supply_urgency.by_top_warehouses?.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-muted-foreground font-medium">По складам:</p>
                  {p.supply_urgency.by_top_warehouses.map((w: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{w.cluster_name}</span>
                      <span className="font-medium">{fmtNum(w.units_needed)} шт</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 text-sm text-muted-foreground flex items-center gap-2">
              <span className="text-green-500">●</span> Срочных поставок нет
            </div>
          )}
        </div>


      </div>
    </div>
  )
}
