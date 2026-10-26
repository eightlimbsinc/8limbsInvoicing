import { useId, useState } from 'react'
import { BillingEditor, ClientPicker } from '../components/BillingEditor'
import { errorMessage } from '../lib/format'
import { Button, EmptyState, ErrorBanner, Field, PageHeader } from '../components/ui'
import { TERMS_PRESETS, addDays, daysBetween, termsLabel } from '../lib/calc'
import { invoiceTitle } from '../lib/db'
import { navigate } from '../lib/router'
import { type InvoiceDraft, useInvoicing } from '../lib/store'

export function InvoiceEditor({ id }: { id?: string }) {
  const existing = useInvoicing((s) => (id ? s.invoices.find((i) => i.id === id) : undefined))
  const saveInvoice = useInvoicing((s) => s.saveInvoice)
  const hasInvoiceNames = useInvoicing((s) => s.hasInvoiceNames)
  const [draft, setDraft] = useState<InvoiceDraft | undefined>(() => existing ?? (id ? undefined : useInvoicing.getState().blankInvoice()))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const termsId = useId()

  if (!draft) return <EmptyState title="Invoice not found" />

  const patch = (p: Partial<InvoiceDraft>) => {
    setError('')
    setDraft((d) => d && { ...d, ...p })
  }
  const terms = daysBetween(draft.issueDate, draft.dueDate)

  const save = async () => {
    if (!draft.clientId) return setError('Choose a customer.')
    const items = draft.items.filter((it) => it.description.trim() || it.unitPrice)
    if (items.length === 0) return setError('Add at least one line item.')
    if (draft.dueDate < draft.issueDate) return setError('Due date can’t be before the issue date.')
    if (draft.id && !draft.number?.trim()) return setError('Invoice number can’t be empty.')
    setBusy(true)
    try {
      const saved = await saveInvoice({ ...draft, items })
      navigate(`/invoices/${saved.id}`, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title={draft.id ? `Edit ${existing ? invoiceTitle(existing) : ''} · ${existing?.number}` : 'New invoice'}
        subtitle={draft.id ? undefined : 'The invoice number is assigned automatically when you save.'}
        actions={
          <>
            <Button onClick={() => navigate(id ? `/invoices/${id}` : '/')}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      />
      <ErrorBanner error={error} />

      <div className="panel p-4 sm:p-5 flex flex-col gap-5">
        {hasInvoiceNames && (
          <Field label="Invoice name">
            <input
              className="input"
              placeholder="e.g. Podcast Services"
              value={draft.name ?? ''}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ClientPicker value={draft.clientId} onChange={(clientId) => patch({ clientId })} />
          {draft.id ? (
            <Field label="Invoice no">
              <input className="input" value={draft.number ?? ''} onChange={(e) => patch({ number: e.target.value })} />
            </Field>
          ) : (
            <Field label="Payment terms" htmlFor={termsId}>
              <TermsSelect id={termsId} days={terms} onChange={(d) => patch({ dueDate: addDays(draft.issueDate, d) })} />
            </Field>
          )}
          <Field label="Issue date">
            <input
              className="input"
              type="date"
              value={draft.issueDate}
              // Keep the payment terms when the issue date moves.
              onChange={(e) => e.target.value && patch({ issueDate: e.target.value, dueDate: addDays(e.target.value, Math.max(0, terms)) })}
            />
          </Field>
          <Field label={`Due date (${terms >= 0 ? termsLabel(terms) : 'invalid'})`}>
            <input className="input" type="date" value={draft.dueDate} onChange={(e) => e.target.value && patch({ dueDate: e.target.value })} />
          </Field>
        </div>
        <BillingEditor value={draft} onChange={patch} />
      </div>
    </>
  )
}

export function TermsSelect({ id, days, onChange }: { id?: string; days: number; onChange: (days: number) => void }) {
  const [customPicked, setCustom] = useState(false)
  const custom = customPicked || !TERMS_PRESETS.includes(days)
  return (
    <div className="flex gap-2">
      <select
        id={id}
        className="input"
        value={custom ? 'custom' : days}
        onChange={(e) => {
          setCustom(e.target.value === 'custom')
          if (e.target.value !== 'custom') onChange(Number(e.target.value))
        }}
      >
        {TERMS_PRESETS.map((d) => (
          <option key={d} value={d}>
            {termsLabel(d)}
          </option>
        ))}
        <option value="custom">Custom…</option>
      </select>
      {custom && (
        <input
          className="input w-24"
          type="number"
          min="0"
          aria-label="Days"
          value={days}
          onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        />
      )}
    </div>
  )
}
