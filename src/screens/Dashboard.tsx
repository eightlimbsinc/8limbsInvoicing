import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Avatar, Button, EmptyState, PageHeader, StatusBadge } from '../components/ui'
import { displayStatus, round2, todayISO } from '../lib/calc'
import { fmtDate, fmtMoney } from '../lib/format'
import { navigate } from '../lib/router'
import { useInvoicing } from '../lib/store'
import type { DisplayStatus } from '../lib/types'

type Filter = 'all' | DisplayStatus
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
    (r) => (filter === 'all' ? r.status !== 'void' : r.status === filter) && (!q || r.inv.number.toLowerCase().includes(q) || r.client.toLowerCase().includes(q)),
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
            <input className="input sm:ml-auto sm:max-w-60" type="search" placeholder="Search number or customer" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {visible.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500 m-0">No invoices match.</p>
          ) : (
            <ul className="list-none m-0 p-0 divide-y divide-slate-100">
              {visible.map(({ inv, status, client }) => (
                <li key={inv.id}>
                  <a href={`#/invoices/${inv.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 no-underline text-inherit">
                    <Avatar name={client} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{inv.number}</span>
                        <StatusBadge status={status} />
                        {inv.recurringId && (
                          <span className="text-xs text-slate-400" title="Issued by a recurring invoice">
                            ↻
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500 truncate">{client}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium tabular-nums">{fmtMoney(inv.total, inv.currency)}</div>
                      <div className="text-xs text-slate-500">Due {fmtDate(inv.dueDate)}</div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
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
