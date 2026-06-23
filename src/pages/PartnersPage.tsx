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
import { Plus, Pencil, Trash2, User } from 'lucide-react'

interface Partner { id: number; user_id: number | null; name: string; tax_regime: 'IP_USN6' | 'NPD'; share: number }

const TAX_LABEL: Record<string, string> = { IP_USN6: 'ИП УСН 6%', NPD: 'НПД (самозанятый)' }

const EMPTY: Partial<Partner> = { name: '', tax_regime: 'IP_USN6', share: 0.5, user_id: null }

export default function PartnersPage() {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const [dialog, setDialog] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<Partner>>(EMPTY)
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: () => api.get('/partners').then(r => r.data.data as Partner[]),
  })

  const save = useMutation({
    mutationFn: () => editId ? api.patch(`/partners/${editId}`, form) : api.post('/partners', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['partners'] }); close() },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка'),
  })
  const del = useMutation({
    mutationFn: () => api.delete(`/partners/${deleteId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['partners'] }); setDeleteId(null) },
  })

  function close() { setDialog(false); setEditId(null); setForm(EMPTY); setError('') }
  function openCreate() { setEditId(null); setForm(EMPTY); setError(''); setDialog(true) }
  function openEdit(p: Partner) { setEditId(p.id); setForm(p); setError(''); setDialog(true) }

  const partners = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Партнёры</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Получатели выплат и доли</p>
        </div>
        {isOwner && <Button onClick={openCreate} className="gap-2"><Plus className="size-4" /> Добавить</Button>}
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Налоговый режим</TableHead>
              <TableHead className="text-right">Доля</TableHead>
              <TableHead>User ID</TableHead>
              {isOwner && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">Загрузка...</TableCell></TableRow>}
            {!isLoading && partners.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">Нет партнёров</TableCell></TableRow>}
            {partners.map(p => (
              <TableRow key={p.id}>
                <TableCell><div className="flex items-center gap-2"><User className="size-4 text-muted-foreground" /><span className="font-medium">{p.name}</span></div></TableCell>
                <TableCell><Badge variant="outline">{TAX_LABEL[p.tax_regime]}</Badge></TableCell>
                <TableCell className="text-right font-medium">{(p.share * 100).toFixed(1)}%</TableCell>
                <TableCell className="text-muted-foreground text-xs">{p.user_id ?? '—'}</TableCell>
                {isOwner && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} className="text-destructive hover:text-destructive"><Trash2 className="size-3.5" /></Button>
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
          <DialogTitle>{editId ? 'Редактировать партнёра' : 'Новый партнёр'}</DialogTitle>
          <DialogClose onClose={close} />
        </DialogHeader>
        <DialogContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>Имя</Label>
              <Input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Иван ИП" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Налоговый режим</Label>
              <Select value={form.tax_regime ?? 'IP_USN6'} onChange={e => setForm(f => ({ ...f, tax_regime: e.target.value as Partner['tax_regime'] }))}>
                <option value="IP_USN6">ИП УСН 6%</option>
                <option value="NPD">НПД</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Доля (0-1)</Label>
              <Input type="number" min={0} max={1} step="0.01" value={form.share ?? 0} onChange={e => setForm(f => ({ ...f, share: Number(e.target.value) }))} />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>User ID (опционально)</Label>
              <Input type="number" min={1} value={form.user_id ?? ''} onChange={e => setForm(f => ({ ...f, user_id: e.target.value ? Number(e.target.value) : null }))} />
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
          <DialogTitle>Удалить партнёра?</DialogTitle>
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
