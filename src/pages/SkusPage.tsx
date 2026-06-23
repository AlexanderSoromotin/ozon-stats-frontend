import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { fmtMoney, fmtNum } from '@/lib/format'

interface Sku {
  id: number
  ozon_sku_id: number | null
  article: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  channel_strategy: 'FBO' | 'FBS'
  item_volume_cm3: number
  default_cover_days: number
  sales_30d?: { units: number; revenue_minor: number }
}

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Активен', PAUSED: 'Пауза', ARCHIVED: 'Архив' }
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary'> = {
  ACTIVE: 'success', PAUSED: 'warning', ARCHIVED: 'secondary',
}

export default function SkusPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['skus', page, search, statusFilter],
    queryFn: () => api.get('/skus', { params: { page, per_page: 20, search: search || undefined, status: statusFilter || undefined, include: 'sales_30d' } }).then(r => r.data),
  })

  const skus: Sku[] = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Каталог SKU</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Товарные позиции</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию или артикулу..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="w-40">
          <option value="">Все статусы</option>
          <option value="ACTIVE">Активные</option>
          <option value="PAUSED">Пауза</option>
          <option value="ARCHIVED">Архив</option>
        </Select>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Артикул</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Канал</TableHead>
              <TableHead>Ozon SKU ID</TableHead>
              <TableHead>Объём, см³</TableHead>
              <TableHead>Покрытие, дн.</TableHead>
              <TableHead className="text-right">Продажи 30д</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">Загрузка...</TableCell></TableRow>
            )}
            {!isLoading && skus.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">Ничего не найдено</TableCell></TableRow>
            )}
            {skus.map(sku => (
              <TableRow key={sku.id}>
                <TableCell className="font-mono text-xs">{sku.article}</TableCell>
                <TableCell>
                  <Link to={`/skus/${sku.id}`} className="font-medium hover:underline underline-offset-4">{sku.name}</Link>
                </TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[sku.status]}>{STATUS_LABEL[sku.status]}</Badge></TableCell>
                <TableCell><Badge variant="outline">{sku.channel_strategy}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-xs">{sku.ozon_sku_id ?? '—'}</TableCell>
                <TableCell>{sku.item_volume_cm3}</TableCell>
                <TableCell>{sku.default_cover_days}</TableCell>
                <TableCell className="text-right">
                  {sku.sales_30d ? (
                    <div>
                      <div className="text-sm font-medium">{fmtMoney(sku.sales_30d.revenue_minor)}</div>
                      <div className="text-xs text-muted-foreground">{fmtNum(sku.sales_30d.units)} шт</div>
                    </div>
                  ) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Всего: {meta.total}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Назад</Button>
            <span>{page} / {meta.last_page}</span>
            <Button variant="outline" size="sm" disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}>Вперёд</Button>
          </div>
        </div>
      )}

    </div>
  )
}
