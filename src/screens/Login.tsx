import { useState } from 'react'
import { errorMessage } from '../lib/format'
import { Button, ErrorBanner, Field } from '../components/ui'
import { supabase } from '../lib/supabase'

export function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split('#')[0] } })
        if (error) throw error
        if (!data.session) setNotice('Check your email to confirm your account, then sign in.')
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={submit} className="panel shadow-sm w-full max-w-sm p-6 flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold m-0">{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
          <p className="m-0 mt-1 text-sm text-slate-500">Invoicing</p>
        </div>
        <ErrorBanner error={error} />
        {notice && <div className="rounded-md bg-emerald-50 text-emerald-800 text-sm px-3 py-2 ring-1 ring-emerald-200">{notice}</div>}
        <Field label="Email">
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input
            className="input"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button variant="primary" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
        <button
          type="button"
          className="bg-transparent border-0 p-0 text-sm text-blue-700 cursor-pointer"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'First time? Create an account' : 'Have an account? Sign in'}
        </button>
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
