import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calculator, ClipboardCheck, CalendarRange, AlertTriangle, CheckCircle2 } from 'lucide-react'

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

interface Cluster { id: number; name: string }
interface Sku { id: number; name: string; article: string }

export default function InventoryPage() {
  const [skuId, setSkuId] = useState<number | ''>('')
  const [clusterIds, setClusterIds] = useState<number[]>([])
  const [demand, setDemand] = useState<DemandRow[] | null>(null)
  const [error, setError] = useState('')

  // check materials dialog
  const [checkDialog, setCheckDialog] = useState<{ sku_id: number; qty: number } | null>(null)
  const [checkResult, setCheckResult] = useState<any>(null)

  // schedule dialog
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
    setCheckResult(null)
    setCheckDialog({ sku_id: row.sku_id, qty: row.need_qty })
    checkMutation.mutate({ sku_id: row.sku_id, qty: row.need_qty })
  }

  function openSchedule(row: DemandRow) {
    setScheduleResult(null)
    setScheduleDialog(row)
    scheduleMutation.mutate(row)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Склад и спрос</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Расчёт потребности и планирование производства</p>
      </div>

      {/* Form */}
      <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>SKU</Label>
            <Select value={skuId} onChange={e => setSkuId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— Выберите SKU —</option>
              {skus.map(s => (
                <option key={s.id} value={s.id}>{s.article} — {s.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Кластеры Ozon</Label>
            <div className="flex flex-wrap gap-2">
              {clusters.map(c => {
                const active = clusterIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCluster(c.id)}
                    className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}
                  >
                    {c.name}
                  </button>
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

      {/* Results */}
      {demand && (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Кластер</TableHead>
                <TableHead>Скорость/день</TableHead>
                <TableHead>Остаток</TableHead>
                <TableHead>В пути</TableHead>
                <TableHead>Stockout</TableHead>
                <TableHead>Произвести до</TableHead>
                <TableHead>Нужно, шт</TableHead>
                <TableHead>Критичность</TableHead>
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
                    <TableCell>
                      <Badge variant={critical ? 'destructive' : 'outline'}>
                        {row.criticality_days} дн.
                      </Badge>
                    </TableCell>
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

      {/* Check materials dialog */}
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

      {/* Schedule dialog */}
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
