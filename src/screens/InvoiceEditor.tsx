import { useState } from 'react'
import { ClientDialog } from '../components/ClientDialog'
import { Button, EmptyState, Field, PageHeader } from '../components/ui'
import { addDays, daysBetween, invoiceTotals, lineTotal } from '../lib/calc'
import { fmtMoney } from '../lib/format'
import { navigate } from '../lib/router'
import { type InvoiceDraft, uid, useInvoicing } from '../lib/store'
import type { Invoice, LineItem } from '../lib/types'

/** Shows blank for 0 so typing doesn't start with a stray "0". */
const numValue = (n: number) => (n === 0 ? '' : n)
const toNum = (v: string) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

export function InvoiceEditor({ id }: { id?: string }) {
  const existing = useInvoicing((s) => (id ? s.invoices.find((i) => i.id === id) : undefined))
  const clients = useInvoicing((s) => s.clients)
  const settings = useInvoicing((s) => s.settings)
  const createInvoice = useInvoicing((s) => s.createInvoice)
  const updateInvoice = useInvoicing((s) => s.updateInvoice)
  const [draft, setDraft] = useState<InvoiceDraft | Invoice | undefined>(() => existing ?? (id ? undefined : useInvoicing.getState().blankDraft()))
  const [clientDialog, setClientDialog] = useState(false)
  const [error, setError] = useState('')

  if (!draft) return <EmptyState title="Invoice not found" />

  const patch = (p: Partial<InvoiceDraft>) => setDraft((d) => d && { ...d, ...p })
  const patchItem = (itemId: string, p: Partial<LineItem>) => patch({ items: draft.items.map((it) => (it.id === itemId ? { ...it, ...p } : it)) })
  const totals = invoiceTotals(draft)
  const title = 'number' in draft ? `Edit ${draft.number}` : 'New invoice'

  const save = () => {
    if (!draft.clientId) return setError('Choose a client.')
    const items = draft.items.filter((it) => it.description.trim() || it.unitPrice)
    if (items.length === 0) return setError('Add at least one line item.')
    if (draft.dueDate < draft.issueDate) return setError('Due date can’t be before the issue date.')
    const clean = { ...draft, items }
    if ('id' in clean) {
      updateInvoice(clean)
      navigate(`/invoices/${clean.id}`, { replace: true })
    } else {
      navigate(`/invoices/${createInvoice(clean)}`, { replace: true })
    }
  }

  return (
    <>
      <PageHeader
        title={title}
        actions={
          <>
            <Button onClick={() => navigate(id ? `/invoices/${id}` : '/')}>Cancel</Button>
            <Button variant="primary" onClick={save}>
              Save
            </Button>
          </>
        }
      />

      {error && <div className="mb-4 rounded-md bg-red-50 text-red-800 text-sm px-3 py-2 ring-1 ring-red-200">{error}</div>}

      <div className="panel p-4 sm:p-5 flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Client" className="sm:col-span-1">
            <div className="flex gap-2">
              <select
                className="input"
                value={draft.clientId}
                onChange={(e) => {
                  setError('')
                  patch({ clientId: e.target.value })
                }}
              >
                <option value="">Select…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button onClick={() => setClientDialog(true)} aria-label="Add client" title="Add client">
                +
              </Button>
            </div>
          </Field>
          <Field label="Issue date">
            <input
              className="input"
              type="date"
              value={draft.issueDate}
              onChange={(e) => {
                const issueDate = e.target.value
                // Keep the payment term when the issue date moves.
                patch(issueDate ? { issueDate, dueDate: addDays(issueDate, daysBetween(draft.issueDate, draft.dueDate)) } : {})
              }}
            />
          </Field>
          <Field label="Due date">
            <input className="input" type="date" value={draft.dueDate} onChange={(e) => e.target.value && patch({ dueDate: e.target.value })} />
          </Field>
        </div>

        <div>
          <div className="hidden sm:grid grid-cols-[1fr_90px_120px_110px_36px] gap-2 text-xs font-medium text-slate-600 mb-1">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit price</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          <div className="flex flex-col gap-3 sm:gap-2">
            {draft.items.map((it) => (
              <div key={it.id} className="grid grid-cols-[1fr_1fr_36px] sm:grid-cols-[1fr_90px_120px_110px_36px] gap-2 items-center border-b border-slate-100 pb-3 sm:border-0 sm:pb-0">
                <input
                  className="input col-span-3 sm:col-span-1"
                  placeholder="Description"
                  value={it.description}
                  onChange={(e) => patchItem(it.id, { description: e.target.value })}
                />
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="Qty"
                  aria-label="Quantity"
                  value={numValue(it.quantity)}
                  onChange={(e) => patchItem(it.id, { quantity: toNum(e.target.value) })}
                />
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  aria-label="Unit price"
                  value={numValue(it.unitPrice)}
                  onChange={(e) => patchItem(it.id, { unitPrice: toNum(e.target.value) })}
                />
                <span className="hidden sm:block text-right text-sm tabular-nums">{fmtMoney(lineTotal(it), settings.currency)}</span>
                <Button
                  variant="ghost"
                  className="!px-0 w-9"
                  aria-label="Remove line"
                  title="Remove line"
                  disabled={draft.items.length === 1}
                  onClick={() => patch({ items: draft.items.filter((x) => x.id !== it.id) })}
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            className="mt-2 !px-2"
            onClick={() => patch({ items: [...draft.items, { id: uid(), description: '', quantity: 1, unitPrice: 0 }] })}
          >
            + Add line
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-5">
          <Field label="Notes (shown on invoice)">
            <textarea className="input" rows={4} value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} />
          </Field>
          <div className="flex flex-col gap-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Discount %">
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="any"
                  value={numValue(draft.discountRate)}
                  placeholder="0"
                  onChange={(e) => patch({ discountRate: Math.min(100, toNum(e.target.value)) })}
                />
              </Field>
              <Field label="Tax %">
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={numValue(draft.taxRate)}
                  placeholder="0"
                  onChange={(e) => patch({ taxRate: toNum(e.target.value) })}
                />
              </Field>
            </div>
            <Row label="Subtotal" value={fmtMoney(totals.subtotal, settings.currency)} />
            {totals.discount > 0 && <Row label="Discount" value={`−${fmtMoney(totals.discount, settings.currency)}`} />}
            {totals.tax > 0 && <Row label="Tax" value={fmtMoney(totals.tax, settings.currency)} />}
            <div className="border-t border-slate-200 pt-2">
              <Row label="Total" value={fmtMoney(totals.total, settings.currency)} strong />
            </div>
          </div>
        </div>
      </div>

      {clientDialog && (
        <ClientDialog
          onClose={(saved) => {
            setClientDialog(false)
            if (saved) {
              setError('')
              patch({ clientId: saved.id })
            }
          }}
        />
      )}
    </>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between font-semibold text-base' : 'flex justify-between text-slate-600'}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
