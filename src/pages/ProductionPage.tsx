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
  article: string | null
  sku_name: string | null
  qty: number
  actual_qty: number | null
  status: TaskStatus
  started_at: string | null
  finished_at: string | null
  printer_id: number | null
  printer_name: string | null
  duration_min: number | null
  kind: 'SHORT' | 'OVERNIGHT' | null
  fails: number
}

interface PackingTask {
  type: 'packing_task'
  id: number
  sku_id: number
  article: string | null
  sku_name: string | null
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

// datetime-local format: "YYYY-MM-DDTHH:mm"
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaultShiftEnd(): string {
  const d = new Date()
  d.setHours(d.getHours() + 8, d.getMinutes(), 0, 0)
  return toDatetimeLocal(d)
}

function adjustShiftEnd(current: string, deltaMin: number): string {
  const d = new Date(current)
  d.setMinutes(d.getMinutes() + deltaMin)
  return toDatetimeLocal(d)
}

function getDatePart(dtLocal: string): string {
  return dtLocal.split('T')[0] ?? ''
}

function getTimePart(dtLocal: string): string {
  return dtLocal.split('T')[1]?.slice(0, 5) ?? ''
}

function todayStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function tomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function getHourVal(dtLocal: string): number {
  return parseInt(getTimePart(dtLocal).split(':')[0] ?? '18')
}

function getMinVal(dtLocal: string): number {
  return parseInt(getTimePart(dtLocal).split(':')[1] ?? '0')
}

function withHour(dtLocal: string, h: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${getDatePart(dtLocal)}T${pad(Math.max(0, Math.min(23, h)))}:${pad(getMinVal(dtLocal))}`
}

function withMinute(dtLocal: string, m: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${getDatePart(dtLocal)}T${pad(getHourVal(dtLocal))}:${pad(((m % 60) + 60) % 60)}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProductionPage() {
  const qc = useQueryClient()

  // shift open dialog
  const [openShiftDialog, setOpenShiftDialog] = useState(false)
  const [plannedEnd, setPlannedEnd] = useState('')
  const [dateMode, setDateMode] = useState<'today' | 'tomorrow' | 'other'>('today')
  const [editingSeg, setEditingSeg] = useState<'h' | 'm' | null>(null)
  const [editVal, setEditVal] = useState('')

  // close shift dialog
  const [closeShiftDialog, setCloseShiftDialog] = useState(false)
  const [newJobDialog, setNewJobDialog] = useState(false)
  const [newJobForm, setNewJobForm] = useState<{ sku_id: number | ''; printer_id: number | ''; qty: number; scheduled_start: string }>({
    sku_id: '', printer_id: '', qty: 1, scheduled_start: '',
  })
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

  const { data: skusForJob } = useQuery({
    queryKey: ['skus', 'all-active'],
    queryFn: () => api.get('/skus', { params: { per_page: 200, status: 'ACTIVE' } }).then(r => r.data.data as Array<{ id: number; article: string; name: string }>),
  })
  const { data: printersForJob } = useQuery({
    queryKey: ['printers'],
    queryFn: () => api.get('/printers').then(r => r.data.data as Array<{ id: number; name: string }>),
  })

  const createJobMutation = useMutation({
    mutationFn: () => api.post('/print-jobs', {
      sku_id: newJobForm.sku_id,
      printer_id: newJobForm.printer_id,
      qty: newJobForm.qty,
      shift_id: shift?.id,
      scheduled_start: newJobForm.scheduled_start || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-tasks'] })
      setNewJobDialog(false)
      setNewJobForm({ sku_id: '', printer_id: '', qty: 1, scheduled_start: '' })
    },
    onError: (e: any) => setActionError(e.response?.data?.message ?? 'Ошибка'),
  })

  // ── Mutations ──
  const openShiftMutation = useMutation({
    // Преобразуем datetime-local (без timezone) в ISO с локальным offset,
    // иначе сервер (UTC) интерпретирует как UTC и показывает неверное время
    mutationFn: () => api.post('/shifts/open', { planned_end_at: new Date(plannedEnd).toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shift-current'] }); setOpenShiftDialog(false) },
    onError: (e: any) => setActionError(e.response?.data?.message ?? 'Ошибка'),
  })

  const [closeResult, setCloseResult] = useState<{ printer_hours: Array<{ printer_id: number; hours_added: number; total_hours: number; maintenance_due: boolean; maintenance_actions: string[] }> } | null>(null)

  const closeShiftMutation = useMutation({
    mutationFn: () => api.post(`/shifts/${shift!.id}/close`, { notes: shiftNotes || null }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['shift-current'] })
      setCloseShiftDialog(false)
      setShiftNotes('')
      const ph = res.data?.data?.printer_hours
      if (ph?.length) setCloseResult({ printer_hours: ph })
    },
    onError: (e: any) => setActionError(e.response?.data?.message ?? 'Ошибка'),
  })

  function _startPrint(id: number) {
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
          <Button onClick={() => { setActionError(''); setPlannedEnd(defaultShiftEnd()); setDateMode('today'); setEditingSeg(null); setOpenShiftDialog(true) }} className="gap-2">
            <Play className="size-4" /> Открыть смену
          </Button>
        )}
        {shift && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { setActionError(''); setNewJobDialog(true) }} className="gap-2">
              <Play className="size-4" /> Добавить печать
            </Button>
            <Button variant="outline" onClick={() => { setActionError(''); setCloseShiftDialog(true) }} className="gap-2">
              <XCircle className="size-4" /> Закрыть смену
            </Button>
          </div>
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
          <Button onClick={() => { setPlannedEnd(defaultShiftEnd()); setDateMode('today'); setEditingSeg(null); setOpenShiftDialog(true) }} variant="secondary" size="sm">
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
                  <div className="min-w-0">
                    <p className="font-medium text-sm font-mono">{job.article ?? `SKU #${job.sku_id}`}</p>
                    {job.sku_name && <p className="text-xs text-muted-foreground truncate mt-0.5">{job.sku_name}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {job.printer_name ?? (job.printer_id ? `Принтер #${job.printer_id}` : 'Принтер не назначен')}
                      {job.duration_min ? ` · ${durLabel(job.duration_min)}` : ''}
                      {job.kind === 'OVERNIGHT' ? ' · ночная' : ''}
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

                {(job.status === 'PLANNED' || job.status === 'RUNNING') && (
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
                    <p className="font-medium text-sm font-mono">{task.article ?? `SKU #${task.sku_id}`}</p>
                    {task.sku_name && <p className="text-xs text-muted-foreground truncate mt-0.5">{task.sku_name}</p>}
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
      <Dialog open={openShiftDialog} onClose={() => { setOpenShiftDialog(false); setEditingSeg(null) }}>
        <DialogHeader>
          <DialogTitle>Открыть смену</DialogTitle>
          <DialogClose onClose={() => { setOpenShiftDialog(false); setEditingSeg(null) }} />
        </DialogHeader>
        <DialogContent>
          <div className="flex flex-col gap-5">

            {/* Выбор даты — сегментный контрол */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(['today', 'tomorrow', 'other'] as const).map((mode, i) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setDateMode(mode)
                    const t = getTimePart(plannedEnd) || '18:00'
                    if (mode === 'today') setPlannedEnd(`${todayStr()}T${t}`)
                    if (mode === 'tomorrow') setPlannedEnd(`${tomorrowStr()}T${t}`)
                  }}
                  className={[
                    'flex-1 py-2 text-sm font-medium transition-colors',
                    i > 0 ? 'border-l border-border' : '',
                    dateMode === mode
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                  ].join(' ')}
                >
                  {mode === 'today' ? 'Сегодня' : mode === 'tomorrow' ? 'Завтра' : 'Другой день'}
                </button>
              ))}
            </div>

            {/* Поле выбора даты для «Другой день» */}
            {dateMode === 'other' && (
              <Input
                type="date"
                value={getDatePart(plannedEnd)}
                onChange={e => setPlannedEnd(`${e.target.value}T${getTimePart(plannedEnd) || '18:00'}`)}
              />
            )}

            {/* Таймпикер */}
            <div className="flex flex-col items-center gap-3 py-1">

              {/* Кнопки + */}
              <div className="flex gap-1">
                {([5, 15, 30, 60] as const).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPlannedEnd(adjustShiftEnd(plannedEnd, d))}
                    className="w-14 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    +{d < 60 ? `${d}м` : '1ч'}
                  </button>
                ))}
              </div>

              {/* Крупное время с раздельным редактированием */}
              <div className="flex items-center gap-0.5 py-1" onMouseLeave={() => {}}>
                {/* Часы */}
                {editingSeg === 'h' ? (
                  <input
                    autoFocus
                    type="number"
                    min={0}
                    max={23}
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onBlur={() => {
                      const v = parseInt(editVal)
                      if (!isNaN(v)) setPlannedEnd(withHour(plannedEnd, v))
                      setEditingSeg(null)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const v = parseInt(editVal)
                        if (!isNaN(v)) setPlannedEnd(withHour(plannedEnd, v))
                        setEditingSeg(null)
                      }
                      if (e.key === 'Tab') {
                        e.preventDefault()
                        const v = parseInt(editVal)
                        if (!isNaN(v)) setPlannedEnd(withHour(plannedEnd, v))
                        setEditingSeg('m')
                        setEditVal(String(getMinVal(plannedEnd)).padStart(2, '0'))
                      }
                      if (e.key === 'Escape') setEditingSeg(null)
                    }}
                    className="w-[5.5rem] text-center text-6xl font-bold tabular-nums tracking-tight bg-transparent border-b-2 border-primary outline-none text-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                ) : (
                  <span
                    onClick={() => { setEditingSeg('h'); setEditVal(String(getHourVal(plannedEnd)).padStart(2, '0')) }}
                    className="text-6xl font-bold tabular-nums tracking-tight cursor-pointer px-2 py-1 rounded-lg hover:bg-muted/60 transition-colors select-none"
                  >
                    {getTimePart(plannedEnd).split(':')[0] ?? '18'}
                  </span>
                )}

                <span className="text-6xl font-bold text-muted-foreground select-none mb-1">:</span>

                {/* Минуты */}
                {editingSeg === 'm' ? (
                  <input
                    autoFocus
                    type="number"
                    min={0}
                    max={59}
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onBlur={() => {
                      const v = parseInt(editVal)
                      if (!isNaN(v)) setPlannedEnd(withMinute(plannedEnd, v))
                      setEditingSeg(null)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const v = parseInt(editVal)
                        if (!isNaN(v)) setPlannedEnd(withMinute(plannedEnd, v))
                        setEditingSeg(null)
                      }
                      if (e.key === 'Escape') setEditingSeg(null)
                    }}
                    className="w-[5.5rem] text-center text-6xl font-bold tabular-nums tracking-tight bg-transparent border-b-2 border-primary outline-none text-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                ) : (
                  <span
                    onClick={() => { setEditingSeg('m'); setEditVal(String(getMinVal(plannedEnd)).padStart(2, '0')) }}
                    className="text-6xl font-bold tabular-nums tracking-tight cursor-pointer px-2 py-1 rounded-lg hover:bg-muted/60 transition-colors select-none"
                  >
                    {getTimePart(plannedEnd).split(':')[1] ?? '00'}
                  </span>
                )}
              </div>

              {/* Подсказка */}
              {editingSeg === null && (
                <p className="text-xs text-muted-foreground/60">нажмите на часы или минуты для ввода</p>
              )}

              {/* Кнопки − */}
              <div className="flex gap-1">
                {([5, 15, 30, 60] as const).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPlannedEnd(adjustShiftEnd(plannedEnd, -d))}
                    className="w-14 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    −{d < 60 ? `${d}м` : '1ч'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {actionError && <p className="text-sm text-destructive mt-2">{actionError}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpenShiftDialog(false); setEditingSeg(null) }}>Отмена</Button>
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

      {/* New print job dialog */}
      <Dialog open={newJobDialog} onClose={() => setNewJobDialog(false)}>
        <DialogHeader>
          <DialogTitle>Добавить задание на печать</DialogTitle>
          <DialogClose onClose={() => setNewJobDialog(false)} />
        </DialogHeader>
        <DialogContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>SKU</Label>
              <select
                value={newJobForm.sku_id}
                onChange={e => setNewJobForm(f => ({ ...f, sku_id: e.target.value ? Number(e.target.value) : '' }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">—</option>
                {skusForJob?.map(s => <option key={s.id} value={s.id}>{s.article} — {s.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Принтер</Label>
              <select
                value={newJobForm.printer_id}
                onChange={e => setNewJobForm(f => ({ ...f, printer_id: e.target.value ? Number(e.target.value) : '' }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">—</option>
                {printersForJob?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Количество</Label>
              <Input type="number" min={1} value={newJobForm.qty} onChange={e => setNewJobForm(f => ({ ...f, qty: Number(e.target.value) }))} />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>Плановый старт (опционально)</Label>
              <Input type="datetime-local" value={newJobForm.scheduled_start} onChange={e => setNewJobForm(f => ({ ...f, scheduled_start: e.target.value }))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Длительность рассчитается автоматически по профилю печати (SKU × Принтер).</p>
          {actionError && <p className="text-sm text-destructive mt-2">{actionError}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setNewJobDialog(false)}>Отмена</Button>
          <Button
            disabled={!newJobForm.sku_id || !newJobForm.printer_id || !newJobForm.qty || createJobMutation.isPending}
            onClick={() => createJobMutation.mutate()}
          >
            {createJobMutation.isPending ? 'Создание...' : 'Создать'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Итоги закрытия смены */}
      <Dialog open={!!closeResult} onClose={() => setCloseResult(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Смена закрыта</DialogTitle></DialogHeader>
          {closeResult && (
            <div className="flex flex-col gap-3">
              {closeResult.printer_hours.length === 0 && (
                <p className="text-sm text-muted-foreground">За смену нет завершённых заданий печати.</p>
              )}
              {closeResult.printer_hours.map(ph => (
                <div key={ph.printer_id} className={`rounded-xl border px-4 py-3 flex flex-col gap-1 ${ph.maintenance_due ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/20' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Принтер #{ph.printer_id}</span>
                    <span className="text-xs text-muted-foreground">Итого: {ph.total_hours.toFixed(1)} ч</span>
                  </div>
                  <span className="text-xs text-muted-foreground">+{ph.hours_added.toFixed(2)} ч за смену</span>
                  {ph.maintenance_due && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-orange-600">⚠ Требуется ТО</span>
                      {ph.maintenance_actions.map((a, i) => (
                        <span key={i} className="text-xs text-orange-700">— {a}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCloseResult(null)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
