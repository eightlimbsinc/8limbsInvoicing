import type { ButtonHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'
import type { DisplayStatus } from '../lib/types'

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

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

const STATUS_STYLES: Record<DisplayStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-300',
  sent: 'bg-blue-50 text-blue-700 ring-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  overdue: 'bg-red-50 text-red-700 ring-red-200',
}

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset', STATUS_STYLES[status])}>
      {status}
    </span>
  )
}

export function PageHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-5">
      <h1 className="text-xl font-semibold m-0">{title}</h1>
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
