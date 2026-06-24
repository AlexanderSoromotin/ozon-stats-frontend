import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
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

export default function SkusPage() {
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Каталог SKU</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Товарные позиции</p>
      </div>

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
            {sortedSkus.map(sku => (
              <TableRow key={sku.id}>
                <TableCell>
                  <Link to={`/skus/${sku.id}`} className="font-mono text-xs hover:underline underline-offset-4">{sku.article}</Link>
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
            ))}
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
