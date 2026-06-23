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
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { fmtMoney, daysAgoIso, todayIso } from '@/lib/format'

interface Expense {
  id: number; month: string; type: string
  amount_minor: number; amount: number
  currency: string; note: string | null
}

const TYPE_LABEL: Record<string, string> = {
  RENT: 'Аренда', SUBSCRIPTION: 'Подписки', LOGISTICS: 'Логистика', MARKETING: 'Маркетинг', OTHER: 'Прочее',
}

const EMPTY: Partial<Expense> & { amount_rub?: number } = {
  month: todayIso().slice(0, 8) + '01', type: 'OTHER', amount_minor: 0, note: '',
}

export default function ExpensesPage() {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const [from, setFrom] = useState(daysAgoIso(90))
  const [to, setTo] = useState(todayIso())
  const [typeFilter, setTypeFilter] = useState('')
  const [dialog, setDialog] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<Expense>>(EMPTY)
  const [amountRub, setAmountRub] = useState('')
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', from, to, typeFilter],
    queryFn: () => api.get('/expenses', { params: { from, to, type: typeFilter || undefined } }).then(r => r.data.data as Expense[]),
  })

  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, amount_minor: Math.round(Number(amountRub) * 100) }
      return editId ? api.patch(`/expenses/${editId}`, payload) : api.post('/expenses', payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); close() },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка'),
  })
  const del = useMutation({
    mutationFn: () => api.delete(`/expenses/${deleteId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setDeleteId(null) },
  })

  function close() { setDialog(false); setEditId(null); setForm(EMPTY); setAmountRub(''); setError('') }
  function openCreate() { setEditId(null); setForm(EMPTY); setAmountRub(''); setError(''); setDialog(true) }
  function openEdit(e: Expense) {
    setEditId(e.id); setForm(e); setAmountRub(String(e.amount_minor / 100)); setError(''); setDialog(true)
  }

  const expenses = data ?? []
  const total = expenses.reduce((acc, e) => acc + e.amount_minor, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Расходы</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Постоянные и переменные затраты</p>
        </div>
        {isOwner && <Button onClick={openCreate} className="gap-2"><Plus className="size-4" /> Добавить расход</Button>}
      </div>

      <div className="rounded-xl border bg-card p-5 flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">С</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">По</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Тип</Label>
          <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-44">
            <option value="">Все</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">Итого за период</p>
          <p className="text-xl font-bold">{fmtMoney(total)}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Месяц</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead>Комментарий</TableHead>
              {isOwner && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">Загрузка...</TableCell></TableRow>}
            {!isLoading && expenses.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">Нет расходов за период</TableCell></TableRow>}
            {expenses.map(e => (
              <TableRow key={e.id}>
                <TableCell className="text-sm">{e.month}</TableCell>
                <TableCell><Badge variant="outline">{TYPE_LABEL[e.type] ?? e.type}</Badge></TableCell>
                <TableCell className="text-right font-medium">{fmtMoney(e.amount_minor)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{e.note ?? '—'}</TableCell>
                {isOwner && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(e.id)} className="text-destructive hover:text-destructive"><Trash2 className="size-3.5" /></Button>
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
          <DialogTitle>{editId ? 'Редактировать расход' : 'Новый расход'}</DialogTitle>
          <DialogClose onClose={close} />
        </DialogHeader>
        <DialogContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Месяц</Label>
              <Input type="date" value={form.month ?? ''} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Тип</Label>
              <Select value={form.type ?? 'OTHER'} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>Сумма, ₽</Label>
              <Input type="number" min={0} step="0.01" value={amountRub} onChange={e => setAmountRub(e.target.value)} placeholder="50000" />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>Комментарий</Label>
              <Input value={form.note ?? ''} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Аренда мастерской" />
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
          <DialogTitle>Удалить расход?</DialogTitle>
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
