import { useEffect, useState } from 'react'
import { Avatar, Button, ErrorBanner, Field, PageHeader } from '../components/ui'
import { errorMessage, fmtDate } from '../lib/format'
import { supabase } from '../lib/supabase'

type Role = 'admin' | 'member'
interface TeamUser {
  user_id: string
  email: string
  role: Role
  created_at: string
  is_owner: boolean
  is_me: boolean
}

/** Calls the admin-users Edge Function, surfacing its error message. */
async function adminUsers<T = { ok: true }>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null)
    if (detail?.error) throw new Error(detail.error)
    if (/Failed to send|FunctionsFetchError|not found/i.test(String(error.message)))
      throw new Error('The admin-users function isn’t set up in Supabase yet — see the README (Team & users).')
    throw error
  }
  return data as T
}

const ROLE_HELP: Record<Role, string> = {
  admin: 'Everything, including settings, recurring invoices, customers and users',
  member: 'Create and edit invoices only',
}

export function Users() {
  const [users, setUsers] = useState<TeamUser[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', role: 'member' as Role })

  const listUsers = () => adminUsers<{ users: TeamUser[] }>({ action: 'list' }).then((r) => r.users)
  const refresh = async () => setUsers(await listUsers())

  useEffect(() => {
    let alive = true
    listUsers()
      .then((list) => alive && setUsers(list))
      .catch((e) => {
        if (!alive) return
        setError(errorMessage(e))
        setUsers([])
      })
    return () => {
      alive = false
    }
  }, [])

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await fn()
      setNotice(done)
      await refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const create = (e: React.FormEvent) => {
    e.preventDefault()
    const { email, role } = form
    run(async () => {
      await adminUsers({ action: 'create', ...form })
      setForm({ email: '', password: '', role: 'member' })
    }, `Created ${email} as ${role}. Share the email and password with them so they can sign in.`)
  }

  const setRole = (u: TeamUser, role: Role) => run(() => adminUsers({ action: 'set_role', user_id: u.user_id, role }), `${u.email} is now ${role === 'admin' ? 'an admin' : 'a member'}.`)

  const resetPassword = (u: TeamUser) => {
    const password = prompt(`New password for ${u.email} (at least 8 characters):`)
    if (password) run(() => adminUsers({ action: 'reset_password', user_id: u.user_id, password }), `Password updated for ${u.email}.`)
  }

  const remove = (u: TeamUser) => {
    if (confirm(`Remove ${u.email}? They will no longer be able to sign in. Invoices they created stay.`))
      run(() => adminUsers({ action: 'remove', user_id: u.user_id }), `Removed ${u.email}.`)
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Who can sign in, and what they can do" />
      <ErrorBanner error={error} />
      {notice && <div className="mb-4 rounded-md bg-emerald-50 text-emerald-800 text-sm px-3 py-2 ring-1 ring-emerald-200">{notice}</div>}

      <form onSubmit={create} className="panel shadow-sm p-4 sm:p-5 mb-5">
        <h2 className="text-base font-semibold m-0 mb-4">Add a user</h2>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_180px_auto] gap-3 items-end">
          <Field label="Email">
            <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Temporary password (min. 8)">
            <input className="input" type="text" required minLength={8} autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Role" htmlFor="new-user-role">
            <select id="new-user-role" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Button variant="primary" type="submit" disabled={busy}>
            Add user
          </Button>
        </div>
        <p className="m-0 mt-2 text-xs text-slate-500">{ROLE_HELP[form.role]}.</p>
      </form>

      <div className="panel shadow-sm overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs text-slate-600">
              <th className="font-medium px-4 py-3">User</th>
              <th className="font-medium px-3 py-3">Role</th>
              <th className="font-medium px-3 py-3">Added</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {users === null && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {users?.map((u) => (
              <tr key={u.user_id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <Avatar name={u.email} />
                    <span>
                      {u.email}
                      {u.is_me && <span className="text-slate-400"> (you)</span>}
                      {u.is_owner && <span className="block text-xs text-slate-500">Account owner</span>}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-3">
                  <select
                    className="input w-32"
                    aria-label={`Role for ${u.email}`}
                    value={u.role}
                    disabled={busy || u.is_owner}
                    onChange={(e) => setRole(u, e.target.value as Role)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-3 py-3 text-slate-500">{fmtDate(u.created_at.slice(0, 10))}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" disabled={busy} onClick={() => resetPassword(u)}>
                      Reset password
                    </Button>
                    {!u.is_owner && !u.is_me && (
                      <Button variant="ghost" className="text-red-700" disabled={busy} onClick={() => remove(u)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
