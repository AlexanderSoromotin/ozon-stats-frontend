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
import { SkeletonTableRows } from '@/components/ui/skeleton'
import PeriodPicker, { presetPeriod, type PeriodValue } from '@/components/PeriodPicker'
import { fmtDate, fmtMoney, todayIso } from '@/lib/format'
import {
  AlertTriangle, BanknoteArrowDown, BanknoteArrowUp, Calculator,
  CheckCircle2, FileText, Package, Pencil, Plus,
  ReceiptText, ShoppingCart, Trash2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

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
  delivery_cost_minor?: number
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
  itemType: 'sku' | 'custom'
  sku_id: string
  name: string
  qty: string
  unit_cogs_rub: string
}

interface DirectSaleForm {
  date: string; channel: string; customer_name: string
  revenue_rub: string; delivery_cost_rub: string; note: string
  items: SaleItemForm[]
}

interface ExpenseForm {
  month: string; type: string; amount_rub: string
  payment_source: 'COMPANY' | 'PARTNER'; paid_by_partner_id: string
  is_reimbursable: boolean; is_reimbursed: boolean; note: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  RENT: 'Аренда', MATERIALS: 'Материалы', ELECTRICITY: 'Электричество',
  AMORTIZATION: 'Амортизация', SUBSCRIPTION: 'Подписки', SERVER: 'Сервер и хостинг',
  LOGISTICS: 'Логистика', MARKETING: 'Реклама', PACKAGING: 'Упаковка', OTHER: 'Другое',
}

const CHANNEL_LABEL: Record<string, string> = {
  DIRECT: 'Прямая продажа', BANK_TRANSFER: 'Оплата на счёт',
  WHOLESALE: 'Опт', OTHER: 'Другой канал', OZON: 'Ozon',
}

const TAX_LABEL: Record<string, string> = { IP_USN6: 'ИП УСН 6%', NPD: 'НПД' }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newSaleItem(itemType: 'sku' | 'custom' = 'sku'): SaleItemForm {
  return { uid: `${Date.now()}-${Math.random()}`, itemType, sku_id: '', name: '', qty: '1', unit_cogs_rub: '' }
}

const emptySale = (): DirectSaleForm => ({
  date: todayIso(), channel: 'BANK_TRANSFER', customer_name: '',
  revenue_rub: '', delivery_cost_rub: '', note: '', items: [newSaleItem('sku')],
})

const emptyExpense = (): ExpenseForm => ({
  month: todayIso(), type: 'MATERIALS', amount_rub: '',
  payment_source: 'COMPANY', paid_by_partner_id: '',
  is_reimbursable: false, is_reimbursed: false, note: '',
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

function saleItemsText(row: IncomeRow): string {
  const items = row.items ?? []
  if (items.length === 0) {
    return row.sku_name ? `${row.sku_article ?? ''} ${row.sku_name} x ${row.qty}`.trim() : 'Состав не указан'
  }
  return items.map(i => `${i.sku_article ?? ''} ${i.sku_name ?? i.name ?? 'Товар'} x ${i.qty}`.trim()).join(', ')
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ title, value, icon: Icon, tone = 'default' }: {
  title: string; value: number; icon: any; tone?: 'default' | 'good' | 'warn'
}) {
  const cls = tone === 'good' ? 'text-green-600' : tone === 'warn' ? 'text-amber-600' : value < 0 ? 'text-destructive' : ''
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{title}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className={`text-2xl font-bold mt-2 ${cls}`}>{fmtMoney(value)}</p>
    </div>
  )
}

// ─── P&L row ─────────────────────────────────────────────────────────────────

function PlRow({ label, value, indent = false, bold = false, positive = false }: {
  label: string; value: number | undefined; indent?: boolean; bold?: boolean; positive?: boolean
}) {
  const v = value ?? 0
  const cls = positive && v > 0 ? 'text-green-600' : v < 0 ? 'text-destructive' : ''
  return (
    <TableRow className={bold ? 'bg-muted/30' : ''}>
      <TableCell className={`text-sm ${indent ? 'pl-8 text-muted-foreground' : bold ? 'font-semibold' : ''}`}>{label}</TableCell>
      <TableCell className={`text-right text-sm ${bold ? 'font-bold' : ''} ${cls}`}>{fmtMoney(v)}</TableCell>
    </TableRow>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const [period, setPeriod] = useState<PeriodValue>(() => presetPeriod('month', true))
  const { from, to } = period

  // Dialog state
  const [saleDialog, setSaleDialog] = useState(false)
  const [expenseDialog, setExpenseDialog] = useState(false)
  const [editSaleId, setEditSaleId] = useState<number | null>(null)
  const [editExpenseId, setEditExpenseId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'sale' | 'expense'; id: number } | null>(null)
  const [saleForm, setSaleForm] = useState<DirectSaleForm>(emptySale)
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpense)
  const [formError, setFormError] = useState('')

  // Payouts state
  const [calcResult, setCalcResult] = useState<any>(null)
  const [createdPayouts, setCreatedPayouts] = useState<any[] | null>(null)
  const [calcError, setCalcError] = useState('')

  // Queries
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

  // Mutations — sales & expenses
  const saveSale = useMutation({
    mutationFn: () => {
      if (!saleForm.date) throw new Error('Укажите дату оплаты.')
      if (moneyToMinor(saleForm.revenue_rub) <= 0) throw new Error('Укажите сумму оплаты больше нуля.')
      if (saleForm.items.length === 0) throw new Error('Добавьте хотя бы один товар.')
      if (saleForm.items.some(i => i.itemType === 'sku' && !i.sku_id)) throw new Error('Выберите товар из каталога или укажите произвольное название.')
      if (saleForm.items.some(i => i.itemType === 'custom' && !i.name.trim())) throw new Error('Укажите название для каждого произвольного товара.')
      if (saleForm.items.some(i => Number(i.qty || 0) <= 0)) throw new Error('Количество товара должно быть больше нуля.')
      const payload = {
        date: saleForm.date, channel: saleForm.channel,
        customer_name: saleForm.customer_name || null,
        revenue_minor: moneyToMinor(saleForm.revenue_rub),
        delivery_cost_minor: moneyToMinor(saleForm.delivery_cost_rub),
        note: saleForm.note || null,
        items: saleForm.items.map(i => ({
          sku_id: i.itemType === 'sku' && i.sku_id ? Number(i.sku_id) : null,
          name: i.itemType === 'custom' ? i.name.trim() : null,
          qty: Number(i.qty || 1),
          unit_cogs_minor: i.unit_cogs_rub === '' ? null : moneyToMinor(i.unit_cogs_rub),
        })),
      }
      return editSaleId ? api.patch(`/external-incomes/${editSaleId}`, payload) : api.post('/external-incomes', payload)
    },
    onSuccess: () => { invalidate(); closeSale() },
    onError: (e: any) => setFormError(errorMessage(e, 'Не удалось сохранить прямую продажу.')),
  })

  const saveExpense = useMutation({
    mutationFn: () => {
      if (!expenseForm.month) throw new Error('Укажите дату оплаты.')
      if (moneyToMinor(expenseForm.amount_rub) <= 0) throw new Error('Укажите сумму расхода больше нуля.')
      if (expenseForm.payment_source === 'PARTNER' && !expenseForm.paid_by_partner_id) {
        throw new Error('Выберите партнёра, который оплатил расход.')
      }
      const payload = {
        month: expenseForm.month, type: expenseForm.type,
        amount_minor: moneyToMinor(expenseForm.amount_rub),
        payment_source: expenseForm.payment_source,
        paid_by_partner_id: expenseForm.payment_source === 'PARTNER' ? Number(expenseForm.paid_by_partner_id) : null,
        is_reimbursable: expenseForm.payment_source === 'PARTNER' && expenseForm.is_reimbursable,
        reimbursed_at: editExpenseId && expenseForm.payment_source === 'PARTNER' && expenseForm.is_reimbursed ? todayIso() : null,
        note: expenseForm.note || null,
      }
      return editExpenseId ? api.patch(`/expenses/${editExpenseId}`, payload) : api.post('/expenses', payload)
    },
    onSuccess: () => { invalidate(); closeExpense() },
    onError: (e: any) => setFormError(errorMessage(e, 'Не удалось сохранить расход.')),
  })

  const remove = useMutation({
    mutationFn: () => deleteTarget?.kind === 'sale'
      ? api.delete(`/external-incomes/${deleteTarget.id}`)
      : api.delete(`/expenses/${deleteTarget?.id}`),
    onSuccess: () => { invalidate(); setDeleteTarget(null) },
  })

  // Mutations — payouts
  const calc = useMutation({
    mutationFn: () => api.post('/finance/calculate', { from, to }).then(r => r.data.data),
    onSuccess: (data) => { setCalcResult(data); setCreatedPayouts(null); setCalcError('') },
    onError: (e: any) => setCalcError(e.response?.data?.message ?? 'Ошибка'),
  })

  const payoutsMutation = useMutation({
    mutationFn: () => api.post('/finance/payouts', { from, to }).then(r => r.data.data),
    onSuccess: (data) => { setCreatedPayouts(data.payouts); setCalcResult(data.calculation); setCalcError('') },
    onError: (e: any) => setCalcError(e.response?.data?.message ?? 'Ошибка'),
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['finance-ledger'] })
  }

  function closeSale() {
    setSaleDialog(false); setEditSaleId(null); setSaleForm(emptySale()); setFormError('')
  }

  function closeExpense() {
    setExpenseDialog(false); setEditExpenseId(null); setExpenseForm(emptyExpense()); setFormError('')
  }

  function openSale(row?: IncomeRow) {
    setFormError('')
    if (row) {
      setEditSaleId(row.id)
      const items = (row.items ?? []).length > 0
        ? (row.items ?? []).map(i => ({
            uid: `${i.id ?? i.sku_id}-${Math.random()}`,
            itemType: (i.sku_id ? 'sku' : 'custom') as 'sku' | 'custom',
            sku_id: i.sku_id ? String(i.sku_id) : '',
            name: i.name ?? '',
            qty: String(i.qty),
            unit_cogs_rub: i.unit_cogs_minor > 0 ? String(i.unit_cogs_minor / 100) : '',
          }))
        : [{ ...newSaleItem('sku'), sku_id: row.sku_id ? String(row.sku_id) : '', qty: String(row.qty) }]
      setSaleForm({
        date: row.date, channel: row.channel, customer_name: row.customer_name ?? '',
        revenue_rub: String(row.revenue_minor / 100),
        delivery_cost_rub: row.delivery_cost_minor ? String(row.delivery_cost_minor / 100) : '',
        note: row.note ?? '', items,
      })
    } else {
      setEditSaleId(null); setSaleForm(emptySale())
    }
    setSaleDialog(true)
  }

  function openExpense(row?: Expense) {
    setFormError('')
    if (row) {
      setEditExpenseId(row.id)
      setExpenseForm({
        month: row.month, type: row.type,
        amount_rub: String(row.amount_minor / 100),
        payment_source: row.payment_source,
        paid_by_partner_id: row.paid_by_partner_id ? String(row.paid_by_partner_id) : '',
        is_reimbursable: row.is_reimbursable, is_reimbursed: row.is_reimbursed,
        note: row.note ?? '',
      })
    } else {
      setEditExpenseId(null); setExpenseForm(emptyExpense())
    }
    setExpenseDialog(true)
  }

  function setPaymentSource(src: ExpenseForm['payment_source']) {
    setExpenseForm(f => ({
      ...f, payment_source: src,
      paid_by_partner_id: src === 'PARTNER' ? f.paid_by_partner_id : '',
      is_reimbursable: src === 'PARTNER',
      is_reimbursed: src === 'PARTNER' ? f.is_reimbursed : false,
    }))
  }

  function updateSaleItem(uid: string, patch: Partial<SaleItemForm>) {
    setSaleForm(f => ({ ...f, items: f.items.map(i => i.uid === uid ? { ...i, ...patch } : i) }))
  }

  async function viewStatement(id: number) {
    try {
      const res = await api.get(`/finance/payouts/${id}/statement`, { responseType: 'text' })
      const w = window.open('', '_blank')
      if (w) { w.document.write(res.data); w.document.close() }
    } catch (e: any) {
      setCalcError(e.response?.data?.message ?? 'Ошибка')
    }
  }

  // Derived
  const ledger = ledgerQuery.data
  const summary = ledger?.summary ?? {}
  const directSales = ledger?.external_incomes ?? []
  const marketplaceSales = ledger?.marketplace_incomes ?? []
  const expenses = ledger?.expenses ?? []
  const partners = partnersQuery.data ?? []
  const skus = skusQuery.data ?? []

  const materialCogs = summary.total_material_cogs_minor ?? summary.materials_need_minor ?? 0
  const printerCosts = summary.printer_costs_minor ?? ((summary.total_electricity_cost_minor ?? 0) + (summary.total_depreciation_cost_minor ?? 0))
  const deliveryCost = summary.external_delivery_cost_minor ?? 0

  const directSaleQty = useMemo(
    () => saleForm.items.reduce((s, i) => s + Number(i.qty || 0), 0),
    [saleForm.items],
  )

  const pendingReimbursements = expenses.filter(e => e.is_reimbursable && !e.is_reimbursed)

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Финансы</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Продажи, расходы и выплаты партнёрам</p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => openExpense()} className="gap-2">
              <ReceiptText className="size-4" /> Расход
            </Button>
            <Button onClick={() => openSale()} className="gap-2">
              <ShoppingCart className="size-4" /> Прямая продажа
            </Button>
          </div>
        )}
      </div>

      {/* Period + quick result */}
      <div className="rounded-xl border bg-card p-5 flex items-center gap-3 flex-wrap">
        <PeriodPicker value={period} onChange={setPeriod} includeToday />
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">Результат после затрат и расходов</p>
          <p className={`text-xl font-bold ${(summary.cash_result_minor ?? 0) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
            {fmtMoney(summary.cash_result_minor)}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard title="Выручка" value={summary.total_revenue_minor ?? 0} icon={BanknoteArrowDown} tone="good" />
        <StatCard title="Себестоимость" value={materialCogs} icon={Package} tone="warn" />
        <StatCard title="Расходы бизнеса" value={summary.expenses_minor ?? 0} icon={BanknoteArrowUp} />
        <StatCard title="Прибыль" value={summary.gross_profit_minor ?? 0} icon={BanknoteArrowDown} />
        <StatCard title="Долг партнёрам" value={summary.open_reimbursements_minor ?? 0} icon={ReceiptText} tone="warn" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="sales">Продажи</TabsTrigger>
          <TabsTrigger value="expenses">Расходы</TabsTrigger>
          <TabsTrigger value="payouts">Выплаты</TabsTrigger>
        </TabsList>

        {/* ── Обзор ─────────────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card">
              <div className="px-5 py-4 border-b">
                <p className="font-semibold text-sm">P&amp;L за период</p>
                <p className="text-xs text-muted-foreground mt-0.5">{from} — {to}</p>
              </div>
              <Table>
                <TableBody>
                  <PlRow label="Выручка Ozon (маркетплейс)" value={summary.marketplace_revenue_minor} indent />
                  <PlRow label="Выручка прямые продажи" value={summary.external_revenue_minor} indent />
                  <PlRow label="Итого выручка" value={summary.total_revenue_minor} bold positive />
                  <PlRow label="Материалы в себестоимости" value={-materialCogs} indent />
                  <PlRow label="Электричество и амортизация" value={-printerCosts} indent />
                  <PlRow label="Доставка прямых продаж" value={-deliveryCost} indent />
                  <PlRow label="Расходы бизнеса" value={-(summary.expenses_minor ?? 0)} indent />
                  <PlRow label="Прибыль" value={summary.gross_profit_minor} bold />
                  <PlRow label="Резерв на пополнение материалов" value={summary.materials_need_minor} indent />
                  <PlRow label="К делению между партнёрами" value={summary.cash_result_minor} bold positive />
                </TableBody>
              </Table>
            </div>

            <div className="rounded-xl border bg-card">
              <div className="px-5 py-4 border-b">
                <p className="font-semibold text-sm">Компенсации партнёрам</p>
                <p className="text-xs text-muted-foreground mt-0.5">Расходы, оплаченные из личных средств</p>
              </div>
              {pendingReimbursements.length === 0 ? (
                <p className="text-sm text-muted-foreground p-5">Долгов нет</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Партнёр</TableHead>
                      <TableHead>Статья</TableHead>
                      <TableHead className="text-right">Сумма</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingReimbursements.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm font-medium">
                          {e.paid_by_partner_name ?? e.paid_by_partner?.name ?? 'Партнёр'}
                        </TableCell>
                        <TableCell><Badge variant="outline">{TYPE_LABEL[e.type] ?? e.type}</Badge></TableCell>
                        <TableCell className="text-right font-medium text-amber-600">{fmtMoney(e.amount_minor)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={2} className="font-semibold text-sm">Итого к возврату</TableCell>
                      <TableCell className="text-right font-bold text-amber-600">
                        {fmtMoney(summary.open_reimbursements_minor)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Продажи ───────────────────────────────────────────────────── */}
        <TabsContent value="sales">
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border bg-card">
              <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
                <p className="font-semibold text-sm">Прямые продажи</p>
                {isOwner && (
                  <Button size="sm" onClick={() => openSale()} className="gap-2">
                    <Plus className="size-4" /> Продажа
                  </Button>
                )}
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
                  {!ledgerQuery.isLoading && directSales.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">Прямых продаж за период нет</TableCell></TableRow>
                  )}
                  {directSales.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm">{fmtDate(row.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{CHANNEL_LABEL[row.channel] ?? row.channel}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{row.customer_name ?? '—'}</p>
                      </TableCell>
                      <TableCell className="max-w-[280px] text-sm">{saleItemsText(row)}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{fmtMoney(row.revenue_minor)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(row.product_cogs_minor ?? 0)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(row.delivery_cost_minor ?? 0)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(row.gross_profit_minor)}</TableCell>
                      {isOwner && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openSale(row)}><Pencil className="size-3.5" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ kind: 'sale', id: row.id })} className="text-destructive hover:text-destructive"><Trash2 className="size-3.5" /></Button>
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
                <p className="font-semibold text-sm">Маркетплейс (Ozon)</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Площадка</TableHead>
                    <TableHead>Операция</TableHead>
                    <TableHead className="text-right">Выручка</TableHead>
                    <TableHead className="text-right">Себестоимость</TableHead>
                    <TableHead className="text-right">Прибыль</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerQuery.isLoading && <SkeletonTableRows cols={6} rows={5} />}
                  {!ledgerQuery.isLoading && marketplaceSales.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Продаж маркетплейсов за период нет</TableCell></TableRow>
                  )}
                  {marketplaceSales.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm">{fmtDate(row.date)}</TableCell>
                      <TableCell><Badge variant="secondary">{CHANNEL_LABEL[row.channel] ?? row.channel}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.operation_id ?? row.note ?? 'Продажа'}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{fmtMoney(row.revenue_minor)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(row.product_cogs_minor ?? 0)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(row.gross_profit_minor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Расходы ───────────────────────────────────────────────────── */}
        <TabsContent value="expenses">
          <div className="rounded-xl border bg-card">
            <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
              <p className="font-semibold text-sm">Расходы бизнеса</p>
              {isOwner && (
                <Button size="sm" variant="outline" onClick={() => openExpense()} className="gap-2">
                  <Plus className="size-4" /> Расход
                </Button>
              )}
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
                {!ledgerQuery.isLoading && expenses.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Расходов за период нет</TableCell></TableRow>
                )}
                {expenses.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm">{fmtDate(row.month)}</TableCell>
                    <TableCell><Badge variant="outline">{TYPE_LABEL[row.type] ?? row.type}</Badge></TableCell>
                    <TableCell className="text-sm">
                      {row.payment_source === 'COMPANY' ? 'Общие деньги' : row.paid_by_partner_name ?? row.paid_by_partner?.name ?? 'Партнёр'}
                    </TableCell>
                    <TableCell>
                      {row.is_reimbursable
                        ? row.is_reimbursed
                          ? <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" /> Вернули</Badge>
                          : <Badge variant="outline" className="text-amber-600 border-amber-300">Нужно вернуть</Badge>
                        : <span className="text-sm text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(row.amount_minor)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.note ?? '—'}</TableCell>
                    {isOwner && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openExpense(row)}><Pencil className="size-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ kind: 'expense', id: row.id })} className="text-destructive hover:text-destructive"><Trash2 className="size-3.5" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Выплаты ───────────────────────────────────────────────────── */}
        <TabsContent value="payouts">
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border bg-card p-5 flex items-center gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground">
                Период: <span className="text-foreground font-medium">{from} — {to}</span>
              </p>
              <div className="flex items-center gap-2 ml-auto">
                <Button onClick={() => calc.mutate()} disabled={calc.isPending} variant="outline" className="gap-2">
                  <Calculator className="size-4" /> {calc.isPending ? 'Расчёт...' : 'Рассчитать'}
                </Button>
                <Button onClick={() => payoutsMutation.mutate()} disabled={payoutsMutation.isPending} className="gap-2">
                  <FileText className="size-4" /> {payoutsMutation.isPending ? 'Создание...' : 'Создать выплаты'}
                </Button>
              </div>
            </div>

            {calcError && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0" /> {calcError}
              </div>
            )}

            {calcResult && (
              <>
                <div className="rounded-xl border bg-card">
                  <div className="px-5 py-4 border-b">
                    <p className="font-semibold text-sm">Финансовый расчёт</p>
                  </div>
                  <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {([
                      ['Выручка', calcResult.revenue_minor],
                      ['Комиссия Ozon', -calcResult.ozon_commission_minor],
                      ['Возвраты', -calcResult.returns_minor],
                      ['Чистая выручка', calcResult.net_revenue_minor],
                      ['COGS', -calcResult.cogs_minor],
                      ['Расходы', -calcResult.expenses_minor],
                      ['Налог', -calcResult.tax_minor],
                      ['Прибыль', calcResult.gross_profit_minor],
                    ] as [string, number][]).map(([k, v], i) => (
                      <div key={k} className={`rounded-lg p-3 ${i === 7 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/40'}`}>
                        <p className="text-xs text-muted-foreground">{k}</p>
                        <p className={`text-lg font-bold mt-1 ${i === 7 && v > 0 ? 'text-green-600' : v < 0 ? 'text-destructive' : ''}`}>
                          {fmtMoney(v)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {calcResult.per_partner?.length > 0 && (
                  <div className="rounded-xl border bg-card">
                    <div className="px-5 py-4 border-b">
                      <p className="font-semibold text-sm">Выплаты партнёрам</p>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Партнёр</TableHead>
                          <TableHead>Режим</TableHead>
                          <TableHead className="text-right">Гросс</TableHead>
                          <TableHead className="text-right">Налог</TableHead>
                          <TableHead className="text-right">На руки</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calcResult.per_partner.map((p: any) => (
                          <TableRow key={p.partner_id}>
                            <TableCell className="font-medium">{p.partner_name}</TableCell>
                            <TableCell><Badge variant="outline">{TAX_LABEL[p.tax_regime] ?? p.tax_regime}</Badge></TableCell>
                            <TableCell className="text-right">{fmtMoney(p.gross_paid_minor)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{fmtMoney(p.tax_withheld_minor)}</TableCell>
                            <TableCell className="text-right font-bold">{fmtMoney(p.net_to_hand_minor)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {createdPayouts && createdPayouts.length > 0 && (
                  <div className="rounded-xl border border-green-200 bg-green-50/30">
                    <div className="px-5 py-4 border-b border-green-200">
                      <p className="font-semibold text-sm">Созданные выплаты</p>
                    </div>
                    <div className="divide-y divide-green-200">
                      {createdPayouts.map((p) => (
                        <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                          <div>
                            <p className="font-medium">Выплата #{p.id}</p>
                            <p className="text-xs text-muted-foreground">
                              Партнёр #{p.partner_id} · на руки {fmtMoney(p.net_to_hand)}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => viewStatement(p.id)} className="gap-1.5">
                            <FileText className="size-3.5" /> Выписка
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Dialog: прямая продажа ─────────────────────────────────────── */}
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
              <Input value={saleForm.customer_name} onChange={e => setSaleForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="ООО Клиент, Авито, перевод на счёт…" />
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
                <p className="text-xs text-muted-foreground">Всего позиций: {directSaleQty}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSaleForm(f => ({ ...f, items: [...f.items, newSaleItem('sku')] }))} className="gap-1.5">
                  <Plus className="size-4" /> Из каталога
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setSaleForm(f => ({ ...f, items: [...f.items, newSaleItem('custom')] }))} className="gap-1.5">
                  <Plus className="size-4" /> Произвольный
                </Button>
              </div>
            </div>

            <div className="col-span-2 flex flex-col gap-2">
              {saleForm.items.map((item) => (
                <div key={item.uid} className="rounded-lg border bg-muted/20 p-3 flex flex-col gap-2">
                  {/* Переключатель типа */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateSaleItem(item.uid, { itemType: 'sku', name: '' })}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${item.itemType === 'sku' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
                    >
                      Из каталога
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSaleItem(item.uid, { itemType: 'custom', sku_id: '' })}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${item.itemType === 'custom' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
                    >
                      Произвольный
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaleForm(f => ({ ...f, items: f.items.filter(i => i.uid !== item.uid) }))}
                      disabled={saleForm.items.length === 1}
                      className="ml-auto text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  {/* Поля строки */}
                  <div className="grid grid-cols-[1fr_80px_130px] gap-3 items-end">
                    <div className="flex flex-col gap-1.5">
                      {item.itemType === 'sku' ? (
                        <Select value={item.sku_id} onChange={e => updateSaleItem(item.uid, { sku_id: e.target.value })}>
                          <option value="">Выберите товар из каталога</option>
                          {skus.map(s => <option key={s.id} value={s.id}>{s.article} · {s.name}</option>)}
                        </Select>
                      ) : (
                        <Input
                          value={item.name}
                          onChange={e => updateSaleItem(item.uid, { name: e.target.value })}
                          placeholder="Название товара / услуги"
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Input type="number" min={1} value={item.qty} onChange={e => updateSaleItem(item.uid, { qty: e.target.value })} placeholder="Кол-во" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Input
                        type="number" min={0} step="0.01" value={item.unit_cogs_rub}
                        onChange={e => updateSaleItem(item.uid, { unit_cogs_rub: e.target.value })}
                        placeholder={item.itemType === 'sku' ? 'Себест. (авто)' : 'Себест./шт, ₽'}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>Описание</Label>
              <Input value={saleForm.note} onChange={e => setSaleForm(f => ({ ...f, note: e.target.value }))} placeholder="Номер счёта, заказ, детали оплаты" />
            </div>
          </div>
          {formError && <p className="text-sm text-destructive mt-3">{formError}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={closeSale}>Отмена</Button>
          <Button disabled={saveSale.isPending} onClick={() => saveSale.mutate()}>
            {saveSale.isPending ? 'Сохраняю...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ── Dialog: расход ────────────────────────────────────────────── */}
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
              <Select value={expenseForm.payment_source} onChange={e => setPaymentSource(e.target.value as ExpenseForm['payment_source'])}>
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
                <label className="col-span-2 flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={expenseForm.is_reimbursable} onChange={e => setExpenseForm(f => ({ ...f, is_reimbursable: e.target.checked, is_reimbursed: e.target.checked ? f.is_reimbursed : false }))} />
                  Вернуть партнёру из общих денег
                </label>
                {editExpenseId && expenseForm.is_reimbursable && (
                  <label className="col-span-2 flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={expenseForm.is_reimbursed} onChange={e => setExpenseForm(f => ({ ...f, is_reimbursed: e.target.checked }))} />
                    Компенсация уже выплачена
                  </label>
                )}
              </>
            )}
            <div className="flex flex-col gap-1.5 col-span-2">
              <Label>Описание</Label>
              <Input value={expenseForm.note} onChange={e => setExpenseForm(f => ({ ...f, note: e.target.value }))} placeholder="Пластик PETG, подписка, сервер, доставка…" />
            </div>
          </div>
          {formError && <p className="text-sm text-destructive mt-3">{formError}</p>}
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={closeExpense}>Отмена</Button>
          <Button disabled={saveExpense.isPending} onClick={() => saveExpense.mutate()}>
            {saveExpense.isPending ? 'Сохраняю...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ── Dialog: удаление ──────────────────────────────────────────── */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <DialogHeader>
          <DialogTitle>Удалить запись?</DialogTitle>
          <DialogClose onClose={() => setDeleteTarget(null)} />
        </DialogHeader>
        <DialogContent>
          <p className="text-sm text-muted-foreground">Запись пропадёт из журнала и итогов периода.</p>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Отмена</Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending ? 'Удаляю...' : 'Удалить'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
