export function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    // Unknown currency code typed into settings — fall back to a plain number.
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function fmtDate(iso: string, month: 'short' | 'long' = 'short'): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month, day: 'numeric' })
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'JPY', 'SGD', 'THB', 'MXN', 'BRL', 'INR', 'ZAR']

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Shows blank for 0 so typing in a number field doesn't start with a stray "0". */
export const numValue = (n: number | null) => (n ? n : '')

export const toNum = (v: string) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

/** Client-facing link for a sent invoice (served by the same app, no sign-in). */
export const shareUrl = (shareToken: string) => `${location.origin}${location.pathname}#/i/${shareToken}`
