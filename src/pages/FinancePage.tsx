import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Calculator, FileText, TrendingUp, AlertTriangle } from 'lucide-react'
import { fmtMoney, fmtDate, daysAgoIso, todayIso } from '@/lib/format'

const TAX_LABEL: Record<string, string> = { IP_USN6: 'ИП УСН 6%', NPD: 'НПД' }

// ─── Calculate / Payouts ─────────────────────────────────────────────────────

function PayoutsTab() {
  const [from, setFrom] = useState(daysAgoIso(30))
  const [to, setTo] = useState(todayIso())
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [createdPayouts, setCreatedPayouts] = useState<any[] | null>(null)

  const calc = useMutation({
    mutationFn: () => api.post('/finance/calculate', { from, to }).then(r => r.data.data),
    onSuccess: (data) => { setResult(data); setCreatedPayouts(null); setError('') },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка'),
  })

  const payouts = useMutation({
    mutationFn: () => api.post('/finance/payouts', { from, to }).then(r => r.data.data),
    onSuccess: (data) => { setCreatedPayouts(data.payouts); setResult(data.calculation); setError('') },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Ошибка'),
  })

  async function viewStatement(id: number) {
    try {
      const res = await api.get(`/finance/payouts/${id}/statement`, { responseType: 'text' })
      const html = res.data
      const w = window.open('', '_blank')
      if (w) { w.document.write(html); w.document.close() }
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Ошибка')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border bg-card p-5 flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">С</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">По</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={() => calc.mutate()} disabled={calc.isPending} variant="outline" className="gap-2">
          <Calculator className="size-4" /> {calc.isPending ? 'Расчёт...' : 'Рассчитать'}
        </Button>
        <Button onClick={() => payouts.mutate()} disabled={payouts.isPending} className="gap-2">
          <FileText className="size-4" /> {payouts.isPending ? 'Создание...' : 'Создать выплаты'}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <>
          {/* P&L */}
          <div className="rounded-xl border bg-card">
            <div className="px-5 py-4 border-b">
              <p className="font-semibold text-sm">Финансовый отчёт</p>
              <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(from)} — {fmtDate(to)}</p>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['Выручка', result.revenue_minor],
                ['Комиссия Ozon', -result.ozon_commission_minor],
                ['Возвраты', -result.returns_minor],
                ['Чистая выручка', result.net_revenue_minor],
                ['COGS', -result.cogs_minor],
                ['Расходы', -result.expenses_minor],
                ['Налог', -result.tax_minor],
                ['Прибыль', result.gross_profit_minor],
              ].map(([k, v], i) => (
                <div key={String(k)} className={`rounded-lg p-3 ${i === 7 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/40'}`}>
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className={`text-lg font-bold mt-1 ${i === 7 && (v as number) > 0 ? 'text-green-600' : (v as number) < 0 ? 'text-destructive' : ''}`}>
                    {fmtMoney(v as number)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Per-partner breakdown */}
          {result.per_partner?.length > 0 && (
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
                  {result.per_partner.map((p: any) => (
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

          {/* Created payouts with statement links */}
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
                      <p className="text-xs text-muted-foreground">Партнёр #{p.partner_id} · на руки {p.net_to_hand?.toLocaleString('ru')} ₽</p>
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
  )
}

// ─── Cash Flow Forecast ──────────────────────────────────────────────────────

function CashFlowTab() {
  const [horizon, setHorizon] = useState(30)
  const [opening, setOpening] = useState(0)

  const forecast = useMutation({
    mutationFn: () => api.post('/finance/cash-flow-forecast', { horizon_days: horizon, opening_balance: opening }).then(r => r.data.data),
  })

  const data = forecast.data

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border bg-card p-5 flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Горизонт, дней</Label>
          <Input type="number" min={1} max={365} value={horizon} onChange={e => setHorizon(Number(e.target.value))} className="w-32" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Начальный баланс, ₽</Label>
          <Input type="number" value={opening} onChange={e => setOpening(Number(e.target.value))} className="w-40" />
        </div>
        <Button onClick={() => forecast.mutate()} disabled={forecast.isPending} className="gap-2">
          <TrendingUp className="size-4" /> {forecast.isPending ? 'Расчёт...' : 'Рассчитать прогноз'}
        </Button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-5">
              <p className="text-xs text-muted-foreground">Начальный баланс</p>
              <p className="text-2xl font-bold mt-1">{fmtMoney(data.opening_balance_minor)}</p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <p className="text-xs text-muted-foreground">Конечный баланс</p>
              <p className="text-2xl font-bold mt-1">{fmtMoney(data.closing_balance_minor)}</p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <p className="text-xs text-muted-foreground">Средний дневной приток</p>
              <p className="text-2xl font-bold mt-1">{fmtMoney(data.assumptions?.avg_daily_inflow_minor)}</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card">
            <div className="px-5 py-4 border-b">
              <p className="font-semibold text-sm">Прогноз по дням</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead className="text-right">Приток</TableHead>
                  <TableHead className="text-right">Отток</TableHead>
                  <TableHead className="text-right">Баланс</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.days.map((d: any) => (
                  <TableRow key={d.date}>
                    <TableCell className="text-sm">{fmtDate(d.date)}</TableCell>
                    <TableCell className="text-right text-green-600">{fmtMoney(d.inflow_minor)}</TableCell>
                    <TableCell className="text-right text-destructive">−{fmtMoney(d.outflow_minor)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(d.balance_minor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Финансы</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Расчёты, выплаты и прогноз кассы</p>
      </div>

      <Tabs defaultValue="payouts">
        <TabsList>
          <TabsTrigger value="payouts">Расчёт и выплаты</TabsTrigger>
          <TabsTrigger value="forecast">Прогноз кассы</TabsTrigger>
        </TabsList>
        <TabsContent value="payouts"><PayoutsTab /></TabsContent>
        <TabsContent value="forecast"><CashFlowTab /></TabsContent>
      </Tabs>
    </div>
  )
}
