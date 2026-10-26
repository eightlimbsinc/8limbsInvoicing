import type { ReactNode } from 'react'
import { daysBetween, invoiceTotals, lineTotal, termsLabel } from '../lib/calc'
import { fmtDate, fmtMoney } from '../lib/format'
import type { BusinessInfo, Client, Invoice } from '../lib/types'

/**
 * The invoice as the client sees it — used in the app, the client share link
 * and print/PDF.
 */
export function InvoiceDocument({ invoice, client, business }: { invoice: Invoice; client: Client | undefined; business: BusinessInfo }) {
  const totals = invoiceTotals(invoice)
  const money = (n: number) => fmtMoney(n, invoice.currency)
  const paid = invoice.status === 'paid'
  const amountDue = paid ? 0 : totals.total
  const vars: Record<string, string> = {
    invoice_number: invoice.number,
    due_date: fmtDate(invoice.dueDate, 'long'),
    issue_date: fmtDate(invoice.issueDate, 'long'),
    amount_due: money(totals.total),
    client_name: client?.name ?? '',
    terms: termsLabel(daysBetween(invoice.issueDate, invoice.dueDate)),
    terms_days: String(daysBetween(invoice.issueDate, invoice.dueDate)),
  }

  return (
    <article className="invoice-doc bg-white text-[#222] font-invoice text-[14px] leading-snug px-4 py-8 sm:px-4 sm:py-10">
      <header className="flex items-end justify-end border-b border-[#222] pb-1 pt-6">
        {invoice.status === 'void' && <span className="mr-auto text-2xl font-bold text-red-600 tracking-wide">VOID</span>}
        <h2 className="m-0 text-[38px] leading-none font-bold tracking-tight">INVOICE</h2>
      </header>

      <section className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 py-6 border-b border-[#e5e5e5]">
        <div>{business.logo && <img src={business.logo} alt={business.businessName} className="max-h-[130px] max-w-[220px] object-contain" />}</div>
        <div className="sm:text-right">
          <div className="text-[20px]">{business.businessName}</div>
          <Muted text={business.address} />
          {business.email && <div className="text-[#666]">{business.email}</div>}
          {business.phone && <div className="text-[#666]">{business.phone}</div>}
          {business.website && <div className="text-[#666]">{business.website}</div>}
        </div>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-[1.5fr_0.7fr_1fr_1.4fr] gap-x-6 gap-y-5 pt-6 pb-8">
        <div className="col-span-2 sm:col-span-1">
          <Label>Billed to</Label>
          {client && <div className="text-[#666]">{client.name}</div>}
          {client?.email && <div className="text-[#666]">{client.email}</div>}
          {client && <Muted text={client.address} />}
        </div>
        <div className="sm:pt-[7px]">
          <Label>Invoice No</Label>
          <div className="text-[#666]">{invoice.number}</div>
        </div>
        <div className="sm:pt-[7px] flex flex-col gap-4">
          <div>
            <Label>Issue Date</Label>
            <div className="text-[#666]">{fmtDate(invoice.issueDate, 'long')}</div>
          </div>
          <div>
            <Label>Due Date</Label>
            <div className="text-[#666]">{fmtDate(invoice.dueDate, 'long')}</div>
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1 flex sm:justify-center sm:items-start sm:pt-6">
          {paid ? (
            <span className="inline-flex items-center rounded border-2 border-[#2fa84f] px-5 py-2 font-bold tracking-widest text-[#2fa84f]">PAID</span>
          ) : (
            invoice.paymentLink &&
            invoice.status !== 'void' && (
              <a
                href={invoice.paymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded bg-[#2fa84f] hover:bg-[#28923f] px-8 py-3 whitespace-nowrap text-white font-bold text-[14px] no-underline shadow-sm"
              >
                Pay Invoice Here {money(amountDue)}
              </a>
            )
          )}
        </div>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-[#3d8fd6] text-[12px] font-bold uppercase">
              <th className="py-2 text-left font-bold">Item Name</th>
              <th className="py-2 text-right font-bold w-24 sm:w-28">Price</th>
              <th className="py-2 text-center font-bold w-12 sm:w-20">Qty</th>
              <th className="hidden sm:table-cell py-2 text-left font-bold w-24 pl-4">Tax</th>
              <th className="py-2 text-right font-bold w-24 sm:w-32">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id} className="border-b border-[#ddd] align-top">
                <td className="py-3 pr-3">
                  <div className="whitespace-pre-line">{it.description}</div>
                  {it.details?.trim() && (
                    <div className="mt-1 text-[12.5px] leading-relaxed text-[#777] whitespace-pre-line">{withBold(it.details.trim())}</div>
                  )}
                </td>
                <td className="py-3 text-right tabular-nums">{money(it.unitPrice)}</td>
                <td className="py-3 text-center tabular-nums">{it.quantity}</td>
                <td className="hidden sm:table-cell py-3 pl-4">{it.taxRate ? `${it.taxRate}%` : '-'}</td>
                <td className="py-3 text-right tabular-nums">{money(lineTotal(it))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto w-full sm:w-[37%] mt-1">
        <TotalRow label="Subtotal" value={money(totals.subtotal)} />
        {totals.discount > 0 && <TotalRow label={`Discount (${invoice.discountRate}%)`} value={`−${money(totals.discount)}`} />}
        {totals.tax > 0 && <TotalRow label="Tax" value={money(totals.tax)} />}
        {paid && <TotalRow label="Paid" value={`−${money(totals.total)}`} />}
        <div className="flex justify-between items-baseline border-t border-[#ddd] mt-1 py-3 pl-4">
          <span className="text-[16px]">Amount Due ({invoice.currency})</span>
          <span className="font-bold tabular-nums">{money(amountDue)}</span>
        </div>
      </div>

      {invoice.notes.trim() && (
        <section className="mt-8">
          <div className="font-bold mb-4">Terms &amp; Notes:</div>
          <RichNotes text={invoice.notes} vars={vars} />
        </section>
      )}
    </article>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <div className="font-bold mb-0.5">{children}</div>
}

function Muted({ text }: { text: string }) {
  return text ? <div className="whitespace-pre-line text-[#666]">{text}</div> : null
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 pl-4">
      <span className="font-bold text-[13px]">{label}</span>
      <span className="text-[#3d8fd6] tabular-nums">{value}</span>
    </div>
  )
}

/**
 * Notes support **bold** and placeholders like {invoice_number}, so one
 * template works for every invoice (including recurring ones). Each line is
 * its own paragraph.
 */
export function RichNotes({ text, vars }: { text: string; vars: Record<string, string> }) {
  const filled = text.replace(/\{(\w+)\}/g, (m, key: string) => vars[key] ?? m)
  return (
    <div className="flex flex-col gap-3.5 leading-relaxed">
      {filled
        .split('\n')
        .filter((line) => line.trim())
        .map((line, i) => (
          <p key={i} className="m-0">
            {withBold(line)}
          </p>
        ))}
    </div>
  )
}

export const NOTES_HELP = 'One paragraph per line. **text** for bold. Placeholders: {invoice_number} {due_date} {issue_date} {amount_due} {client_name} {terms} (e.g. Net 30) {terms_days}'

/** Renders **bold** spans. "**Bank Name:**CIBC" reads as "Bank Name: CIBC". */
function withBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, j, parts) => {
    if (!(part.startsWith('**') && part.endsWith('**') && part.length > 4)) return part
    const label = part.slice(2, -2)
    const gap = label.endsWith(':') && /^\S/.test(parts[j + 1] ?? '') ? ' ' : ''
    return (
      <strong key={j}>
        {label}
        {gap}
      </strong>
    )
  })
}
