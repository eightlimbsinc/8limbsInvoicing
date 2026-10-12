import { useState } from 'react'
import { NOTES_HELP } from '../components/InvoiceDocument'
import { Button, ErrorBanner, Field, PageHeader } from '../components/ui'
import { TermsSelect } from './InvoiceEditor'
import { exportBackup, importBackup, readLocalV1 } from '../lib/backup'
import { CURRENCIES, errorMessage } from '../lib/format'
import { useInvoicing } from '../lib/store'
import { supabase } from '../lib/supabase'
import type { Settings as SettingsT } from '../lib/types'

const MAX_LOGO_PX = 400

export const NOTES_TEMPLATE = `Payment is due within {terms_days} days of the invoice date ({terms}). Late payments may be subject to a 1.5% monthly interest charge (or the maximum permitted by law). Services may be paused on overdue accounts. Client is responsible for any costs incurred in the collection of outstanding balances.
Please include your **Invoice Number [{invoice_number}]** in the payment reference when sending funds via Wise or bank transfer. This ensures we can properly allocate your payment and confirm without delay.
Bank Wire Transfer Information:
**Bank Name:**
**SWIFT Code:**
**Canadian Clearing Code:**
**Institution Number:**
**Transit Number:**
**Account Number:**
**Beneficiary or Creditor Name:**
**Beneficiary or Creditor Home Address:** `

/** Downscale the logo so it stays small in the database. */
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

const TIMEZONES = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []

export function Settings() {
  const settings = useInvoicing((s) => s.settings)
  const saveSettings = useInvoicing((s) => s.saveSettings)
  const [form, setForm] = useState<SettingsT>(settings)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [localV1] = useState(readLocalV1)

  const set = <K extends keyof SettingsT>(field: K, value: SettingsT[K]) => {
    setStatus('')
    setForm((f) => ({ ...f, [field]: value }))
  }
  const text = (field: keyof SettingsT) => (e: { target: { value: string } }) => set(field, e.target.value)
  const num = (field: 'defaultTaxRate' | 'numberPadding' | 'nextNumber') => (e: { target: { value: string } }) =>
    set(field, Math.max(0, Number(e.target.value) || 0))

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true)
    setError('')
    setStatus('')
    try {
      setStatus((await fn()) || '')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      await saveSettings({
        ...form,
        currency: form.currency.trim().toUpperCase() || 'USD',
        nextNumber: Math.max(1, Math.floor(form.nextNumber)),
        numberPadding: Math.min(12, Math.floor(form.numberPadding)),
      })
      return 'Saved'
    })
  }

  const download = () => {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `invoicing-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const restore = (data: () => Promise<unknown>) =>
    run(async () => {
      const msg = await importBackup(await data())
      setForm(useInvoicing.getState().settings)
      return msg
    })

  const n = Math.max(1, Math.floor(form.nextNumber))
  const preview = `${form.invoicePrefix}${String(n).padStart(Math.min(12, form.numberPadding), '0')}`

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="Settings"
        actions={
          <>
            {status && <span className="self-center text-sm text-emerald-700">{status}</span>}
            <Button variant="primary" type="submit" disabled={busy}>
              Save settings
            </Button>
          </>
        }
      />
      <ErrorBanner error={error} />

      <div className="flex flex-col gap-5">
        <section className="panel p-4 sm:p-5">
          <h2 className="text-base font-semibold m-0 mb-4">Business (shown on invoices)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Business name">
              <input className="input" value={form.businessName} onChange={text('businessName')} />
            </Field>
            <Field label="Website">
              <input className="input" placeholder="https://8limbsinc.net/" value={form.website} onChange={text('website')} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={form.email} onChange={text('email')} />
            </Field>
            <Field label="Phone">
              <input className="input" type="tel" value={form.phone} onChange={text('phone')} />
            </Field>
            <Field label="Address">
              <textarea className="input" rows={3} placeholder={'Markham, Ontario, L6E1X8\nCA'} value={form.address} onChange={text('address')} />
            </Field>
            <div>
              <span className="field-label">Logo</span>
              <div className="flex flex-wrap items-center gap-3">
                {form.logo && <img src={form.logo} alt="Logo" className="h-16 max-w-32 object-contain" />}
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
            <Field label="Default payment terms" htmlFor="default-terms">
              <TermsSelect id="default-terms" days={form.paymentTermsDays} onChange={(d) => set('paymentTermsDays', d)} />
            </Field>
            <Field label="Number prefix">
              <input className="input" value={form.invoicePrefix} onChange={text('invoicePrefix')} />
            </Field>
            <Field label="Digits (zero-padded)">
              <input className="input" type="number" min="0" max="12" step="1" value={form.numberPadding} onChange={num('numberPadding')} />
            </Field>
            <Field label="Next number">
              <input className="input" type="number" min="1" step="1" value={form.nextNumber} onChange={num('nextNumber')} />
            </Field>
            <p className="col-span-2 sm:col-span-3 m-0 -mt-1 text-sm text-slate-500">
              Next invoice will be <b className="text-slate-800">{preview}</b>. To continue your existing sequence, set the next number (e.g. 157 after INV-000156).
            </p>
            <Field label="Time zone (for when recurring invoices are issued)" className="col-span-2 sm:col-span-3">
              <input className="input" list="timezones" value={form.timezone} onChange={text('timezone')} />
              <datalist id="timezones">
                {TIMEZONES.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </Field>
            <Field label="Default payment link" className="col-span-2 sm:col-span-3">
              <input className="input" type="url" placeholder="https://…" value={form.paymentLink} onChange={text('paymentLink')} />
            </Field>
            <Field label="Default terms & notes" className="col-span-2 sm:col-span-3">
              <textarea className="input font-mono text-[13px]" rows={12} value={form.defaultNotes} onChange={text('defaultNotes')} />
              <span className="block mt-1 text-xs text-slate-500">{NOTES_HELP}</span>
            </Field>
            {!form.defaultNotes.trim() && (
              <div className="col-span-2 sm:col-span-3">
                <Button onClick={() => set('defaultNotes', NOTES_TEMPLATE)}>Start from the Net 30 + bank wire template</Button>
              </div>
            )}
          </div>
        </section>

        <section className="panel p-4 sm:p-5">
          <h2 className="text-base font-semibold m-0 mb-1">Data</h2>
          <p className="text-sm text-slate-500 m-0 mb-4">
            Everything is stored in your Supabase database. You can also keep an offline copy, or import a backup (including one from the earlier browser-only version).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>Download backup (JSON)</Button>
            <label className="btn btn-secondary">
              Import backup…
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) restore(async () => JSON.parse(await file.text()))
                }}
              />
            </label>
            {localV1 && (
              <Button disabled={busy} onClick={() => restore(async () => localV1)}>
                Import {localV1.invoices.length} invoices saved in this browser
              </Button>
            )}
            <Button variant="ghost" className="ml-auto" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </section>
      </div>
    </form>
  )
}
