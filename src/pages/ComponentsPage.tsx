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
import { Plus, Search, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { fmtNum } from '@/lib/format'

interface Component {
  id: number
  name: string
  unit: 'g' | 'ml' | 'pcs' | 'm'
  current_stock: number
  min_level: number
  lead_time_days: number
  purchase_price: number | null
  purchase_qty: number | null
  price_per_unit: number | null
  supplier_id: number | null
}

const UNIT_LABEL: Record<string, string> = { g: 'г', ml: 'мл', pcs: 'шт', m: 'м' }

const EMPTY: Partial<Component> = {
  name: '', unit: 'g',
  current_stock: 0, min_level: 0, lead_time_days: 7,
  purchase_price: null, purchase_qty: null,
}

export default function ComponentsPage() {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<Component>>(EMPTY)
  const [editId, setEditId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['components', search],
    queryFn: () => api.get('/components', {
      params: { search: search || undefined },
    }).then(r => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Component>) =>
      editId
        ? api.patch(`/components/${editId}`, payload).then(r => r.data)
        : api.post('/components', payload).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['components'] }); closeDialog() },
    onError: (e: any) => setFormError(e.response?.data?.message ?? 'Ошибка сохранения'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/components/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['components'] }); setDeleteId(null) },
  })

  function openCreate() { setEditId(null); setForm(EMPTY); setFormError(''); setDialogOpen(true) }
  function openEdit(c: Component) { setEditId(c.id); setForm(c); setFormError(''); setDialogOpen(true) }
  function closeDialog() { setDialogOpen(false); setForm(EMPTY); setEditId(null); setFormError('') }
  function set(field: keyof Component) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const components: Component[] = data?.data ?? []
  const lowStock = components.filter(c => c.current_stock < c.min_level)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Компоненты и расходники</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Пластик, упаковка и прочие материалы</p>
        </div>
        {isOwner && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" /> Добавить компонент
          </Button>
        )}
      </div>

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <div className="flex flex-col gap-2">
          {lowStock.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              <AlertTriangle className="size-4 shrink-0" />
              <span>Нехватка: <strong>{c.name}</strong> — остаток {c.current_stock.toLocaleString('ru')} {UNIT_LABEL[c.unit]} (мин. {c.min_level.toLocaleString('ru')})</span>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Ед.</TableHead>
              <TableHead>Остаток</TableHead>
              <TableHead>Мин. уровень</TableHead>
              <TableHead>Цена за ед.</TableHead>
              <TableHead>Срок поставки, дн.</TableHead>
              {isOwner && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">Загрузка...</TableCell>
              </TableRow>
            )}
            {!isLoading && components.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">Ничего не найдено</TableCell>
              </TableRow>
            )}
            {components.map(c => {
              const isLow = c.current_stock < c.min_level
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{UNIT_LABEL[c.unit]}</TableCell>
                  <TableCell>
                    <span className={isLow ? 'text-destructive font-semibold flex items-center gap-1' : ''}>
                      {isLow && <AlertTriangle className="size-3.5 shrink-0" />}
                      {c.current_stock.toLocaleString('ru')}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.min_level.toLocaleString('ru')}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.price_per_unit != null ? `${fmtNum(c.price_per_unit)} ₽/${UNIT_LABEL[c.unit]}` : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.lead_time_days}</TableCell>
                  {isOwner && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog}>
        <DialogHeader>
          <DialogTitle>{editId ? 'Редактировать компонент' : 'Новый компонент'}</DialogTitle>
          <DialogClose onClose={closeDialog} />
        </DialogHeader>
        <DialogContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>Название *</Label>
              <Input value={form.name ?? ''} onChange={set('name')} placeholder="PLA Black 1kg" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Единица измерения</Label>
              <Select value={form.unit ?? 'g'} onChange={set('unit')}>
                <option value="g">Граммы (г)</option>
                <option value="ml">Миллилитры (мл)</option>
                <option value="pcs">Штуки (шт)</option>
                <option value="m">Метры (м)</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Срок поставки, дней</Label>
              <Input value={form.lead_time_days ?? ''} onChange={set('lead_time_days')} type="number" min={0} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Текущий остаток</Label>
              <Input value={form.current_stock ?? ''} onChange={set('current_stock')} type="number" min={0} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Минимальный уровень</Label>
              <Input value={form.min_level ?? ''} onChange={set('min_level')} type="number" min={0} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Цена закупки, ₽</Label>
              <Input value={form.purchase_price ?? ''} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value ? Number(e.target.value) : null }))} type="number" min={0} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Объём закупки ({UNIT_LABEL[form.unit ?? 'g']})</Label>
              <Input value={form.purchase_qty ?? ''} onChange={e => setForm(f => ({ ...f, purchase_qty: e.target.value ? Number(e.target.value) : null }))} type="number" min={0} />
            </div>
          </div>
          {formError && <p className="text-sm text-destructive mt-3">{formError}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>Отмена</Button>
          <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
            {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)}>
        <DialogHeader>
          <DialogTitle>Удалить компонент?</DialogTitle>
          <DialogClose onClose={() => setDeleteId(null)} />
        </DialogHeader>
        <DialogContent>
          <p className="text-sm text-muted-foreground">Компонент будет удалён безвозвратно.</p>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteId(null)}>Отмена</Button>
          <Button variant="destructive" disabled={deleteMutation.isPending}
            onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
            {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
