import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Avatar, Button, ErrorBanner, PageHeader, StatusBadge } from '../components/ui'
import { frequencyLabel, nextIssueDate, termsLabel } from '../lib/calc'
import { errorMessage, fmtDate, fmtMoney } from '../lib/format'
import { navigate } from '../lib/router'
import { useInvoicing } from '../lib/store'
import type { Recurring, RecurringStatus } from '../lib/types'

const STATUS_FILTERS: ('all' | RecurringStatus)[] = ['all', 'active', 'paused', 'cancelled', 'completed']

export function RecurringList() {
  const recurring = useInvoicing((s) => s.recurring)
  const clients = useInvoicing((s) => s.clients)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | RecurringStatus>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [error, setError] = useState('')

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? '—'
  const q = query.trim().toLowerCase()
  const rows = recurring.filter(
    (r) => (status === 'all' || r.status === status) && (!q || r.name.toLowerCase().includes(q) || clientName(r.clientId).toLowerCase().includes(q)),
  )

  return (
    <>
      <PageHeader
        title="Recurring Invoices"
        subtitle="Automatically issue invoices to customers at a scheduled frequency"
        actions={
          <>
            <Button onClick={() => navigate('/settings')}>⚙ Settings</Button>
            <Button variant="primary" className="px-8" onClick={() => navigate('/recurring/new')}>
              + New
            </Button>
          </>
        }
      />
      <ErrorBanner error={error} />

      <div className="panel shadow-sm">
        <div className="flex flex-wrap justify-end gap-2 p-3">
          <input className="input sm:max-w-60" type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Button onClick={() => setShowFilters((v) => !v)}>
            ☰ Filters{status !== 'all' && ` (${status})`}
          </Button>
          {showFilters && (
            <div className="basis-full flex flex-wrap justify-end gap-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatus(f)}
                  className={clsx(
                    'px-2.5 py-1 rounded-md text-sm capitalize cursor-pointer border-0',
                    status === f ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-left text-xs text-slate-600">
                <th className="font-medium px-6 py-3">Recurring Invoice Name</th>
                <th className="font-medium px-3 py-3">Customer</th>
                <th className="font-medium px-3 py-3">Last Issued On</th>
                <th className="font-medium px-3 py-3">Next Issue</th>
                <th className="font-medium px-3 py-3">Frequency</th>
                <th className="font-medium px-3 py-3">Amount</th>
                <th className="font-medium px-3 py-3">Status</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                    {recurring.length === 0 ? 'No recurring invoices yet. Click “+ New” to schedule one.' : 'Nothing matches.'}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-200 hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/recurring/${r.id}`)}>
                  <td className="px-6 py-5 font-semibold">{r.name}</td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-3 text-slate-600">
                      <Avatar name={clientName(r.clientId)} />
                      {clientName(r.clientId)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{r.lastIssuedOn ? fmtDate(r.lastIssuedOn) : '—'}</td>
                  <td className="px-3 py-3 text-slate-600">{r.status === 'active' || r.status === 'paused' ? fmtDate(nextIssueDate(r)) : '—'}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {frequencyLabel(r.intervalUnit, r.intervalCount)}
                    <div className="text-xs text-slate-400">{termsLabel(r.paymentTermsDays)}</div>
                  </td>
                  <td className="px-3 py-3 font-semibold tabular-nums">{fmtMoney(r.total, r.currency)}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-2" onClick={(e) => e.stopPropagation()}>
                    <RowMenu r={r} onError={setError} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function RowMenu({ r, onError }: { r: Recurring; onError: (msg: string) => void }) {
  const setRecurringStatus = useInvoicing((s) => s.setRecurringStatus)
  const deleteRecurring = useInvoicing((s) => s.deleteRecurring)
  // Fixed-position menu so the table's horizontal scroll container can't clip it.
  const [open, setOpen] = useState<{ top: number; right: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => ref.current && !ref.current.contains(e.target as Node) && setOpen(null)
    const dismiss = () => setOpen(null)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [open])

  const act = (fn: () => Promise<unknown> | void) => () => {
    setOpen(null)
    onError('')
    Promise.resolve(fn()).catch((e) => onError(errorMessage(e)))
  }

  const items: [string, () => void, boolean?][] = [
    ['Edit', act(() => navigate(`/recurring/${r.id}`))],
    ['Duplicate', act(() => navigate(`/recurring/new?from=${r.id}`))],
  ]
  if (r.status === 'active') items.push(['Pause', act(() => setRecurringStatus(r.id, 'paused'))])
  if (r.status === 'paused') items.push(['Resume', act(() => setRecurringStatus(r.id, 'active'))])
  if (r.status === 'active' || r.status === 'paused')
    items.push(['Cancel schedule', act(() => (confirm(`Cancel “${r.name}”? No further invoices will be issued.`) ? setRecurringStatus(r.id, 'cancelled') : undefined)), true])
  items.push([
    'Delete',
    act(() => (confirm(`Delete “${r.name}”? Invoices it already issued are kept.`) ? deleteRecurring(r.id) : undefined)),
    true,
  ])

  return (
    <div ref={ref}>
      <button
        type="button"
        aria-label="Actions"
        className="w-8 h-8 rounded-md border-0 bg-transparent hover:bg-slate-200 cursor-pointer text-lg leading-none"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          setOpen((v) => (v ? null : { top: rect.bottom + 4, right: window.innerWidth - rect.right }))
        }}
      >
        ⋮
      </button>
      {open && (
        <div className="fixed z-30 w-44 panel shadow-lg py-1" style={open}>
          {items.map(([label, fn, danger]) => (
            <button
              key={label}
              type="button"
              onClick={fn}
              className={clsx('block w-full text-left px-3 py-2 text-sm border-0 bg-transparent hover:bg-slate-100 cursor-pointer', danger && 'text-red-700')}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
