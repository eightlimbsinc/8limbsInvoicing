import { useMemo, useState } from 'react'
import { ClientDialog } from '../components/ClientDialog'
import { Button, EmptyState, PageHeader } from '../components/ui'
import { displayStatus, invoiceTotals, round2 } from '../lib/calc'
import { fmtMoney } from '../lib/format'
import { useInvoicing } from '../lib/store'
import type { Client } from '../lib/types'

export function Clients() {
  const clients = useInvoicing((s) => s.clients)
  const invoices = useInvoicing((s) => s.invoices)
  const currency = useInvoicing((s) => s.settings.currency)
  const deleteClient = useInvoicing((s) => s.deleteClient)
  const [editing, setEditing] = useState<Client | 'new' | null>(null)

  const summary = useMemo(() => {
    const m = new Map<string, { count: number; outstanding: number }>()
    for (const inv of invoices) {
      const s = m.get(inv.clientId) ?? { count: 0, outstanding: 0 }
      s.count++
      const st = displayStatus(inv)
      if (st === 'sent' || st === 'overdue') s.outstanding = round2(s.outstanding + invoiceTotals(inv).total)
      m.set(inv.clientId, s)
    }
    return m
  }, [invoices])

  const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name))

  const remove = (c: Client) => {
    if (!confirm(`Delete ${c.name}?`)) return
    if (!deleteClient(c.id)) alert(`${c.name} has invoices. Delete those first.`)
  }

  return (
    <>
      <PageHeader
        title="Clients"
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            + New client
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState title="No clients yet">Add the people or companies you bill.</EmptyState>
      ) : (
        <ul className="panel list-none m-0 p-0 divide-y divide-slate-100">
          {sorted.map((c) => {
            const s = summary.get(c.id)
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
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
