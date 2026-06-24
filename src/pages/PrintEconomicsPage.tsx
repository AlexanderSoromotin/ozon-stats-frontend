import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PeriodPicker, { presetPeriod, type PeriodValue } from '@/components/PeriodPicker'
import { Clock, Calculator } from 'lucide-react'
import { fmtNum } from '@/lib/format'

interface Row {
  sku_id: number; article: string; name: string
  avg_sale_price: number; avg_commission: number
  cogs_per_unit: number; margin_per_unit: number
  hours_per_unit: number; profit_per_hour: number
  sales_count: number
}

export default function PrintEconomicsPage() {
  const [period, setPeriod] = useState<PeriodValue>(() => presetPeriod('month'))

  const calc = useMutation({
    mutationFn: () => api.post('/analytics/print-hour-economics', { from: period.from, to: period.to }).then(r => r.data.data as Row[]),
  })

  const rows = calc.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Прибыль на час печати</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Приоритизация SKU по экономике печати</p>
      </div>

      <div className="rounded-xl border bg-card p-5 flex items-center gap-3 flex-wrap">
        <PeriodPicker value={period} onChange={setPeriod} />
        <Button onClick={() => calc.mutate()} disabled={calc.isPending} className="gap-2 ml-auto">
          <Calculator className="size-4" /> {calc.isPending ? 'Расчёт...' : 'Рассчитать'}
        </Button>
      </div>

      {calc.data && (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Цена ср.</TableHead>
                <TableHead className="text-right">Комиссия</TableHead>
                <TableHead className="text-right">COGS/ед</TableHead>
                <TableHead className="text-right">Маржа/ед</TableHead>
                <TableHead className="text-right">Часов/ед</TableHead>
                <TableHead className="text-right">Продаж</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1"><Clock className="size-3" /> ₽/час</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">Нет данных</TableCell></TableRow>
              )}
              {rows.map(r => (
                <TableRow key={r.sku_id}>
                  <TableCell>
                    <Link to={`/skus/${r.sku_id}`} className="hover:underline">
                      <span className="font-mono text-xs text-muted-foreground">{r.article}</span>{' '}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{fmtNum(r.avg_sale_price)} ₽</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmtNum(r.avg_commission)} ₽</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmtNum(r.cogs_per_unit)} ₽</TableCell>
                  <TableCell className="text-right font-medium">{fmtNum(r.margin_per_unit)} ₽</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r.hours_per_unit}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r.sales_count}</TableCell>
                  <TableCell className="text-right font-bold">{fmtNum(r.profit_per_hour)} ₽</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
