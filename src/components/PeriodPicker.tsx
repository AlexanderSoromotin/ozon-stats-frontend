import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { fmtDate } from '@/lib/format'

export type PeriodPreset = 'day' | 'week' | 'month' | 'custom'

export interface PeriodValue {
  from: string
  to: string
  preset: PeriodPreset
}

function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function yesterday(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toIso(d)
}

function diffDays(from: string, to: string): number {
  const f = new Date(from + 'T00:00:00').getTime()
  const t = new Date(to + 'T00:00:00').getTime()
  return Math.round((t - f) / 86400000) + 1
}

export function presetPeriod(preset: Exclude<PeriodPreset, 'custom'>, includeToday = false): PeriodValue {
  const end = toIso(includeToday ? new Date() : yesterday())
  if (preset === 'day') return { from: end, to: end, preset }
  if (preset === 'week') return { from: addDays(end, -6), to: end, preset }
  return { from: addDays(end, -29), to: end, preset }
}

const PRESETS: { key: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
  { key: 'day', label: 'День' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
]

interface Props {
  value: PeriodValue
  onChange: (v: PeriodValue) => void
  includeToday?: boolean
}

export default function PeriodPicker({ value, onChange, includeToday = false }: Props) {
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom')

  useEffect(() => {
    if (value.preset === 'custom') setCustomOpen(true)
  }, [value.preset])

  const length = diffDays(value.from, value.to)
  const maxDate = toIso(includeToday ? new Date() : yesterday())
  const canForward = value.to < maxDate

  function shift(direction: -1 | 1) {
    const delta = direction * length
    let newFrom = addDays(value.from, delta)
    let newTo = addDays(value.to, delta)
    // Clamp forward navigation so we don't go past yesterday
    if (direction === 1 && newTo > maxDate) {
      newTo = maxDate
      newFrom = addDays(newTo, -(length - 1))
    }
    onChange({ from: newFrom, to: newTo, preset: value.preset })
  }

  function selectPreset(p: Exclude<PeriodPreset, 'custom'>) {
    setCustomOpen(false)
    onChange(presetPeriod(p, includeToday))
  }

  function openCustom() {
    setCustomOpen(true)
    onChange({ ...value, preset: 'custom' })
  }

  return (
    <div className="flex items-center gap-2">
      {/* Prev */}
      <button
        type="button"
        onClick={() => shift(-1)}
        className="inline-flex items-center justify-center size-9 rounded-md border bg-background hover:bg-accent transition-colors"
        aria-label="Предыдущий период"
      >
        <ChevronLeft className="size-4" />
      </button>

      {/* Preset group */}
      <div className="inline-flex h-9 items-center rounded-lg bg-muted p-1 text-sm">
        {PRESETS.map(p => {
          const active = value.preset === p.key
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => selectPreset(p.key)}
              className={cn(
                'rounded-md px-3 h-7 font-medium transition-colors',
                active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={openCustom}
          className={cn(
            'rounded-md px-3 h-7 font-medium transition-colors inline-flex items-center gap-1.5',
            value.preset === 'custom' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Calendar className="size-3.5" /> Другое
        </button>
      </div>

      {/* Next */}
      <button
        type="button"
        onClick={() => shift(1)}
        disabled={!canForward}
        className="inline-flex items-center justify-center size-9 rounded-md border bg-background hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Следующий период"
      >
        <ChevronRight className="size-4" />
      </button>

      {/* Date range display */}
      <div className="hidden md:flex items-center text-xs text-muted-foreground px-2">
        {value.from === value.to
          ? fmtDate(value.from)
          : <>{fmtDate(value.from)} <span className="mx-1.5 opacity-60">→</span> {fmtDate(value.to)}</>}
      </div>

      {/* Custom range pickers */}
      {customOpen && value.preset === 'custom' && (
        <div className="flex items-center gap-2 ml-2">
          <Input
            type="date"
            value={value.from}
            max={value.to}
            onChange={e => onChange({ ...value, from: e.target.value, preset: 'custom' })}
            className="w-40"
          />
          <span className="text-muted-foreground text-sm">—</span>
          <Input
            type="date"
            value={value.to}
            min={value.from}
            max={maxDate}
            onChange={e => onChange({ ...value, to: e.target.value, preset: 'custom' })}
            className="w-40"
          />
        </div>
      )}
    </div>
  )
}
