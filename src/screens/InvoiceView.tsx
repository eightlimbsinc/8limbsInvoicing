import { Button, EmptyState, PageHeader, StatusBadge } from '../components/ui'
import { displayStatus, invoiceTotals, lineTotal } from '../lib/calc'
import { fmtDate, fmtMoney } from '../lib/format'
import { navigate } from '../lib/router'
import { useInvoicing } from '../lib/store'

export function InvoiceView({ id }: { id: string }) {
  const invoice = useInvoicing((s) => s.invoices.find((i) => i.id === id))
  const client = useInvoicing((s) => s.clients.find((c) => c.id === invoice?.clientId))
  const settings = useInvoicing((s) => s.settings)
  const setStatus = useInvoicing((s) => s.setStatus)
  const deleteInvoice = useInvoicing((s) => s.deleteInvoice)
  const duplicateInvoice = useInvoicing((s) => s.duplicateInvoice)

  if (!invoice) return <EmptyState title="Invoice not found" />

  const status = displayStatus(invoice)
  const totals = invoiceTotals(invoice)
  const money = (n: number) => fmtMoney(n, settings.currency)

  const mailto = client?.email
    ? `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(
        `Invoice ${invoice.number}${settings.businessName ? ` from ${settings.businessName}` : ''}`,
      )}&body=${encodeURIComponent(
        `Hi ${client.name},\n\nPlease find invoice ${invoice.number} for ${money(totals.total)}, due ${fmtDate(invoice.dueDate)}.\n\n` +
          (settings.paymentInstructions ? `${settings.paymentInstructions}\n\n` : '') +
          `Thank you,\n${settings.businessName}`,
      )}`
    : undefined

  const remove = () => {
    if (!confirm(`Delete invoice ${invoice.number}? This can't be undone.`)) return
    deleteInvoice(invoice.id)
    navigate('/', { replace: true })
  }

  const duplicate = () => {
    const newId = duplicateInvoice(invoice.id)
    if (newId) navigate(`/invoices/${newId}/edit`)
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {invoice.number} <StatusBadge status={status} />
          </span>
        }
        actions={
          <>
            {invoice.status === 'draft' && (
              <Button variant="primary" onClick={() => setStatus(invoice.id, 'sent')}>
                Mark as sent
              </Button>
            )}
            {invoice.status === 'sent' && (
              <Button variant="primary" onClick={() => setStatus(invoice.id, 'paid')}>
                Mark as paid
              </Button>
            )}
            {invoice.status === 'paid' && <Button onClick={() => setStatus(invoice.id, 'sent')}>Mark unpaid</Button>}
            {invoice.status === 'sent' && <Button onClick={() => setStatus(invoice.id, 'draft')}>Back to draft</Button>}
            <Button onClick={() => window.print()}>Print / PDF</Button>
            {mailto && (
              <a className="btn btn-secondary no-underline" href={mailto}>
                Email
              </a>
            )}
            <Button onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>Edit</Button>
            <Button onClick={duplicate}>Duplicate</Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
          </>
        }
      />

      <article className="panel print-plain p-6 sm:p-10 text-sm">
        <header className="flex flex-col-reverse sm:flex-row sm:justify-between gap-6">
          <div>
            {settings.logo && <img src={settings.logo} alt="" className="max-h-16 max-w-48 object-contain mb-3" />}
            <div className="font-semibold text-base">{settings.businessName || 'Your business'}</div>
            <Lines text={settings.address} />
            {settings.email && <div className="text-slate-600">{settings.email}</div>}
            {settings.phone && <div className="text-slate-600">{settings.phone}</div>}
          </div>
          <div className="sm:text-right">
            <div className="text-3xl font-light tracking-wide uppercase text-slate-400">Invoice</div>
            <div className="mt-1 font-semibold">{invoice.number}</div>
            {status === 'paid' && <div className="mt-1 font-semibold text-emerald-700 uppercase tracking-wide">Paid</div>}
          </div>
        </header>

        <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Bill to</div>
            {client ? (
              <>
                <div className="font-semibold">{client.name}</div>
                <Lines text={client.address} />
                {client.email && <div className="text-slate-600">{client.email}</div>}
                {client.phone && <div className="text-slate-600">{client.phone}</div>}
              </>
            ) : (
              <div className="text-slate-500">Unknown client</div>
            )}
          </div>
          <dl className="grid grid-cols-[auto_1fr] sm:justify-end gap-x-6 gap-y-1 m-0 sm:text-right">
            <dt className="text-slate-500">Issue date</dt>
            <dd className="m-0">{fmtDate(invoice.issueDate)}</dd>
            <dt className="text-slate-500">Due date</dt>
            <dd className="m-0">{fmtDate(invoice.dueDate)}</dd>
            <dt className="text-slate-500">Amount due</dt>
            <dd className="m-0 font-semibold">{money(status === 'paid' ? 0 : totals.total)}</dd>
          </dl>
        </section>

        <table className="mt-8 w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-900 text-left text-xs uppercase tracking-wide text-slate-600">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 font-medium text-right w-16">Qty</th>
              <th className="py-2 font-medium text-right w-28">Price</th>
              <th className="py-2 font-medium text-right w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id} className="border-b border-slate-200 align-top">
                <td className="py-2 pr-3 whitespace-pre-line">{it.description}</td>
                <td className="py-2 text-right tabular-nums">{it.quantity}</td>
                <td className="py-2 text-right tabular-nums">{money(it.unitPrice)}</td>
                <td className="py-2 text-right tabular-nums">{money(lineTotal(it))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-full sm:w-72 flex flex-col gap-1">
          <TotalRow label="Subtotal" value={money(totals.subtotal)} />
          {totals.discount > 0 && <TotalRow label={`Discount (${invoice.discountRate}%)`} value={`−${money(totals.discount)}`} />}
          {totals.tax > 0 && <TotalRow label={`Tax (${invoice.taxRate}%)`} value={money(totals.tax)} />}
          <div className="mt-1 pt-2 border-t-2 border-slate-900 flex justify-between font-semibold text-base">
            <span>Total</span>
            <span className="tabular-nums">{money(totals.total)}</span>
          </div>
        </div>

        {(settings.paymentInstructions || invoice.notes) && (
          <footer className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6 text-slate-600">
            {settings.paymentInstructions && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Payment</div>
                <Lines text={settings.paymentInstructions} />
              </div>
            )}
            {invoice.notes && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Notes</div>
                <Lines text={invoice.notes} />
              </div>
            )}
          </footer>
        )}
      </article>
    </>
  )
}

function Lines({ text }: { text: string }) {
  return text ? <div className="whitespace-pre-line text-slate-600">{text}</div> : null
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
