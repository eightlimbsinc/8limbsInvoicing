import { useState } from 'react'
import { uid, useInvoicing } from '../lib/store'
import type { Client } from '../lib/types'
import { Button, Field } from './ui'

const emptyClient = (): Client => ({ id: uid(), name: '', email: '', phone: '', address: '' })

export function ClientDialog({ client, onClose }: { client?: Client; onClose: (saved?: Client) => void }) {
  const saveClient = useInvoicing((s) => s.saveClient)
  const [form, setForm] = useState<Client>(() => client ?? emptyClient())
  const set = (field: keyof Client) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const saved = { ...form, name: form.name.trim() }
    saveClient(saved)
    onClose(saved)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-slate-900/50" onClick={() => onClose()}>
      <form className="panel w-full max-w-md p-5 flex flex-col gap-3 shadow-xl" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="text-lg font-semibold m-0">{client ? 'Edit client' : 'New client'}</h2>
        <Field label="Name *">
          <input className="input" required autoFocus value={form.name} onChange={set('name')} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Email">
            <input className="input" type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Phone">
            <input className="input" type="tel" value={form.phone} onChange={set('phone')} />
          </Field>
        </div>
        <Field label="Address">
          <textarea className="input" rows={3} value={form.address} onChange={set('address')} />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button onClick={() => onClose()}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={!form.name.trim()}>
            Save client
          </Button>
        </div>
      </form>
    </div>
  )
}
