import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addDays, todayISO } from './calc'
import type { Client, Invoice, InvoiceStatus, Settings } from './types'

export const uid = () => crypto.randomUUID()

const initialSettings: Settings = {
  businessName: '',
  email: '',
  phone: '',
  address: '',
  logo: '',
  currency: 'USD',
  defaultTaxRate: 0,
  paymentTermsDays: 30,
  invoicePrefix: 'INV-',
  nextNumber: 1001,
  paymentInstructions: '',
  defaultNotes: 'Thank you for your business!',
}

export type InvoiceDraft = Omit<Invoice, 'id' | 'number' | 'createdAt' | 'sentAt' | 'paidAt'>

interface InvoicingState {
  settings: Settings
  clients: Client[]
  invoices: Invoice[]

  updateSettings: (patch: Partial<Settings>) => void
  saveClient: (client: Client) => void
  /** Returns false (and deletes nothing) if the client still has invoices. */
  deleteClient: (id: string) => boolean
  createInvoice: (draft: InvoiceDraft) => string
  updateInvoice: (invoice: Invoice) => void
  deleteInvoice: (id: string) => void
  setStatus: (id: string, status: InvoiceStatus) => void
  duplicateInvoice: (id: string) => string | null
  blankDraft: () => InvoiceDraft
  exportData: () => BackupData
  /** Replaces all data. Throws if the file isn't a backup from this app. */
  importData: (data: unknown) => void
}

export interface BackupData {
  app: 'invoicing'
  version: 1
  settings: Settings
  clients: Client[]
  invoices: Invoice[]
}

export const useInvoicing = create<InvoicingState>()(
  persist(
    (set, get) => ({
      settings: initialSettings,
      clients: [],
      invoices: [],

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      saveClient: (client) =>
        set((s) => ({
          clients: s.clients.some((c) => c.id === client.id)
            ? s.clients.map((c) => (c.id === client.id ? client : c))
            : [...s.clients, client],
        })),

      deleteClient: (id) => {
        if (get().invoices.some((i) => i.clientId === id)) return false
        set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }))
        return true
      },

      createInvoice: (draft) => {
        const { settings } = get()
        const invoice: Invoice = {
          ...draft,
          id: uid(),
          number: `${settings.invoicePrefix}${settings.nextNumber}`,
          createdAt: Date.now(),
        }
        set((s) => ({
          invoices: [...s.invoices, invoice],
          settings: { ...s.settings, nextNumber: s.settings.nextNumber + 1 },
        }))
        return invoice.id
      },

      updateInvoice: (invoice) => set((s) => ({ invoices: s.invoices.map((i) => (i.id === invoice.id ? invoice : i)) })),

      deleteInvoice: (id) => set((s) => ({ invoices: s.invoices.filter((i) => i.id !== id) })),

      setStatus: (id, status) =>
        set((s) => ({
          invoices: s.invoices.map((i) => {
            if (i.id !== id) return i
            const now = Date.now()
            return {
              ...i,
              status,
              sentAt: status === 'draft' ? undefined : (i.sentAt ?? now),
              paidAt: status === 'paid' ? (i.paidAt ?? now) : undefined,
            }
          }),
        })),

      duplicateInvoice: (id) => {
        const src = get().invoices.find((i) => i.id === id)
        if (!src) return null
        const base = get().blankDraft()
        return get().createInvoice({
          ...base,
          clientId: src.clientId,
          items: src.items.map((it) => ({ ...it, id: uid() })),
          taxRate: src.taxRate,
          discountRate: src.discountRate,
          notes: src.notes,
        })
      },

      blankDraft: () => {
        const { settings } = get()
        const issueDate = todayISO()
        return {
          clientId: '',
          issueDate,
          dueDate: addDays(issueDate, settings.paymentTermsDays),
          status: 'draft',
          items: [{ id: uid(), description: '', quantity: 1, unitPrice: 0 }],
          taxRate: settings.defaultTaxRate,
          discountRate: 0,
          notes: settings.defaultNotes,
        }
      },

      exportData: () => {
        const { settings, clients, invoices } = get()
        return { app: 'invoicing', version: 1, settings, clients, invoices }
      },

      importData: (data) => {
        const d = data as Partial<BackupData> | null
        if (!d || d.app !== 'invoicing' || !Array.isArray(d.clients) || !Array.isArray(d.invoices) || typeof d.settings !== 'object') {
          throw new Error('Not an invoicing backup file')
        }
        set({ settings: { ...initialSettings, ...d.settings }, clients: d.clients, invoices: d.invoices })
      },
    }),
    {
      name: 'invoicing-app',
      version: 1,
      partialize: (s) => ({ settings: s.settings, clients: s.clients, invoices: s.invoices }),
      merge: (persisted, current) => {
        const p = persisted as Partial<InvoicingState> | undefined
        return { ...current, ...p, settings: { ...initialSettings, ...p?.settings } }
      },
    },
  ),
)
