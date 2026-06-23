import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowRightLeft, CheckCircle2 } from 'lucide-react'

interface Row {
  sku_id: number; article: string; name: string
  qty_sold: number; velocity_per_day: number
  recommended: boolean; reason: string
}

export default function StrategyPage() {
  const [windowDays, setWindowDays] = useState(30)
  const [minVel, setMinVel] = useState(1)

  const calc = useMutation({
    mutationFn: () => api.post('/strategy/fbs-to-fbo', { window_days: windowDays, min_velocity_per_day: minVel }).then(r => r.data.data as Row[]),
  })

  const rows = calc.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Стратегия: FBS → FBO</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Кандидаты на миграцию канала</p>
      </div>

      <div className="rounded-xl border bg-card p-5 flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Окно, дней</Label>
          <Input type="number" min={1} value={windowDays} onChange={e => setWindowDays(Number(e.target.value))} className="w-32" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Мин. скорость, шт/день</Label>
          <Input type="number" min={0} step="0.1" value={minVel} onChange={e => setMinVel(Number(e.target.value))} className="w-40" />
        </div>
        <Button onClick={() => calc.mutate()} disabled={calc.isPending} className="gap-2">
          <ArrowRightLeft className="size-4" /> {calc.isPending ? 'Анализ...' : 'Найти кандидатов'}
        </Button>
      </div>

      {calc.data && (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Продано</TableHead>
                <TableHead className="text-right">Скорость/день</TableHead>
                <TableHead>Рекомендация</TableHead>
                <TableHead>Причина</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">Кандидатов нет</TableCell></TableRow>
              )}
              {rows.map(r => (
                <TableRow key={r.sku_id}>
                  <TableCell>
                    <Link to={`/skus/${r.sku_id}`} className="hover:underline">
                      <span className="font-mono text-xs text-muted-foreground">{r.article}</span>{' '}
                      <span className="text-sm">{r.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{r.qty_sold}</TableCell>
                  <TableCell className="text-right font-medium">{r.velocity_per_day.toFixed(2)}</TableCell>
                  <TableCell>
                    {r.recommended ? (
                      <Badge variant="success" className="gap-1"><CheckCircle2 className="size-3" /> Да</Badge>
                    ) : (
                      <Badge variant="secondary">Нет</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md">{r.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
