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
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format'
import { Label } from '@/components/ui/label'

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
  type: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Активен', PAUSED: 'Пауза', ARCHIVED: 'Архив' }
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary'> = {
  ACTIVE: 'success', PAUSED: 'warning', ARCHIVED: 'secondary',
}
const UNIT_LABEL: Record<string, string> = { g: 'г', ml: 'мл', pcs: 'шт', m: 'м' }

// ─── BOM Tab ─────────────────────────────────────────────────────────────────

function BomTab({ skuId, isOwner }: { skuId: number; isOwner: boolean }) {
  const qc = useQueryClient()
  const [lines, setLines] = useState<BomLine[] | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saveError, setSaveError] = useState('')

  const { data: bomData, isLoading: bomLoading } = useQuery({
    queryKey: ['bom', skuId],
    queryFn: () => api.get(`/skus/${skuId}/bom`).then(r => r.data.data as BomLine[]),
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

  if (bomLoading) return <p className="text-sm text-muted-foreground">Загрузка...</p>

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
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.qty_per_unit}
                          onChange={e => updateLine(idx, 'qty_per_unit', Number(e.target.value))}
                          className="w-28"
                        />
                      ) : (
                        line.qty_per_unit
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {comp ? UNIT_LABEL[comp.unit] ?? comp.unit : '—'}
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
              type="number" min={0}
              value={form.item_volume_cm3}
              onChange={e => setForm(f => ({ ...f, item_volume_cm3: Number(e.target.value) }))}
              disabled={!isOwner}
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

function AnalyticsTab({ skuId }: { skuId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['sku-analytics', skuId],
    queryFn: () => api.get(`/skus/${skuId}/analytics`).then(r => r.data.data),
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Загрузка...</p>
  if (!data) return <p className="text-sm text-muted-foreground">Нет данных</p>

  const e = data.economics_last_30d
  const profitable = e?.verdict === 'profitable'

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-muted-foreground">За последние 30 дней</p>

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
              <p className="font-semibold text-sm">Экономика</p>
              <Badge variant={profitable ? 'success' : 'destructive'}>
                {profitable ? 'Прибыльный' : 'Убыточный'}
              </Badge>
            </div>
            <div className="p-5 flex flex-col gap-2 text-sm">
              {[
                ['Выручка', fmtMoney(e.revenue_minor)],
                ['Комиссия', '−' + fmtMoney(e.commission_minor)],
                ['Логистика', '−' + fmtMoney(e.logistics_minor)],
                ['Возвраты', '−' + fmtMoney(e.returns_minor)],
                ['COGS (себестоимость)', '−' + fmtMoney(e.cogs_minor)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 mt-1">
                <span className="font-semibold">Прибыль</span>
                <span className={`font-bold ${profitable ? 'text-green-600' : 'text-destructive'}`}>
                  {fmtMoney(e.profit_minor)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">COGS на единицу: {fmtMoney(e.cogs_per_unit_minor)}</p>
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
              {data.stock_by_warehouse.warehouses.map((w: any) => (
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

  if (isLoading) return <div className="text-muted-foreground">Загрузка...</div>
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
          <BomTab skuId={skuId} isOwner={isOwner} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
