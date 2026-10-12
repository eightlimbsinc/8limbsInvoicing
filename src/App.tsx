import clsx from 'clsx'
import { useInvoicing } from './lib/store'
import { useRoute } from './lib/router'
import { Dashboard } from './screens/Dashboard'
import { InvoiceEditor } from './screens/InvoiceEditor'
import { InvoiceView } from './screens/InvoiceView'
import { Clients } from './screens/Clients'
import { Settings } from './screens/Settings'

const NAV = [
  { href: '/', label: 'Invoices', section: '' },
  { href: '/clients', label: 'Clients', section: 'clients' },
  { href: '/settings', label: 'Settings', section: 'settings' },
]

function Screen({ route }: { route: string[] }) {
  const [section, id, action] = route
  if (section === 'invoices' && id === 'new') return <InvoiceEditor key="new" />
  if (section === 'invoices' && id && action === 'edit') return <InvoiceEditor key={id} id={id} />
  if (section === 'invoices' && id) return <InvoiceView id={id} />
  if (section === 'clients') return <Clients />
  if (section === 'settings') return <Settings />
  return <Dashboard />
}

function App() {
  const route = useRoute()
  const businessName = useInvoicing((s) => s.settings.businessName)
  const current = route[0] === 'invoices' ? '' : (route[0] ?? '')

  return (
    <div className="min-h-screen font-body">
      <header className="no-print bg-slate-900 text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-4">
          <a href="#/" className="font-semibold truncate text-white no-underline">
            {businessName || 'Invoicing'}
          </a>
          <nav className="flex gap-1">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={`#${n.href}`}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-sm no-underline',
                  current === n.section ? 'bg-white/15 text-white' : 'text-slate-300 hover:text-white',
                )}
              >
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 print-plain">
        <Screen route={route} />
      </main>
    </div>
  )
}

export default App
