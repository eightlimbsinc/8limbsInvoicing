import { create } from 'zustand'
import { addDays, invoiceTotals, nextIssueDate, todayISO } from './calc'
import { clientFromRow, invoiceFromRow, recurringFromRow, settingsFromRow, toRow } from './db'
import { supabase } from './supabase'
import type { BillingContent, Client, Invoice, InvoiceStatus, LineItem, Recurring, RecurringStatus, Settings } from './types'

export const uid = () => crypto.randomUUID()

export const DEFAULT_SETTINGS: Settings = {
  businessName: '',
  email: '',
  phone: '',
  address: '',
  website: '',
  logo: '',
  currency: 'USD',
  defaultTaxRate: 0,
  paymentTermsDays: 30,
  invoicePrefix: 'INV-',
  numberPadding: 6,
  nextNumber: 1,
  paymentLink: '',
  defaultNotes: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto',
}

/** An invoice being edited: new ones have no id/number until the database assigns them. */
export type InvoiceDraft = BillingContent & Pick<Invoice, 'name' | 'issueDate' | 'dueDate' | 'status'> & Partial<Pick<Invoice, 'id' | 'number'>>
export type RecurringDraft = Omit<Recurring, 'id' | 'generatedCount' | 'lastIssuedOn' | 'total'> & Partial<Pick<Recurring, 'id'>>

interface State {
  loaded: boolean
  /** Admins manage settings, recurring schedules, customers and users; members create invoices. */
  isAdmin: boolean
  /** False until the invoice-names migration has been run on this database. */
  hasInvoiceNames: boolean
  settings: Settings
  clients: Client[]
  invoices: Invoice[]
  recurring: Recurring[]

  load: () => Promise<void>
  reset: () => void
  /** Saves settings; returns how many invoices/schedules had missing terms or payment link filled in. */
  saveSettings: (patch: Partial<Settings>) => Promise<number>
  /** Copies the default terms/payment link from Settings onto one invoice where it has none. */
  applyDefaultsToInvoice: (id: string) => Promise<void>
  saveClient: (client: Client) => Promise<Client>
  deleteClient: (id: string) => Promise<void>
  saveInvoice: (draft: InvoiceDraft) => Promise<Invoice>
  setInvoiceStatus: (id: string, status: InvoiceStatus) => Promise<void>
  deleteInvoice: (id: string) => Promise<void>
  saveRecurring: (draft: RecurringDraft, scheduleChanged: boolean) => Promise<Recurring>
  setRecurringStatus: (id: string, status: RecurringStatus) => Promise<void>
  deleteRecurring: (id: string) => Promise<void>
  blankLine: () => LineItem
  blankInvoice: () => InvoiceDraft
  blankRecurring: () => RecurringDraft
}

/** Throws the Supabase error with a readable message. */
function check<T>({ data, error }: { data: T; error: { message: string; code?: string } | null }): T {
  if (error) {
    if (error.code === '23503') throw new Error('This record is still used by invoices or recurring schedules.')
    if (error.code === '23505') throw new Error('That invoice number is already used.')
    throw new Error(error.message)
  }
  return data
}

const replace = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]

const content = (d: BillingContent) => ({
  clientId: d.clientId,
  items: d.items,
  discountRate: d.discountRate,
  notes: d.notes,
  paymentLink: d.paymentLink,
  currency: d.currency,
  total: invoiceTotals(d).total,
})

export const useInvoicing = create<State>()((set, get) => ({
  loaded: false,
  isAdmin: false,
  hasInvoiceNames: true,
  settings: DEFAULT_SETTINGS,
  clients: [],
  invoices: [],
  recurring: [],

  load: async () => {
    // Catch up on any recurring invoices that came due (the hourly job does this too).
    await supabase.rpc('generate_due_recurring_invoices')
    const [a, s, c, i, r, n] = await Promise.all([
      supabase.rpc('is_admin'),
      supabase.from('settings').select('*').maybeSingle(),
      supabase.from('clients').select('*').order('name'),
      supabase.from('invoices').select('*').order('issue_date', { ascending: false }),
      supabase.from('recurring_invoices').select('*').order('created_at'),
      supabase.from('invoices').select('name').limit(1),
    ])
    // Databases set up before team roles existed have no is_admin(): everyone there is an admin.
    const isAdmin = a.error ? true : Boolean(a.data)
    let settingsRow = check(s)
    if (!settingsRow && isAdmin) settingsRow = check(await supabase.from('settings').insert(toRow({ timezone: DEFAULT_SETTINGS.timezone })).select().single())
    set({
      loaded: true,
      isAdmin,
      hasInvoiceNames: !n.error,
      settings: settingsRow ? settingsFromRow(settingsRow) : DEFAULT_SETTINGS,
      clients: (check(c) ?? []).map(clientFromRow),
      invoices: (check(i) ?? []).map(invoiceFromRow),
      recurring: (check(r) ?? []).map(recurringFromRow),
    })
  },

  reset: () => set({ loaded: false, isAdmin: false, settings: DEFAULT_SETTINGS, clients: [], invoices: [], recurring: [] }),

  saveSettings: async (patch) => {
    const row = check(await supabase.from('settings').update(toRow(patch)).not('user_id', 'is', null).select().single())
    const settings = settingsFromRow(row!)
    set({ settings })

    // Invoices are created with a copy of the defaults, so ones made before the
    // defaults were filled in have none. Give those the new defaults.
    let filled = 0
    for (const [field, value] of [['notes', settings.defaultNotes], ['payment_link', settings.paymentLink]] as const) {
      if (!value.trim()) continue
      for (const table of ['invoices', 'recurring_invoices'] as const) {
        const rows = check(await supabase.from(table).update({ [field]: value }).eq(field, '').select('id'))
        filled += rows?.length ?? 0
      }
    }
    if (filled) await get().load()
    return filled
  },

  applyDefaultsToInvoice: async (id) => {
    const inv = get().invoices.find((i) => i.id === id)
    if (!inv) return
    const { defaultNotes, paymentLink } = get().settings
    const patch = { notes: inv.notes.trim() ? inv.notes : defaultNotes, paymentLink: inv.paymentLink || paymentLink }
    const saved = invoiceFromRow(check(await supabase.from('invoices').update(toRow(patch)).eq('id', id).select().single())!)
    set((s) => ({ invoices: replace(s.invoices, saved) }))
  },

  saveClient: async (client) => {
    const saved = clientFromRow(check(await supabase.from('clients').upsert(toRow(client)).select().single())!)
    set((s) => ({ clients: replace(s.clients, saved).sort((a, b) => a.name.localeCompare(b.name)) }))
    return saved
  },

  deleteClient: async (id) => {
    check(await supabase.from('clients').delete().eq('id', id))
    set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }))
  },

  saveInvoice: async (draft) => {
    const row = toRow({
      ...content(draft),
      ...(get().hasInvoiceNames ? { name: draft.name.trim() } : {}),
      issueDate: draft.issueDate,
      dueDate: draft.dueDate,
      status: draft.status,
    })
    const res = draft.id
      ? await supabase.from('invoices').update({ ...row, number: draft.number }).eq('id', draft.id).select().single()
      : await supabase.from('invoices').insert(row).select().single()
    const saved = invoiceFromRow(check(res))
    set((s) => ({ invoices: replace(s.invoices, saved) }))
    if (!draft.id) {
      // The database advanced next_number; pick it up for the Settings screen.
      const { data } = await supabase.from('settings').select('*').maybeSingle()
      if (data) set({ settings: settingsFromRow(data) })
    }
    return saved
  },

  setInvoiceStatus: async (id, status) => {
    const inv = get().invoices.find((i) => i.id === id)
    if (!inv) return
    const now = new Date().toISOString()
    const patch = {
      status,
      sentAt: status === 'draft' ? null : (inv.sentAt ?? now),
      paidAt: status === 'paid' ? (inv.paidAt ?? now) : null,
    }
    const saved = invoiceFromRow(check(await supabase.from('invoices').update(toRow(patch)).eq('id', id).select().single())!)
    set((s) => ({ invoices: replace(s.invoices, saved) }))
  },

  deleteInvoice: async (id) => {
    check(await supabase.from('invoices').delete().eq('id', id))
    set((s) => ({ invoices: s.invoices.filter((i) => i.id !== id) }))
  },

  saveRecurring: async (draft, scheduleChanged) => {
    const row = toRow({
      ...content(draft),
      id: draft.id ?? uid(),
      name: draft.name.trim(),
      status: draft.status,
      intervalUnit: draft.intervalUnit,
      intervalCount: draft.intervalCount,
      paymentTermsDays: draft.paymentTermsDays,
      endDate: draft.endDate || null,
      maxOccurrences: draft.maxOccurrences || null,
      autoSend: draft.autoSend,
      // A new date or frequency re-anchors the schedule on the chosen next issue date.
      ...(scheduleChanged || !draft.id ? { startDate: draft.startDate, periodIndex: 0 } : {}),
    })
    check(await supabase.from('recurring_invoices').upsert(row))
    // Issues anything due today (or missed periods for a backdated start).
    await get().load()
    return get().recurring.find((r) => r.id === row.id)!
  },

  setRecurringStatus: async (id, status) => {
    const r = get().recurring.find((x) => x.id === id)
    if (!r) return
    let periodIndex = r.periodIndex
    if (status === 'active' && r.status === 'paused') {
      // Resuming skips the periods missed while paused instead of back-billing them.
      const today = todayISO()
      while (nextIssueDate({ ...r, periodIndex }) < today) periodIndex++
    }
    check(await supabase.from('recurring_invoices').update(toRow({ status, periodIndex })).eq('id', id))
    await get().load()
  },

  deleteRecurring: async (id) => {
    check(await supabase.from('recurring_invoices').delete().eq('id', id))
    set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) }))
  },

  blankLine: () => ({ id: uid(), description: '', details: '', quantity: 1, unitPrice: 0, taxRate: get().settings.defaultTaxRate }),

  blankInvoice: () => {
    const { settings } = get()
    const issueDate = todayISO()
    return {
      name: '',
      clientId: '',
      issueDate,
      dueDate: addDays(issueDate, settings.paymentTermsDays),
      status: 'draft',
      items: [get().blankLine()],
      discountRate: 0,
      notes: settings.defaultNotes,
      paymentLink: settings.paymentLink,
      currency: settings.currency,
    }
  },

  blankRecurring: () => {
    const { settings } = get()
    return {
      name: '',
      clientId: '',
      status: 'active',
      startDate: todayISO(),
      periodIndex: 0,
      intervalUnit: 'month',
      intervalCount: 1,
      paymentTermsDays: settings.paymentTermsDays,
      endDate: null,
      maxOccurrences: null,
      autoSend: true,
      items: [get().blankLine()],
      discountRate: 0,
      notes: settings.defaultNotes,
      paymentLink: settings.paymentLink,
      currency: settings.currency,
    }
  },
}))
