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
import { Plus, Trash2, Hammer, Send, Search, AlertTriangle } from 'lucide-react'

interface Sku { id: number; name: string; article: string }
interface Cluster { id: number; name: string }
interface BoxType { id: number; name: string; inner_volume_cm3: number }

interface Signal {
  sku_id: number | ''
  cluster_id: number | ''
  need_qty: number
  ship_by_date: string
  criticality_days: number
}

interface CargoDraft {
  sku_id: number
  box_type_id: number
  qty: number
  estimated_capacity?: number
}

interface DraftGroup {
  cluster_id: number
  ship_by_date: string
  cargoes: CargoDraft[]
  deferred: any[]
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Черновик', SUBMITTED: 'Отправлено', ACCEPTED: 'Принято', CANCELLED: 'Отменено',
}
const STATUS_VARIANT: Record<string, 'outline' | 'warning' | 'success' | 'secondary'> = {
  DRAFT: 'outline', SUBMITTED: 'warning', ACCEPTED: 'success', CANCELLED: 'secondary',
}

const emptySignal = (): Signal => ({ sku_id: '', cluster_id: '', need_qty: 0, ship_by_date: '', criticality_days: 7 })

// ─── Build & Submit ───────────────────────────────────────────────────────────

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
    queryFn: () => api.get('/reference/box-types').then(r => r.data.data as BoxType[]),
  })

  const skus = skusData ?? []
  const clusters = clustersData ?? []
  const boxes = boxesData ?? []

  const buildMutation = useMutation({
    mutationFn: () => api.post('/supply/build', { signals }).then(r => r.data.data as DraftGroup[]),
    onSuccess: (data) => { setDrafts(data); setError(''); setSubmittedId(null) },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка построения черновика'),
  })

  const submitMutation = useMutation({
    mutationFn: (group: DraftGroup) =>
      api.post('/supply/submit', {
        cluster_id: group.cluster_id,
        ship_by_date: group.ship_by_date,
        cargoes: group.cargoes.map(c => ({ sku_id: c.sku_id, box_type_id: c.box_type_id, qty: c.qty })),
      }).then(r => r.data.data),
    onSuccess: (data) => { setSubmittedId(data.id); setDrafts(null) },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка отправки'),
  })

  function update(i: number, field: keyof Signal, value: any) {
    setSignals(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }
  function addSignal() { setSignals(prev => [...prev, emptySignal()]) }
  function removeSignal(i: number) { setSignals(prev => prev.filter((_, idx) => idx !== i)) }

  return (
    <div className="flex flex-col gap-5">
      {/* Signals form */}
      <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="font-medium text-sm">Сигналы потребности</p>
          <Button size="sm" variant="outline" onClick={addSignal} className="gap-1.5">
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
                <Button variant="ghost" size="icon" onClick={() => removeSignal(i)} disabled={signals.length === 1} className="text-destructive hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={() => buildMutation.mutate()}
          disabled={buildMutation.isPending || signals.some(s => !s.sku_id || !s.cluster_id || !s.need_qty || !s.ship_by_date)}
          className="gap-2 self-start"
        >
          <Hammer className="size-4" />
          {buildMutation.isPending ? 'Построение...' : 'Построить черновик'}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {submittedId !== null && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Поставка #{submittedId} отправлена в Ozon
        </div>
      )}

      {/* Drafts */}
      {drafts && drafts.length === 0 && (
        <p className="text-sm text-muted-foreground">Черновик пуст</p>
      )}
      {drafts && drafts.map((group, idx) => {
        const cluster = clusters.find(c => c.id === group.cluster_id)
        return (
          <div key={idx} className="rounded-xl border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <p className="font-semibold text-sm">{cluster?.name ?? `Кластер #${group.cluster_id}`}</p>
                <p className="text-xs text-muted-foreground">Отгрузка до {group.ship_by_date}</p>
              </div>
              <Button size="sm" onClick={() => submitMutation.mutate(group)} disabled={submitMutation.isPending} className="gap-1.5">
                <Send className="size-3.5" /> Отправить в Ozon
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Короб</TableHead>
                  <TableHead>Кол-во</TableHead>
                  <TableHead>Вместимость</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.cargoes.map((c, i) => {
                  const sku = skus.find(s => s.id === c.sku_id)
                  const box = boxes.find(b => b.id === c.box_type_id)
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{sku?.name ?? `#${c.sku_id}`}</TableCell>
                      <TableCell className="text-muted-foreground">{box?.name ?? `#${c.box_type_id}`}</TableCell>
                      <TableCell>{c.qty}</TableCell>
                      <TableCell className="text-muted-foreground">{c.estimated_capacity ?? '—'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {group.deferred?.length > 0 && (
              <div className="px-5 py-3 border-t bg-yellow-50/50 text-xs text-yellow-800">
                Отложено (нет на складе): {group.deferred.length} позиций
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── View by ID ───────────────────────────────────────────────────────────────

function ViewTab() {
  const [id, setId] = useState('')
  const [loadedId, setLoadedId] = useState<number | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['supply', loadedId],
    queryFn: () => api.get(`/supply/${loadedId}`).then(r => r.data.data),
    enabled: loadedId !== null,
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-2 max-w-sm">
        <div className="flex-1 flex flex-col gap-1.5">
          <Label>ID поставки</Label>
          <Input value={id} onChange={e => setId(e.target.value)} type="number" min={1} placeholder="7" />
        </div>
        <Button onClick={() => id && setLoadedId(Number(id))} disabled={!id} className="gap-2">
          <Search className="size-4" /> Найти
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Загрузка...</p>}
      {error && <p className="text-sm text-destructive">Поставка не найдена</p>}

      {data && (
        <div className="rounded-xl border bg-card">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">Поставка #{data.id}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Кластер #{data.cluster_id} · Канал {data.channel} · Отгрузка до {data.ship_by_date}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[data.status]}>{STATUS_LABEL[data.status]}</Badge>
          </div>
          <div className="px-5 py-3 border-b text-xs text-muted-foreground flex gap-4 flex-wrap">
            {data.ozon_supply_id && <span>Ozon ID: <strong className="text-foreground">{data.ozon_supply_id}</strong></span>}
            {data.ozon_supply_order_number && <span>№ заказа: <strong className="text-foreground">{data.ozon_supply_order_number}</strong></span>}
            {data.ozon_operation_id && <span>Operation: {data.ozon_operation_id}</span>}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Груз</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Короб</TableHead>
                <TableHead>Кол-во</TableHead>
                <TableHead>Этикетка</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.cargoes?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">#{c.id}</TableCell>
                  <TableCell>#{c.sku_id}</TableCell>
                  <TableCell className="text-muted-foreground">#{c.box_type_id}</TableCell>
                  <TableCell>{c.qty}</TableCell>
                  <TableCell>
                    {c.label_pdf_path
                      ? <a href={`http://127.0.0.1:8000/${c.label_pdf_path}`} target="_blank" className="text-xs underline">PDF</a>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
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

export default function SupplyPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Поставки в Ozon</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Построение и отправка поставок</p>
      </div>

      <Tabs defaultValue="build">
        <TabsList>
          <TabsTrigger value="build">Построить и отправить</TabsTrigger>
          <TabsTrigger value="view">Просмотр поставки</TabsTrigger>
        </TabsList>
        <TabsContent value="build"><BuildTab /></TabsContent>
        <TabsContent value="view"><ViewTab /></TabsContent>
      </Tabs>
    </div>
  )
}
