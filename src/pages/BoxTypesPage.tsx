import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Box } from 'lucide-react'
import { fmtNum } from '@/lib/format'

interface BoxType { id: number; name: string; inner_volume_cm3: number }

export default function BoxTypesPage() {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const [dialog, setDialog] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<BoxType>>({ name: '', inner_volume_cm3: 0 })
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['box-types'],
    queryFn: () => api.get('/box-types').then(r => r.data.data as BoxType[]),
  })

  const save = useMutation({
    mutationFn: () => editId ? api.patch(`/box-types/${editId}`, form) : api.post('/box-types', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['box-types'] }); close() },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка'),
  })
  const del = useMutation({
    mutationFn: () => api.delete(`/box-types/${deleteId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['box-types'] }); setDeleteId(null) },
  })

  function close() { setDialog(false); setEditId(null); setForm({ name: '', inner_volume_cm3: 0 }); setError('') }
  function openCreate() { setEditId(null); setForm({ name: '', inner_volume_cm3: 0 }); setError(''); setDialog(true) }
  function openEdit(b: BoxType) { setEditId(b.id); setForm(b); setError(''); setDialog(true) }

  const boxes = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Типы коробов</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Тары для упаковки поставок в Ozon</p>
        </div>
        {isOwner && <Button onClick={openCreate} className="gap-2"><Plus className="size-4" /> Добавить</Button>}
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead className="text-right">Внутренний объём, см³</TableHead>
              {isOwner && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-12">Загрузка...</TableCell></TableRow>}
            {!isLoading && boxes.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-12">Нет коробов</TableCell></TableRow>}
            {boxes.map(b => (
              <TableRow key={b.id}>
                <TableCell><div className="flex items-center gap-2"><Box className="size-4 text-muted-foreground" /><span className="font-medium">{b.name}</span></div></TableCell>
                <TableCell className="text-right">{fmtNum(b.inner_volume_cm3)}</TableCell>
                {isOwner && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(b.id)} className="text-destructive hover:text-destructive"><Trash2 className="size-3.5" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialog} onClose={close}>
        <DialogHeader>
          <DialogTitle>{editId ? 'Редактировать короб' : 'Новый короб'}</DialogTitle>
          <DialogClose onClose={close} />
        </DialogHeader>
        <DialogContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Название</Label>
              <Input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Малый короб 30×20×15" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Внутренний объём, см³</Label>
              <Input type="number" min={0} value={form.inner_volume_cm3 ?? 0} onChange={e => setForm(f => ({ ...f, inner_volume_cm3: Number(e.target.value) }))} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Отмена</Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Сохранение...' : 'Сохранить'}</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)}>
        <DialogHeader>
          <DialogTitle>Удалить короб?</DialogTitle>
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
