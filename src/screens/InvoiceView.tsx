import { useState } from 'react'
import { InvoiceDocument } from '../components/InvoiceDocument'
import { Button, EmptyState, ErrorBanner, PageHeader, StatusBadge } from '../components/ui'
import { displayStatus, invoiceTotals, todayISO } from '../lib/calc'
import { errorMessage, fmtDate, fmtMoney, shareUrl } from '../lib/format'
import { navigate } from '../lib/router'
import { useInvoicing } from '../lib/store'
import type { InvoiceStatus } from '../lib/types'

export function InvoiceView({ id }: { id: string }) {
  const invoice = useInvoicing((s) => s.invoices.find((i) => i.id === id))
  const client = useInvoicing((s) => s.clients.find((c) => c.id === invoice?.clientId))
  const recurring = useInvoicing((s) => s.recurring.find((r) => r.id === invoice?.recurringId))
  const settings = useInvoicing((s) => s.settings)
  const setInvoiceStatus = useInvoicing((s) => s.setInvoiceStatus)
  const deleteInvoice = useInvoicing((s) => s.deleteInvoice)
  const saveInvoice = useInvoicing((s) => s.saveInvoice)
  const applyDefaultsToInvoice = useInvoicing((s) => s.applyDefaultsToInvoice)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  if (!invoice) return <EmptyState title="Invoice not found" />

  const status = displayStatus(invoice)
  const total = invoiceTotals(invoice).total
  const shared = invoice.status === 'sent' || invoice.status === 'paid'

  const run = (fn: () => Promise<unknown>) => () => {
    setError('')
    fn().catch((e) => setError(errorMessage(e)))
  }
  const setStatus = (s: InvoiceStatus) => run(() => setInvoiceStatus(invoice.id, s))

  const mailto = client?.email
    ? `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(
        `Invoice ${invoice.number}${settings.businessName ? ` from ${settings.businessName}` : ''}`,
      )}&body=${encodeURIComponent(
        `Hi ${client.name},\n\nPlease find invoice ${invoice.number} for ${fmtMoney(total, invoice.currency)}, due ${fmtDate(invoice.dueDate)}.\n\n` +
          `View and pay online: ${shareUrl(invoice.shareToken)}\n\nThank you,\n${settings.businessName}`,
      )}`
    : undefined

  const copyLink = run(async () => {
    await navigator.clipboard.writeText(shareUrl(invoice.shareToken))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  })

  const remove = run(async () => {
    if (!confirm(`Delete draft ${invoice.number}? This can't be undone.`)) return
    await deleteInvoice(invoice.id)
    navigate('/', { replace: true })
  })

  const voidInvoice = run(async () => {
    if (confirm(`Void ${invoice.number}? It stays on record but no longer counts as owed.`)) await setInvoiceStatus(invoice.id, 'void')
  })

  const duplicate = run(async () => {
    const issueDate = todayISO()
    const copy = await saveInvoice({
      ...invoice,
      id: undefined,
      number: undefined,
      status: 'draft',
      issueDate,
      dueDate: useInvoicing.getState().blankInvoice().dueDate,
    })
    navigate(`/invoices/${copy.id}/edit`)
  })

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {invoice.number} <StatusBadge status={status} />
          </span>
        }
        subtitle={recurring ? `Issued by recurring invoice “${recurring.name}”` : undefined}
        actions={
          <>
            {!invoice.notes.trim() && (
        <div className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-md bg-amber-50 ring-1 ring-amber-200 px-3 py-2 text-sm text-amber-900">
          <span className="flex-1">
            This invoice has no terms &amp; notes.
            {!settings.defaultNotes.trim() && ' Add default terms in Settings first.'}
          </span>
          {settings.defaultNotes.trim() && (
            <Button onClick={run(() => applyDefaultsToInvoice(invoice.id))}>Add terms from Settings</Button>
          )}
        </div>
      )}
      {invoice.status === 'draft' && (
              <Button variant="primary" onClick={setStatus('sent')}>
                Mark as sent
              </Button>
            )}
            {invoice.status === 'sent' && (
              <Button variant="primary" onClick={setStatus('paid')}>
                Mark as paid
              </Button>
            )}
            {invoice.status === 'paid' && <Button onClick={setStatus('sent')}>Mark unpaid</Button>}
            {invoice.status === 'void' && <Button onClick={setStatus('draft')}>Restore as draft</Button>}
            {shared && <Button onClick={copyLink}>{copied ? 'Link copied ✓' : 'Copy client link'}</Button>}
            {shared && mailto && (
              <a className="btn btn-secondary no-underline" href={mailto}>
                Email
              </a>
            )}
            <Button onClick={() => window.print()}>Download PDF</Button>
            {invoice.status !== 'void' && <Button onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>Edit</Button>}
            <Button onClick={duplicate}>Duplicate</Button>
            {invoice.status === 'draft' ? (
              <Button variant="danger" onClick={remove}>
                Delete
              </Button>
            ) : (
              invoice.status !== 'void' && (
                <Button variant="danger" onClick={voidInvoice}>
                  Void
                </Button>
              )
            )}
          </>
        }
      />
      <ErrorBanner error={error} />
      {invoice.status === 'draft' && (
        <p className="no-print -mt-2 mb-4 text-sm text-slate-500">Drafts can't be opened from the client link — mark it as sent first.</p>
      )}

      <div className="mx-auto max-w-[900px] print-plain">
        <div className="rounded border border-slate-200 shadow-sm print-plain overflow-hidden">
          <InvoiceDocument invoice={invoice} client={client} business={settings} />
        </div>

        <div className="no-print mt-4 panel shadow-sm p-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => window.print()}>
              View PDF
            </Button>
            {shared ? (
              <a className="btn btn-secondary no-underline" href={shareUrl(invoice.shareToken)} target="_blank" rel="noopener noreferrer">
                Online version ↗
              </a>
            ) : (
              <Button disabled title="Mark the invoice as sent to enable the online version">
                Online version ↗
              </Button>
            )}
          </div>
          {shared ? (
            <div>
              <label htmlFor="client-link" className="field-label">
                Client link — anyone with this link can view and pay this invoice
              </label>
              <div className="flex gap-2">
                <input id="client-link" className="input font-mono text-xs" readOnly value={shareUrl(invoice.shareToken)} onFocus={(e) => e.target.select()} />
                <Button onClick={copyLink}>{copied ? 'Copied ✓' : 'Copy'}</Button>
              </div>
            </div>
          ) : (
            <p className="m-0 text-sm text-slate-500">
              {invoice.status === 'void' ? 'Voided invoices have no client link.' : 'The online version and client link become available once you mark this invoice as sent.'}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
