import type { DisplayStatus, Invoice, LineItem } from './types'

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function lineTotal(item: LineItem): number {
  return round2((item.quantity || 0) * (item.unitPrice || 0))
}

export interface Totals {
  subtotal: number
  discount: number
  tax: number
  total: number
}

/** Discount applies to the subtotal; tax applies to the discounted amount. */
export function invoiceTotals(inv: Pick<Invoice, 'items' | 'taxRate' | 'discountRate'>): Totals {
  const subtotal = round2(inv.items.reduce((sum, it) => sum + lineTotal(it), 0))
  const discount = round2((subtotal * (inv.discountRate || 0)) / 100)
  const tax = round2(((subtotal - discount) * (inv.taxRate || 0)) / 100)
  return { subtotal, discount, tax, total: round2(subtotal - discount + tax) }
}

export function todayISO(): string {
  const d = new Date()
  return toISO(d)
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return toISO(new Date(y, m - 1, d + days))
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

export function displayStatus(inv: Invoice, today = todayISO()): DisplayStatus {
  if (inv.status === 'sent' && inv.dueDate < today) return 'overdue'
  return inv.status
}
