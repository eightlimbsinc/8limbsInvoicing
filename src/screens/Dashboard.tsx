import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Button, EmptyState, PageHeader, StatusBadge } from '../components/ui'
import { displayStatus, invoiceTotals, round2, toISO, todayISO } from '../lib/calc'
import { fmtDate, fmtMoney } from '../lib/format'
import { navigate } from '../lib/router'
import { useInvoicing } from '../lib/store'
import type { DisplayStatus } from '../lib/types'

type Filter = 'all' | DisplayStatus
const FILTERS: Filter[] = ['all', 'draft', 'sent', 'overdue', 'paid']

export function Dashboard() {
  const invoices = useInvoicing((s) => s.invoices)
  const clients = useInvoicing((s) => s.clients)
  const currency = useInvoicing((s) => s.settings.currency)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const today = todayISO()
    const clientName = new Map(clients.map((c) => [c.id, c.name]))
    return invoices
      .map((inv) => ({
        inv,
        status: displayStatus(inv, today),
        total: invoiceTotals(inv).total,
        client: clientName.get(inv.clientId) ?? '—',
      }))
      .sort((a, b) => b.inv.issueDate.localeCompare(a.inv.issueDate) || b.inv.createdAt - a.inv.createdAt)
  }, [invoices, clients])

  const stats = useMemo(() => {
    const sum = (pred: (s: DisplayStatus) => boolean) => round2(rows.filter((r) => pred(r.status)).reduce((t, r) => t + r.total, 0))
    const yearStart = `${todayISO().slice(0, 4)}-01-01`
    return {
      outstanding: sum((s) => s === 'sent' || s === 'overdue'),
      overdue: sum((s) => s === 'overdue'),
      overdueCount: rows.filter((r) => r.status === 'overdue').length,
      paidYtd: round2(rows.filter((r) => r.status === 'paid' && r.inv.paidAt && toISO(new Date(r.inv.paidAt)) >= yearStart).reduce((t, r) => t + r.total, 0)),
      drafts: rows.filter((r) => r.status === 'draft').length,
    }
  }, [rows])

  const q = query.trim().toLowerCase()
  const visible = rows.filter(
    (r) => (filter === 'all' || r.status === filter) && (!q || r.inv.number.toLowerCase().includes(q) || r.client.toLowerCase().includes(q)),
  )

  return (
    <>
      <PageHeader
        title="Invoices"
        actions={
          <Button variant="primary" onClick={() => navigate('/invoices/new')}>
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
          {clients.length === 0 ? (
            <>
              Start by <a href="#/settings">adding your business details</a> and <a href="#/clients">a client</a>, then create your first invoice.
            </>
          ) : (
            'Create your first invoice to get started.'
          )}
        </EmptyState>
      ) : (
        <div className="panel">
          <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-200">
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={clsx(
                    'px-2.5 py-1 rounded-md text-sm capitalize cursor-pointer border-0',
                    filter === f ? 'bg-slate-900 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <input className="input sm:ml-auto sm:max-w-56" placeholder="Search number or client" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {visible.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500 m-0">No invoices match.</p>
          ) : (
            <ul className="list-none m-0 p-0 divide-y divide-slate-100">
              {visible.map(({ inv, status, total, client }) => (
                <li key={inv.id}>
                  <a href={`#/invoices/${inv.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 no-underline text-inherit">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{inv.number}</span>
                        <StatusBadge status={status} />
                      </div>
                      <div className="text-sm text-slate-500 truncate">{client}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium tabular-nums">{fmtMoney(total, currency)}</div>
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
    <div className="panel p-4">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={clsx('mt-1 text-lg font-semibold tabular-nums', danger && 'text-red-700')}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}
