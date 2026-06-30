import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Link } from 'react-router-dom'
import { Search, ChevronDown, ChevronRight, Boxes, Truck, MapPin, AlertCircle } from 'lucide-react'
import { fmtMoney, fmtNum, fmtDuration } from '@/lib/format'
import { SkeletonTableRows } from '@/components/ui/skeleton'

interface Sku {
  id: number
  ozon_sku_id: number | null
  article: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  channel_strategy: 'FBO' | 'FBS'
  print_time_sec: number | null
  item_volume_cm3: number | null
  item_area_cm2: number | null
  compatible_printers?: number[]
  sales_30d?: { units: number; revenue_minor: number }
  stats?: {
    cogs_per_unit_minor: number | null
    avg_sale_price_minor: number | null
    total_cost: number | null
    production_cost: number | null
    verdict: 'profitable' | 'marginal' | 'unprofitable' | 'no_data' | null
    margin_pct: number | null
    compatible_printers: Array<{ id: number; name: string; status: string }>
    electricity_cost: number | null
    depreciation_cost: number | null
  }
}

interface ClusterSkuRow {
  sku_id: number
  article: string | null
  name: string | null
  available: number
  transit: number
}

interface ClusterStockRow {
  cluster_id: number
  cluster_name: string
  total_available: number
  total_transit: number
  sku_count: number
  skus: ClusterSkuRow[]
}

function missingFields(sku: Sku): string[] {
  const m: string[] = []
  if (!sku.print_time_sec) m.push('время печати')
  if (!sku.item_volume_cm3) m.push('объём')
  if (!sku.item_area_cm2) m.push('площадь')
  if (!sku.compatible_printers?.length) m.push('принтеры')
  return m
}

// ─── SKU tab ─────────────────────────────────────────────────────────────────

function SkuTab() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['skus', page, search],
    queryFn: () => api.get('/skus', { params: { page, per_page: 20, search: search || undefined, include: 'sales_30d,stats' } }).then(r => r.data),
  })

  const skus: Sku[] = data?.data ?? []
  const meta = data?.meta

  const sortedSkus = useMemo(
    () => [...skus].sort((a, b) => (b.sales_30d?.revenue_minor ?? 0) - (a.sales_30d?.revenue_minor ?? 0)),
    [skus],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию или артикулу..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Артикул</TableHead>
              <TableHead>Канал</TableHead>
              <TableHead className="text-right">Ср. цена</TableHead>
              <TableHead className="text-right">Себестоимость</TableHead>
              <TableHead>Совместимые принтеры</TableHead>
              <TableHead>Рентабельность</TableHead>
              <TableHead className="text-right">Время печати</TableHead>
              <TableHead className="text-right">Продажи 30д ↓</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <SkeletonTableRows cols={8} rows={8} />}
            {!isLoading && sortedSkus.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">Ничего не найдено</TableCell></TableRow>
            )}
            {sortedSkus.map(sku => {
              const missing = missingFields(sku)
              return (
              <TableRow key={sku.id}>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Link to={`/skus/${sku.id}`} className="font-mono text-xs hover:underline underline-offset-4">{sku.article}</Link>
                    {missing.length > 0 && (
                      <span title={`Не заполнено: ${missing.join(', ')}`}>
                        <AlertCircle className="size-3.5 text-destructive shrink-0" />
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{sku.channel_strategy}</Badge></TableCell>
                <TableCell className="text-right text-sm">{sku.stats?.avg_sale_price_minor != null ? fmtMoney(sku.stats.avg_sale_price_minor) : '—'}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{sku.stats?.production_cost != null ? `${fmtNum(+sku.stats.production_cost.toFixed(2))} ₽` : '—'}</TableCell>
                <TableCell className="text-sm">
                  {sku.stats?.compatible_printers?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {sku.stats.compatible_printers.map(p => (
                        <Badge key={p.id} variant="outline" className="text-xs">{p.name}</Badge>
                      ))}
                    </div>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-sm">
                  {(() => {
                    const v = sku.stats?.verdict
                    if (!v || v === 'no_data') return <span className="text-muted-foreground">—</span>
                    const cfg: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
                      profitable: { label: 'Прибыльный', variant: 'success' },
                      marginal: { label: 'Маржинальный', variant: 'warning' },
                      unprofitable: { label: 'Убыточный', variant: 'destructive' },
                    }
                    const c = cfg[v]
                    const m = sku.stats?.margin_pct
                    return <div className="flex items-center gap-2">
                      <Badge variant={c.variant}>{c.label}</Badge>
                      {m != null && <span className="text-muted-foreground">{m > 0 ? '+' : ''}{m.toFixed(1)}%</span>}
                    </div>
                  })()}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {sku.print_time_sec != null ? fmtDuration(sku.print_time_sec) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  {sku.sales_30d ? (
                    <div>
                      <div className="text-sm font-medium">{fmtMoney(sku.sales_30d.revenue_minor)}</div>
                      <div className="text-xs text-muted-foreground">{fmtNum(sku.sales_30d.units)} шт</div>
                    </div>
                  ) : '—'}
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </div>

      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Всего: {meta.total}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Назад</Button>
            <span>{page} / {meta.last_page}</span>
            <Button variant="outline" size="sm" disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}>Вперёд</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Cluster tab ──────────────────────────────────────────────────────────────

function ClusterTab() {
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(new Set())

  const toggleCluster = useCallback((id: number) => {
    setExpandedClusters(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const { data: resp, isLoading } = useQuery({
    queryKey: ['warehouse-stock-by-cluster'],
    queryFn: () => api.get('/warehouse/stock/by-cluster').then(r => r.data as { data: ClusterStockRow[]; snapshot_at: string | null }),
  })

  const clusters = resp?.data ?? []
  const snapshotAt = resp?.snapshot_at ?? null

  return (
    <div className="flex flex-col gap-3">
      {isLoading && <p className="text-sm text-muted-foreground py-12 text-center">Загрузка...</p>}
      {!isLoading && snapshotAt && (
        <p className="text-xs text-muted-foreground">Данные Ozon на {new Date(snapshotAt).toLocaleString('ru', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      )}
      {!isLoading && clusters.length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center">
          Нет данных об остатках Ozon. Выполните синхронизацию остатков.
        </p>
      )}
      {clusters.map(cluster => {
        const expanded = expandedClusters.has(cluster.cluster_id)
        return (
          <div key={cluster.cluster_id} className="rounded-xl border bg-card overflow-hidden">
            <button
              onClick={() => toggleCluster(cluster.cluster_id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
            >
              {expanded
                ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              }
              <span className="font-medium flex-1">{cluster.cluster_name}</span>
              <div className="flex items-center gap-5 text-sm">
                <span className="text-muted-foreground">{cluster.sku_count} SKU</span>
                <span className="flex items-center gap-1.5">
                  <Boxes className="size-3.5 text-muted-foreground" />
                  <span className="font-semibold">{cluster.total_available}</span>
                  <span className="text-muted-foreground text-xs">в наличии</span>
                </span>
                {cluster.total_transit > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Truck className="size-3.5 text-muted-foreground" />
                    <span className="font-semibold">{cluster.total_transit}</span>
                    <span className="text-muted-foreground text-xs">в пути</span>
                  </span>
                )}
              </div>
            </button>

            {expanded && (
              <div className="border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">В наличии</TableHead>
                      <TableHead className="text-right">В пути</TableHead>
                      <TableHead className="text-right">Итого</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cluster.skus.map(sku => {
                      const isEmpty = sku.available === 0 && sku.transit === 0
                      return (
                        <TableRow key={sku.sku_id} className={isEmpty ? 'opacity-40' : ''}>
                          <TableCell>
                            <p className="font-medium">{sku.article ?? `#${sku.sku_id}`}</p>
                            {sku.name && <p className="text-xs text-muted-foreground line-clamp-1">{sku.name}</p>}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {sku.available > 0 ? sku.available : <span className="text-muted-foreground">0</span>}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {sku.transit > 0 ? sku.transit : '—'}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {sku.available + sku.transit > 0 ? sku.available + sku.transit : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'sku' | 'cluster'

export default function SkusPage() {
  const [tab, setTab] = useState<Tab>('sku')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Каталог SKU</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Товарные позиции и наличие по кластерам</p>
      </div>

      <div className="flex gap-1 border-b">
        <TabButton active={tab === 'sku'} onClick={() => setTab('sku')}>По SKU</TabButton>
        <TabButton active={tab === 'cluster'} onClick={() => setTab('cluster')}>
          <MapPin className="size-3.5" /> По кластерам
        </TabButton>
      </div>

      {tab === 'sku' && <SkuTab />}
      {tab === 'cluster' && <ClusterTab />}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
        active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}
