/** Stored status. "overdue" is derived from a sent invoice's due date — see `displayStatus`. */
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void'
export type DisplayStatus = InvoiceStatus | 'overdue'

export type RecurringStatus = 'active' | 'paused' | 'cancelled' | 'completed'
export type IntervalUnit = 'week' | 'month' | 'year'

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
  /** Percent, e.g. 13 for 13% HST. 0 shows as "-". */
  taxRate: number
}

/** Fields shared by one-off invoices and recurring schedules. */
export interface BillingContent {
  clientId: string
  items: LineItem[]
  discountRate: number
  notes: string
  paymentLink: string
  currency: string
}

export interface Invoice extends BillingContent {
  id: string
  number: string
  /** What the invoice is for, e.g. "Podcast Services". Shown first in lists. */
  name: string
  recurringId: string | null
  /** ISO dates, YYYY-MM-DD */
  issueDate: string
  dueDate: string
  status: InvoiceStatus
  total: number
  shareToken: string
  sentAt: string | null
  paidAt: string | null
  createdAt: string
}

export interface Recurring extends BillingContent {
  id: string
  name: string
  status: RecurringStatus
  startDate: string
  periodIndex: number
  intervalUnit: IntervalUnit
  intervalCount: number
  paymentTermsDays: number
  endDate: string | null
  maxOccurrences: number | null
  generatedCount: number
  lastIssuedOn: string | null
  autoSend: boolean
  total: number
}

export interface Settings {
  businessName: string
  email: string
  phone: string
  address: string
  website: string
  /** data: URL, downscaled on upload */
  logo: string
  currency: string
  defaultTaxRate: number
  paymentTermsDays: number
  invoicePrefix: string
  numberPadding: number
  nextNumber: number
  paymentLink: string
  defaultNotes: string
  timezone: string
}

/** Business details shown on an invoice (the subset a client-facing link may see). */
export type BusinessInfo = Pick<Settings, 'businessName' | 'email' | 'phone' | 'address' | 'website' | 'logo'>
