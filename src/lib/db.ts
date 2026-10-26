import type { BusinessInfo, Client, Invoice, LineItem, Recurring, Settings } from './types'

// Rows are snake_case in Postgres and camelCase in the app. Only top-level
// keys are converted; `items` (jsonb) is stored as the app writes it.

type Row = Record<string, unknown>

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

export function toRow(obj: object): Row {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [snake(k), v]))
}

function fromRow(row: Row): Row {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [camel(k), v]))
}

// Postgres numeric can arrive as a string; coerce the fields we do math on.
const num = (v: unknown) => (v == null ? 0 : Number(v))

function items(v: unknown): LineItem[] {
  return (Array.isArray(v) ? v : []).map((it: Partial<LineItem>) => ({
    id: it.id ?? crypto.randomUUID(),
    description: it.description ?? '',
    quantity: num(it.quantity),
    unitPrice: num(it.unitPrice),
    taxRate: num(it.taxRate),
  }))
}

export function settingsFromRow(row: Row): Settings {
  const { userId: _u, updatedAt: _t, ...s } = fromRow(row) as unknown as Settings & { userId: string; updatedAt: string }
  return { ...s, defaultTaxRate: num(s.defaultTaxRate) }
}

export function clientFromRow(row: Row): Client {
  const { id, name, email, phone, address } = fromRow(row) as unknown as Client
  return { id, name, email, phone, address }
}

export function invoiceFromRow(row: Row): Invoice {
  const r = fromRow(row) as unknown as Invoice
  return { ...r, name: r.name ?? '', items: items(r.items), discountRate: num(r.discountRate), total: num(r.total) }
}

export function recurringFromRow(row: Row): Recurring {
  const r = fromRow(row) as unknown as Recurring
  return { ...r, items: items(r.items), discountRate: num(r.discountRate), total: num(r.total) }
}

export function businessFromRow(row: Row | null): BusinessInfo {
  const b = (row ? fromRow(row) : {}) as Partial<BusinessInfo>
  return {
    businessName: b.businessName ?? '',
    email: b.email ?? '',
    phone: b.phone ?? '',
    address: b.address ?? '',
    website: b.website ?? '',
    logo: b.logo ?? '',
  }
}

/** The invoice's name, falling back to its first line item for invoices that don't have one. */
export function invoiceTitle(inv: Pick<Invoice, 'name' | 'items' | 'number'>): string {
  return inv.name.trim() || inv.items.find((it) => it.description.trim())?.description.trim() || inv.number
}
