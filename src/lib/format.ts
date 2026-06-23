export function fmtMoney(minor: number | null | undefined): string {
  if (minor == null) return '—'
  const rub = minor / 100
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(rub)
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('ru-RU').format(n)
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}
