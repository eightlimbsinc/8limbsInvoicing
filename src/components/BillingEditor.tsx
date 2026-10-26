import { useId, useState } from 'react'
import { invoiceTotals, lineTotal } from '../lib/calc'
import { fmtMoney, numValue, toNum } from '../lib/format'
import { useInvoicing } from '../lib/store'
import type { BillingContent, LineItem } from '../lib/types'
import { ClientDialog } from './ClientDialog'
import { NOTES_HELP } from './InvoiceDocument'
import { Button, Field } from './ui'

export function ClientPicker({ value, onChange }: { value: string; onChange: (clientId: string) => void }) {
  const clients = useInvoicing((s) => s.clients)
  const [adding, setAdding] = useState(false)
  const id = useId()
  return (
    <>
      <Field label="Customer" htmlFor={id}>
        <div className="flex gap-2">
          <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button onClick={() => setAdding(true)} aria-label="Add customer" title="Add customer">
            +
          </Button>
        </div>
      </Field>
      {adding && (
        <ClientDialog
          onClose={(saved) => {
            setAdding(false)
            if (saved) onChange(saved.id)
          }}
        />
      )}
    </>
  )
}

/** Line items, discount, totals, payment link and notes. */
export function BillingEditor<T extends BillingContent>({ value, onChange }: { value: T; onChange: (patch: Partial<BillingContent>) => void }) {
  const blankLine = useInvoicing((s) => s.blankLine)
  const totals = invoiceTotals(value)
  const money = (n: number) => fmtMoney(n, value.currency)
  const [openDetails, setOpenDetails] = useState<Set<string>>(() => new Set())
  const patchItem = (id: string, p: Partial<LineItem>) => onChange({ items: value.items.map((it) => (it.id === id ? { ...it, ...p } : it)) })

  return (
    <>
      <div>
        <div className="hidden sm:grid grid-cols-[1fr_80px_120px_80px_110px_36px] gap-2 text-xs font-medium text-slate-600 mb-1">
          <span>Item name</span>
          <span>Qty</span>
          <span>Price</span>
          <span>Tax %</span>
          <span className="text-right">Subtotal</span>
          <span />
        </div>
        <div className="flex flex-col gap-3 sm:gap-2">
          {value.items.map((it) => (
            <div key={it.id} className="border-b border-slate-100 pb-3 sm:border-0 sm:pb-0">
              <div className="grid grid-cols-[1fr_1fr_1fr_36px] sm:grid-cols-[1fr_80px_120px_80px_110px_36px] gap-2 items-center">
                <input
                  className="input col-span-4 sm:col-span-1"
                  placeholder="Item name"
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
                  aria-label="Price"
                  value={numValue(it.unitPrice)}
                  onChange={(e) => patchItem(it.id, { unitPrice: toNum(e.target.value) })}
                />
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="Tax %"
                  aria-label="Tax %"
                  value={numValue(it.taxRate)}
                  onChange={(e) => patchItem(it.id, { taxRate: toNum(e.target.value) })}
                />
                <span className="hidden sm:block text-right text-sm tabular-nums">{money(lineTotal(it))}</span>
                <Button
                  variant="ghost"
                  className="!px-0 w-9 row-start-2 col-start-4 sm:row-start-auto sm:col-start-auto"
                  aria-label="Remove line"
                  title="Remove line"
                  disabled={value.items.length === 1}
                  onClick={() => onChange({ items: value.items.filter((x) => x.id !== it.id) })}
                >
                  ✕
                </Button>
              </div>
              {it.details || openDetails.has(it.id) ? (
                <div className="mt-2 sm:mr-[calc(110px+36px+1rem)]">
                  <textarea
                    className="input text-sm"
                    rows={3}
                    placeholder="Description shown under the item on the invoice (optional). **text** for bold."
                    aria-label={`Description for ${it.description || 'item'}`}
                    autoFocus={!it.details}
                    value={it.details}
                    onChange={(e) => patchItem(it.id, { details: e.target.value })}
                  />
                  <button
                    type="button"
                    className="mt-0.5 bg-transparent border-0 p-0 text-xs text-red-700 cursor-pointer"
                    onClick={() => {
                      setOpenDetails((s) => new Set([...s].filter((x) => x !== it.id)))
                      patchItem(it.id, { details: '' })
                    }}
                  >
                    Remove description
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="mt-1 bg-transparent border-0 p-0 text-xs text-blue-700 cursor-pointer"
                  onClick={() => setOpenDetails((s) => new Set(s).add(it.id))}
                >
                  + Add description
                </button>
              )}
            </div>
          ))}
        </div>
        <Button variant="ghost" className="mt-2 !px-2" onClick={() => onChange({ items: [...value.items, blankLine()] })}>
          + Add line
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-5">
        <div className="flex flex-col gap-3">
          <Field label="Payment link (shows a “Pay Invoice Here” button)">
            <input
              className="input"
              type="url"
              placeholder="https://wise.com/pay/… or Stripe/PayPal link"
              value={value.paymentLink}
              onChange={(e) => onChange({ paymentLink: e.target.value })}
            />
          </Field>
          <Field label="Terms & notes">
            <textarea className="input font-mono text-[13px]" rows={8} value={value.notes} onChange={(e) => onChange({ notes: e.target.value })} />
            <span className="block mt-1 text-xs text-slate-500">{NOTES_HELP}</span>
          </Field>
        </div>
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
                value={numValue(value.discountRate)}
                placeholder="0"
                onChange={(e) => onChange({ discountRate: Math.min(100, toNum(e.target.value)) })}
              />
            </Field>
            <Field label="Currency">
              <input
                className="input uppercase"
                maxLength={3}
                value={value.currency}
                onChange={(e) => onChange({ currency: e.target.value.toUpperCase() })}
              />
            </Field>
          </div>
          <Row label="Subtotal" value={money(totals.subtotal)} />
          {totals.discount > 0 && <Row label="Discount" value={`−${money(totals.discount)}`} />}
          {totals.tax > 0 && <Row label="Tax" value={money(totals.tax)} />}
          <div className="border-t border-slate-200 pt-2">
            <Row label={`Amount due (${value.currency})`} value={money(totals.total)} strong />
          </div>
        </div>
      </div>
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
