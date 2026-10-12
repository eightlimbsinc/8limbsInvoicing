import { invoiceTotals } from './calc'
import { toRow } from './db'
import { useInvoicing } from './store'
import { supabase } from './supabase'
import type { Client, Invoice, Recurring, Settings } from './types'

export interface BackupV2 {
  app: 'invoicing'
  version: 2
  settings: Settings
  clients: Client[]
  invoices: Invoice[]
  recurring: Recurring[]
}

export function exportBackup(): BackupV2 {
  const { settings, clients, invoices, recurring } = useInvoicing.getState()
  return { app: 'invoicing', version: 2, settings, clients, invoices, recurring }
}

/** Shape written by the first, browser-only version of this app. */
interface V1Invoice {
  id: string
  number: string
  clientId: string
  issueDate: string
  dueDate: string
  status: 'draft' | 'sent' | 'paid'
  items: { id: string; description: string; quantity: number; unitPrice: number }[]
  taxRate: number
  discountRate: number
  notes: string
  sentAt?: number
  paidAt?: number
}

interface V1Backup {
  settings: Partial<Settings> & { currency?: string }
  clients: Client[]
  invoices: V1Invoice[]
}

/** The first version kept everything in this browser's localStorage. */
export function readLocalV1(): V1Backup | null {
  try {
    const raw = localStorage.getItem('invoicing-app')
    const state = raw ? JSON.parse(raw).state : null
    return state?.invoices?.length || state?.clients?.length ? state : null
  } catch {
    return null
  }
}

function fromV1(b: V1Backup): Omit<BackupV2, 'settings'> & { settings: Partial<Settings> } {
  const currency = b.settings?.currency || 'USD'
  const iso = (ms?: number) => (ms ? new Date(ms).toISOString() : null)
  return {
    app: 'invoicing',
    version: 2,
    settings: b.settings ?? {},
    clients: b.clients ?? [],
    recurring: [],
    invoices: (b.invoices ?? []).map((v) => {
      const items = v.items.map((it) => ({ ...it, taxRate: v.taxRate || 0 }))
      return {
        id: v.id,
        number: v.number,
        clientId: v.clientId,
        recurringId: null,
        issueDate: v.issueDate,
        dueDate: v.dueDate,
        status: v.status,
        items,
        discountRate: v.discountRate || 0,
        notes: v.notes ?? '',
        paymentLink: '',
        currency,
        total: invoiceTotals({ items, discountRate: v.discountRate || 0 }).total,
        sentAt: iso(v.sentAt),
        paidAt: iso(v.paidAt),
      } as Invoice
    }),
  }
}

const check = ({ error }: { error: { message: string } | null }) => {
  if (error) throw new Error(error.message)
}

/**
 * Adds a backup (from this version or the old browser-only one) to the
 * database. Records with the same id are overwritten; nothing is deleted.
 */
export async function importBackup(raw: unknown): Promise<string> {
  const b = raw as Partial<BackupV2> & Partial<V1Backup>
  if (!b || !Array.isArray(b.clients) || !Array.isArray(b.invoices)) throw new Error('Not an invoicing backup file')
  const data = b.version === 2 ? (b as BackupV2) : fromV1(b as V1Backup)

  const strip = <T extends object>(o: T, ...keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)))
  if (data.clients.length) check(await supabase.from('clients').upsert(data.clients.map((c) => toRow(strip(c, 'userId', 'createdAt')))))
  if (data.recurring.length) check(await supabase.from('recurring_invoices').upsert(data.recurring.map((r) => toRow(strip(r, 'userId', 'createdAt', 'updatedAt')))))
  if (data.invoices.length) check(await supabase.from('invoices').upsert(data.invoices.map((i) => toRow(strip(i, 'userId', 'createdAt', 'updatedAt', 'shareToken')))))

  // Fill in business details only where nothing is set yet.
  const current = useInvoicing.getState().settings
  const fill = Object.fromEntries(
    (['businessName', 'email', 'phone', 'address', 'website', 'logo', 'paymentLink', 'defaultNotes'] as const)
      .filter((k) => !current[k] && data.settings[k])
      .map((k) => [k, data.settings[k]]),
  )
  if (Object.keys(fill).length) await useInvoicing.getState().saveSettings(fill)

  await useInvoicing.getState().load()
  return `Imported ${data.clients.length} customers, ${data.invoices.length} invoices and ${data.recurring.length} recurring invoices.`
}
