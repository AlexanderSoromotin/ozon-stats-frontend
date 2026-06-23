import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'

interface Profile { id: number; sku_id: number; printer_id: number; plate_capacity: number; full_plate_time_min: number }
interface Sku { id: number; article: string; name: string }
interface Printer { id: number; name: string }

const EMPTY: Partial<Profile> = { sku_id: 0, printer_id: 0, plate_capacity: 1, full_plate_time_min: 60 }

export default function PrintProfilesPage() {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const [dialog, setDialog] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<Profile>>(EMPTY)
  const [error, setError] = useState('')

  const { data: profilesData, isLoading } = useQuery({
    queryKey: ['print-profiles'],
    queryFn: () => api.get('/print-profiles').then(r => r.data.data as Profile[]),
  })
  const { data: skusData } = useQuery({
    queryKey: ['skus', 'all-active'],
    queryFn: () => api.get('/skus', { params: { per_page: 200, status: 'ACTIVE' } }).then(r => r.data.data as Sku[]),
  })
  const { data: printersData } = useQuery({
    queryKey: ['printers'],
    queryFn: () => api.get('/printers').then(r => r.data.data as Printer[]),
  })

  const profiles = profilesData ?? []
  const skus = skusData ?? []
  const printers = printersData ?? []

  const save = useMutation({
    mutationFn: () => editId ? api.patch(`/print-profiles/${editId}`, form) : api.post('/print-profiles', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['print-profiles'] }); close() },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка'),
  })
  const del = useMutation({
    mutationFn: () => api.delete(`/print-profiles/${deleteId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['print-profiles'] }); setDeleteId(null) },
  })

  function close() { setDialog(false); setEditId(null); setForm(EMPTY); setError('') }
  function openCreate() { setEditId(null); setForm(EMPTY); setError(''); setDialog(true) }
  function openEdit(p: Profile) { setEditId(p.id); setForm(p); setError(''); setDialog(true) }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Профили печати</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Длительность печати SKU × Принтер</p>
        </div>
        {isOwner && <Button onClick={openCreate} className="gap-2"><Plus className="size-4" /> Добавить профиль</Button>}
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Принтер</TableHead>
              <TableHead className="text-right">Шт на плиту</TableHead>
              <TableHead className="text-right">Время плиты, мин</TableHead>
              {isOwner && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">Загрузка...</TableCell></TableRow>}
            {!isLoading && profiles.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">Нет профилей</TableCell></TableRow>}
            {profiles.map(p => {
              const sku = skus.find(s => s.id === p.sku_id)
              const pr = printers.find(pp => pp.id === p.printer_id)
              return (
                <TableRow key={p.id}>
                  <TableCell>{sku ? <><span className="font-mono text-xs text-muted-foreground">{sku.article}</span> <span className="text-sm">{sku.name}</span></> : `#${p.sku_id}`}</TableCell>
                  <TableCell>{pr?.name ?? `#${p.printer_id}`}</TableCell>
                  <TableCell className="text-right">{p.plate_capacity}</TableCell>
                  <TableCell className="text-right">{p.full_plate_time_min}</TableCell>
                  {isOwner && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="size-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} className="text-destructive hover:text-destructive"><Trash2 className="size-3.5" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialog} onClose={close}>
        <DialogHeader>
          <DialogTitle>{editId ? 'Редактировать профиль' : 'Новый профиль'}</DialogTitle>
          <DialogClose onClose={close} />
        </DialogHeader>
        <DialogContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>SKU</Label>
              <Select value={form.sku_id ?? ''} onChange={e => setForm(f => ({ ...f, sku_id: Number(e.target.value) }))}>
                <option value="">—</option>
                {skus.map(s => <option key={s.id} value={s.id}>{s.article} — {s.name}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>Принтер</Label>
              <Select value={form.printer_id ?? ''} onChange={e => setForm(f => ({ ...f, printer_id: Number(e.target.value) }))}>
                <option value="">—</option>
                {printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Штук на плиту</Label>
              <Input type="number" min={1} value={form.plate_capacity ?? 1} onChange={e => setForm(f => ({ ...f, plate_capacity: Number(e.target.value) }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Время плиты, мин</Label>
              <Input type="number" min={1} value={form.full_plate_time_min ?? 60} onChange={e => setForm(f => ({ ...f, full_plate_time_min: Number(e.target.value) }))} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Отмена</Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Сохранение...' : 'Сохранить'}</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)}>
        <DialogHeader>
          <DialogTitle>Удалить профиль?</DialogTitle>
          <DialogClose onClose={() => setDeleteId(null)} />
        </DialogHeader>
        <DialogContent><p className="text-sm text-muted-foreground">Действие необратимо.</p></DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteId(null)}>Отмена</Button>
          <Button variant="destructive" disabled={del.isPending} onClick={() => del.mutate()}>{del.isPending ? 'Удаление...' : 'Удалить'}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
