import type { DisplayStatus, IntervalUnit, Invoice, LineItem, Recurring } from './types'

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function lineTotal(item: Pick<LineItem, 'quantity' | 'unitPrice'>): number {
  return round2((item.quantity || 0) * (item.unitPrice || 0))
}

export interface Totals {
  subtotal: number
  discount: number
  tax: number
  total: number
}

/** Discount applies to the subtotal; each line's tax applies to its discounted amount. */
export function invoiceTotals(inv: { items: Pick<LineItem, 'quantity' | 'unitPrice' | 'taxRate'>[]; discountRate: number }): Totals {
  const subtotal = round2(inv.items.reduce((sum, it) => sum + lineTotal(it), 0))
  const keep = 1 - (inv.discountRate || 0) / 100
  const discount = round2(subtotal - subtotal * keep)
  const tax = round2(inv.items.reduce((sum, it) => sum + (lineTotal(it) * (it.taxRate || 0)) / 100, 0) * keep)
  return { subtotal, discount, tax, total: round2(subtotal - discount + tax) }
}

export function todayISO(): string {
  return toISO(new Date())
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseISO(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m, d]
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = parseISO(iso)
  return toISO(new Date(y, m - 1, d + days))
}

/** Adds months, clamping to the month's last day (Jan 31 + 1 month = Feb 28), like Postgres. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = parseISO(iso)
  const lastDay = new Date(y, m - 1 + months + 1, 0).getDate()
  return toISO(new Date(y, m - 1 + months, Math.min(d, lastDay)))
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = parseISO(a)
  const [by, bm, bd] = parseISO(b)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** Mirrors SQL `recurring_issue_date`: the issue date of the given period, counted from the anchor. */
export function recurringIssueDate(startDate: string, unit: IntervalUnit, every: number, period: number): string {
  if (unit === 'week') return addDays(startDate, every * period * 7)
  return addMonths(startDate, (unit === 'year' ? 12 : 1) * every * period)
}

export function nextIssueDate(r: Pick<Recurring, 'startDate' | 'intervalUnit' | 'intervalCount' | 'periodIndex'>): string {
  return recurringIssueDate(r.startDate, r.intervalUnit, r.intervalCount, r.periodIndex)
}

export function frequencyLabel(unit: IntervalUnit, every: number): string {
  if (every === 1) return `Every ${unit}`
  if (unit === 'month' && every === 3) return 'Every quarter'
  return `Every ${every} ${unit}s`
}

export function termsLabel(days: number): string {
  return days === 0 ? 'Due on receipt' : `Net ${days}`
}

export const TERMS_PRESETS = [0, 7, 15, 30, 45, 60, 90]

export function displayStatus(inv: Pick<Invoice, 'status' | 'dueDate'>, today = todayISO()): DisplayStatus {
  if (inv.status === 'sent' && inv.dueDate < today) return 'overdue'
  return inv.status
}
