import { useState } from 'react'
import { uid, useInvoicing } from '../lib/store'
import type { Client } from '../lib/types'
import { errorMessage } from '../lib/format'
import { Button, ErrorBanner, Field } from './ui'

const emptyClient = (): Client => ({ id: uid(), name: '', email: '', phone: '', address: '' })

export function ClientDialog({ client, onClose }: { client?: Client; onClose: (saved?: Client) => void }) {
  const saveClient = useInvoicing((s) => s.saveClient)
  const [form, setForm] = useState<Client>(() => client ?? emptyClient())
  const set = (field: keyof Client) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      onClose(await saveClient({ ...form, name: form.name.trim() }))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-slate-900/50" onClick={() => onClose()}>
      <form className="panel w-full max-w-md p-5 flex flex-col gap-3 shadow-xl" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="text-lg font-semibold m-0">{client ? 'Edit customer' : 'New customer'}</h2>
        <ErrorBanner error={error} />
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
        <Field label="Address (incl. country)">
          <textarea className="input" rows={3} value={form.address} onChange={set('address')} />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button onClick={() => onClose()}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={!form.name.trim() || busy}>
            Save customer
          </Button>
        </div>
      </form>
    </div>
  )
}
