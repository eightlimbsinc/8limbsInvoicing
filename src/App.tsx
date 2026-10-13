import { useEffect, useState } from 'react'
import clsx from 'clsx'
import type { Session } from '@supabase/supabase-js'
import { Button } from './components/ui'
import { errorMessage } from './lib/format'
import { useRoute } from './lib/router'
import { useInvoicing } from './lib/store'
import { isConfigured, supabase } from './lib/supabase'
import { Clients } from './screens/Clients'
import { Dashboard } from './screens/Dashboard'
import { InvoiceEditor } from './screens/InvoiceEditor'
import { InvoiceView } from './screens/InvoiceView'
import { Login, NotConfigured } from './screens/Login'
import { PublicInvoice } from './screens/PublicInvoice'
import { RecurringEditor } from './screens/RecurringEditor'
import { RecurringList } from './screens/RecurringList'
import { Settings } from './screens/Settings'
import { Users } from './screens/Users'

const NAV = [
  { href: '/', label: 'Invoices', section: 'invoices', adminOnly: false },
  { href: '/recurring', label: 'Recurring', section: 'recurring', adminOnly: true },
  { href: '/clients', label: 'Customers', section: 'clients', adminOnly: true },
  { href: '/users', label: 'Users', section: 'users', adminOnly: true },
  { href: '/settings', label: 'Settings', section: 'settings', adminOnly: true },
]

const LOGO_URL = `${import.meta.env.BASE_URL}logo.png`

type Route = ReturnType<typeof useRoute>

function Screen({ path, query }: Route) {
  const [section, id, action] = path
  const isAdmin = useInvoicing((s) => s.isAdmin)
  // Members only work with invoices; the database enforces the same rules.
  if (!isAdmin && section && section !== 'invoices') return <Dashboard />
  if (section === 'invoices' && id === 'new') return <InvoiceEditor key="new" />
  if (section === 'invoices' && id && action === 'edit') return <InvoiceEditor key={id} id={id} />
  if (section === 'invoices' && id) return <InvoiceView id={id} />
  if (section === 'recurring' && id === 'new') return <RecurringEditor key={`new-${query.get('from')}`} fromId={query.get('from') ?? undefined} />
  if (section === 'recurring' && id) return <RecurringEditor key={id} id={id} />
  if (section === 'recurring') return <RecurringList />
  if (section === 'clients') return <Clients />
  if (section === 'settings') return <Settings />
  if (section === 'users') return <Users />
  return <Dashboard />
}

function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}

function App() {
  const route = useRoute()
  if (!isConfigured) return <NotConfigured />
  // Client-facing invoice links work without signing in.
  if (route.path[0] === 'i' && route.path[1]) return <PublicInvoice token={route.path[1]} />
  return <Authed {...route} />
}

function Authed(route: Route) {
  const session = useSession()
  const userId = session?.user.id
  const loaded = useInvoicing((s) => s.loaded)
  const businessName = useInvoicing((s) => s.settings.businessName)
  const isAdmin = useInvoicing((s) => s.isAdmin)
  const [error, setError] = useState('')

  useEffect(() => {
    const { load, reset } = useInvoicing.getState()
    reset()
    if (userId) load().catch((e) => setError(errorMessage(e)))
  }, [userId])

  if (session === undefined) return null
  if (!session) return <Login />
  if (error)
    return (
      <div className="min-h-screen grid place-items-center p-4 text-center">
        <div>
          <p className="text-red-700">Couldn't load your data: {error}</p>
          <Button onClick={() => location.reload()}>Retry</Button>
        </div>
      </div>
    )

  const current = route.path[0] ?? 'invoices'
  const nav = NAV.filter((n) => isAdmin || !n.adminOnly)

  return (
    <div className="min-h-screen font-body">
      <header className="no-print bg-white border-b border-slate-200" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto max-w-6xl px-4 min-h-14 flex flex-wrap items-center justify-between gap-x-4">
          <a href="#/" className="flex items-center gap-2.5 font-semibold truncate text-slate-900 no-underline py-2">
            <img src={LOGO_URL} alt="" className="h-10 w-10 object-contain shrink-0" />
            {businessName || 'Invoicing'}
          </a>
          <nav className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-2 sm:pb-0">
            {nav.map((n) => (
              <a
                key={n.href}
                href={`#${n.href}`}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-sm no-underline whitespace-nowrap',
                  current === n.section ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {n.label}
              </a>
            ))}
            <button
              type="button"
              className="px-3 py-1.5 rounded-md text-sm whitespace-nowrap border-0 bg-transparent text-slate-500 hover:text-slate-900 cursor-pointer"
              title={session.user.email ?? undefined}
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 print-plain">
        {loaded ? <Screen {...route} /> : <p className="text-center text-slate-500 py-10">Loading…</p>}
      </main>
    </div>
  )
}

export default App
