import { useId, useMemo, useState } from 'react'
import { BillingEditor, ClientPicker } from '../components/BillingEditor'
import { Button, EmptyState, ErrorBanner, Field, PageHeader, StatusBadge } from '../components/ui'
import { addDays, displayStatus, frequencyLabel, nextIssueDate, recurringIssueDate, termsLabel, todayISO } from '../lib/calc'
import { errorMessage, fmtDate, fmtMoney, numValue } from '../lib/format'
import { navigate } from '../lib/router'
import { type RecurringDraft, uid, useInvoicing } from '../lib/store'
import type { IntervalUnit } from '../lib/types'
import { TermsSelect } from './InvoiceEditor'

const FREQUENCIES: { label: string; unit: IntervalUnit; count: number }[] = [
  { label: 'Every week', unit: 'week', count: 1 },
  { label: 'Every 2 weeks', unit: 'week', count: 2 },
  { label: 'Every month', unit: 'month', count: 1 },
  { label: 'Every quarter', unit: 'month', count: 3 },
  { label: 'Every 6 months', unit: 'month', count: 6 },
  { label: 'Every year', unit: 'year', count: 1 },
]

type Ends = 'never' | 'date' | 'count'

export function RecurringEditor({ id, fromId }: { id?: string; fromId?: string }) {
  const existing = useInvoicing((s) => (id ? s.recurring.find((r) => r.id === id) : undefined))
  const invoices = useInvoicing((s) => s.invoices)
  const issued = useMemo(() => (id ? invoices.filter((i) => i.recurringId === id) : []), [invoices, id])
  const clients = useInvoicing((s) => s.clients)
  const saveRecurring = useInvoicing((s) => s.saveRecurring)

  const [draft, setDraft] = useState<RecurringDraft | undefined>(() => {
    if (existing) return { ...existing, startDate: nextIssueDate(existing) }
    if (id) return undefined
    const blank = useInvoicing.getState().blankRecurring()
    const src = fromId ? useInvoicing.getState().recurring.find((r) => r.id === fromId) : undefined
    if (!src) return blank
    return {
      ...blank,
      ...src,
      id: undefined,
      name: `Copy of ${src.name}`,
      status: 'active',
      startDate: nextIssueDate(src) < todayISO() ? todayISO() : nextIssueDate(src),
      periodIndex: 0,
      items: src.items.map((it) => ({ ...it, id: uid() })),
    }
  })
  const [customFreq, setCustomFreq] = useState(false)
  const [ends, setEnds] = useState<Ends>(() => (draft?.endDate ? 'date' : draft?.maxOccurrences ? 'count' : 'never'))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ids = { freq: useId(), terms: useId(), ends: useId() }

  if (!draft) return <EmptyState title="Recurring invoice not found" />

  const patch = (p: Partial<RecurringDraft>) => {
    setError('')
    setDraft((d) => d && { ...d, ...p })
  }
  const preset = FREQUENCIES.find((f) => f.unit === draft.intervalUnit && f.count === draft.intervalCount)
  const freq = customFreq ? undefined : preset
  const locked = draft.status === 'cancelled' || draft.status === 'completed'
  const today = todayISO()

  // Upcoming issue dates, honouring the end condition.
  const already = existing?.generatedCount ?? 0
  const upcoming: string[] = []
  let catchUp = 0
  for (let p = 0; p < 1000; p++) {
    const d = recurringIssueDate(draft.startDate, draft.intervalUnit, draft.intervalCount, p)
    if (ends === 'date' && draft.endDate && d > draft.endDate) break
    if (ends === 'count' && draft.maxOccurrences && already + p >= draft.maxOccurrences) break
    if (d <= today) catchUp++
    else if (upcoming.length >= 4) break
    if (upcoming.length < 4) upcoming.push(d)
  }

  const save = async () => {
    if (!draft.name.trim()) return setError('Give the recurring invoice a name.')
    if (!draft.clientId) return setError('Choose a customer.')
    const items = draft.items.filter((it) => it.description.trim() || it.unitPrice)
    if (items.length === 0) return setError('Add at least one line item.')
    if (ends === 'date' && !draft.endDate) return setError('Pick an end date or choose “Never”.')
    if (ends === 'count' && !draft.maxOccurrences) return setError('Enter how many invoices to issue or choose “Never”.')
    if (catchUp > 1 && !confirm(`The first date is in the past: ${catchUp} invoices will be issued right away for the missed periods. Continue?`)) return

    const scheduleChanged =
      !existing ||
      draft.startDate !== nextIssueDate(existing) ||
      draft.intervalUnit !== existing.intervalUnit ||
      draft.intervalCount !== existing.intervalCount
    setBusy(true)
    try {
      await saveRecurring(
        { ...draft, items, endDate: ends === 'date' ? draft.endDate : null, maxOccurrences: ends === 'count' ? draft.maxOccurrences : null },
        scheduleChanged,
      )
      navigate('/recurring', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {existing ? existing.name : 'New recurring invoice'}
            {existing && <StatusBadge status={existing.status} />}
          </span>
        }
        subtitle={existing ? `${existing.generatedCount} invoice${existing.generatedCount === 1 ? '' : 's'} issued so far` : undefined}
        actions={
          <>
            <Button onClick={() => navigate('/recurring')}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy || locked}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      />
      <ErrorBanner error={error} />
      {locked && <p className="-mt-2 mb-4 text-sm text-slate-500">This schedule is {draft.status} — duplicate it to start a new one.</p>}

      <div className="flex flex-col gap-5">
        <div className="panel p-4 sm:p-5 flex flex-col gap-4">
          <h2 className="text-base font-semibold m-0">Schedule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="Name (internal)">
              <input className="input" placeholder="e.g. 8 Limbs Retainer – Blend 360" value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>
            <ClientPicker value={draft.clientId} onChange={(clientId) => patch({ clientId })} />
            <Field label="Frequency" htmlFor={ids.freq}>
              <div className="flex gap-2">
                <select
                  id={ids.freq}
                  className="input"
                  value={freq ? FREQUENCIES.indexOf(freq) : 'custom'}
                  onChange={(e) => {
                    const f = FREQUENCIES[Number(e.target.value)]
                    setCustomFreq(!f)
                    if (f) patch({ intervalUnit: f.unit, intervalCount: f.count })
                  }}
                >
                  {FREQUENCIES.map((f, i) => (
                    <option key={f.label} value={i}>
                      {f.label}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
              </div>
              {!freq && (
                <div className="flex items-center gap-2 mt-2 text-sm">
                  Every
                  <input
                    className="input w-20"
                    type="number"
                    min="1"
                    max="36"
                    aria-label="Interval"
                    value={draft.intervalCount}
                    onChange={(e) => patch({ intervalCount: Math.min(36, Math.max(1, Math.floor(Number(e.target.value) || 1))) })}
                  />
                  <select className="input w-28" value={draft.intervalUnit} aria-label="Unit" onChange={(e) => patch({ intervalUnit: e.target.value as IntervalUnit })}>
                    <option value="week">weeks</option>
                    <option value="month">months</option>
                    <option value="year">years</option>
                  </select>
                </div>
              )}
            </Field>
            <Field label={existing ? 'Next issue date' : 'First invoice date'}>
              <input className="input" type="date" value={draft.startDate} onChange={(e) => e.target.value && patch({ startDate: e.target.value })} />
            </Field>
            <Field label="Payment terms" htmlFor={ids.terms}>
              <TermsSelect id={ids.terms} days={draft.paymentTermsDays} onChange={(paymentTermsDays) => patch({ paymentTermsDays })} />
            </Field>
            <Field label="Ends" htmlFor={ids.ends}>
              <div className="flex gap-2">
                <select id={ids.ends} className="input" value={ends} onChange={(e) => setEnds(e.target.value as Ends)}>
                  <option value="never">Never</option>
                  <option value="date">On date</option>
                  <option value="count">After # invoices</option>
                </select>
                {ends === 'date' && (
                  <input className="input" type="date" aria-label="End date" value={draft.endDate ?? ''} onChange={(e) => patch({ endDate: e.target.value || null })} />
                )}
                {ends === 'count' && (
                  <input
                    className="input w-24"
                    type="number"
                    min="1"
                    aria-label="Number of invoices"
                    value={numValue(draft.maxOccurrences)}
                    onChange={(e) => patch({ maxOccurrences: Math.max(0, Math.floor(Number(e.target.value) || 0)) || null })}
                  />
                )}
              </div>
            </Field>
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={draft.autoSend} onChange={(e) => patch({ autoSend: e.target.checked })} />
            <span>
              Mark generated invoices as <b>sent</b> so the client link works immediately
              <span className="block text-slate-500">Unchecked: they're created as drafts for you to review first.</span>
            </span>
          </label>
          <div className="rounded-md bg-slate-50 ring-1 ring-slate-200 p-3 text-sm">
            <div className="font-medium mb-1">
              {frequencyLabel(draft.intervalUnit, draft.intervalCount)} · {termsLabel(draft.paymentTermsDays)}
            </div>
            {upcoming.length === 0 ? (
              <span className="text-slate-500">No more invoices will be issued with this end condition.</span>
            ) : (
              <ul className="m-0 pl-4 text-slate-600">
                {upcoming.map((d) => (
                  <li key={d}>
                    Issued {fmtDate(d)} → due {fmtDate(addDays(d, draft.paymentTermsDays))}
                    {d <= today && <span className="text-amber-700"> (issued on save)</span>}
                  </li>
                ))}
              </ul>
            )}
            <p className="m-0 mt-2 text-xs text-slate-500">
              Invoices are generated automatically every hour by the database, using the time zone in Settings.
            </p>
          </div>
        </div>

        <div className="panel p-4 sm:p-5 flex flex-col gap-5">
          <h2 className="text-base font-semibold m-0">Invoice content</h2>
          <BillingEditor value={draft} onChange={patch} />
        </div>

        {issued.length > 0 && (
          <div className="panel">
            <h2 className="text-base font-semibold m-0 px-4 pt-4 pb-2">Issued invoices</h2>
            <ul className="list-none m-0 p-0 divide-y divide-slate-100">
              {[...issued]
                .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
                .map((inv) => (
                  <li key={inv.id}>
                    <a href={`#/invoices/${inv.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 no-underline text-inherit text-sm">
                      <span className="font-medium w-28">{inv.number}</span>
                      <StatusBadge status={displayStatus(inv)} />
                      <span className="ml-auto text-slate-500">{fmtDate(inv.issueDate)}</span>
                      <span className="w-28 text-right tabular-nums">{fmtMoney(inv.total, inv.currency)}</span>
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        )}
        {clients.length === 0 && <p className="text-sm text-slate-500">Tip: add a customer with the + button next to Customer.</p>}
      </div>
    </>
  )
}
