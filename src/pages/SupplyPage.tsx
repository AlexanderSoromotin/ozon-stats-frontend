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
import { Plus, Trash2, Hammer, Send, AlertTriangle, FileText, Calendar, CheckCircle2, Eye } from 'lucide-react'
import { fmtDate, fmtDateTime } from '@/lib/format'

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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SupplyPage() {
  const [openId, setOpenId] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Поставки в Ozon</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Построение, отправка и мониторинг</p>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Список</TabsTrigger>
          <TabsTrigger value="build">Построить новую</TabsTrigger>
        </TabsList>
        <TabsContent value="list"><ListTab onOpen={setOpenId} /></TabsContent>
        <TabsContent value="build"><BuildTab /></TabsContent>
      </Tabs>

      {openId !== null && <SupplyDetailDialog id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
