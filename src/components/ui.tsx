import type { ButtonHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'
import type { DisplayStatus, RecurringStatus } from '../lib/types'

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
}

export function Button({
  variant = 'secondary',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <button type="button" className={clsx('btn', VARIANTS[variant], className)} {...rest}>
      {children}
    </button>
  )
}

/** Wraps a single control in its label; pass `htmlFor` instead when the field holds several controls. */
export function Field({ label, children, className, htmlFor }: { label: string; children: ReactNode; className?: string; htmlFor?: string }) {
  if (htmlFor)
    return (
      <div className={className}>
        <label htmlFor={htmlFor} className="field-label">
          {label}
        </label>
        {children}
      </div>
    )
  return (
    <label className={clsx('block', className)}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

const STATUS_STYLES: Record<DisplayStatus | RecurringStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-300',
  sent: 'bg-blue-50 text-blue-700 ring-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  overdue: 'bg-red-50 text-red-700 ring-red-200',
  void: 'bg-slate-100 text-slate-500 ring-slate-200 line-through',
  active: 'bg-blue-50 text-blue-700 ring-blue-200',
  paused: 'bg-amber-50 text-amber-800 ring-amber-200',
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
  completed: 'bg-slate-100 text-slate-600 ring-slate-300',
}

export function StatusBadge({ status }: { status: DisplayStatus | RecurringStatus }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset', STATUS_STYLES[status])}>
      {status}
    </span>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="no-print flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-semibold m-0">{title}</h1>
        {subtitle && <p className="m-0 mt-0.5 text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="panel p-10 text-center">
      <p className="font-medium m-0">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
    </div>
  )
}

const AVATAR_COLORS = ['#7cb77a', '#b98472', '#7a9cc6', '#c6a15b', '#9b85c4', '#6fb3b0']

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
  const color = AVATAR_COLORS[[...name].reduce((h, ch) => h + ch.charCodeAt(0), 0) % AVATAR_COLORS.length]
  return (
    <span className="inline-grid place-items-center w-8 h-8 shrink-0 rounded-full text-xs font-medium text-slate-800" style={{ background: color }}>
      {initials || '?'}
    </span>
  )
}

export function ErrorBanner({ error }: { error: string }) {
  return error ? <div className="no-print mb-4 rounded-md bg-red-50 text-red-800 text-sm px-3 py-2 ring-1 ring-red-200">{error}</div> : null
}
