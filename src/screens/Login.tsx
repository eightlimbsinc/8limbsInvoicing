import { useState } from 'react'
import { errorMessage } from '../lib/format'
import { Button, ErrorBanner, Field } from '../components/ui'
import { supabase } from '../lib/supabase'

/** Sign-in only: accounts are created by the admin in the Supabase dashboard (public sign-up is off). */
export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={submit} className="panel shadow-sm w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex flex-col items-center text-center">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Eight Limbs" className="h-28 w-28 object-contain mb-2" />
          <h1 className="text-xl font-semibold m-0">Sign in</h1>
          <p className="m-0 mt-1 text-sm text-slate-500">8 Limbs Invoicing</p>
        </div>
        <ErrorBanner error={error} />
        <Field label="Email">
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button variant="primary" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : 'Sign in'}
        </Button>
        <p className="m-0 text-xs text-slate-500 text-center">Accounts are created by the administrator.</p>
      </form>
    </div>
  )
}

export function NotConfigured() {
  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="panel w-full max-w-lg p-6 text-sm leading-relaxed">
        <h1 className="text-xl font-semibold m-0 mb-2">Connect a database</h1>
        <p className="m-0">
          This build has no Supabase project configured. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (in <code>.env.local</code> for
          local development, or as repository variables <code>SUPABASE_URL</code> / <code>SUPABASE_ANON_KEY</code> for the GitHub Pages build). See the README for
          setup steps.
        </p>
      </div>
    </div>
  )
}
