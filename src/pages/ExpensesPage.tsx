import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BanknoteArrowDown, BanknoteArrowUp, CheckCircle2, Package, Pencil, Plus, Printer, ReceiptText, ShoppingCart, Trash2, Truck } from 'lucide-react'
import PeriodPicker, { presetPeriod, type PeriodValue } from '@/components/PeriodPicker'
import { fmtDate, fmtMoney, todayIso } from '@/lib/format'
import { SkeletonTableRows } from '@/components/ui/skeleton'

interface Partner { id: number; name: string }
interface Sku { id: number; article: string; name: string }

interface Expense {
  id: number
  month: string
  type: string
  amount_minor: number
  payment_source: 'COMPANY' | 'PARTNER'
  paid_by_partner_id: number | null
  paid_by_partner_name?: string | null
  paid_by_partner?: Partner | null
  is_reimbursable: boolean
  is_reimbursed: boolean
  note: string | null
}

interface SaleItem {
  id: number | null
  sku_id: number | null
  sku_name: string | null
  sku_article: string | null
  name: string | null
  qty: number
  unit_cogs_minor: number
  total_cogs_minor: number
  material_cogs_minor?: number
  electricity_cost_minor?: number
  depreciation_cost_minor?: number
}

interface IncomeRow {
  id: number
  date: string
  source: 'external' | 'marketplace'
  channel: string
  customer_name?: string | null
  operation_id?: string | null
  sku_id: number | null
  sku_name: string | null
  sku_article: string | null
  qty: number
  items?: SaleItem[]
  revenue_minor: number
  product_cogs_minor?: number
  material_cogs_minor?: number
  electricity_cost_minor?: number
  depreciation_cost_minor?: number
  delivery_cost_minor?: number
  total_cogs_minor?: number
  cogs_minor: number
  gross_profit_minor: number
  note: string | null
}

interface Ledger {
  summary: Record<string, number>
  external_incomes: IncomeRow[]
  marketplace_incomes: IncomeRow[]
  expenses: Expense[]
}

interface SaleItemForm {
  uid: string
  sku_id: string
  qty: string
  unit_cogs_rub: string
}

interface DirectSaleForm {
  date: string
  channel: string
  customer_name: string
  revenue_rub: string
  delivery_cost_rub: string
  note: string
  items: SaleItemForm[]
}

interface ExpenseForm {
  month: string
  type: string
  amount_rub: string
  payment_source: 'COMPANY' | 'PARTNER'
  paid_by_partner_id: string
  is_reimbursable: boolean
  is_reimbursed: boolean
  note: string
}

const TYPE_LABEL: Record<string, string> = {
  RENT: 'Аренда',
  MATERIALS: 'Материалы',
  ELECTRICITY: 'Электричество',
  AMORTIZATION: 'Амортизация',
  SUBSCRIPTION: 'Подписки',
  SERVER: 'Сервер и хостинг',
  LOGISTICS: 'Логистика',
  MARKETING: 'Реклама',
  PACKAGING: 'Упаковка',
  OTHER: 'Другое',
}

const CHANNEL_LABEL: Record<string, string> = {
  DIRECT: 'Прямая продажа',
  BANK_TRANSFER: 'Оплата на счёт',
  WHOLESALE: 'Опт',
  OTHER: 'Другой канал',
  OZON: 'Ozon',
}

function newSaleItem(): SaleItemForm {
  return { uid: `${Date.now()}-${Math.random()}`, sku_id: '', qty: '1', unit_cogs_rub: '' }
}

const emptySale = (): DirectSaleForm => ({
  date: todayIso(),
  channel: 'BANK_TRANSFER',
  customer_name: '',
  revenue_rub: '',
  delivery_cost_rub: '',
  note: '',
  items: [newSaleItem()],
})

const emptyExpense = (): ExpenseForm => ({
  month: todayIso(),
  type: 'MATERIALS',
  amount_rub: '',
  payment_source: 'COMPANY',
  paid_by_partner_id: '',
  is_reimbursable: false,
  is_reimbursed: false,
  note: '',
})

function moneyToMinor(value: string): number {
  return Math.round(Number(value || 0) * 100)
}

function errorMessage(e: any, fallback: string): string {
  const errors = e.response?.data?.errors
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors)[0]
    if (Array.isArray(first) && first[0]) return String(first[0])
  }

  return e.response?.data?.message ?? e.message ?? fallback
}

function StatCard({ title, value, icon: Icon, tone = 'default' }: { title: string; value: number; icon: any; tone?: 'default' | 'good' | 'warn' }) {
  const toneClass = tone === 'good' ? 'text-green-600' : tone === 'warn' ? 'text-amber-600' : value < 0 ? 'text-destructive' : ''

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{title}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className={`text-2xl font-bold mt-2 ${toneClass}`}>{fmtMoney(value)}</p>
    </div>
  )
}

function saleItemsText(row: IncomeRow): string {
  const items = row.items ?? []
  if (items.length === 0) {
    return row.sku_name ? `${row.sku_article ?? ''} ${row.sku_name} x ${row.qty}`.trim() : 'Состав не указан'
  }

  return items
    .map(item => `${item.sku_article ?? ''} ${item.sku_name ?? item.name ?? 'Товар'} x ${item.qty}`.trim())
    .join(', ')
}

export default function ExpensesPage() {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const [period, setPeriod] = useState<PeriodValue>(() => presetPeriod('month', true))
  const { from, to } = period
  const [saleDialog, setSaleDialog] = useState(false)
  const [expenseDialog, setExpenseDialog] = useState(false)
  const [editSaleId, setEditSaleId] = useState<number | null>(null)
  const [editExpenseId, setEditExpenseId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'sale' | 'expense'; id: number } | null>(null)
  const [saleForm, setSaleForm] = useState<DirectSaleForm>(emptySale)
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpense)
  const [error, setError] = useState('')

  const ledgerQuery = useQuery({
    queryKey: ['finance-ledger', from, to],
    queryFn: () => api.get('/finance/ledger', { params: { from, to } }).then(r => r.data.data as Ledger),
  })

  const partnersQuery = useQuery({
    queryKey: ['partners'],
    queryFn: () => api.get('/partners').then(r => r.data.data as Partner[]),
  })

  const skusQuery = useQuery({
    queryKey: ['skus-for-sales'],
    queryFn: () => api.get('/skus', { params: { per_page: 200 } }).then(r => r.data.data as Sku[]),
  })

  const saveSale = useMutation({
    mutationFn: () => {
      if (!saleForm.date) throw new Error('Укажите дату оплаты.')
      if (moneyToMinor(saleForm.revenue_rub) <= 0) throw new Error('Укажите сумму оплаты больше нуля.')
      if (saleForm.items.length === 0) throw new Error('Добавьте хотя бы один товар.')
      if (saleForm.items.some(item => !item.sku_id)) throw new Error('Выберите товар в каждой строке продажи.')
      if (saleForm.items.some(item => Number(item.qty || 0) <= 0)) throw new Error('Количество товара должно быть больше нуля.')

      const payload = {
        date: saleForm.date,
        channel: saleForm.channel,
        customer_name: saleForm.customer_name || null,
        revenue_minor: moneyToMinor(saleForm.revenue_rub),
        delivery_cost_minor: moneyToMinor(saleForm.delivery_cost_rub),
        note: saleForm.note || null,
        items: saleForm.items.map(item => ({
          sku_id: Number(item.sku_id),
          qty: Number(item.qty || 1),
          unit_cogs_minor: item.unit_cogs_rub === '' ? null : moneyToMinor(item.unit_cogs_rub),
        })),
      }

      return editSaleId ? api.patch(`/external-incomes/${editSaleId}`, payload) : api.post('/external-incomes', payload)
    },
    onSuccess: () => { invalidateLedger(); closeSale() },
    onError: (e: any) => setError(errorMessage(e, 'Не удалось сохранить прямую продажу.')),
  })

  const saveExpense = useMutation({
    mutationFn: () => {
      if (!expenseForm.month) throw new Error('Укажите дату оплаты.')
      if (moneyToMinor(expenseForm.amount_rub) <= 0) throw new Error('Укажите сумму расхода больше нуля.')
      if (expenseForm.payment_source === 'PARTNER' && !expenseForm.paid_by_partner_id) {
        throw new Error('Выберите партнёра, который оплатил расход.')
      }

      const reimbursedAt = editExpenseId && expenseForm.payment_source === 'PARTNER' && expenseForm.is_reimbursed
        ? todayIso()
        : null

      const payload = {
        month: expenseForm.month,
        type: expenseForm.type,
        amount_minor: moneyToMinor(expenseForm.amount_rub),
        payment_source: expenseForm.payment_source,
        paid_by_partner_id: expenseForm.payment_source === 'PARTNER' ? Number(expenseForm.paid_by_partner_id) : null,
        is_reimbursable: expenseForm.payment_source === 'PARTNER' && expenseForm.is_reimbursable,
        reimbursed_at: reimbursedAt,
        note: expenseForm.note || null,
      }

      return editExpenseId ? api.patch(`/expenses/${editExpenseId}`, payload) : api.post('/expenses', payload)
    },
    onSuccess: () => { invalidateLedger(); closeExpense() },
    onError: (e: any) => setError(errorMessage(e, 'Не удалось сохранить расход.')),
  })

  const remove = useMutation({
    mutationFn: () => deleteTarget?.kind === 'sale' ? api.delete(`/external-incomes/${deleteTarget.id}`) : api.delete(`/expenses/${deleteTarget?.id}`),
    onSuccess: () => { invalidateLedger(); setDeleteTarget(null) },
  })

  function invalidateLedger() {
    qc.invalidateQueries({ queryKey: ['finance-ledger'] })
    qc.invalidateQueries({ queryKey: ['expenses'] })
    qc.invalidateQueries({ queryKey: ['external-incomes'] })
  }

  function closeSale() {
    setSaleDialog(false)
    setEditSaleId(null)
    setSaleForm(emptySale())
    setError('')
  }

  function closeExpense() {
    setExpenseDialog(false)
    setEditExpenseId(null)
    setExpenseForm(emptyExpense())
    setError('')
  }

  function openSale(row?: IncomeRow) {
    setError('')
    if (row) {
      setEditSaleId(row.id)
      const items = (row.items ?? []).length > 0
        ? (row.items ?? []).map(item => ({
            uid: `${item.id ?? item.sku_id}-${Math.random()}`,
            sku_id: item.sku_id ? String(item.sku_id) : '',
            qty: String(item.qty),
            unit_cogs_rub: item.unit_cogs_minor > 0 ? String(item.unit_cogs_minor / 100) : '',
          }))
        : [{ ...newSaleItem(), sku_id: row.sku_id ? String(row.sku_id) : '', qty: String(row.qty), unit_cogs_rub: row.product_cogs_minor && row.qty > 0 ? String(row.product_cogs_minor / row.qty / 100) : '' }]

      setSaleForm({
        date: row.date,
        channel: row.channel,
        customer_name: row.customer_name ?? '',
        revenue_rub: String(row.revenue_minor / 100),
        delivery_cost_rub: row.delivery_cost_minor ? String(row.delivery_cost_minor / 100) : '',
        note: row.note ?? '',
        items,
      })
    } else {
      setEditSaleId(null)
      setSaleForm(emptySale())
    }
    setSaleDialog(true)
  }

  function openExpense(row?: Expense) {
    setError('')
    if (row) {
      setEditExpenseId(row.id)
      setExpenseForm({
        month: row.month,
        type: row.type,
        amount_rub: String(row.amount_minor / 100),
        payment_source: row.payment_source,
        paid_by_partner_id: row.paid_by_partner_id ? String(row.paid_by_partner_id) : '',
        is_reimbursable: row.is_reimbursable,
        is_reimbursed: row.is_reimbursed,
        note: row.note ?? '',
      })
    } else {
      setEditExpenseId(null)
      setExpenseForm(emptyExpense())
    }
    setExpenseDialog(true)
  }

  function setExpensePaymentSource(payment_source: ExpenseForm['payment_source']) {
    setExpenseForm(f => ({
      ...f,
      payment_source,
      paid_by_partner_id: payment_source === 'PARTNER' ? f.paid_by_partner_id : '',
      is_reimbursable: payment_source === 'PARTNER',
      is_reimbursed: payment_source === 'PARTNER' ? f.is_reimbursed : false,
    }))
  }

  function updateSaleItem(uid: string, patch: Partial<SaleItemForm>) {
    setSaleForm(form => ({
      ...form,
      items: form.items.map(item => item.uid === uid ? { ...item, ...patch } : item),
    }))
  }

  function removeSaleItem(uid: string) {
    setSaleForm(form => ({ ...form, items: form.items.filter(item => item.uid !== uid) }))
  }

  const ledger = ledgerQuery.data
  const summary = ledger?.summary ?? {}
  const directSales = ledger?.external_incomes ?? []
  const marketplaceSales = ledger?.marketplace_incomes ?? []
  const expenses = ledger?.expenses ?? []
  const partners = partnersQuery.data ?? []
  const skus = skusQuery.data ?? []
  const totalDirectDelivery = summary.external_delivery_cost_minor ?? 0
  const totalProductCogs = summary.total_product_cogs_minor ?? summary.materials_need_minor ?? 0
  const totalMaterialCogs = summary.total_material_cogs_minor ?? summary.materials_need_minor ?? 0
  const totalPrinterCosts = summary.printer_costs_minor ?? ((summary.total_electricity_cost_minor ?? 0) + (summary.total_depreciation_cost_minor ?? 0))
  const salesCosts = summary.sales_costs_minor ?? summary.total_cogs_minor ?? 0

  const directSaleTotal = useMemo(() => saleForm.items.reduce((acc, item) => acc + Number(item.qty || 0), 0), [saleForm.items])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Продажи и расходы</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Прямые продажи, маркетплейсы, себестоимость, доставка и компенсации партнёрам</p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => openExpense()} className="gap-2"><ReceiptText className="size-4" /> Расход</Button>
            <Button onClick={() => openSale()} className="gap-2"><ShoppingCart className="size-4" /> Прямая продажа</Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5 flex items-center gap-3 flex-wrap">
        <PeriodPicker value={period} onChange={setPeriod} includeToday />
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">Итог после затрат и расходов</p>
          <p className={`text-xl font-bold ${(summary.cash_result_minor ?? 0) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
            {fmtMoney(summary.cash_result_minor)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Выручка" value={summary.total_revenue_minor ?? 0} icon={BanknoteArrowDown} tone="good" />
        <StatCard title="Полная себестоимость" value={totalProductCogs} icon={Package} tone="warn" />
        <StatCard title="Материалы" value={totalMaterialCogs} icon={Package} tone="warn" />
        <StatCard title="Электричество и амортизация" value={totalPrinterCosts} icon={Printer} tone="warn" />
        <StatCard title="Доставка прямых продаж" value={totalDirectDelivery} icon={Truck} tone="warn" />
        <StatCard title="Расходы бизнеса" value={summary.expenses_minor ?? 0} icon={BanknoteArrowUp} />
        <StatCard title="Долг партнёрам" value={summary.open_reimbursements_minor ?? 0} icon={ReceiptText} tone="warn" />
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Обзор</TabsTrigger>
          <TabsTrigger value="sales">Продажи</TabsTrigger>
          <TabsTrigger value="expenses">Расходы</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card">
              <div className="px-5 py-4 border-b">
                <p className="font-semibold text-sm">Выручка и затраты продаж</p>
              </div>
              <Table>
                <TableBody>
                  <TableRow><TableCell>Маркетплейсы</TableCell><TableCell className="text-right font-medium">{fmtMoney(summary.marketplace_revenue_minor)}</TableCell></TableRow>
                  <TableRow><TableCell>Прямые продажи</TableCell><TableCell className="text-right font-medium">{fmtMoney(summary.external_revenue_minor)}</TableCell></TableRow>
                  <TableRow><TableCell>Материалы в себестоимости</TableCell><TableCell className="text-right text-amber-600">{fmtMoney(totalMaterialCogs)}</TableCell></TableRow>
                  <TableRow><TableCell>Электричество и амортизация</TableCell><TableCell className="text-right text-amber-600">{fmtMoney(totalPrinterCosts)}</TableCell></TableRow>
                  <TableRow><TableCell>Доставка прямых продаж</TableCell><TableCell className="text-right text-amber-600">{fmtMoney(totalDirectDelivery)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="rounded-xl border bg-card">
              <div className="px-5 py-4 border-b">
                <p className="font-semibold text-sm">Результат периода</p>
              </div>
              <Table>
                <TableBody>
                  <TableRow><TableCell>Валовая прибыль</TableCell><TableCell className="text-right font-medium">{fmtMoney(summary.gross_profit_minor)}</TableCell></TableRow>
                  <TableRow><TableCell>Заложить на новые материалы</TableCell><TableCell className="text-right font-medium">{fmtMoney(summary.materials_need_minor)}</TableCell></TableRow>
                  <TableRow><TableCell>Полная себестоимость товаров</TableCell><TableCell className="text-right">{fmtMoney(totalProductCogs)}</TableCell></TableRow>
                  <TableRow><TableCell>Все затраты продаж</TableCell><TableCell className="text-right">{fmtMoney(salesCosts)}</TableCell></TableRow>
                  <TableRow><TableCell>Расходы бизнеса</TableCell><TableCell className="text-right">{fmtMoney(summary.expenses_minor)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sales">
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border bg-card">
              <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
                <p className="font-semibold text-sm">Прямые продажи</p>
                {isOwner && <Button size="sm" onClick={() => openSale()} className="gap-2"><Plus className="size-4" /> Продажа</Button>}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Состав</TableHead>
                    <TableHead className="text-right">Получено</TableHead>
                    <TableHead className="text-right">Себестоимость</TableHead>
                    <TableHead className="text-right">Доставка</TableHead>
                    <TableHead className="text-right">Прибыль</TableHead>
                    {isOwner && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerQuery.isLoading && <SkeletonTableRows cols={8} rows={5} />}
                  {!ledgerQuery.isLoading && directSales.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">Прямых продаж за период нет</TableCell></TableRow>}
                  {directSales.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm">{fmtDate(row.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{CHANNEL_LABEL[row.channel] ?? row.channel}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{row.customer_name ?? 'Клиент не указан'}</p>
                      </TableCell>
                      <TableCell className="max-w-[320px] text-sm">{saleItemsText(row)}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{fmtMoney(row.revenue_minor)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(row.product_cogs_minor ?? row.cogs_minor)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(row.delivery_cost_minor ?? 0)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(row.gross_profit_minor)}</TableCell>
                      {isOwner && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button title="Редактировать продажу" variant="ghost" size="icon" onClick={() => openSale(row)}><Pencil className="size-3.5" /></Button>
                            <Button title="Удалить продажу" variant="ghost" size="icon" onClick={() => setDeleteTarget({ kind: 'sale', id: row.id })} className="text-destructive hover:text-destructive"><Trash2 className="size-3.5" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-xl border bg-card">
              <div className="px-5 py-4 border-b">
                <p className="font-semibold text-sm">Маркетплейсы</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Площадка</TableHead>
                    <TableHead>Операция</TableHead>
                    <TableHead className="text-right">Выручка</TableHead>
                  <TableHead className="text-right">Полная себестоимость</TableHead>
                    <TableHead className="text-right">Прибыль</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerQuery.isLoading && <SkeletonTableRows cols={6} rows={5} />}
                  {!ledgerQuery.isLoading && marketplaceSales.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Продаж маркетплейсов за период нет</TableCell></TableRow>}
                  {marketplaceSales.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm">{fmtDate(row.date)}</TableCell>
                      <TableCell><Badge variant="secondary">{CHANNEL_LABEL[row.channel] ?? row.channel}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.operation_id ?? row.note ?? 'Продажа'}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{fmtMoney(row.revenue_minor)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(row.product_cogs_minor ?? row.cogs_minor)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(row.gross_profit_minor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="expenses">
          <div className="rounded-xl border bg-card">
            <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
              <p className="font-semibold text-sm">Расходы бизнеса</p>
              {isOwner && <Button size="sm" variant="outline" onClick={() => openExpense()} className="gap-2"><Plus className="size-4" /> Расход</Button>}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Статья</TableHead>
                  <TableHead>Кто оплатил</TableHead>
                  <TableHead>Компенсация</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead>Описание</TableHead>
                  {isOwner && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerQuery.isLoading && <SkeletonTableRows cols={7} rows={6} />}
                {!ledgerQuery.isLoading && expenses.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Расходов за период нет</TableCell></TableRow>}
                {expenses.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm">{fmtDate(row.month)}</TableCell>
                    <TableCell><Badge variant="outline">{TYPE_LABEL[row.type] ?? row.type}</Badge></TableCell>
                    <TableCell className="text-sm">{row.payment_source === 'COMPANY' ? 'Общие деньги' : row.paid_by_partner_name ?? row.paid_by_partner?.name ?? 'Партнёр'}</TableCell>
                    <TableCell>
                      {row.is_reimbursable ? (
                        row.is_reimbursed ? <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" /> Вернули</Badge> : <Badge variant="outline">Нужно вернуть</Badge>
                      ) : <span className="text-sm text-muted-foreground">Не нужно</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(row.amount_minor)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.note ?? '—'}</TableCell>
                    {isOwner && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button title="Редактировать расход" variant="ghost" size="icon" onClick={() => openExpense(row)}><Pencil className="size-3.5" /></Button>
                          <Button title="Удалить расход" variant="ghost" size="icon" onClick={() => setDeleteTarget({ kind: 'expense', id: row.id })} className="text-destructive hover:text-destructive"><Trash2 className="size-3.5" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={saleDialog} onClose={closeSale}>
        <DialogHeader>
          <DialogTitle>{editSaleId ? 'Редактировать прямую продажу' : 'Новая прямая продажа'}</DialogTitle>
          <DialogClose onClose={closeSale} />
        </DialogHeader>
        <DialogContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Дата оплаты</Label>
              <Input type="date" value={saleForm.date} onChange={e => setSaleForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Канал</Label>
              <Select value={saleForm.channel} onChange={e => setSaleForm(f => ({ ...f, channel: e.target.value }))}>
                {Object.entries(CHANNEL_LABEL).filter(([k]) => k !== 'OZON').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>Клиент или источник оплаты</Label>
              <Input value={saleForm.customer_name} onChange={e => setSaleForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Например: ООО Клиент, Авито, перевод на счёт" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Получено от клиента, ₽</Label>
              <Input type="number" min={0} step="0.01" value={saleForm.revenue_rub} onChange={e => setSaleForm(f => ({ ...f, revenue_rub: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Доставка, ₽</Label>
              <Input type="number" min={0} step="0.01" value={saleForm.delivery_cost_rub} onChange={e => setSaleForm(f => ({ ...f, delivery_cost_rub: e.target.value }))} />
            </div>

            <div className="col-span-2 flex items-center justify-between gap-3 pt-1">
              <div>
                <p className="text-sm font-medium">Товары в продаже</p>
                <p className="text-xs text-muted-foreground">Всего позиций: {directSaleTotal}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setSaleForm(f => ({ ...f, items: [...f.items, newSaleItem()] }))} className="gap-2">
                <Plus className="size-4" /> Товар
              </Button>
            </div>

            <div className="col-span-2 flex flex-col gap-3">
              {saleForm.items.map((item, index) => (
                <div key={item.uid} className="grid grid-cols-[1fr_96px_140px_36px] gap-3 items-end">
                  <div className="flex flex-col gap-1.5">
                    <Label>{index === 0 ? 'Товар' : 'Товар'}</Label>
                    <Select value={item.sku_id} onChange={e => updateSaleItem(item.uid, { sku_id: e.target.value })}>
                      <option value="">Выберите товар</option>
                      {skus.map(s => <option key={s.id} value={s.id}>{s.article} · {s.name}</option>)}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Кол-во</Label>
                    <Input type="number" min={1} value={item.qty} onChange={e => updateSaleItem(item.uid, { qty: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Полная себест./шт, ₽</Label>
                    <Input type="number" min={0} step="0.01" value={item.unit_cogs_rub} onChange={e => updateSaleItem(item.uid, { unit_cogs_rub: e.target.value })} placeholder="Авто" />
                  </div>
                  <Button type="button" variant="ghost" size="icon" title="Убрать товар" onClick={() => removeSaleItem(item.uid)} disabled={saleForm.items.length === 1} className="text-destructive hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>Описание</Label>
              <Input value={saleForm.note} onChange={e => setSaleForm(f => ({ ...f, note: e.target.value }))} placeholder="Номер счёта, заказ, детали оплаты" />
            </div>
          </div>
          {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={closeSale}>Отмена</Button>
          <Button disabled={saveSale.isPending} onClick={() => saveSale.mutate()}>{saveSale.isPending ? 'Сохраняю...' : 'Сохранить продажу'}</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={expenseDialog} onClose={closeExpense}>
        <DialogHeader>
          <DialogTitle>{editExpenseId ? 'Редактировать расход' : 'Новый расход'}</DialogTitle>
          <DialogClose onClose={closeExpense} />
        </DialogHeader>
        <DialogContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Дата оплаты</Label>
              <Input type="date" value={expenseForm.month} onChange={e => setExpenseForm(f => ({ ...f, month: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Статья расхода</Label>
              <Select value={expenseForm.type} onChange={e => setExpenseForm(f => ({ ...f, type: e.target.value }))}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Сумма, ₽</Label>
              <Input type="number" min={0} step="0.01" value={expenseForm.amount_rub} onChange={e => setExpenseForm(f => ({ ...f, amount_rub: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Источник оплаты</Label>
              <Select value={expenseForm.payment_source} onChange={e => setExpensePaymentSource(e.target.value as ExpenseForm['payment_source'])}>
                <option value="COMPANY">Из общих денег</option>
                <option value="PARTNER">Партнёр оплатил сам</option>
              </Select>
            </div>
            {expenseForm.payment_source === 'PARTNER' && (
              <>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <Label>Кто оплатил</Label>
                  <Select value={expenseForm.paid_by_partner_id} onChange={e => setExpenseForm(f => ({ ...f, paid_by_partner_id: e.target.value }))}>
                    <option value="">Выберите партнёра</option>
                    {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </div>
                <label className="col-span-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={expenseForm.is_reimbursable} onChange={e => setExpenseForm(f => ({ ...f, is_reimbursable: e.target.checked, is_reimbursed: e.target.checked ? f.is_reimbursed : false }))} />
                  Вернуть партнёру из общих денег
                </label>
                {editExpenseId && expenseForm.is_reimbursable && (
                  <label className="col-span-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={expenseForm.is_reimbursed} onChange={e => setExpenseForm(f => ({ ...f, is_reimbursed: e.target.checked }))} />
                    Компенсация уже выплачена
                  </label>
                )}
              </>
            )}
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>Описание</Label>
              <Input value={expenseForm.note} onChange={e => setExpenseForm(f => ({ ...f, note: e.target.value }))} placeholder="Например: пластик PETG, подписка, сервер, доставка" />
            </div>
          </div>
          {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={closeExpense}>Отмена</Button>
          <Button disabled={saveExpense.isPending} onClick={() => saveExpense.mutate()}>{saveExpense.isPending ? 'Сохраняю...' : 'Сохранить расход'}</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <DialogHeader>
          <DialogTitle>Удалить запись?</DialogTitle>
          <DialogClose onClose={() => setDeleteTarget(null)} />
        </DialogHeader>
        <DialogContent><p className="text-sm text-muted-foreground">Запись пропадёт из журнала и итогов периода.</p></DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Отмена</Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? 'Удаляю...' : 'Удалить'}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
