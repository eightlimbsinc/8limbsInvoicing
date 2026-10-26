import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Avatar, Button, EmptyState, PageHeader, StatusBadge } from '../components/ui'
import { displayStatus, round2, todayISO } from '../lib/calc'
import { fmtDate, fmtMoney } from '../lib/format'
import { invoiceTitle } from '../lib/db'
import { navigate } from '../lib/router'
import { useInvoicing } from '../lib/store'
import type { DisplayStatus } from '../lib/types'

type Filter = 'all' | DisplayStatus
// Invoice Name | Invoice Number | Customer | Issue Date | Amount | Status
const COLUMNS = 'lg:grid-cols-[minmax(0,1.5fr)_120px_minmax(0,1fr)_110px_130px_90px]'

const FILTERS: Filter[] = ['all', 'draft', 'sent', 'overdue', 'paid', 'void']

export function Dashboard() {
  const invoices = useInvoicing((s) => s.invoices)
  const clients = useInvoicing((s) => s.clients)
  const currency = useInvoicing((s) => s.settings.currency)
  const isAdmin = useInvoicing((s) => s.isAdmin)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const today = todayISO()
    const clientName = new Map(clients.map((c) => [c.id, c.name]))
    return invoices
      .map((inv) => ({ inv, status: displayStatus(inv, today), client: clientName.get(inv.clientId) ?? '—' }))
      .sort((a, b) => b.inv.issueDate.localeCompare(a.inv.issueDate) || b.inv.number.localeCompare(a.inv.number))
  }, [invoices, clients])

  const stats = useMemo(() => {
    // Headline totals are in the default currency; invoices in other currencies are left out.
    const mine = rows.filter((r) => r.inv.currency === currency)
    const sum = (list: typeof rows) => round2(list.reduce((t, r) => t + r.inv.total, 0))
    const yearStart = `${todayISO().slice(0, 4)}-01-01`
    const overdue = mine.filter((r) => r.status === 'overdue')
    return {
      outstanding: sum(mine.filter((r) => r.status === 'sent' || r.status === 'overdue')),
      overdue: sum(overdue),
      overdueCount: overdue.length,
      paidYtd: sum(mine.filter((r) => r.status === 'paid' && (r.inv.paidAt ?? '').slice(0, 10) >= yearStart)),
      drafts: rows.filter((r) => r.status === 'draft').length,
    }
  }, [rows, currency])

  const q = query.trim().toLowerCase()
  const visible = rows.filter(
    // Voided invoices only appear under the Void filter.
    (r) => (filter === 'all' ? r.status !== 'void' : r.status === filter) && (!q || [invoiceTitle(r.inv), r.inv.number, r.client].some((t) => t.toLowerCase().includes(q))),
  )

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Every invoice you've issued, one-off and recurring"
        actions={
          <Button variant="primary" className="px-6" onClick={() => navigate('/invoices/new')}>
            + New invoice
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Outstanding" value={fmtMoney(stats.outstanding, currency)} />
        <Stat label="Overdue" value={fmtMoney(stats.overdue, currency)} sub={`${stats.overdueCount} invoice${stats.overdueCount === 1 ? '' : 's'}`} danger={stats.overdue > 0} />
        <Stat label="Paid this year" value={fmtMoney(stats.paidYtd, currency)} />
        <Stat label="Drafts" value={String(stats.drafts)} />
      </div>

      {invoices.length === 0 ? (
        <EmptyState title="No invoices yet">
          {isAdmin ? (
            <>
              Start with <a href="#/settings">your business details</a>, then create an invoice or set up a <a href="#/recurring">recurring invoice</a>.
            </>
          ) : (
            'Create your first invoice with “+ New invoice”.'
          )}
        </EmptyState>
      ) : (
        <div className="panel shadow-sm">
          <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-200">
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={clsx(
                    'px-2.5 py-1 rounded-md text-sm capitalize cursor-pointer border-0',
                    filter === f ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <input className="input sm:ml-auto sm:max-w-60" type="search" placeholder="Search name, number or customer" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {visible.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500 m-0">No invoices match.</p>
          ) : (
            <>
              <div
                className={clsx(
                  'hidden lg:grid gap-4 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-600',
                  COLUMNS,
                )}
              >
                <span className="pl-12">Invoice Name</span>
                <span>Invoice Number</span>
                <span>Customer</span>
                <span>Issue Date</span>
                <span className="text-right">Amount</span>
                <span>Status</span>
              </div>
              <ul className="list-none m-0 p-0 divide-y divide-slate-100">
                {visible.map(({ inv, status, client }) => (
                  <li key={inv.id}>
                    <a
                      href={`#/invoices/${inv.id}`}
                      className={clsx(
                        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50 no-underline text-inherit',
                        COLUMNS,
                      )}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span
                          className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-slate-100 text-slate-500"
                          title={inv.recurringId ? 'Recurring invoice' : 'One-off invoice'}
                        >
                          {inv.recurringId ? <RecurringIcon /> : <DocumentIcon />}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold truncate" title={invoiceTitle(inv)}>
                            {invoiceTitle(inv)}
                          </span>
                          {/* On smaller screens the customer sits under the name. */}
                          <span className="lg:hidden block text-sm text-slate-500 truncate">{client}</span>
                        </span>
                      </span>
                      <span className="hidden lg:block text-sm text-slate-600">{inv.number}</span>
                      <span className="hidden lg:flex items-center gap-2.5 min-w-0 text-sm text-slate-600">
                        <Avatar name={client} />
                        <span className="truncate">{client}</span>
                      </span>
                      <span className="hidden lg:block text-sm text-slate-600">{fmtDate(inv.issueDate)}</span>
                      <span className="text-right">
                        <span className="block font-semibold tabular-nums">{fmtMoney(inv.total, inv.currency)}</span>
                        <span className="block text-xs text-slate-500">Due {fmtDate(inv.dueDate)}</span>
                      </span>
                      <span className="hidden lg:block">
                        <StatusBadge status={status} />
                      </span>
                      <span className="lg:hidden col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1 pl-12 text-xs text-slate-500">
                        {inv.number} · Issued {fmtDate(inv.issueDate)} <StatusBadge status={status} />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  )
}

function Stat({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div className="panel p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={clsx('mt-1 text-lg font-semibold tabular-nums', danger && 'text-red-700')}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

function RecurringIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M9 10h6M9 14h6" />
    </svg>
  )
}
