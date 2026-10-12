/** Stored status. "overdue" is derived from a sent invoice's due date — see `displayStatus`. */
export type InvoiceStatus = 'draft' | 'sent' | 'paid'
export type DisplayStatus = InvoiceStatus | 'overdue'

export interface Client {
  id: string
  name: string
  email: string
  phone: string
  address: string
}

export interface LineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

export interface Invoice {
  id: string
  number: string
  clientId: string
  /** ISO dates, YYYY-MM-DD */
  issueDate: string
  dueDate: string
  status: InvoiceStatus
  items: LineItem[]
  /** Percentages, e.g. 8.25 */
  taxRate: number
  discountRate: number
  notes: string
  createdAt: number
  sentAt?: number
  paidAt?: number
}

export interface Settings {
  businessName: string
  email: string
  phone: string
  address: string
  /** data: URL, kept small so it fits in localStorage */
  logo: string
  currency: string
  defaultTaxRate: number
  paymentTermsDays: number
  invoicePrefix: string
  nextNumber: number
  paymentInstructions: string
  defaultNotes: string
}
