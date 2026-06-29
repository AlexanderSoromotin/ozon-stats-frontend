import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Warehouse, Coins, Wallet, PiggyBank, Truck, Lock, CalendarClock, Boxes,
  Plus, Minus, ClipboardEdit, Trash2, History, AlertTriangle, Search,
} from 'lucide-react'
import { fmtMoney, fmtNum } from '@/lib/format'

interface StockRow {
  sku_id: number
  sku_name: string | null
  article: string | null
  stock: number
  reserved_fbo: number
  reserved_fbs: number
  in_transit: number
  received_ozon: number
  total: number
}

interface SkuLite {
  id: number
  article: string
  name: string
  default_cover_days: number | null
  sales_30d?: { units: number; revenue_minor: number }
  stats?: { cogs_per_unit_minor: number; avg_sale_price_minor: number }
}

interface Movement {
  id: number
  from_state: string | null
  to_state: string | null
  qty: number
  reason: string
  note: string | null
  occurred_at: string | null
}

const REASON_LABEL: Record<string, string> = {
  PRODUCTION: 'Производство',
  RESERVATION: 'Резерв',
  RESERVATION_CANCELLED: 'Снятие резерва',
  SHIPMENT: 'Отгрузка',
  OZON_ACCEPTANCE: 'Приёмка Ozon',
  SALE: 'Продажа',
  RETURN: 'Возврат',
  ADJUSTMENT: 'Корректировка',
}

const STATE_LABEL: Record<string, string> = {
  STOCK: 'Готово',
  RESERVED_FBS: 'Резерв FBS',
  RESERVED_FBO: 'Резерв FBO',
  IN_TRANSIT: 'В пути',
  RECEIVED_OZON: 'Принято Ozon',
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function Stat({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  accent?: 'green' | 'red' | 'yellow'
}) {
  const accentClasses =
    accent === 'green' ? 'border-green-200 bg-green-50/30'
    : accent === 'red' ? 'border-red-200 bg-red-50/30'
    : accent === 'yellow' ? 'border-yellow-200 bg-yellow-50/30'
    : 'bg-card'
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 h-full ${accentClasses}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─── Coverage helpers ────────────────────────────────────────────────────────

function coverageDays(stock: number, units30d: number): number | null {
  if (units30d <= 0) return null
  const velocity = units30d / 30
  return stock / velocity
}

function coverageBadge(days: number | null): { label: string; variant: 'destructive' | 'warning' | 'success' | 'secondary' } {
  if (days == null) return { label: 'нет продаж', variant: 'secondary' }
  if (days < 7) return { label: `${days.toFixed(0)} дн`, variant: 'destructive' }
  if (days < 14) return { label: `${days.toFixed(0)} дн`, variant: 'warning' }
  return { label: `${days.toFixed(0)} дн`, variant: 'success' }
}

// ─── Action Dialogs ──────────────────────────────────────────────────────────

type ActionKind = 'adjust' | 'set' | 'write-off' | null

function ActionDialog({ kind, row, onClose, onDone }: {
  kind: ActionKind
  row: StockRow | null
  onClose: () => void
  onDone: () => void
}) {
  const [qty, setQty] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [reasonKind, setReasonKind] = useState<'BROKEN' | 'LOST' | 'SAMPLE' | 'OTHER'>('BROKEN')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      if (!row || qty === '' || qty === 0) throw new Error('Введите количество')
      if (kind === 'adjust') {
        await api.post('/warehouse/stock/adjust', { sku_id: row.sku_id, qty: Number(qty), note: note || undefined })
      } else if (kind === 'set') {
        await api.post('/warehouse/stock/set', { sku_id: row.sku_id, qty: Number(qty), note: note || undefined })
      } else if (kind === 'write-off') {
        await api.post('/warehouse/stock/write-off', { sku_id: row.sku_id, qty: Number(qty), reason_kind: reasonKind, note: note || undefined })
      }
    },
    onSuccess: () => { onDone(); reset(); onClose() },
    onError: (e: any) => setError(e.response?.data?.message ?? e.message ?? 'Ошибка'),
  })

  function reset() {
    setQty(''); setNote(''); setReasonKind('BROKEN'); setError('')
  }

  if (!kind || !row) return null

  const titles: Record<Exclude<ActionKind, null>, string> = {
    'adjust': 'Корректировка остатка',
    'set': 'Инвентаризация (точное значение)',
    'write-off': 'Списание со склада',
  }

  return (
    <Dialog open={true} onClose={() => { reset(); onClose() }}>
      <DialogHeader>
        <DialogTitle>{titles[kind]}</DialogTitle>
        <DialogClose onClose={() => { reset(); onClose() }} />
      </DialogHeader>
      <DialogContent>
        <div className="flex flex-col gap-4">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <p className="font-medium">{row.article ?? `#${row.sku_id}`}</p>
            <p className="text-xs text-muted-foreground">{row.sku_name}</p>
            <p className="text-xs text-muted-foreground mt-1">Сейчас на складе: <strong className="text-foreground">{row.stock} шт</strong></p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">
              {kind === 'adjust' && 'Изменение, шт (положительное — приход, отрицательное — расход)'}
              {kind === 'set' && 'Установить значение, шт'}
              {kind === 'write-off' && 'Списать, шт'}
            </Label>
            <Input
              type="number"
              min={kind === 'set' || kind === 'write-off' ? 0 : undefined}
              value={qty}
              onChange={e => setQty(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={kind === 'adjust' ? 'напр. 10 или -3' : '0'}
              autoFocus
            />
          </div>

          {kind === 'write-off' && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Причина</Label>
              <Select value={reasonKind} onChange={e => setReasonKind(e.target.value as any)}>
                <option value="BROKEN">Брак</option>
                <option value="LOST">Потеря</option>
                <option value="SAMPLE">Образец / тест</option>
                <option value="OTHER">Прочее</option>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Комментарий (опционально)</Label>
            <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Например: остатки на полке после смены" />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="size-3.5 shrink-0" /> {error}
            </div>
          )}
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={() => { reset(); onClose() }}>Отмена</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || qty === ''}>
          {mutation.isPending ? 'Сохраняю...' : 'Сохранить'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

// ─── Add new SKU dialog ──────────────────────────────────────────────────────

function AddSkuDialog({ skus, existing, onClose, onDone }: {
  skus: SkuLite[]
  existing: Set<number>
  onClose: () => void
  onDone: () => void
}) {
  const [skuId, setSkuId] = useState<number | ''>('')
  const [qty, setQty] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const available = skus.filter(s => !existing.has(s.id))

  const mutation = useMutation({
    mutationFn: async () => {
      if (!skuId || !qty || qty <= 0) throw new Error('Заполните SKU и количество')
      await api.post('/warehouse/stock/adjust', { sku_id: skuId, qty: Number(qty), note: note || undefined })
    },
    onSuccess: () => { onDone(); onClose() },
    onError: (e: any) => setError(e.response?.data?.message ?? e.message ?? 'Ошибка'),
  })

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Добавить SKU на склад</DialogTitle>
        <DialogClose onClose={onClose} />
      </DialogHeader>
      <DialogContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">SKU (только те, которых пока нет на складе)</Label>
            <Select value={skuId} onChange={e => setSkuId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— выберите —</option>
              {available.map(s => (
                <option key={s.id} value={s.id}>{s.article} — {s.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Количество, шт</Label>
            <Input type="number" min={1} value={qty} onChange={e => setQty(e.target.value === '' ? '' : Number(e.target.value))} autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Комментарий (опционально)</Label>
            <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Например: первоначальная инвентаризация" />
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="size-3.5 shrink-0" /> {error}
            </div>
          )}
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Отмена</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Сохраняю...' : 'Добавить'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

// ─── History dialog ──────────────────────────────────────────────────────────

function HistoryDialog({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-stock', row.sku_id],
    queryFn: () => api.get(`/warehouse/stock/${row.sku_id}`).then(r => r.data.data as {
      quantities: Record<string, number>
      recent_movements: Movement[]
    }),
  })

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>История: {row.article ?? `#${row.sku_id}`}</DialogTitle>
        <DialogClose onClose={onClose} />
      </DialogHeader>
      <DialogContent>
        {isLoading && <p className="text-sm text-muted-foreground">Загрузка...</p>}
        {data && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              {Object.entries(data.quantities).map(([state, qty]) => (
                <div key={state} className="rounded-md border px-2 py-1.5">
                  <p className="text-muted-foreground">{STATE_LABEL[state] ?? state}</p>
                  <p className="font-semibold">{qty}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-medium mb-2 text-muted-foreground">Последние 50 движений</p>
              <div className="rounded-md border max-h-80 overflow-auto">
                {data.recent_movements.length === 0 && (
                  <p className="text-sm text-muted-foreground p-4 text-center">Нет движений</p>
                )}
                {data.recent_movements.map(m => {
                  const dir = m.from_state && m.to_state ? '→' : m.to_state ? '+' : '−'
                  return (
                    <div key={m.id} className="px-3 py-2 border-b last:border-b-0 text-sm flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs">
                          <span className="font-mono">{dir} {m.qty}</span>{' '}
                          <span className="text-muted-foreground">
                            {m.from_state && STATE_LABEL[m.from_state]}
                            {m.from_state && m.to_state && ' → '}
                            {m.to_state && STATE_LABEL[m.to_state]}
                          </span>
                        </p>
                        {m.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.note}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="text-[10px]">{REASON_LABEL[m.reason] ?? m.reason}</Badge>
                        <p className="text-[10px] text-muted-foreground mt-1">{m.occurred_at ? new Date(m.occurred_at).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Закрыть</Button>
      </DialogFooter>
    </Dialog>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [onlyLow, setOnlyLow] = useState(false)
  const [actionKind, setActionKind] = useState<ActionKind>(null)
  const [actionRow, setActionRow] = useState<StockRow | null>(null)
  const [historyRow, setHistoryRow] = useState<StockRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['warehouse-stock-list'],
    queryFn: () => api.get('/warehouse/stock').then(r => r.data.data as StockRow[]),
  })

  const { data: skusData } = useQuery({
    queryKey: ['skus', 'with-stats'],
    queryFn: () => api.get('/skus', {
      params: { per_page: 500, status: 'ACTIVE', include: 'sales_30d,stats' },
    }).then(r => r.data.data as SkuLite[]),
  })

  const skus = skusData ?? []
  const skusById = useMemo(() => new Map(skus.map(s => [s.id, s])), [skus])
  const rows = stockData ?? []

  const enriched = useMemo(() => rows.map(r => {
    const sku = skusById.get(r.sku_id)
    const units30 = sku?.sales_30d?.units ?? 0
    const avgPriceMinor = sku?.stats?.avg_sale_price_minor ?? (sku?.sales_30d ? Math.round(sku.sales_30d.revenue_minor / Math.max(sku.sales_30d.units, 1)) : 0)
    const cogsMinor = sku?.stats?.cogs_per_unit_minor ?? 0
    const cov = coverageDays(r.stock, units30)
    return {
      ...r,
      units30d: units30,
      avg_price_minor: avgPriceMinor,
      cogs_minor: cogsMinor,
      potential_revenue_minor: r.stock * avgPriceMinor,
      potential_profit_minor: r.stock * Math.max(avgPriceMinor - cogsMinor, 0),
      stock_cost_minor: r.stock * cogsMinor,
      coverage_days: cov,
    }
  }), [rows, skusById])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return enriched.filter(r => {
      if (q && !(r.article?.toLowerCase().includes(q) || r.sku_name?.toLowerCase().includes(q))) return false
      if (onlyLow && (r.coverage_days == null || r.coverage_days >= 14)) return false
      return true
    })
  }, [enriched, search, onlyLow])

  // KPI totals
  const totals = useMemo(() => {
    const t = {
      units: 0,
      distinctSkus: 0,
      potentialRevenue: 0,
      potentialProfit: 0,
      stockCost: 0,
      reserved: 0,
      inTransit: 0,
      coverage: null as number | null,
    }
    let totalVelocity = 0
    for (const r of enriched) {
      t.units += r.stock
      if (r.stock > 0) t.distinctSkus++
      t.potentialRevenue += r.potential_revenue_minor
      t.potentialProfit += r.potential_profit_minor
      t.stockCost += r.stock_cost_minor
      t.reserved += r.reserved_fbo + r.reserved_fbs
      t.inTransit += r.in_transit
      totalVelocity += r.units30d / 30
    }
    t.coverage = totalVelocity > 0 ? t.units / totalVelocity : null
    return t
  }, [enriched])

  function refresh() {
    qc.invalidateQueries({ queryKey: ['warehouse-stock-list'] })
    if (actionRow) qc.invalidateQueries({ queryKey: ['warehouse-stock', actionRow.sku_id] })
  }

  function openAction(kind: Exclude<ActionKind, null>, row: StockRow) {
    setActionRow(row)
    setActionKind(kind)
  }

  const existingSkuIds = useMemo(() => new Set(rows.map(r => r.sku_id)), [rows])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Свой склад</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Готовая продукция на личном складе — приход, инвентаризация, списания</p>
        </div>
        {isOwner && (
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="size-4" /> Добавить SKU
          </Button>
        )}
      </div>

      {/* KPI dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Boxes} label="Всего на складе" value={fmtNum(totals.units)} sub={`${totals.distinctSkus} SKU`} />
        <Stat icon={Coins} label="Потенциальная выручка" value={fmtMoney(totals.potentialRevenue)} sub="по средней цене продажи" />
        <Stat icon={PiggyBank} label="Потенциальная прибыль" value={fmtMoney(totals.potentialProfit)} accent="green" sub="выручка − COGS" />
        <Stat icon={Wallet} label="Себестоимость запаса" value={fmtMoney(totals.stockCost)} sub="заморожено в материалах" />
        <Stat icon={Lock} label="Зарезервировано" value={fmtNum(totals.reserved)} sub="под поставки FBO/FBS" />
        <Stat icon={Truck} label="В пути в Ozon" value={fmtNum(totals.inTransit)} sub="ожидает приёмки" />
        <Stat
          icon={CalendarClock}
          label="Покрытие (средн.)"
          value={totals.coverage == null ? '—' : `${totals.coverage.toFixed(0)} дн`}
          sub="средневзвешенное по скорости"
          accent={totals.coverage != null && totals.coverage < 14 ? 'yellow' : undefined}
        />
        <Stat icon={Warehouse} label="Уникальных SKU" value={fmtNum(totals.distinctSkus)} sub={`из ${skus.length} активных`} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Поиск по артикулу или названию" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={onlyLow} onChange={e => setOnlyLow(e.target.checked)} className="size-4" />
          Только с низким покрытием (&lt;14 дн)
        </label>
      </div>

      {/* Stock table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Готово</TableHead>
              <TableHead className="text-right">Резерв</TableHead>
              <TableHead className="text-right">В пути</TableHead>
              <TableHead className="text-right">Ozon</TableHead>
              <TableHead className="text-right">Скорость/дн</TableHead>
              <TableHead>Покрытие</TableHead>
              <TableHead className="text-right">Потенц. прибыль</TableHead>
              <TableHead className="text-right w-56">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockLoading && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">Загрузка...</TableCell></TableRow>
            )}
            {!stockLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                {rows.length === 0 ? 'Склад пуст. Нажмите «Добавить SKU», чтобы внести остатки.' : 'Нет SKU по фильтру'}
              </TableCell></TableRow>
            )}
            {filtered.map(r => {
              const badge = coverageBadge(r.coverage_days)
              const velocity = r.units30d / 30
              return (
                <TableRow key={r.sku_id}>
                  <TableCell>
                    <p className="font-medium">{r.article ?? `#${r.sku_id}`}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{r.sku_name}</p>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{r.stock}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r.reserved_fbo + r.reserved_fbs || '—'}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r.in_transit || '—'}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r.received_ozon || '—'}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{velocity > 0 ? velocity.toFixed(1) : '—'}</TableCell>
                  <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                  <TableCell className="text-right text-xs">{r.potential_profit_minor > 0 ? fmtMoney(r.potential_profit_minor) : '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {isOwner && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => openAction('adjust', r)} title="Корректировка ±">
                            <Plus className="size-3.5" /><Minus className="size-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openAction('set', r)} title="Инвентаризация">
                            <ClipboardEdit className="size-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openAction('write-off', r)} title="Списать" className="text-destructive hover:text-destructive">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setHistoryRow(r)} title="История">
                        <History className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <ActionDialog
        kind={actionKind}
        row={actionRow}
        onClose={() => { setActionKind(null); setActionRow(null) }}
        onDone={refresh}
      />
      {historyRow && <HistoryDialog row={historyRow} onClose={() => setHistoryRow(null)} />}
      {addOpen && (
        <AddSkuDialog
          skus={skus}
          existing={existingSkuIds}
          onClose={() => setAddOpen(false)}
          onDone={refresh}
        />
      )}
    </div>
  )
}
