import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Download, Upload, RefreshCw, CheckCircle2, AlertTriangle, Settings } from 'lucide-react'

interface SyncEntry {
  key: string
  label: string
  last_run_at: string | null
  last_error: string | null
}

function fmtAgo(iso: string | null): string {
  if (!iso) return 'никогда'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return `${Math.floor(diff / 86400)} дн назад`
}

interface Props {
  isOwner: boolean
  onExport: () => void
  onImport: (file: File) => void
  exporting: boolean
  importing: boolean
}

export default function SettingsDialog({ isOwner, onExport, onImport, exporting, importing }: Props) {
  const [open, setOpen] = useState(false)
  const [runningKey, setRunningKey] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const qc = useQueryClient()

  const statusQuery = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => api.get('/sync/status').then(r => r.data.data as SyncEntry[]),
    enabled: open,
    refetchInterval: open ? 10000 : false,
  })

  const runMutation = useMutation({
    mutationFn: (key: string) => api.post(`/sync/run/${key}`).then(r => r.data.data),
    onMutate: (key) => { setRunningKey(key); setRunError(null) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sync-status'] }) },
    onError: (e: any) => setRunError(e.response?.data?.message ?? 'Ошибка синхронизации'),
    onSettled: () => setRunningKey(null),
  })

  const syncs = statusQuery.data ?? []

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all"
      >
        <Settings className="size-4 shrink-0 text-muted-foreground" />
        Настройки
      </button>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogHeader>
          <DialogTitle>Настройки</DialogTitle>
          <DialogClose onClose={() => setOpen(false)} />
        </DialogHeader>
        <DialogContent>
          <div className="flex flex-col gap-6">

            {/* Импорт / Экспорт */}
            {isOwner && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Данные системы</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-2" onClick={onExport} disabled={exporting}>
                    <Download className="size-4" />
                    {exporting ? 'Экспорт...' : 'Экспорт настроек'}
                  </Button>
                  <Button variant="outline" className="flex-1 gap-2" disabled={importing}
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = '.json'
                      input.onchange = (e) => {
                        const f = (e.target as HTMLInputElement).files?.[0]
                        if (f) onImport(f)
                      }
                      input.click()
                    }}
                  >
                    <Upload className="size-4" />
                    {importing ? 'Импорт...' : 'Импорт настроек'}
                  </Button>
                </div>
              </div>
            )}

            {/* Синхронизации */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Синхронизация с Ozon</p>

              {runError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="size-3.5 shrink-0" /> {runError}
                </div>
              )}

              <div className="rounded-xl border divide-y overflow-hidden">
                {statusQuery.isLoading && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">Загрузка...</div>
                )}
                {syncs.map(entry => (
                  <div key={entry.key} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium">{entry.label}</span>
                      <span className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        {entry.last_error ? (
                          <><AlertTriangle className="size-3 text-destructive shrink-0" /><span className="text-destructive truncate max-w-[200px]">{entry.last_error}</span></>
                        ) : entry.last_run_at ? (
                          <><CheckCircle2 className="size-3 text-green-500 shrink-0" />{fmtAgo(entry.last_run_at)}</>
                        ) : (
                          <span className="text-muted-foreground/60">Не синхронизировано</span>
                        )}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1.5"
                      disabled={runningKey !== null}
                      onClick={() => runMutation.mutate(entry.key)}
                    >
                      <RefreshCw className={`size-3.5 ${runningKey === entry.key ? 'animate-spin' : ''}`} />
                      {runningKey === entry.key ? 'Синхр...' : 'Синхр.'}
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="gap-2 self-start"
                disabled={runningKey !== null}
                onClick={() => {
                  const keys = syncs.map(s => s.key)
                  const runNext = (i: number) => {
                    if (i >= keys.length) return
                    runMutation.mutate(keys[i], { onSettled: () => runNext(i + 1) })
                  }
                  runNext(0)
                }}
              >
                <RefreshCw className={`size-4 ${runningKey !== null ? 'animate-spin' : ''}`} />
                Синхронизировать всё
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
