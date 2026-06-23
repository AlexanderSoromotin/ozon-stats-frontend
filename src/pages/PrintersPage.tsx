import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Printer, Plus, Pencil, Trash2 } from 'lucide-react'
import { fmtDateTime, fmtNum } from '@/lib/format'

interface PrinterDev {
  id: number
  model: string
  name: string
  build_volume_cm3: number | null
  status: 'IDLE' | 'BUSY' | 'MAINTENANCE'
  busy_until: string | null
  total_print_hours: number
}

const STATUS_LABEL: Record<string, string> = { IDLE: 'Свободен', BUSY: 'Печатает', MAINTENANCE: 'Обслуживание' }
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary'> = {
  IDLE: 'success', BUSY: 'warning', MAINTENANCE: 'secondary',
}

const EMPTY: Partial<PrinterDev> = { model: '', name: '', build_volume_cm3: 0, status: 'IDLE' }

export default function PrintersPage() {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const [dialog, setDialog] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<PrinterDev>>(EMPTY)
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['printers'],
    queryFn: () => api.get('/printers').then(r => r.data.data as PrinterDev[]),
    refetchInterval: 30000,
  })

  const saveMutation = useMutation({
    mutationFn: () => editId
      ? api.patch(`/printers/${editId}`, form)
      : api.post('/printers', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['printers'] }); close() },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/printers/${deleteId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['printers'] }); setDeleteId(null) },
  })

  function openCreate() { setEditId(null); setForm(EMPTY); setError(''); setDialog(true) }
  function openEdit(p: PrinterDev) { setEditId(p.id); setForm(p); setError(''); setDialog(true) }
  function close() { setDialog(false); setEditId(null); setForm(EMPTY); setError('') }
  function set(field: keyof PrinterDev) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const printers = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Оборудование</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Принтеры и их текущий статус</p>
        </div>
        {isOwner && (
          <Button onClick={openCreate} className="gap-2"><Plus className="size-4" /> Добавить принтер</Button>
        )}
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Принтер</TableHead>
              <TableHead>Модель</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Занят до</TableHead>
              <TableHead>Объём, см³</TableHead>
              <TableHead>Часов печати</TableHead>
              {isOwner && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Загрузка...</TableCell></TableRow>
            )}
            {!isLoading && printers.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Нет данных</TableCell></TableRow>
            )}
            {printers.map(p => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Printer className="size-4 text-muted-foreground" />
                    <span className="font-medium">{p.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.model}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{fmtDateTime(p.busy_until)}</TableCell>
                <TableCell className="text-muted-foreground">{fmtNum(p.build_volume_cm3)}</TableCell>
                <TableCell>{p.total_print_hours.toLocaleString('ru')}</TableCell>
                {isOwner && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={dialog} onClose={close}>
        <DialogHeader>
          <DialogTitle>{editId ? 'Редактировать принтер' : 'Новый принтер'}</DialogTitle>
          <DialogClose onClose={close} />
        </DialogHeader>
        <DialogContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Название</Label>
              <Input value={form.name ?? ''} onChange={set('name')} placeholder="Принтер #1" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Модель</Label>
              <Input value={form.model ?? ''} onChange={set('model')} placeholder="Creality K1 SE" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Объём печати, см³</Label>
              <Input type="number" min={0} value={form.build_volume_cm3 ?? ''} onChange={set('build_volume_cm3')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Статус</Label>
              <Select value={form.status ?? 'IDLE'} onChange={set('status')}>
                <option value="IDLE">Свободен</option>
                <option value="BUSY">Печатает</option>
                <option value="MAINTENANCE">Обслуживание</option>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Отмена</Button>
          <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)}>
        <DialogHeader>
          <DialogTitle>Удалить принтер?</DialogTitle>
          <DialogClose onClose={() => setDeleteId(null)} />
        </DialogHeader>
        <DialogContent>
          <p className="text-sm text-muted-foreground">Принтер будет удалён безвозвратно.</p>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteId(null)}>Отмена</Button>
          <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
            {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
