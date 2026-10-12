import { useState } from 'react'
import { Button, Field, PageHeader } from '../components/ui'
import { CURRENCIES } from '../lib/format'
import { useInvoicing } from '../lib/store'
import type { Settings as SettingsT } from '../lib/types'

const MAX_LOGO_PX = 400

/** Downscale the logo so it fits comfortably in localStorage. */
function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, MAX_LOGO_PX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    img.src = url
  })
}

export function Settings() {
  const settings = useInvoicing((s) => s.settings)
  const updateSettings = useInvoicing((s) => s.updateSettings)
  const exportData = useInvoicing((s) => s.exportData)
  const importData = useInvoicing((s) => s.importData)
  const [form, setForm] = useState<SettingsT>(settings)
  const [saved, setSaved] = useState(false)

  const set = <K extends keyof SettingsT>(field: K, value: SettingsT[K]) => {
    setSaved(false)
    setForm((f) => ({ ...f, [field]: value }))
  }
  const text = (field: keyof SettingsT) => (e: { target: { value: string } }) => set(field, e.target.value)
  const num = (field: 'defaultTaxRate' | 'paymentTermsDays' | 'nextNumber') => (e: { target: { value: string } }) =>
    set(field, Math.max(0, Number(e.target.value) || 0))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    updateSettings({ ...form, currency: form.currency.trim().toUpperCase() || 'USD', nextNumber: Math.max(1, Math.floor(form.nextNumber)) })
    setSaved(true)
  }

  const download = () => {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `invoicing-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const restore = async (file: File) => {
    if (!confirm('Restoring replaces all current clients, invoices and settings. Continue?')) return
    try {
      importData(JSON.parse(await file.text()))
      setForm(useInvoicing.getState().settings)
      alert('Backup restored.')
    } catch (err) {
      alert(`Couldn't restore: ${err instanceof Error ? err.message : err}`)
    }
  }

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="Settings"
        actions={
          <>
            {saved && <span className="self-center text-sm text-emerald-700">Saved</span>}
            <Button variant="primary" type="submit">
              Save settings
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-5">
        <section className="panel p-4 sm:p-5">
          <h2 className="text-base font-semibold m-0 mb-4">Business</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Business name">
              <input className="input" value={form.businessName} onChange={text('businessName')} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={form.email} onChange={text('email')} />
            </Field>
            <Field label="Phone">
              <input className="input" type="tel" value={form.phone} onChange={text('phone')} />
            </Field>
            <div>
              <span className="field-label">Logo</span>
              <div className="flex items-center gap-3">
                {form.logo && <img src={form.logo} alt="Logo" className="h-9 max-w-24 object-contain" />}
                <input
                  type="file"
                  accept="image/*"
                  className="text-sm min-w-0"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) set('logo', await readLogo(file).catch(() => form.logo))
                  }}
                />
                {form.logo && (
                  <Button variant="ghost" onClick={() => set('logo', '')}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <Field label="Address" className="sm:col-span-2">
              <textarea className="input" rows={3} value={form.address} onChange={text('address')} />
            </Field>
          </div>
        </section>

        <section className="panel p-4 sm:p-5">
          <h2 className="text-base font-semibold m-0 mb-4">Invoice defaults</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Currency">
              <input className="input uppercase" list="currencies" maxLength={3} value={form.currency} onChange={text('currency')} />
              <datalist id="currencies">
                {CURRENCIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Default tax %">
              <input className="input" type="number" min="0" step="any" value={form.defaultTaxRate} onChange={num('defaultTaxRate')} />
            </Field>
            <Field label="Payment terms (days)">
              <input className="input" type="number" min="0" step="1" value={form.paymentTermsDays} onChange={num('paymentTermsDays')} />
            </Field>
            <Field label="Number prefix">
              <input className="input" value={form.invoicePrefix} onChange={text('invoicePrefix')} />
            </Field>
            <Field label="Next number">
              <input className="input" type="number" min="1" step="1" value={form.nextNumber} onChange={num('nextNumber')} />
            </Field>
            <div className="self-end pb-2 text-sm text-slate-500">
              Next: <span className="font-medium text-slate-800">{`${form.invoicePrefix}${form.nextNumber}`}</span>
            </div>
            <Field label="Payment instructions (bank details, payment link…)" className="col-span-2 sm:col-span-3">
              <textarea className="input" rows={3} value={form.paymentInstructions} onChange={text('paymentInstructions')} />
            </Field>
            <Field label="Default notes" className="col-span-2 sm:col-span-3">
              <textarea className="input" rows={2} value={form.defaultNotes} onChange={text('defaultNotes')} />
            </Field>
          </div>
        </section>

        <section className="panel p-4 sm:p-5">
          <h2 className="text-base font-semibold m-0 mb-1">Backup</h2>
          <p className="text-sm text-slate-500 m-0 mb-4">
            All data is stored in this browser only — clearing site data erases it. Download a backup regularly, or use one to move to another device.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>Download backup</Button>
            <label className="btn btn-secondary">
              Restore from file…
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) restore(file)
                }}
              />
            </label>
          </div>
        </section>
      </div>
    </form>
  )
}
