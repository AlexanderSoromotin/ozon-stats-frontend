import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Plus, Trash2, Save, Info } from 'lucide-react'
import PeriodPicker, { presetPeriod, type PeriodValue } from '@/components/PeriodPicker'
import { fmtMoney, fmtNum, fmtPct, fmtDuration } from '@/lib/format'
import { Label } from '@/components/ui/label'
import { Skeleton, SkeletonStatCard, SkeletonTableRows } from '@/components/ui/skeleton'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Sku {
  id: number
  ozon_sku_id: number | null
  article: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  channel_strategy: 'FBO' | 'FBS'
  item_volume_cm3: number
  default_cover_days: number
  max_cover_days: number | null
  compatible_printers: number[]
  item_area_cm2: number | null
  print_time_sec: number | null
}

interface BomLine {
  id?: number
  component_id: number
  qty_per_unit: number
  write_off_stage: 'PRINT' | 'PACK'
}

interface Component {
  id: number
  name: string
  unit: string
  price_per_unit: number | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Активен', PAUSED: 'Пауза', ARCHIVED: 'Архив' }
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary'> = {
  ACTIVE: 'success', PAUSED: 'warning', ARCHIVED: 'secondary',
}
const UNIT_LABEL: Record<string, string> = { g: 'г', ml: 'мл', pcs: 'шт', m: 'м' }

// ─── BOM Tab ─────────────────────────────────────────────────────────────────

function BomTab({ skuId, isOwner, printTimeSec }: { skuId: number; isOwner: boolean; printTimeSec: number | null }) {
  const qc = useQueryClient()
  const [lines, setLines] = useState<BomLine[] | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saveError, setSaveError] = useState('')

  const { data: bomData, isLoading: bomLoading } = useQuery({
    queryKey: ['bom', skuId],
    queryFn: () => api.get(`/skus/${skuId}/bom`).then(r => r.data.data as BomLine[]),
  })

  const { data: skuStats } = useQuery({
    queryKey: ['sku-stats', skuId],
    queryFn: () => api.get(`/skus/${skuId}`, { params: { include: 'stats' } })
      .then(r => r.data.data?.stats as {
        electricity_cost: number | null; depreciation_cost: number | null
        electricity_qty_wh: number | null; depreciation_rate_per_hour: number | null
      } | undefined),
  })

  // Sync server data into local state once (when not dirty)
  const serverLines = bomData ?? []
  if (!dirty && lines === null && bomData !== undefined) {
    setLines(bomData)
  }

  const { data: compData } = useQuery({
    queryKey: ['components'],
    queryFn: () => api.get('/components').then(r => r.data.data as Component[]),
  })

  const components = compData ?? []

  const saveMutation = useMutation({
    mutationFn: (payload: BomLine[]) =>
      api.put(`/skus/${skuId}/bom`, { lines: payload.map(({ component_id, qty_per_unit, write_off_stage }) => ({ component_id, qty_per_unit, write_off_stage })) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bom', skuId] })
      setDirty(false)
      setSaveError('')
    },
    onError: (e: any) => setSaveError(e.response?.data?.message ?? 'Ошибка сохранения'),
  })

  const currentLines = lines ?? serverLines

  function addLine() {
    const first = components[0]
    setLines([...currentLines, { component_id: first?.id ?? 0, qty_per_unit: 1, write_off_stage: 'PRINT' }])
    setDirty(true)
  }

  function removeLine(idx: number) {
    setLines(currentLines.filter((_, i) => i !== idx))
    setDirty(true)
  }

  function updateLine(idx: number, field: keyof BomLine, value: string | number) {
    setLines(currentLines.map((l, i) => i === idx ? { ...l, [field]: value } : l))
    setDirty(true)
  }

  if (bomLoading) return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-64" />
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Компонент</TableHead>
              <TableHead>Кол-во на ед.</TableHead>
              <TableHead>Ед.</TableHead>
              <TableHead>Стоимость</TableHead>
              <TableHead>Стадия списания</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <SkeletonTableRows cols={5} rows={3} />
          </TableBody>
        </Table>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Состав изделия — расходники на 1 единицу</p>
        {isOwner && (
          <div className="flex items-center gap-2">
            {dirty && (
              <Button size="sm" onClick={() => saveMutation.mutate(currentLines)} disabled={saveMutation.isPending} className="gap-1.5">
                <Save className="size-3.5" /> {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={addLine} className="gap-1.5">
              <Plus className="size-3.5" /> Добавить строку
            </Button>
          </div>
        )}
      </div>

      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      {currentLines.length === 0 && (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          BOM пуст — добавьте расходники
        </div>
      )}

      {currentLines.length > 0 && (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Компонент</TableHead>
                <TableHead>Кол-во на ед.</TableHead>
                <TableHead>Ед.</TableHead>
                <TableHead>Стоимость</TableHead>
                <TableHead>Стадия списания</TableHead>
                {isOwner && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentLines.map((line, idx) => {
                const comp = components.find(c => c.id === line.component_id)
                return (
                  <TableRow key={idx}>
                    <TableCell>
                      {isOwner ? (
                        <Select
                          value={String(line.component_id)}
                          onChange={e => updateLine(idx, 'component_id', Number(e.target.value))}
                          className="w-52"
                        >
                          {components.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </Select>
                      ) : (
                        <span className="font-medium">{comp?.name ?? `#${line.component_id}`}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isOwner ? (
                        <Input
                          inputMode="decimal"
                          value={line.qty_per_unit}
                          onChange={e => {
                            const raw = e.target.value.replace(',', '.')
                            if (raw === '' || raw === '.' || /^\d*\.?\d*$/.test(raw)) {
                              updateLine(idx, 'qty_per_unit', raw as any)
                            }
                          }}
                          onBlur={() => {
                            const n = parseFloat(String(line.qty_per_unit).replace(',', '.'))
                            updateLine(idx, 'qty_per_unit', isNaN(n) ? 0 : n)
                          }}
                          className="w-28"
                        />
                      ) : (
                        line.qty_per_unit
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {comp ? UNIT_LABEL[comp.unit] ?? comp.unit : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {comp?.price_per_unit != null
                        ? `${fmtNum(+(line.qty_per_unit * comp.price_per_unit).toFixed(2))} ₽`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {isOwner ? (
                        <Select
                          value={line.write_off_stage}
                          onChange={e => updateLine(idx, 'write_off_stage', e.target.value)}
                          className="w-36"
                        >
                          <option value="PRINT">При печати</option>
                          <option value="PACK">При упаковке</option>
                        </Select>
                      ) : (
                        <Badge variant="outline">{line.write_off_stage === 'PRINT' ? 'При печати' : 'При упаковке'}</Badge>
                      )}
                    </TableCell>
                    {isOwner && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeLine(idx)} className="text-destructive hover:text-destructive">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
              {skuStats?.electricity_cost != null && (
                <TableRow className="text-muted-foreground">
                  <TableCell className="font-medium">Электроэнергия</TableCell>
                  <TableCell>{skuStats.electricity_qty_wh != null ? `${fmtNum(+skuStats.electricity_qty_wh.toFixed(1))} Вт·ч` : '—'}</TableCell>
                  <TableCell />
                  <TableCell>{fmtNum(+skuStats.electricity_cost.toFixed(2))} ₽</TableCell>
                  <TableCell />
                  {isOwner && <TableCell />}
                </TableRow>
              )}
              {skuStats?.depreciation_cost != null && (
                <TableRow className="text-muted-foreground">
                  <TableCell className="font-medium">Амортизация</TableCell>
                  <TableCell>{printTimeSec != null ? fmtDuration(printTimeSec) : '—'}</TableCell>
                  <TableCell />
                  <TableCell>{fmtNum(+skuStats.depreciation_cost.toFixed(2))} ₽</TableCell>
                  <TableCell />
                  {isOwner && <TableCell />}
                </TableRow>
              )}
              {(() => {
                const materialTotal = currentLines.reduce((sum, line) => {
                  const comp = components.find(c => c.id === line.component_id)
                  if (comp?.price_per_unit == null) return sum
                  return sum + line.qty_per_unit * comp.price_per_unit
                }, 0)
                const allPriced = currentLines.every(line => {
                  const comp = components.find(c => c.id === line.component_id)
                  return comp?.price_per_unit != null
                })
                const total = materialTotal
                  + (skuStats?.electricity_cost ?? 0)
                  + (skuStats?.depreciation_cost ?? 0)
                const hasAny = currentLines.length > 0 || skuStats?.electricity_cost != null || skuStats?.depreciation_cost != null
                const approx = !allPriced || (currentLines.length > 0 && currentLines.some(l => {
                  const c = components.find(cc => cc.id === l.component_id)
                  return c?.price_per_unit == null
                }))
                return hasAny ? (
                  <TableRow className="font-medium">
                    <TableCell colSpan={3} className="text-right">Итого:</TableCell>
                    <TableCell>{approx ? `≈ ${fmtNum(+total.toFixed(2))} ₽` : `${fmtNum(+total.toFixed(2))} ₽`}</TableCell>
                    <TableCell />
                    {isOwner && <TableCell />}
                  </TableRow>
                ) : null
              })()}
            </TableBody>
          </Table>
        </div>
      )}

      {dirty && (
        <p className="text-xs text-muted-foreground">Несохранённые изменения — нажмите «Сохранить» чтобы применить</p>
      )}
    </div>
  )
}

// ─── Info Tab ─────────────────────────────────────────────────────────────────

interface Printer { id: number; name: string }

function InfoTab({ sku, isOwner }: { sku: Sku; isOwner: boolean }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    channel_strategy: sku.channel_strategy,
    item_volume_cm3: sku.item_volume_cm3,
    item_area_cm2: sku.item_area_cm2,
    print_time_sec: sku.print_time_sec,
    default_cover_days: sku.default_cover_days,
    max_cover_days: sku.max_cover_days,
    compatible_printers: sku.compatible_printers ?? [],
  })
  const [error, setError] = useState('')

  const { data: printersData } = useQuery({
    queryKey: ['printers'],
    queryFn: () => api.get('/printers').then(r => r.data.data as Printer[]),
  })
  const printers = printersData ?? []

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/skus/${sku.id}`, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sku', sku.id] }); setError('') },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка'),
  })

  function togglePrinter(id: number) {
    setForm(f => ({
      ...f,
      compatible_printers: f.compatible_printers.includes(id)
        ? f.compatible_printers.filter(p => p !== id)
        : [...f.compatible_printers, id],
    }))
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Read-only info */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Артикул</p>
          <div className="text-sm font-mono">{sku.article}</div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Статус</p>
          <Badge variant={STATUS_VARIANT[sku.status]}>{STATUS_LABEL[sku.status]}</Badge>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Ozon SKU ID</p>
          <div className="text-sm font-medium">{sku.ozon_sku_id ?? '—'}</div>
        </div>
      </div>

      {/* Editable form */}
      <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
        <p className="text-sm font-medium">Локальные параметры</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Канал</Label>
            <Select
              value={form.channel_strategy}
              onChange={e => setForm(f => ({ ...f, channel_strategy: e.target.value as Sku['channel_strategy'] }))}
              disabled={!isOwner}
            >
              <option value="FBO">FBO</option>
              <option value="FBS">FBS</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Объём, см³</Label>
            <Input
              type="number" min={0} step="0.1"
              value={form.item_volume_cm3 ?? ''}
              onChange={e => setForm(f => ({ ...f, item_volume_cm3: e.target.value ? Number(e.target.value) : 0 }))}
              disabled={!isOwner}
              placeholder="0"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Площадь детали, см²</Label>
            <Input
              type="number" min={0} step="0.1"
              value={form.item_area_cm2 ?? ''}
              onChange={e => setForm(f => ({ ...f, item_area_cm2: e.target.value ? Number(e.target.value) : null }))}
              disabled={!isOwner}
              placeholder="25.0"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Время печати, сек</Label>
            <Input
              type="number" min={0}
              value={form.print_time_sec ?? ''}
              onChange={e => setForm(f => ({ ...f, print_time_sec: e.target.value ? Number(e.target.value) : null }))}
              disabled={!isOwner}
              placeholder="1800"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Покрытие по умолчанию, дн</Label>
            <Input
              type="number" min={1}
              value={form.default_cover_days}
              onChange={e => setForm(f => ({ ...f, default_cover_days: Number(e.target.value) }))}
              disabled={!isOwner}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Макс. покрытие, дн</Label>
            <Input
              type="number" min={0}
              value={form.max_cover_days ?? ''}
              onChange={e => setForm(f => ({ ...f, max_cover_days: e.target.value ? Number(e.target.value) : null }))}
              placeholder="без ограничения"
              disabled={!isOwner}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Совместимые принтеры</Label>
          <div className="flex flex-wrap gap-2">
            {printers.map(p => {
              const active = form.compatible_printers.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!isOwner}
                  onClick={() => togglePrinter(p.id)}
                  className={`rounded-md border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}
                >
                  {p.name}
                </button>
              )
            })}
            {printers.length === 0 && <p className="text-xs text-muted-foreground">Нет принтеров</p>}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {isOwner && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2 self-start">
            <Save className="size-4" /> {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

const VERDICT_LABEL: Record<string, string> = {
  profitable: 'Прибыльный',
  marginal: 'На грани',
  unprofitable: 'Убыточный',
  no_data: 'Нет данных',
}
const VERDICT_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  profitable: 'success',
  marginal: 'warning',
  unprofitable: 'destructive',
  no_data: 'secondary',
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex ml-1 cursor-help">
      <Info className="size-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
      <span className="pointer-events-none absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 w-56 rounded-md bg-foreground text-background text-xs leading-snug px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
        {text}
      </span>
    </span>
  )
}

function EconRow({ label, value, tip, indent }: { label: string; value: string; tip?: string; indent?: boolean }) {
  return (
    <div className={`flex justify-between items-center ${indent ? 'pl-3' : ''}`}>
      <span className="text-muted-foreground flex items-center">
        {label}
        {tip && <InfoTip text={tip} />}
      </span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

function AnalyticsTab({ skuId }: { skuId: number }) {
  const [period, setPeriod] = useState<PeriodValue>(() => presetPeriod('month'))

  const { data, isLoading } = useQuery({
    queryKey: ['sku-analytics', skuId, period.from, period.to],
    queryFn: () => api.get(`/skus/${skuId}/analytics`, { params: { from: period.from, to: period.to } }).then(r => r.data.data),
  })

  if (isLoading) return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Аналитика за период</h2>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    </div>
  )
  if (!data) return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Аналитика за период</h2>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      <p className="text-sm text-muted-foreground">Нет данных</p>
    </div>
  )

  const e = data.economics_last_30d
  const verdict = e?.verdict ?? 'no_data'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Аналитика за период</h2>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">Продажи</p>
          <p className="text-2xl font-bold mt-1">{fmtMoney(data.sales_last_30d?.revenue_minor)}</p>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-xs text-muted-foreground">{fmtNum(data.sales_last_30d?.units)} шт</p>
            {data.sales_change_pct != null && (
              <Badge variant={data.sales_change_pct >= 0 ? 'success' : 'destructive'}>
                {fmtPct(data.sales_change_pct)}
              </Badge>
            )}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">Доля в выручке</p>
          <p className="text-2xl font-bold mt-1">{fmtPct(data.revenue_share_pct?.share_pct)}</p>
          <p className="text-xs text-muted-foreground mt-2">от общей выручки</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">Средняя цена</p>
          <p className="text-2xl font-bold mt-1">{fmtNum(data.avg_price)} ₽</p>
          <p className="text-xs text-muted-foreground mt-2">за единицу</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">Возвраты</p>
          <p className="text-2xl font-bold mt-1">{fmtNum(data.returns_last_30d?.count)}</p>
          <p className="text-xs text-muted-foreground mt-2">{fmtMoney(data.returns_last_30d?.amount_minor)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Economics */}
        {e && (
          <div className="rounded-xl border bg-card">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <p className="font-semibold text-sm">Юнит-экономика</p>
              <div className="flex items-center gap-2">
                {e.margin_pct != null && (
                  <span className="text-xs text-muted-foreground">Маржа: {fmtPct(e.margin_pct)}</span>
                )}
                <Badge variant={VERDICT_VARIANT[verdict] ?? 'secondary'}>
                  {VERDICT_LABEL[verdict] ?? verdict}
                </Badge>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-2 text-sm">
              {/* Revenue */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Доходы</p>
              {(e.gross_revenue_minor ?? 0) !== 0 && (
                <EconRow label="Валовая выручка" value={fmtMoney(e.gross_revenue_minor)} tip="Полная цена товара для покупателя (accruals_for_sale) до вычетов Ozon" />
              )}
              <EconRow label="Нетто от Ozon" value={fmtMoney(e.ozon_netto_minor)} tip="Деньги, которые Ozon начисляет продавцу. Комиссия и логистика уже вычтены" />

              {/* Ozon expenses */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-3">Удержания Ozon (детализация)</p>
              <EconRow label="Комиссия" value={'−' + fmtMoney(e.commission_minor)} tip="Вознаграждение Ozon за продажу (5–25% в зависимости от категории)" />
              {(e.acquiring_minor ?? 0) !== 0 && (
                <EconRow label="Эквайринг" value={'−' + fmtMoney(e.acquiring_minor)} tip="Комиссия за приём онлайн-оплаты (~1.5–2%)" />
              )}
              <EconRow label="Логистика" value={'−' + fmtMoney(e.logistics_minor)} tip="Магистральная доставка: от склада FBO до сортировочного центра" />
              {(e.last_mile_minor ?? 0) !== 0 && (
                <EconRow label="Last mile (до ПВЗ)" value={'−' + fmtMoney(e.last_mile_minor)} tip="Доставка от сортировочного центра до пункта выдачи или курьером" />
              )}
              {(e.return_processing_minor ?? 0) !== 0 && (
                <EconRow label="Обработка возвратов" value={'−' + fmtMoney(e.return_processing_minor)} tip="Приёмка и проверка возвращённого товара на складе" />
              )}
              {(e.return_logistics_minor ?? 0) !== 0 && (
                <EconRow label="Обратная логистика" value={'−' + fmtMoney(e.return_logistics_minor)} tip="Транспортировка возвращённого товара от ПВЗ обратно на склад" />
              )}
              {(e.return_amount_minor ?? 0) !== 0 && (
                <EconRow label="Возврат средств" value={'−' + fmtMoney(e.return_amount_minor)} tip="Нетто-сумма возвратных операций" />
              )}
              {(e.storage_minor ?? 0) !== 0 && (
                <EconRow label="Хранение" value={'−' + fmtMoney(e.storage_minor)} tip="Плата за хранение на складе Ozon (FBO). Зависит от объёма и срока" />
              )}
              {(e.marketing_minor ?? 0) !== 0 && (
                <EconRow label="Маркетинг" value={'−' + fmtMoney(e.marketing_minor)} tip="Трафареты, поисковое продвижение, акции, Premium-размещение" />
              )}
              {(e.other_minor ?? 0) !== 0 && (
                <EconRow label="Прочее" value={'−' + fmtMoney(e.other_minor)} tip="Штрафы, утилизация, корректировки и другие операции" />
              )}
              {(() => {
                const ozonTotal = (e.commission_minor ?? 0) + (e.acquiring_minor ?? 0) + (e.logistics_minor ?? 0)
                  + (e.last_mile_minor ?? 0) + (e.return_processing_minor ?? 0) + (e.return_logistics_minor ?? 0)
                  + (e.return_amount_minor ?? 0) + (e.storage_minor ?? 0) + (e.marketing_minor ?? 0) + (e.other_minor ?? 0)
                return (
                  <div className="flex justify-between font-semibold border-t pt-1.5 mt-0.5">
                    <span>Итого расходы Ozon</span>
                    <span className="tabular-nums">−{fmtMoney(ozonTotal)}</span>
                  </div>
                )
              })()}

              {/* COGS */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-3">Себестоимость</p>
              <EconRow label="COGS за период" value={'−' + fmtMoney(e.cogs_minor)} tip="Себестоимость × кол-во проданных. Рассчитывается только в нашей системе" />
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground pl-3 mt-0.5">
                {e.cogs_per_unit_minor != null && <span>На единицу: {fmtMoney(e.cogs_per_unit_minor)}</span>}
                {e.material_cost_per_unit_minor != null && <span>Материалы: {fmtMoney(e.material_cost_per_unit_minor)}</span>}
                {e.electricity_cost_per_unit != null && <span>Электр.: {fmtNum(+e.electricity_cost_per_unit.toFixed(2))} ₽</span>}
                {e.depreciation_cost_per_unit != null && <span>Аморт.: {fmtNum(+e.depreciation_cost_per_unit.toFixed(2))} ₽</span>}
              </div>

              {/* Profit */}
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="font-bold">Прибыль</span>
                <span className={`font-bold tabular-nums ${verdict === 'profitable' ? 'text-green-600' : verdict === 'marginal' ? 'text-yellow-600' : 'text-destructive'}`}>
                  {fmtMoney(e.profit_minor)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Best city */}
        {data.best_city && (
          <div className="rounded-xl border bg-card">
            <div className="px-5 py-4 border-b">
              <p className="font-semibold text-sm">Лучший город</p>
            </div>
            <div className="p-5">
              <p className="text-2xl font-bold">{data.best_city.cluster_name}</p>
              <p className="text-sm text-muted-foreground mt-1">Продано: {fmtNum(data.best_city.units)} шт</p>
            </div>
          </div>
        )}
      </div>

      {/* Stock by warehouse */}
      {data.stock_by_warehouse?.warehouses?.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <p className="font-semibold text-sm">Остатки по складам</p>
            <p className="text-xs text-muted-foreground">Всего: {fmtNum(data.stock_by_warehouse.total_available)}</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Склад</TableHead>
                <TableHead>Кластер</TableHead>
                <TableHead className="text-right">Доступно</TableHead>
                <TableHead className="text-right">В пути</TableHead>
                <TableHead className="text-right">Брак</TableHead>
                <TableHead>Оборачиваемость</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...data.stock_by_warehouse.warehouses].sort((a: any, b: any) => (b.available ?? 0) - (a.available ?? 0)).map((w: any) => (
                <TableRow key={w.warehouse_id}>
                  <TableCell className="text-sm font-medium">{w.warehouse_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{w.cluster_name}</TableCell>
                  <TableCell className="text-right">{fmtNum(w.available)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmtNum(w.in_transit)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmtNum(w.defect)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{w.turnover_grade}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SkuDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isOwner } = useAuth()
  const skuId = Number(id)

  const { data, isLoading } = useQuery({
    queryKey: ['sku', skuId],
    queryFn: () => api.get(`/skus/${skuId}`).then(r => r.data.data as Sku),
  })

  if (isLoading) return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-md" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
  if (!data) return <div className="text-destructive">SKU не найден</div>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/skus')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5 font-mono">{data.article}</p>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Основное</TabsTrigger>
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
          <TabsTrigger value="bom">Состав BOM</TabsTrigger>
        </TabsList>
        <TabsContent value="info">
          <InfoTab sku={data} isOwner={isOwner} />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsTab skuId={skuId} />
        </TabsContent>
        <TabsContent value="bom">
          <BomTab skuId={skuId} isOwner={isOwner} printTimeSec={data.print_time_sec} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
