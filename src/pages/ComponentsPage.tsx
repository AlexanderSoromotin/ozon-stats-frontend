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
import { Plus, Search, Pencil, Trash2, AlertTriangle } from 'lucide-react'

interface Component {
  id: number
  type: 'PLASTIC' | 'PACKAGING' | 'OTHER'
  name: string
  color: string | null
  unit: 'g' | 'ml' | 'pcs' | 'm'
  current_stock: number
  min_level: number
  lead_time_days: number
}

const TYPE_LABEL: Record<string, string> = { PLASTIC: 'Пластик', PACKAGING: 'Упаковка', OTHER: 'Прочее' }
const TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  PLASTIC: 'default', PACKAGING: 'secondary', OTHER: 'outline',
}
const UNIT_LABEL: Record<string, string> = { g: 'г', ml: 'мл', pcs: 'шт', m: 'м' }

const EMPTY: Partial<Component> = {
  type: 'PLASTIC', name: '', color: '', unit: 'g',
  current_stock: 0, min_level: 0, lead_time_days: 7,
}

export default function ComponentsPage() {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<Component>>(EMPTY)
  const [editId, setEditId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['components', search, typeFilter],
    queryFn: () => api.get('/components', {
      params: { search: search || undefined, type: typeFilter || undefined },
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

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>
            Нехватка материалов: <strong>{lowStock.map(c => c.name).join(', ')}</strong>
          </span>
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
        <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-40">
          <option value="">Все типы</option>
          <option value="PLASTIC">Пластик</option>
          <option value="PACKAGING">Упаковка</option>
          <option value="OTHER">Прочее</option>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Цвет</TableHead>
              <TableHead>Ед.</TableHead>
              <TableHead>Остаток</TableHead>
              <TableHead>Мин. уровень</TableHead>
              <TableHead>Срок поставки, дн.</TableHead>
              {isOwner && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">Загрузка...</TableCell>
              </TableRow>
            )}
            {!isLoading && components.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">Ничего не найдено</TableCell>
              </TableRow>
            )}
            {components.map(c => {
              const isLow = c.current_stock < c.min_level
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant={TYPE_VARIANT[c.type]}>{TYPE_LABEL[c.type]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.color || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{UNIT_LABEL[c.unit]}</TableCell>
                  <TableCell>
                    <span className={isLow ? 'text-destructive font-semibold flex items-center gap-1' : ''}>
                      {isLow && <AlertTriangle className="size-3.5 shrink-0" />}
                      {c.current_stock.toLocaleString('ru')}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.min_level.toLocaleString('ru')}</TableCell>
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
              <Label>Тип</Label>
              <Select value={form.type ?? 'PLASTIC'} onChange={set('type')}>
                <option value="PLASTIC">Пластик</option>
                <option value="PACKAGING">Упаковка</option>
                <option value="OTHER">Прочее</option>
              </Select>
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
              <Label>Цвет</Label>
              <Input value={form.color ?? ''} onChange={set('color')} placeholder="black" />
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
