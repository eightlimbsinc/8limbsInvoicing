import { useMemo, useState } from 'react'
import { ClientDialog } from '../components/ClientDialog'
import { Avatar, Button, EmptyState, ErrorBanner, PageHeader } from '../components/ui'
import { displayStatus, round2 } from '../lib/calc'
import { errorMessage, fmtMoney } from '../lib/format'
import { useInvoicing } from '../lib/store'
import type { Client } from '../lib/types'

export function Clients() {
  const clients = useInvoicing((s) => s.clients)
  const invoices = useInvoicing((s) => s.invoices)
  const currency = useInvoicing((s) => s.settings.currency)
  const deleteClient = useInvoicing((s) => s.deleteClient)
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const [error, setError] = useState('')

  const summary = useMemo(() => {
    const m = new Map<string, { count: number; outstanding: number }>()
    for (const inv of invoices) {
      const s = m.get(inv.clientId) ?? { count: 0, outstanding: 0 }
      s.count++
      const st = displayStatus(inv)
      if ((st === 'sent' || st === 'overdue') && inv.currency === currency) s.outstanding = round2(s.outstanding + inv.total)
      m.set(inv.clientId, s)
    }
    return m
  }, [invoices, currency])

  const remove = async (c: Client) => {
    if (!confirm(`Delete ${c.name}?`)) return
    setError('')
    try {
      await deleteClient(c.id)
    } catch (e) {
      setError(`${c.name}: ${errorMessage(e)}`)
    }
  }

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="People and companies you bill"
        actions={
          <Button variant="primary" className="px-6" onClick={() => setEditing('new')}>
            + New customer
          </Button>
        }
      />
      <ErrorBanner error={error} />

      {clients.length === 0 ? (
        <EmptyState title="No customers yet">Add the people or companies you bill.</EmptyState>
      ) : (
        <ul className="panel shadow-sm list-none m-0 p-0 divide-y divide-slate-100">
          {clients.map((c) => {
            const s = summary.get(c.id)
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar name={c.name} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-slate-500 truncate">{[c.email, c.phone].filter(Boolean).join(' · ') || 'No contact details'}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-slate-600">
                    {s?.count ?? 0} invoice{s?.count === 1 ? '' : 's'}
                  </div>
                  {s && s.outstanding > 0 && <div className="font-medium tabular-nums">{fmtMoney(s.outstanding, currency)} due</div>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" onClick={() => setEditing(c)}>
                    Edit
                  </Button>
                  <Button variant="ghost" className="text-red-700" onClick={() => remove(c)}>
                    Delete
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing && <ClientDialog client={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
