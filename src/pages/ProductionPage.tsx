import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Play, CheckCircle2, XCircle, Clock, Printer, Package,
  CalendarClock, ChevronRight, AlertTriangle,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Shift {
  id: number
  operator_id: number
  started_at: string
  planned_end_at: string
  ended_at: string | null
  status: 'OPEN' | 'CLOSED'
  notes: string | null
}

type TaskStatus = 'PLANNED' | 'RUNNING' | 'DONE' | 'CANCELLED'

interface PrintJob {
  type: 'print_job'
  id: number
  sku_id: number
  qty: number
  actual_qty: number | null
  status: TaskStatus
  started_at: string | null
  finished_at: string | null
  printer_id: number | null
  duration_min: number | null
  kind: 'SHORT' | 'OVERNIGHT' | null
  fails: number
}

interface PackingTask {
  type: 'packing_task'
  id: number
  sku_id: number
  qty: number
  actual_qty: number | null
  status: TaskStatus
  started_at: string | null
  finished_at: string | null
  source_print_job_id: number | null
}

type Task = PrintJob | PackingTask

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<TaskStatus, string> = {
  PLANNED: 'Запланировано', RUNNING: 'Выполняется', DONE: 'Завершено', CANCELLED: 'Отменено',
}
const STATUS_VARIANT: Record<TaskStatus, 'outline' | 'warning' | 'success' | 'secondary'> = {
  PLANNED: 'outline', RUNNING: 'warning', DONE: 'success', CANCELLED: 'secondary',
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function durLabel(min: number | null) {
  if (!min) return null
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}ч ${m}м` : `${m}м`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProductionPage() {
  const qc = useQueryClient()

  // shift open dialog
  const [openShiftDialog, setOpenShiftDialog] = useState(false)
  const [plannedEnd, setPlannedEnd] = useState('')

  // close shift dialog
  const [closeShiftDialog, setCloseShiftDialog] = useState(false)
  const [shiftNotes, setShiftNotes] = useState('')

  // complete print job dialog
  const [completePrintDialog, setCompletePrintDialog] = useState<PrintJob | null>(null)
  const [actualQty, setActualQty] = useState('')
  const [fails, setFails] = useState('0')

  // complete packing dialog
  const [completePackDialog, setCompletePackDialog] = useState<PackingTask | null>(null)
  const [packActualQty, setPackActualQty] = useState('')

  const [actionError, setActionError] = useState('')

  // ── Queries ──
  const { data: shiftData, isLoading: shiftLoading } = useQuery({
    queryKey: ['shift-current'],
    queryFn: () => api.get('/shifts/current').then(r => r.data.data as Shift | null),
    refetchInterval: 30000,
  })

  const shift = shiftData ?? null

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['shift-tasks', shift?.id],
    queryFn: () => api.get(`/shifts/${shift!.id}/tasks`).then(r => r.data.data as Task[]),
    enabled: !!shift,
    refetchInterval: 15000,
  })

  const tasks = tasksData ?? []
  const printJobs = tasks.filter(t => t.type === 'print_job') as PrintJob[]
  const packingTasks = tasks.filter(t => t.type === 'packing_task') as PackingTask[]

  // ── Mutations ──
  const openShiftMutation = useMutation({
    mutationFn: () => api.post('/shifts/open', { planned_end_at: plannedEnd }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shift-current'] }); setOpenShiftDialog(false) },
    onError: (e: any) => setActionError(e.response?.data?.message ?? 'Ошибка'),
  })

  const closeShiftMutation = useMutation({
    mutationFn: () => api.post(`/shifts/${shift!.id}/close`, { notes: shiftNotes || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shift-current'] }); setCloseShiftDialog(false); setShiftNotes('') },
    onError: (e: any) => setActionError(e.response?.data?.message ?? 'Ошибка'),
  })

  function startPrint(id: number) {
    setActionError('')
    api.post(`/print-jobs/${id}/start`)
      .then(() => qc.invalidateQueries({ queryKey: ['shift-tasks'] }))
      .catch((e) => setActionError(e.response?.data?.message ?? 'Ошибка'))
  }

  function cancelPrint(id: number) {
    setActionError('')
    api.post(`/print-jobs/${id}/cancel`)
      .then(() => qc.invalidateQueries({ queryKey: ['shift-tasks'] }))
      .catch((e) => setActionError(e.response?.data?.message ?? 'Ошибка'))
  }

  function startPack(id: number) {
    setActionError('')
    api.post(`/packing-tasks/${id}/start`)
      .then(() => qc.invalidateQueries({ queryKey: ['shift-tasks'] }))
      .catch((e) => setActionError(e.response?.data?.message ?? 'Ошибка'))
  }

  function cancelPack(id: number) {
    setActionError('')
    api.post(`/packing-tasks/${id}/cancel`)
      .then(() => qc.invalidateQueries({ queryKey: ['shift-tasks'] }))
      .catch((e) => setActionError(e.response?.data?.message ?? 'Ошибка'))
  }

  const [completePrintPending, setCompletePrintPending] = useState(false)
  function submitCompletePrint() {
    if (!completePrintDialog) return
    setCompletePrintPending(true)
    api.post(`/print-jobs/${completePrintDialog.id}/complete`, {
      actual_qty: Number(actualQty),
      fails: Number(fails),
    })
      .then(() => {
        qc.invalidateQueries({ queryKey: ['shift-tasks'] })
        setCompletePrintDialog(null)
      })
      .catch((e) => setActionError(e.response?.data?.message ?? 'Ошибка'))
      .finally(() => setCompletePrintPending(false))
  }

  const [completePackPending, setCompletePackPending] = useState(false)
  function submitCompletePack() {
    if (!completePackDialog) return
    setCompletePackPending(true)
    api.post(`/packing-tasks/${completePackDialog.id}/complete`, { actual_qty: Number(packActualQty) })
      .then(() => {
        qc.invalidateQueries({ queryKey: ['shift-tasks'] })
        setCompletePackDialog(null)
      })
      .catch((e) => setActionError(e.response?.data?.message ?? 'Ошибка'))
      .finally(() => setCompletePackPending(false))
  }

  // ── Render ──
  if (shiftLoading) {
    return <div className="text-muted-foreground">Загрузка...</div>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Производство</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Смены, печать и упаковка</p>
        </div>
        {!shift && (
          <Button onClick={() => { setActionError(''); setOpenShiftDialog(true) }} className="gap-2">
            <Play className="size-4" /> Открыть смену
          </Button>
        )}
        {shift && (
          <Button variant="outline" onClick={() => { setActionError(''); setCloseShiftDialog(true) }} className="gap-2">
            <XCircle className="size-4" /> Закрыть смену
          </Button>
        )}
      </div>

      {/* Global error */}
      {actionError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" /> {actionError}
        </div>
      )}

      {/* No shift */}
      {!shift && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center gap-3">
          <CalendarClock className="size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">Нет открытой смены</p>
          <Button onClick={() => setOpenShiftDialog(true)} variant="secondary" size="sm">
            Открыть смену
          </Button>
        </div>
      )}

      {/* Shift info */}
      {shift && (
        <div className="rounded-xl border bg-card px-5 py-4 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Clock className="size-4 text-muted-foreground" />
            Смена #{shift.id}
          </div>
          <div className="text-muted-foreground">Начало: {fmt(shift.started_at)}</div>
          <div className="text-muted-foreground">Плановое завершение: {fmt(shift.planned_end_at)}</div>
          <Badge variant="success" className="ml-auto">Открыта</Badge>
        </div>
      )}

      {/* Tasks */}
      {shift && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Print Jobs */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Printer className="size-4" /> Задания на печать
              <Badge variant="secondary" className="ml-auto">{printJobs.length}</Badge>
            </div>
            {tasksLoading && <p className="text-sm text-muted-foreground">Загрузка...</p>}
            {!tasksLoading && printJobs.length === 0 && (
              <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">Нет заданий</div>
            )}
            {printJobs.map(job => (
              <div key={job.id} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">SKU #{job.sku_id}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Принтер #{job.printer_id ?? '—'} · {job.kind ?? '—'}
                      {job.duration_min ? ` · ${durLabel(job.duration_min)}` : ''}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[job.status]}>{STATUS_LABEL[job.status]}</Badge>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">Кол-во: <span className="text-foreground font-medium">{job.qty}</span></span>
                  {job.actual_qty !== null && (
                    <span className="text-muted-foreground">Факт: <span className="text-foreground font-medium">{job.actual_qty}</span></span>
                  )}
                  {job.fails > 0 && (
                    <span className="text-destructive text-xs">Брак: {job.fails}</span>
                  )}
                </div>

                {job.status === 'PLANNED' && (
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1.5" onClick={() => startPrint(job.id)}>
                      <Play className="size-3.5" /> Начать
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => cancelPrint(job.id)}>
                      <XCircle className="size-3.5" /> Отменить
                    </Button>
                  </div>
                )}
                {job.status === 'RUNNING' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setCompletePrintDialog(job); setActualQty(String(job.qty)); setFails('0'); setActionError('') }}>
                      <CheckCircle2 className="size-3.5" /> Завершить
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => cancelPrint(job.id)}>
                      <XCircle className="size-3.5" /> Отменить
                    </Button>
                  </div>
                )}
                {(job.status === 'DONE' || job.status === 'CANCELLED') && (
                  <p className="text-xs text-muted-foreground">Завершено: {fmt(job.finished_at)}</p>
                )}
              </div>
            ))}
          </section>

          {/* Packing Tasks */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Package className="size-4" /> Задания на упаковку
              <Badge variant="secondary" className="ml-auto">{packingTasks.length}</Badge>
            </div>
            {tasksLoading && <p className="text-sm text-muted-foreground">Загрузка...</p>}
            {!tasksLoading && packingTasks.length === 0 && (
              <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">Нет заданий</div>
            )}
            {packingTasks.map(task => (
              <div key={task.id} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">SKU #{task.sku_id}</p>
                    {task.source_print_job_id && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <ChevronRight className="size-3" /> Печать #{task.source_print_job_id}
                      </p>
                    )}
                  </div>
                  <Badge variant={STATUS_VARIANT[task.status]}>{STATUS_LABEL[task.status]}</Badge>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">Кол-во: <span className="text-foreground font-medium">{task.qty}</span></span>
                  {task.actual_qty !== null && (
                    <span className="text-muted-foreground">Факт: <span className="text-foreground font-medium">{task.actual_qty}</span></span>
                  )}
                </div>

                {task.status === 'PLANNED' && (
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1.5" onClick={() => startPack(task.id)}>
                      <Play className="size-3.5" /> Начать
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => cancelPack(task.id)}>
                      <XCircle className="size-3.5" /> Отменить
                    </Button>
                  </div>
                )}
                {task.status === 'RUNNING' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setCompletePackDialog(task); setPackActualQty(String(task.qty)); setActionError('') }}>
                      <CheckCircle2 className="size-3.5" /> Завершить
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => cancelPack(task.id)}>
                      <XCircle className="size-3.5" /> Отменить
                    </Button>
                  </div>
                )}
                {(task.status === 'DONE' || task.status === 'CANCELLED') && (
                  <p className="text-xs text-muted-foreground">Завершено: {fmt(task.finished_at)}</p>
                )}
              </div>
            ))}
          </section>
        </div>
      )}

      {/* Open shift dialog */}
      <Dialog open={openShiftDialog} onClose={() => setOpenShiftDialog(false)}>
        <DialogHeader>
          <DialogTitle>Открыть смену</DialogTitle>
          <DialogClose onClose={() => setOpenShiftDialog(false)} />
        </DialogHeader>
        <DialogContent>
          <div className="flex flex-col gap-1.5">
            <Label>Плановое завершение</Label>
            <Input type="datetime-local" value={plannedEnd} onChange={e => setPlannedEnd(e.target.value)} />
          </div>
          {actionError && <p className="text-sm text-destructive mt-3">{actionError}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpenShiftDialog(false)}>Отмена</Button>
          <Button disabled={!plannedEnd || openShiftMutation.isPending} onClick={() => openShiftMutation.mutate()}>
            {openShiftMutation.isPending ? 'Открываем...' : 'Открыть смену'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Close shift dialog */}
      <Dialog open={closeShiftDialog} onClose={() => setCloseShiftDialog(false)}>
        <DialogHeader>
          <DialogTitle>Закрыть смену</DialogTitle>
          <DialogClose onClose={() => setCloseShiftDialog(false)} />
        </DialogHeader>
        <DialogContent>
          <div className="flex flex-col gap-1.5">
            <Label>Заметки (необязательно)</Label>
            <Textarea
              value={shiftNotes}
              onChange={e => setShiftNotes(e.target.value)}
              placeholder="Всё прошло штатно..."
              rows={3}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">Незавершённые задания будут перенесены на следующую смену.</p>
          {actionError && <p className="text-sm text-destructive mt-2">{actionError}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCloseShiftDialog(false)}>Отмена</Button>
          <Button variant="destructive" disabled={closeShiftMutation.isPending} onClick={() => closeShiftMutation.mutate()}>
            {closeShiftMutation.isPending ? 'Закрываем...' : 'Закрыть смену'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Complete print job dialog */}
      <Dialog open={!!completePrintDialog} onClose={() => setCompletePrintDialog(null)}>
        <DialogHeader>
          <DialogTitle>Завершить задание на печать</DialogTitle>
          <DialogClose onClose={() => setCompletePrintDialog(null)} />
        </DialogHeader>
        <DialogContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Фактически напечатано *</Label>
              <Input type="number" min={0} value={actualQty} onChange={e => setActualQty(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Брак</Label>
              <Input type="number" min={0} value={fails} onChange={e => setFails(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">После завершения автоматически создастся задание на упаковку.</p>
          {actionError && <p className="text-sm text-destructive mt-2">{actionError}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCompletePrintDialog(null)}>Отмена</Button>
          <Button disabled={!actualQty || completePrintPending} onClick={submitCompletePrint}>
            {completePrintPending ? 'Сохранение...' : 'Завершить'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Complete packing dialog */}
      <Dialog open={!!completePackDialog} onClose={() => setCompletePackDialog(null)}>
        <DialogHeader>
          <DialogTitle>Завершить упаковку</DialogTitle>
          <DialogClose onClose={() => setCompletePackDialog(null)} />
        </DialogHeader>
        <DialogContent>
          <div className="flex flex-col gap-1.5">
            <Label>Фактически упаковано *</Label>
            <Input type="number" min={0} value={packActualQty} onChange={e => setPackActualQty(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground mt-3">Товары появятся на складе в статусе STOCK.</p>
          {actionError && <p className="text-sm text-destructive mt-2">{actionError}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCompletePackDialog(null)}>Отмена</Button>
          <Button disabled={!packActualQty || completePackPending} onClick={submitCompletePack}>
            {completePackPending ? 'Сохранение...' : 'Завершить'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
