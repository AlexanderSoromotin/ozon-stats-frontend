import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  active: string
  setActive: (v: string) => void
}
const TabsCtx = React.createContext<TabsContextValue | null>(null)

function Tabs({ defaultValue, children, className }: { defaultValue: string; children: React.ReactNode; className?: string }) {
  const [active, setActive] = React.useState(defaultValue)
  return <TabsCtx.Provider value={{ active, setActive }}><div className={className}>{children}</div></TabsCtx.Provider>
}

function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground', className)}>
      {children}
    </div>
  )
}

function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsCtx)!
  const active = ctx.active === value
  return (
    <button
      onClick={() => ctx.setActive(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all',
        active ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(TabsCtx)!
  if (ctx.active !== value) return null
  return <div className={cn('mt-4', className)}>{children}</div>
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
