import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Eye,
  EyeOff,
  ArrowRight,
  TrendingUp,
  Package,
  Factory,
  Sparkles,
  AlertCircle,
} from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch {
      setError('Неверный email или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 grid lg:grid-cols-[1.1fr_1fr] overflow-hidden">
      {/* LEFT — brand / product preview */}
      <aside className="relative hidden lg:flex flex-col justify-between p-10 xl:p-14 overflow-hidden bg-neutral-950 text-neutral-100">
        {/* mesh gradient */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-24 size-[480px] rounded-full bg-gradient-to-br from-indigo-500/40 via-fuchsia-500/20 to-transparent blur-3xl" />
          <div className="absolute top-1/3 -right-24 size-[420px] rounded-full bg-gradient-to-tr from-emerald-400/30 via-cyan-500/20 to-transparent blur-3xl" />
          <div className="absolute -bottom-32 left-1/4 size-[520px] rounded-full bg-gradient-to-tr from-amber-400/20 via-rose-500/20 to-transparent blur-3xl" />
        </div>
        {/* subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
          }}
        />

        {/* logo */}
        <div className="relative flex items-center gap-2.5 text-sm font-medium">
          <div className="size-8 rounded-lg bg-white text-neutral-950 flex items-center justify-center font-bold">
            O
          </div>
          <span className="tracking-tight">Ozon Stats</span>
        </div>

        {/* hero copy + bento preview */}
        <div className="relative flex flex-col gap-10">
          <div className="space-y-4 max-w-md">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm">
              <Sparkles className="size-3" />
              Производство под контролем
            </div>
            <h2 className="text-4xl xl:text-5xl font-semibold tracking-tight leading-[1.05]">
              Аналитика, склад и&nbsp;поставки —{' '}
              <span className="bg-gradient-to-r from-white via-neutral-300 to-neutral-500 bg-clip-text text-transparent">
                в одном месте.
              </span>
            </h2>
            <p className="text-neutral-400 text-base leading-relaxed">
              Планируйте поставки на FBO, рассчитывайте спрос и&nbsp;управляйте
              производством без таблиц и&nbsp;ручных пересчётов.
            </p>
          </div>

          {/* bento mock */}
          <div className="grid grid-cols-3 gap-3 max-w-md">
            <MockCard
              icon={<TrendingUp className="size-4" />}
              label="Выручка"
              value="₽2.4M"
              delta="+12%"
              className="col-span-2"
            />
            <MockCard
              icon={<Package className="size-4" />}
              label="SKU"
              value="148"
            />
            <MockCard
              icon={<Factory className="size-4" />}
              label="В работе"
              value="36"
            />
            <div className="col-span-2 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-3 overflow-hidden">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">
                Поставки на неделю
              </div>
              <div className="flex items-end gap-1.5 h-12">
                {[40, 65, 35, 80, 55, 90, 70].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-gradient-to-t from-indigo-500/40 to-fuchsia-400/80"
                    style={{
                      height: `${h}%`,
                      transition: 'height 600ms ease',
                      transitionDelay: `${i * 60}ms`,
                      transform: mounted ? 'scaleY(1)' : 'scaleY(0)',
                      transformOrigin: 'bottom',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="relative text-xs text-neutral-500">
          &copy; {new Date().getFullYear()} Ozon Stats
        </div>
      </aside>

      {/* RIGHT — form */}
      <main className="relative flex items-center justify-center p-6 sm:p-10">
        {/* mobile logo */}
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-2 text-sm font-medium">
          <div className="size-8 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center font-bold">
            O
          </div>
          <span className="tracking-tight">Ozon Stats</span>
        </div>

        <div
          className={`w-full max-w-sm transition-all duration-500 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">
              С возвращением
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Войдите, чтобы продолжить работу с панелью.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-medium text-neutral-600 dark:text-neutral-400"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
                className="h-11 rounded-xl bg-white dark:bg-white/[0.03] border-neutral-200 dark:border-white/10 focus-visible:ring-2 focus-visible:ring-neutral-900/10 dark:focus-visible:ring-white/20 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-medium text-neutral-600 dark:text-neutral-400"
                >
                  Пароль
                </label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 pr-10 rounded-xl bg-white dark:bg-white/[0.03] border-neutral-200 dark:border-white/10 focus-visible:ring-2 focus-visible:ring-neutral-900/10 dark:focus-visible:ring-white/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="group w-full h-11 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all disabled:opacity-60 cursor-pointer shadow-sm"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Входим...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  Войти
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </Button>
          </form>

          <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-600 text-center">
            Защищено JWT &middot; Сессия 24 часа
          </p>
        </div>
      </main>
    </div>
  )
}

function MockCard({
  icon,
  label,
  value,
  delta,
  className = '',
}: {
  icon: React.ReactNode
  label: string
  value: string
  delta?: string
  className?: string
}) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-3 ${className}`}
    >
      <div className="flex items-center justify-between text-neutral-400 mb-2">
        {icon}
        {delta && (
          <span className="text-[10px] font-medium text-emerald-400">
            {delta}
          </span>
        )}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className="text-xl font-semibold text-white tracking-tight">
        {value}
      </div>
    </div>
  )
}
