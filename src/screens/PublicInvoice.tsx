import { useEffect, useState } from 'react'
import { InvoiceDocument } from '../components/InvoiceDocument'
import { businessFromRow, clientFromRow, invoiceFromRow } from '../lib/db'
import { supabase } from '../lib/supabase'
import type { BusinessInfo, Client, Invoice } from '../lib/types'

type Loaded = { invoice: Invoice; client: Client; business: BusinessInfo }

/** What a client sees from the shared link: the invoice only, no sign-in. */
export function PublicInvoice({ token }: { token: string }) {
  const [data, setData] = useState<Loaded | null | undefined>(undefined)

  useEffect(() => {
    supabase.rpc('get_shared_invoice', { token }).then(({ data: d, error }) => {
      if (error || !d) return setData(null)
      setData({ invoice: invoiceFromRow(d.invoice), client: clientFromRow(d.client), business: businessFromRow(d.business) })
    })
  }, [token])

  useEffect(() => {
    if (data) document.title = `Invoice ${data.invoice.number}${data.business.businessName ? ` · ${data.business.businessName}` : ''}`
  }, [data])

  if (data === undefined) return <p className="p-10 text-center text-slate-500">Loading invoice…</p>
  if (data === null) return <p className="p-10 text-center text-slate-500">This invoice link is invalid or no longer available.</p>

  return (
    <div className="min-h-screen bg-white py-3 sm:py-3 px-2">
      <div className="mx-auto max-w-[900px]">
        <div className="rounded border border-slate-200 shadow-[0_1px_4px_rgba(0,0,0,0.12)] print-plain">
          <InvoiceDocument {...data} />
        </div>
        <p className="no-print mt-3 text-right text-[13px] font-invoice">
          <button type="button" className="bg-transparent border-0 p-0 text-[#3d8fd6] cursor-pointer" onClick={() => window.print()}>
            Click here
          </button>{' '}
          to download pdf
        </p>
      </div>
    </div>
  )
}
