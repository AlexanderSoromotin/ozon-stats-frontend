import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Trash2, Hammer, Send, AlertTriangle, FileText, Calendar, CheckCircle2, Eye, Calculator, ClipboardCheck, CalendarRange, Wand2 } from 'lucide-react'
import { fmtDate, fmtDateTime, fmtMoney } from '@/lib/format'

interface Sku { id: number; name: string; article: string }
interface Cluster { id: number; name: string }
interface BoxType { id: number; name: string; inner_volume_cm3: number }

interface Signal {
  sku_id: number | ''; cluster_id: number | ''
  need_qty: number; ship_by_date: string; criticality_days: number
}

interface CargoDraft { sku_id: number; box_type_id: number; qty: number; estimated_capacity?: number }
interface DraftGroup { cluster_id: number; ship_by_date: string; cargoes: CargoDraft[]; deferred: any[] }

interface Supply {
  id: number; cluster_id: number; status: string; channel: string
  ship_by_date: string | null
  ozon_supply_id: number | null; ozon_supply_order_number: string | null
  ozon_operation_id: string | null
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Черновик', SUBMITTED: 'Отправлено', ACCEPTED: 'Принято', CANCELLED: 'Отменено',
}
const STATUS_VARIANT: Record<string, 'outline' | 'warning' | 'success' | 'secondary'> = {
  DRAFT: 'outline', SUBMITTED: 'warning', ACCEPTED: 'success', CANCELLED: 'secondary',
}

const emptySignal = (): Signal => ({ sku_id: '', cluster_id: '', need_qty: 0, ship_by_date: '', criticality_days: 7 })

// ─── Build Tab ───────────────────────────────────────────────────────────────

function BuildTab() {
  const [signals, setSignals] = useState<Signal[]>([emptySignal()])
  const [drafts, setDrafts] = useState<DraftGroup[] | null>(null)
  const [error, setError] = useState('')
  const [submittedId, setSubmittedId] = useState<number | null>(null)

  const { data: skusData } = useQuery({
    queryKey: ['skus', 'all-active'],
    queryFn: () => api.get('/skus', { params: { per_page: 200, status: 'ACTIVE' } }).then(r => r.data.data as Sku[]),
  })
  const { data: clustersData } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => api.get('/reference/clusters').then(r => r.data.data as Cluster[]),
  })
  const { data: boxesData } = useQuery({
    queryKey: ['box-types'],
    queryFn: () => api.get('/box-types').then(r => r.data.data as BoxType[]),
  })

  const skus = skusData ?? []
  const clusters = clustersData ?? []
  const boxes = boxesData ?? []

  const buildMutation = useMutation({
    mutationFn: () => api.post('/supply/build', { signals }).then(r => r.data.data as DraftGroup[]),
    onSuccess: (data) => { setDrafts(data); setError(''); setSubmittedId(null) },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка'),
  })
  const submitMutation = useMutation({
    mutationFn: (g: DraftGroup) =>
      api.post('/supply/submit', {
        cluster_id: g.cluster_id, ship_by_date: g.ship_by_date,
        cargoes: g.cargoes.map(c => ({ sku_id: c.sku_id, box_type_id: c.box_type_id, qty: c.qty })),
      }).then(r => r.data.data),
    onSuccess: (data) => { setSubmittedId(data.id); setDrafts(null) },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка'),
  })

  function update(i: number, field: keyof Signal, value: any) {
    setSignals(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="font-medium text-sm">Сигналы потребности</p>
          <Button size="sm" variant="outline" onClick={() => setSignals(p => [...p, emptySignal()])} className="gap-1.5">
            <Plus className="size-3.5" /> Строка
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {signals.map((s, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4 flex flex-col gap-1.5">
                {i === 0 && <Label className="text-xs">SKU</Label>}
                <Select value={s.sku_id} onChange={e => update(i, 'sku_id', e.target.value ? Number(e.target.value) : '')}>
                  <option value="">—</option>
                  {skus.map(sk => <option key={sk.id} value={sk.id}>{sk.article} — {sk.name}</option>)}
                </Select>
              </div>
              <div className="col-span-3 flex flex-col gap-1.5">
                {i === 0 && <Label className="text-xs">Кластер</Label>}
                <Select value={s.cluster_id} onChange={e => update(i, 'cluster_id', e.target.value ? Number(e.target.value) : '')}>
                  <option value="">—</option>
                  {clusters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                {i === 0 && <Label className="text-xs">Нужно</Label>}
                <Input type="number" min={1} value={s.need_qty || ''} onChange={e => update(i, 'need_qty', Number(e.target.value))} />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                {i === 0 && <Label className="text-xs">Отгрузить до</Label>}
                <Input type="date" value={s.ship_by_date} onChange={e => update(i, 'ship_by_date', e.target.value)} />
              </div>
              <div className="col-span-1 flex">
                <Button variant="ghost" size="icon" onClick={() => setSignals(p => p.filter((_, idx) => idx !== i))} disabled={signals.length === 1} className="text-destructive hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button onClick={() => buildMutation.mutate()} disabled={buildMutation.isPending || signals.some(s => !s.sku_id || !s.cluster_id || !s.need_qty || !s.ship_by_date)} className="gap-2 self-start">
          <Hammer className="size-4" /> {buildMutation.isPending ? 'Построение...' : 'Построить черновик'}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {submittedId !== null && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="size-4" /> Поставка #{submittedId} отправлена. Перейдите на вкладку «Список» для финализации.
        </div>
      )}

      {drafts?.map((group, idx) => {
        const cluster = clusters.find(c => c.id === group.cluster_id)
        return (
          <div key={idx} className="rounded-xl border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <p className="font-semibold text-sm">{cluster?.name ?? `Кластер #${group.cluster_id}`}</p>
                <p className="text-xs text-muted-foreground">Отгрузка до {group.ship_by_date}</p>
              </div>
              <Button size="sm" onClick={() => submitMutation.mutate(group)} disabled={submitMutation.isPending} className="gap-1.5">
                <Send className="size-3.5" /> Отправить
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>SKU</TableHead><TableHead>Короб</TableHead><TableHead className="text-right">Кол-во</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {group.cargoes.map((c, i) => {
                  const sku = skus.find(s => s.id === c.sku_id)
                  const box = boxes.find(b => b.id === c.box_type_id)
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{sku?.name ?? `#${c.sku_id}`}</TableCell>
                      <TableCell className="text-muted-foreground">{box?.name ?? `#${c.box_type_id}`}</TableCell>
                      <TableCell className="text-right">{c.qty}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {group.deferred?.length > 0 && (
              <div className="px-5 py-3 border-t bg-yellow-50/50 text-xs text-yellow-800">
                Отложено: {group.deferred.length} позиций
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── List Tab ────────────────────────────────────────────────────────────────

function ListTab({ onOpen }: { onOpen: (id: number) => void }) {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['supplies', status, page],
    queryFn: () => api.get('/supplies', { params: { status: status || undefined, per_page: 25, page } }).then(r => r.data),
    refetchInterval: 15000,
  })

  const supplies: Supply[] = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Статус</Label>
          <Select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="w-44">
            <option value="">Все</option>
            <option value="DRAFT">Черновик</option>
            <option value="SUBMITTED">Отправлено</option>
            <option value="ACCEPTED">Принято</option>
            <option value="CANCELLED">Отменено</option>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Канал</TableHead>
              <TableHead>Кластер</TableHead>
              <TableHead>Отгрузка до</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Ozon ID</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Загрузка...</TableCell></TableRow>}
            {!isLoading && supplies.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Нет поставок</TableCell></TableRow>}
            {supplies.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">#{s.id}</TableCell>
                <TableCell><Badge variant="outline">{s.channel}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-sm">#{s.cluster_id}</TableCell>
                <TableCell className="text-sm">{fmtDate(s.ship_by_date)}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-xs">{s.ozon_supply_order_number ?? s.ozon_supply_id ?? '—'}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => onOpen(s.id)}><Eye className="size-3.5" /></Button>
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

// ─── Detail Dialog ───────────────────────────────────────────────────────────

function SupplyDetailDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const [tsFrom, setTsFrom] = useState('')
  const [tsTo, setTsTo] = useState('')
  const [slots, setSlots] = useState<any[] | null>(null)
  const [selected, setSelected] = useState<any | null>(null)
  const [error, setError] = useState('')

  const { data: supply, refetch } = useQuery({
    queryKey: ['supply', id],
    queryFn: () => api.get(`/supply/${id}`).then(r => r.data.data),
    refetchInterval: 10000,
  })

  const tsMutation = useMutation({
    mutationFn: () => api.post(`/supply/${id}/timeslots`, { from: tsFrom, to: tsTo }).then(r => r.data.data),
    onSuccess: (data) => { setSlots(Array.isArray(data) ? data : data?.timeslots ?? []); setError('') },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка'),
  })

  const finalizeMutation = useMutation({
    mutationFn: () => api.post(`/supply/${id}/finalize`, {
      timeslot_from: selected.from ?? selected.timeslot_from,
      timeslot_to: selected.to ?? selected.timeslot_to,
    }),
    onSuccess: () => { setSelected(null); setSlots(null); refetch() },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка'),
  })

  async function downloadLabel(cargoId: number) {
    try {
      const res = await api.get(`/supply/${id}/cargoes/${cargoId}/label`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'PDF этикетки ещё не готов')
    }
  }

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Поставка #{id}</DialogTitle>
        <DialogClose onClose={onClose} />
      </DialogHeader>
      <DialogContent>
        {!supply && <p className="text-sm text-muted-foreground">Загрузка...</p>}
        {supply && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={STATUS_VARIANT[supply.status]}>{STATUS_LABEL[supply.status]}</Badge>
              <span className="text-sm text-muted-foreground">Канал: <strong className="text-foreground">{supply.channel}</strong></span>
              <span className="text-sm text-muted-foreground">Отгрузка: <strong className="text-foreground">{fmtDate(supply.ship_by_date)}</strong></span>
            </div>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              {supply.ozon_supply_id && <span>Ozon ID: {supply.ozon_supply_id}</span>}
              {supply.ozon_supply_order_number && <span>№ заказа: {supply.ozon_supply_order_number}</span>}
              {supply.ozon_operation_id && <span>Operation: {supply.ozon_operation_id}</span>}
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Груз</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Кол-во</TableHead><TableHead className="w-20" /></TableRow>
                </TableHeader>
                <TableBody>
                  {supply.cargoes?.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">#{c.id}</TableCell>
                      <TableCell>#{c.sku_id}</TableCell>
                      <TableCell className="text-right">{c.qty}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => downloadLabel(c.id)} className="gap-1.5">
                          <FileText className="size-3.5" /> PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Timeslots */}
            {(supply.status === 'SUBMITTED' || supply.status === 'DRAFT') && (
              <div className="rounded-md border p-4 flex flex-col gap-3">
                <p className="text-sm font-medium flex items-center gap-2"><Calendar className="size-4" /> Выбор таймслота</p>
                <div className="flex items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">С</Label>
                    <Input type="date" value={tsFrom} onChange={e => setTsFrom(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">По</Label>
                    <Input type="date" value={tsTo} onChange={e => setTsTo(e.target.value)} />
                  </div>
                  <Button size="sm" onClick={() => tsMutation.mutate()} disabled={!tsFrom || !tsTo || tsMutation.isPending}>
                    {tsMutation.isPending ? 'Запрос...' : 'Получить слоты'}
                  </Button>
                </div>

                {slots && slots.length === 0 && <p className="text-xs text-muted-foreground">Нет доступных слотов</p>}
                {slots && slots.length > 0 && (
                  <div className="flex flex-col gap-1 max-h-48 overflow-auto">
                    {slots.map((s, i) => {
                      const sFrom = s.from ?? s.timeslot_from
                      const sTo = s.to ?? s.timeslot_to
                      const active = selected === s
                      return (
                        <button
                          key={i}
                          onClick={() => setSelected(s)}
                          className={`text-left text-xs rounded-md border px-3 py-2 ${active ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
                        >
                          {fmtDateTime(sFrom)} — {fmtDateTime(sTo)}
                        </button>
                      )
                    })}
                  </div>
                )}

                {selected && (
                  <Button size="sm" onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending} className="gap-1.5 self-start">
                    <CheckCircle2 className="size-3.5" /> {finalizeMutation.isPending ? 'Финализация...' : 'Финализировать'}
                  </Button>
                )}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Закрыть</Button>
      </DialogFooter>
    </Dialog>
  )
}

// ─── Demand Tab (расчёт потребности по кластерам) ────────────────────────────

interface DemandRow {
  sku_id: number
  cluster_id: number
  velocity_per_day: number
  current_stock_in_cluster: number
  in_transit_qty: number
  stockout_at: string | null
  ship_by_date: string | null
  produce_by_date: string | null
  need_qty: number
  criticality_days: number
}

function DemandTab() {
  const [skuId, setSkuId] = useState<number | ''>('')
  const [clusterIds, setClusterIds] = useState<number[]>([])
  const [demand, setDemand] = useState<DemandRow[] | null>(null)
  const [error, setError] = useState('')

  const [checkDialog, setCheckDialog] = useState<{ sku_id: number; qty: number } | null>(null)
  const [checkResult, setCheckResult] = useState<any>(null)

  const [scheduleDialog, setScheduleDialog] = useState<DemandRow | null>(null)
  const [scheduleResult, setScheduleResult] = useState<any>(null)

  const { data: skusData } = useQuery({
    queryKey: ['skus', 'all-active'],
    queryFn: () => api.get('/skus', { params: { per_page: 200, status: 'ACTIVE' } }).then(r => r.data.data as Sku[]),
  })
  const { data: clustersData } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => api.get('/reference/clusters').then(r => r.data.data as Cluster[]),
  })
  const skus = skusData ?? []
  const clusters = clustersData ?? []

  const calcMutation = useMutation({
    mutationFn: () => api.post('/demand/calculate', { sku_id: skuId, cluster_ids: clusterIds }).then(r => r.data.data),
    onSuccess: (data) => { setDemand(data); setError('') },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка расчёта'),
  })
  const checkMutation = useMutation({
    mutationFn: (body: { sku_id: number; qty: number }) => api.post('/production/check-materials', body).then(r => r.data.data),
    onSuccess: (data) => setCheckResult(data),
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка'),
  })
  const scheduleMutation = useMutation({
    mutationFn: (row: DemandRow) =>
      api.post('/production/schedule', {
        requests: [{ sku_id: row.sku_id, qty: row.need_qty, produce_by: row.produce_by_date, criticality_days: row.criticality_days }],
      }).then(r => r.data.data),
    onSuccess: (data) => setScheduleResult(data),
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка'),
  })

  function toggleCluster(id: number) {
    setClusterIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }
  function openCheck(row: DemandRow) {
    setCheckResult(null); setCheckDialog({ sku_id: row.sku_id, qty: row.need_qty })
    checkMutation.mutate({ sku_id: row.sku_id, qty: row.need_qty })
  }
  function openSchedule(row: DemandRow) {
    setScheduleResult(null); setScheduleDialog(row); scheduleMutation.mutate(row)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>SKU</Label>
            <Select value={skuId} onChange={e => setSkuId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— Выберите SKU —</option>
              {skus.map(s => <option key={s.id} value={s.id}>{s.article} — {s.name}</option>)}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Кластеры Ozon</Label>
            <div className="flex flex-wrap gap-2">
              {clusters.map(c => {
                const active = clusterIds.includes(c.id)
                return (
                  <button
                    key={c.id} type="button" onClick={() => toggleCluster(c.id)}
                    className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}
                  >{c.name}</button>
                )
              })}
              {clusters.length === 0 && <p className="text-xs text-muted-foreground">Загрузка...</p>}
            </div>
          </div>
        </div>
        <Button
          disabled={!skuId || clusterIds.length === 0 || calcMutation.isPending}
          onClick={() => calcMutation.mutate()}
          className="gap-2 self-start"
        >
          <Calculator className="size-4" />
          {calcMutation.isPending ? 'Расчёт...' : 'Рассчитать потребность'}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {demand && (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Кластер</TableHead><TableHead>Скорость/день</TableHead>
                <TableHead>Остаток</TableHead><TableHead>В пути</TableHead>
                <TableHead>Stockout</TableHead><TableHead>Произвести до</TableHead>
                <TableHead>Нужно, шт</TableHead><TableHead>Критичность</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {demand.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Нет потребности</TableCell></TableRow>
              )}
              {demand.map(row => {
                const cluster = clusters.find(c => c.id === row.cluster_id)
                const critical = row.criticality_days < 3
                return (
                  <TableRow key={row.cluster_id}>
                    <TableCell className="font-medium">{cluster?.name ?? `#${row.cluster_id}`}</TableCell>
                    <TableCell>{row.velocity_per_day.toFixed(1)}</TableCell>
                    <TableCell>{row.current_stock_in_cluster}</TableCell>
                    <TableCell className="text-muted-foreground">{row.in_transit_qty}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{row.stockout_at ?? '—'}</TableCell>
                    <TableCell className="text-xs">{row.produce_by_date ?? '—'}</TableCell>
                    <TableCell className="font-semibold">{row.need_qty}</TableCell>
                    <TableCell><Badge variant={critical ? 'destructive' : 'outline'}>{row.criticality_days} дн.</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openCheck(row)} className="gap-1.5">
                          <ClipboardCheck className="size-3.5" /> Материалы
                        </Button>
                        <Button size="sm" onClick={() => openSchedule(row)} className="gap-1.5">
                          <CalendarRange className="size-3.5" /> План
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!checkDialog} onClose={() => setCheckDialog(null)}>
        <DialogHeader>
          <DialogTitle>Проверка материалов</DialogTitle>
          <DialogClose onClose={() => setCheckDialog(null)} />
        </DialogHeader>
        <DialogContent>
          {checkMutation.isPending && <p className="text-sm text-muted-foreground">Проверка...</p>}
          {checkResult && (
            <div className="flex flex-col gap-3">
              <p className="text-sm">Запрошено: <strong>{checkDialog?.qty} шт</strong></p>
              {checkResult.feasible ? (
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                  <CheckCircle2 className="size-4" /> Материалов достаточно
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                    <AlertTriangle className="size-4" /> Можно произвести максимум: {checkResult.max_producible} шт
                  </div>
                  <div className="rounded-md border divide-y">
                    {checkResult.shortages.map((s: any) => (
                      <div key={s.component_id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span>{s.component_name}</span>
                        <span className="text-muted-foreground text-xs">
                          нужно {s.required} · есть {s.available} ·{' '}
                          <span className="text-destructive font-medium">не хватает {s.deficit}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCheckDialog(null)}>Закрыть</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!scheduleDialog} onClose={() => setScheduleDialog(null)}>
        <DialogHeader>
          <DialogTitle>План производства</DialogTitle>
          <DialogClose onClose={() => setScheduleDialog(null)} />
        </DialogHeader>
        <DialogContent>
          {scheduleMutation.isPending && <p className="text-sm text-muted-foreground">Планирование...</p>}
          {scheduleResult && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4 text-sm">
                <span>Всего: <strong>{scheduleResult.total_qty}</strong></span>
                <Badge variant={scheduleResult.feasible ? 'success' : 'warning'}>
                  {scheduleResult.feasible ? 'Выполнимо' : 'С ограничениями'}
                </Badge>
              </div>
              <div className="rounded-md border divide-y">
                {scheduleResult.jobs.map((j: any, i: number) => (
                  <div key={i} className="px-3 py-2 text-sm flex items-center justify-between">
                    <div>
                      <p className="font-medium">Принтер #{j.printer_id} · {j.qty} шт</p>
                      <p className="text-xs text-muted-foreground">{j.kind} · {j.duration_min} мин · старт {j.scheduled_start}</p>
                    </div>
                  </div>
                ))}
                {scheduleResult.jobs.length === 0 && <p className="text-sm text-muted-foreground px-3 py-2">Нет заданий</p>}
              </div>
              {scheduleResult.warnings?.length > 0 && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                  {scheduleResult.warnings.join('; ')}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Это предложение плана. Задания будут созданы при добавлении в смену.</p>
            </div>
          )}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setScheduleDialog(null)}>Закрыть</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

// ─── Auto-Plan Tab ───────────────────────────────────────────────────────────

interface PlanRow {
  sku_id: number
  article: string | null
  name: string | null
  velocity_per_day: number
  current_stock_in_cluster: number
  in_transit_qty: number
  need_qty: number
  criticality_days: number
  ship_by_date: string | null
  produce_by_date: string | null
  avg_price_minor: number
  margin_per_unit_minor: number
  potential_revenue_minor: number
  potential_profit_minor: number
}
interface PlanCluster {
  cluster_id: number
  cluster_name: string
  lead_time_days: number
  ship_by_date: string | null
  is_priority: boolean
  score_profit_minor: number
  sku_coverage_count: number
  sku_coverage_pct: number
  urgent_skus_count: number
  seeded_skus_count: number
  totals: { skus: number; total_qty: number; potential_revenue_minor: number; potential_profit_minor: number }
  skus: (PlanRow & { is_seeded?: boolean })[]
}
interface PlanResponse {
  target_cover_days: number
  max_clusters: number
  min_sku_coverage_pct: number
  min_profit_minor: number
  pool_size: number
  clusters: PlanCluster[]
  grand_total: { skus: number; total_qty: number; potential_profit_minor: number }
  excluded: { by_top_n: number; total_candidates_after_filters: number }
}

function AutoPlanTab() {
  const [days, setDays] = useState(28)
  const [maxClusters, setMaxClusters] = useState(5)
  const [minCoverage, setMinCoverage] = useState(25)
  const [minProfitRub, setMinProfitRub] = useState(5000)
  const [priorityClusterIds, setPriorityClusterIds] = useState<number[]>([])
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [error, setError] = useState('')

  const { data: clustersData } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => api.get('/reference/clusters').then(r => r.data.data as Cluster[]),
  })
  const allClusters = (clustersData ?? []).filter(c => c.name !== 'Не указан')
  // disabled rows per cluster (key: `${cluster_id}:${sku_id}`)
  const [disabled, setDisabled] = useState<Set<string>>(new Set())
  // editable qty override per row
  const [qtyOverride, setQtyOverride] = useState<Record<string, number>>({})
  const [submittingClusterId, setSubmittingClusterId] = useState<number | null>(null)
  const [submittedIds, setSubmittedIds] = useState<number[]>([])

  const planMutation = useMutation({
    mutationFn: () => api.post('/supply/plan', {
      target_cover_days: days,
      max_clusters: maxClusters,
      min_sku_coverage_pct: minCoverage,
      min_profit_minor: minProfitRub * 100,
      priority_cluster_ids: priorityClusterIds,
    }).then(r => r.data.data as PlanResponse),
    onSuccess: (data) => { setPlan(data); setError(''); setDisabled(new Set()); setQtyOverride({}); setSubmittedIds([]) },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка расчёта'),
  })

  const submitMutation = useMutation({
    mutationFn: async (cluster: PlanCluster) => {
      const cargoes = cluster.skus
        .filter(r => !disabled.has(`${cluster.cluster_id}:${r.sku_id}`))
        .map(r => ({
          sku_id: r.sku_id,
          need_qty: qtyOverride[`${cluster.cluster_id}:${r.sku_id}`] ?? r.need_qty,
        }))
        .filter(c => c.need_qty > 0)
      if (cargoes.length === 0) throw new Error('Все строки отключены')

      const signals = cargoes.map(c => ({
        sku_id: c.sku_id,
        cluster_id: cluster.cluster_id,
        need_qty: c.need_qty,
        ship_by_date: cluster.ship_by_date,
        criticality_days: 7,
      }))
      const drafts = await api.post('/supply/build', { signals }).then(r => r.data.data as any[])
      const group = drafts[0]
      if (!group) throw new Error('Пустой черновик от /supply/build')
      const res = await api.post('/supply/submit', {
        cluster_id: group.cluster_id,
        ship_by_date: group.ship_by_date,
        cargoes: group.cargoes.map((c: any) => ({ sku_id: c.sku_id, box_type_id: c.box_type_id, qty: c.qty })),
      }).then(r => r.data.data)
      return res.id as number
    },
    onSuccess: (id) => { setSubmittedIds(prev => [...prev, id]); setSubmittingClusterId(null) },
    onError: (e: any) => { setError(e.response?.data?.message ?? e.message ?? 'Ошибка отправки'); setSubmittingClusterId(null) },
  })

  function toggle(clusterId: number, skuId: number) {
    const key = `${clusterId}:${skuId}`
    setDisabled(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  function setQty(clusterId: number, skuId: number, v: number) {
    setQtyOverride(prev => ({ ...prev, [`${clusterId}:${skuId}`]: v }))
  }

  function effectiveTotals(cluster: PlanCluster) {
    let qty = 0, rev = 0, profit = 0, n = 0
    for (const r of cluster.skus) {
      const key = `${cluster.cluster_id}:${r.sku_id}`
      if (disabled.has(key)) continue
      const q = qtyOverride[key] ?? r.need_qty
      if (q <= 0) continue
      qty += q
      rev += q * r.avg_price_minor
      profit += q * r.margin_per_unit_minor
      n += 1
    }
    return { qty, rev, profit, n }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Авто-план поставок на топ-кластеры</p>
          <p className="text-xs text-muted-foreground">
            Берём ACTIVE SKU с положительной маржой и продажами за 30 дней → пул. Кластер попадает в план, только если
            (1) в нём за месяц продавалось ≥ выбранного % SKU из пула и (2) ожидаемая прибыль с поставки ≥ порога.
            Сортируем по ожидаемой прибыли и берём топ-N.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Покрытие: <strong>{days} дн</strong></Label>
            <input type="range" min={21} max={28} step={1} value={days} onChange={e => setDays(Number(e.target.value))} className="w-full" />
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>21</span><span>28</span></div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Макс. кластеров: <strong>{maxClusters}</strong></Label>
            <input type="range" min={3} max={5} step={1} value={maxClusters} onChange={e => setMaxClusters(Number(e.target.value))} className="w-full" />
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>3</span><span>5</span></div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Мин. покрытие SKU, %</Label>
            <Input type="number" min={0} max={100} value={minCoverage} onChange={e => setMinCoverage(Number(e.target.value))} className="h-9" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Мин. прибыль с поставки, ₽</Label>
            <Input type="number" min={0} step={500} value={minProfitRub} onChange={e => setMinProfitRub(Number(e.target.value))} className="h-9" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Приоритетные кластеры (всегда в плане, все SKU из пула)</Label>
          <div className="flex flex-wrap gap-2">
            {allClusters.length === 0 && <p className="text-xs text-muted-foreground">Загрузка...</p>}
            {allClusters.map(c => {
              const active = priorityClusterIds.includes(c.id)
              return (
                <button
                  key={c.id} type="button"
                  onClick={() => setPriorityClusterIds(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                  className={`rounded-md border px-3 py-1 text-xs transition-colors ${active ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-background hover:bg-accent'}`}
                >
                  {active && '⭐ '}{c.name}
                </button>
              )
            })}
          </div>
          {priorityClusterIds.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Для SKU без истории продаж в приоритетном кластере используется «сидовая» скорость = 20% общероссийской.
            </p>
          )}
        </div>
        <Button onClick={() => planMutation.mutate()} disabled={planMutation.isPending} className="gap-2 self-start">
          <Wand2 className="size-4" />
          {planMutation.isPending ? 'Расчёт...' : 'Построить план'}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {submittedIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="size-4" /> Отправлено: {submittedIds.map(id => `#${id}`).join(', ')}. Перейдите на «Список» для финализации.
        </div>
      )}

      {plan && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Кластеров в плане</p>
              <p className="text-2xl font-bold">{plan.clusters.length}</p>
              {plan.excluded.by_top_n > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">+{plan.excluded.by_top_n} отсечено лимитом top-{plan.max_clusters}</p>
              )}
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Позиций (SKU×кластер)</p>
              <p className="text-2xl font-bold">{plan.grand_total.skus}</p>
              <p className="text-[10px] text-muted-foreground mt-1">пул: {plan.pool_size} SKU</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Всего шт к отгрузке</p>
              <p className="text-2xl font-bold">{plan.grand_total.total_qty}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 border-green-200 bg-green-50/30">
              <p className="text-xs text-muted-foreground">Ожидаемая прибыль</p>
              <p className="text-2xl font-bold text-green-700">{fmtMoney(plan.grand_total.potential_profit_minor)}</p>
            </div>
          </div>

          {plan.clusters.length === 0 && (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Нет кластеров, удовлетворяющих критериям. Попробуйте снизить «Мин. покрытие SKU» или «Мин. прибыль».
            </div>
          )}

          {plan.clusters.map((cluster, idx) => {
            const tot = effectiveTotals(cluster)
            return (
              <div key={cluster.cluster_id} className="rounded-xl border bg-card">
                <div className="flex items-center justify-between px-5 py-4 border-b gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-8 items-center justify-center rounded-full font-bold text-sm ${cluster.is_priority ? 'bg-amber-100 text-amber-900' : 'bg-primary/10 text-primary'}`}>
                      {cluster.is_priority ? '⭐' : `#${idx + 1}`}
                    </div>
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        {cluster.cluster_name}
                        {cluster.is_priority && <Badge variant="warning" className="text-[10px]">Приоритет</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Lead time {cluster.lead_time_days} дн · Отгрузить до {fmtDate(cluster.ship_by_date)}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">
                          {cluster.sku_coverage_count}/{plan.pool_size} SKU · {cluster.sku_coverage_pct}%
                        </Badge>
                        {cluster.urgent_skus_count > 0 && (
                          <Badge variant="destructive" className="text-[10px]">🔥 {cluster.urgent_skus_count} срочных</Badge>
                        )}
                        {cluster.seeded_skus_count > 0 && (
                          <Badge variant="outline" className="text-[10px]">🌱 {cluster.seeded_skus_count} сидов</Badge>
                        )}
                        <Badge variant="success" className="text-[10px]">
                          score {fmtMoney(cluster.score_profit_minor)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">К отгрузке</p>
                      <p className="font-semibold">{tot.qty} шт · {tot.n} SKU</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Прибыль</p>
                      <p className="font-semibold text-green-700">{fmtMoney(tot.profit)}</p>
                      <p className="text-[10px] text-muted-foreground">выручка {fmtMoney(tot.rev)}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => { setSubmittingClusterId(cluster.cluster_id); submitMutation.mutate(cluster) }}
                      disabled={submitMutation.isPending || tot.qty === 0}
                      className="gap-1.5"
                    >
                      <Send className="size-3.5" />
                      {submittingClusterId === cluster.cluster_id ? 'Отправка...' : 'Отправить'}
                    </Button>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Скор./дн</TableHead>
                      <TableHead className="text-right">Остаток</TableHead>
                      <TableHead className="text-right">В пути</TableHead>
                      <TableHead className="text-right w-24">К отгрузке</TableHead>
                      <TableHead>Критичность</TableHead>
                      <TableHead className="text-right">Прибыль</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cluster.skus.map(r => {
                      const key = `${cluster.cluster_id}:${r.sku_id}`
                      const off = disabled.has(key)
                      const critical = r.criticality_days < 3
                      const value = qtyOverride[key] ?? r.need_qty
                      return (
                        <TableRow key={r.sku_id} className={off ? 'opacity-40' : ''}>
                          <TableCell>
                            <input
                              type="checkbox" className="size-4"
                              checked={!off}
                              onChange={() => toggle(cluster.cluster_id, r.sku_id)}
                            />
                          </TableCell>
                          <TableCell>
                            <p className="font-medium flex items-center gap-1.5">
                              {r.article ?? `#${r.sku_id}`}
                              {r.is_seeded && <span title="Сидовая позиция: SKU без истории продаж в этом кластере, оценка по 20% от общероссийской скорости">🌱</span>}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{r.name}</p>
                          </TableCell>
                          <TableCell className="text-right text-xs">{r.velocity_per_day.toFixed(1)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{r.current_stock_in_cluster}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{r.in_transit_qty || '—'}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              value={value}
                              disabled={off}
                              onChange={e => setQty(cluster.cluster_id, r.sku_id, Number(e.target.value))}
                              className="h-8 w-20 text-right text-sm inline-block"
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant={critical ? 'destructive' : 'outline'}>{r.criticality_days} дн</Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {r.margin_per_unit_minor > 0 ? fmtMoney(value * r.margin_per_unit_minor) : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SupplyPage() {
  const [openId, setOpenId] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Поставки в Ozon</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Авто-план, расчёт потребности, построение, отправка и мониторинг</p>
      </div>

      <Tabs defaultValue="auto">
        <TabsList>
          <TabsTrigger value="auto">Авто-план</TabsTrigger>
          <TabsTrigger value="list">Список</TabsTrigger>
          <TabsTrigger value="demand">Расчёт спроса</TabsTrigger>
          <TabsTrigger value="build">Построить вручную</TabsTrigger>
        </TabsList>
        <TabsContent value="auto"><AutoPlanTab /></TabsContent>
        <TabsContent value="list"><ListTab onOpen={setOpenId} /></TabsContent>
        <TabsContent value="demand"><DemandTab /></TabsContent>
        <TabsContent value="build"><BuildTab /></TabsContent>
      </Tabs>

      {openId !== null && <SupplyDetailDialog id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
