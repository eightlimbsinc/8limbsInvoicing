-- Team workspace with admin / member roles.
--
-- Every row's user_id is the *workspace* id: the user id of the workspace's
-- owner (the original admin). Members created by an admin join that
-- workspace and work on the same invoices and customers.
--   admin:  everything, plus managing users (via the admin-users function)
--   member: view/create/edit invoices and add customers; no settings,
--           recurring schedules, deleting or user management.

create table public.workspace_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  workspace_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  email text not null default '',
  created_at timestamptz not null default now()
);
create index workspace_members_workspace_idx on public.workspace_members (workspace_id);

-- Everyone who already has data owns a workspace and is its admin.
insert into public.workspace_members (user_id, workspace_id, role, email)
select s.user_id, s.user_id, 'admin', coalesce(u.email, '')
from public.settings s join auth.users u on u.id = s.user_id
on conflict (user_id) do nothing;

-- The signed-in user's workspace. Users without a membership row get their
-- own private workspace (and are its admin), so nothing is ever shared by accident.
create function public.current_workspace() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce((select workspace_id from public.workspace_members where user_id = auth.uid()), auth.uid())
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.workspace_members where user_id = auth.uid()), auth.uid() is not null)
$$;

grant execute on function public.current_workspace() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- New rows belong to the workspace, not the individual user.
alter table public.settings alter column user_id set default public.current_workspace();
alter table public.clients alter column user_id set default public.current_workspace();
alter table public.recurring_invoices alter column user_id set default public.current_workspace();
alter table public.invoices alter column user_id set default public.current_workspace();

drop policy "own settings" on public.settings;
drop policy "own clients" on public.clients;
drop policy "own recurring" on public.recurring_invoices;
drop policy "own invoices" on public.invoices;

-- Settings: everyone in the workspace can read them (invoices need the
-- business details); only admins change them.
create policy "workspace reads settings" on public.settings for select to authenticated
  using (user_id = public.current_workspace());
create policy "admins write settings" on public.settings for all to authenticated
  using (user_id = public.current_workspace() and public.is_admin())
  with check (user_id = public.current_workspace() and public.is_admin());

-- Customers: everyone can read, add and edit; only admins delete.
create policy "workspace reads clients" on public.clients for select to authenticated
  using (user_id = public.current_workspace());
create policy "workspace adds clients" on public.clients for insert to authenticated
  with check (user_id = public.current_workspace());
create policy "workspace edits clients" on public.clients for update to authenticated
  using (user_id = public.current_workspace()) with check (user_id = public.current_workspace());
create policy "admins delete clients" on public.clients for delete to authenticated
  using (user_id = public.current_workspace() and public.is_admin());

-- Invoices: everyone can read, create and edit; only admins delete.
create policy "workspace reads invoices" on public.invoices for select to authenticated
  using (user_id = public.current_workspace());
create policy "workspace adds invoices" on public.invoices for insert to authenticated
  with check (user_id = public.current_workspace());
create policy "workspace edits invoices" on public.invoices for update to authenticated
  using (user_id = public.current_workspace()) with check (user_id = public.current_workspace());
create policy "admins delete invoices" on public.invoices for delete to authenticated
  using (user_id = public.current_workspace() and public.is_admin());

-- Recurring schedules: readable by everyone (invoices link to them); admins manage.
create policy "workspace reads recurring" on public.recurring_invoices for select to authenticated
  using (user_id = public.current_workspace());
create policy "admins write recurring" on public.recurring_invoices for all to authenticated
  using (user_id = public.current_workspace() and public.is_admin())
  with check (user_id = public.current_workspace() and public.is_admin());

-- Members can see who is on their team; changes go through the admin-users
-- function (service role), never directly from the browser.
alter table public.workspace_members enable row level security;
create policy "workspace reads members" on public.workspace_members for select to authenticated
  using (workspace_id = public.current_workspace());

-- Recurring generation from the app now covers the signed-in user's workspace.
create or replace function public.generate_due_recurring_invoices() returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.recurring_invoices;
  today date;
  issue date;
  created int := 0;
begin
  for r in
    select * from public.recurring_invoices
    where status = 'active' and (auth.uid() is null or user_id = public.current_workspace())
    for update skip locked
  loop
    today := (now() at time zone coalesce(
      (select s.timezone from public.settings s where s.user_id = r.user_id), 'UTC'))::date;

    loop
      issue := public.recurring_issue_date(r.start_date, r.interval_unit, r.interval_count, r.period_index);

      if (r.end_date is not null and issue > r.end_date)
         or (r.max_occurrences is not null and r.generated_count >= r.max_occurrences) then
        update public.recurring_invoices set status = 'completed' where id = r.id;
        exit;
      end if;
      exit when issue > today;

      insert into public.invoices (user_id, client_id, recurring_id, issue_date, due_date, status,
                                   items, discount_rate, notes, payment_link, currency, total, sent_at)
      values (r.user_id, r.client_id, r.id, issue, issue + r.payment_terms_days,
              case when r.auto_send then 'sent' else 'draft' end,
              r.items, r.discount_rate, r.notes, r.payment_link, r.currency, r.total,
              case when r.auto_send then now() end)
      on conflict (recurring_id, issue_date) where recurring_id is not null do nothing;

      r.period_index := r.period_index + 1;
      r.generated_count := r.generated_count + 1;
      created := created + 1;
      update public.recurring_invoices
        set period_index = r.period_index, generated_count = r.generated_count, last_issued_on = issue
        where id = r.id;
    end loop;
  end loop;
  return created;
end $$;
