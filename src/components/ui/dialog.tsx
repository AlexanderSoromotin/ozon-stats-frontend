import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

function Dialog({ open, onClose, children }: DialogProps) {
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-background rounded-xl border shadow-lg">
        {children}
      </div>
    </div>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-start justify-between gap-4 p-6 pb-0', className)} {...props} />
}

function DialogTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn('text-lg font-semibold', className)} {...props} />
}

function DialogContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-6', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex justify-end gap-2 p-6 pt-0', className)} {...props} />
}

function DialogClose({ onClose }: { onClose: () => void }) {
  return (
    <button onClick={onClose} className="shrink-0 rounded-sm opacity-70 hover:opacity-100 transition-opacity mt-1">
      <X className="size-4" />
    </button>
  )
}

export { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter, DialogClose }
