// Supabase Edge Function: user management for workspace admins.
//
// Creating and removing logins needs the service-role key, which must never
// reach the browser, so the app calls this function instead. Every request
// is checked: the caller must be signed in and an admin of their workspace,
// and can only touch members of that same workspace.
//
// Body: { action: 'list' }
//       { action: 'create', email, password, role }
//       { action: 'set_role', user_id, role }
//       { action: 'reset_password', user_id, password }
//       { action: 'remove', user_id }

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

type Role = 'admin' | 'member'
const isRole = (r: unknown): r is Role => r === 'admin' || r === 'member'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

    // Who is calling?
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '')
    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) throw new HttpError(401, 'Not signed in')
    const caller = userData.user

    let { data: me } = await admin.from('workspace_members').select('*').eq('user_id', caller.id).maybeSingle()
    if (!me) {
      // Not on a team yet: the database already treats them as admin of their
      // own private workspace, so record that and carry on.
      const { data, error } = await admin
        .from('workspace_members')
        .insert({ user_id: caller.id, workspace_id: caller.id, role: 'admin', email: caller.email ?? '' })
        .select()
        .single()
      if (error) throw error
      me = data
    }
    if (me.role !== 'admin') throw new HttpError(403, 'Only admins can manage users')
    const workspace: string = me.workspace_id

    const body = await req.json().catch(() => ({}))

    const member = async (userId: unknown) => {
      if (typeof userId !== 'string') throw new HttpError(400, 'user_id is required')
      const { data } = await admin.from('workspace_members').select('*').eq('user_id', userId).eq('workspace_id', workspace).maybeSingle()
      if (!data) throw new HttpError(404, 'User not found in your team')
      return data
    }
    const adminCount = async () => {
      const { count } = await admin.from('workspace_members').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace).eq('role', 'admin')
      return count ?? 0
    }

    switch (body.action) {
      case 'list': {
        const { data, error } = await admin.from('workspace_members').select('user_id, email, role, created_at').eq('workspace_id', workspace).order('created_at')
        if (error) throw error
        return json({ users: data.map((u) => ({ ...u, is_owner: u.user_id === workspace, is_me: u.user_id === caller.id })) })
      }

      case 'create': {
        const email = String(body.email ?? '').trim().toLowerCase()
        const password = String(body.password ?? '')
        if (!email.includes('@')) throw new HttpError(400, 'Enter a valid email')
        if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters')
        if (!isRole(body.role)) throw new HttpError(400, 'Role must be admin or member')
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
        if (error) throw new HttpError(400, error.message)
        const { error: insertError } = await admin
          .from('workspace_members')
          .insert({ user_id: data.user.id, workspace_id: workspace, role: body.role, email })
        if (insertError) {
          await admin.auth.admin.deleteUser(data.user.id) // don't leave a login with no team
          throw insertError
        }
        return json({ ok: true })
      }

      case 'set_role': {
        const target = await member(body.user_id)
        if (!isRole(body.role)) throw new HttpError(400, 'Role must be admin or member')
        if (target.user_id === workspace && body.role !== 'admin') throw new HttpError(400, 'The account owner always stays an admin')
        if (target.role === 'admin' && body.role === 'member' && (await adminCount()) <= 1) throw new HttpError(400, "Can't remove the last admin")
        const { error } = await admin.from('workspace_members').update({ role: body.role }).eq('user_id', target.user_id)
        if (error) throw error
        return json({ ok: true })
      }

      case 'reset_password': {
        const target = await member(body.user_id)
        const password = String(body.password ?? '')
        if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters')
        const { error } = await admin.auth.admin.updateUserById(target.user_id, { password })
        if (error) throw new HttpError(400, error.message)
        return json({ ok: true })
      }

      case 'remove': {
        const target = await member(body.user_id)
        // The owner's id is the workspace id: removing it would delete all the data.
        if (target.user_id === workspace) throw new HttpError(400, "The account owner can't be removed")
        if (target.user_id === caller.id) throw new HttpError(400, "You can't remove yourself")
        if (target.role === 'admin' && (await adminCount()) <= 1) throw new HttpError(400, "Can't remove the last admin")
        const { error } = await admin.auth.admin.deleteUser(target.user_id)
        if (error) throw new HttpError(400, error.message)
        return json({ ok: true })
      }

      default:
        throw new HttpError(400, 'Unknown action')
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    return json({ error: e instanceof Error ? e.message : String(e) }, status)
  }
})
