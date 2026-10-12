-- Invoicing schema. Every row belongs to a Supabase Auth user and row-level
-- security limits each user to their own data.

-- ───────────────────────── Tables ─────────────────────────

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  business_name text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  website text not null default '',
  logo text not null default '', -- small data: URL
  currency text not null default 'USD',
  default_tax_rate numeric(6, 3) not null default 0,
  payment_terms_days int not null default 30 check (payment_terms_days >= 0),
  invoice_prefix text not null default 'INV-',
  number_padding int not null default 6 check (number_padding between 0 and 12),
  next_number int not null default 1 check (next_number >= 1),
  payment_link text not null default '',
  default_notes text not null default '',
  timezone text not null default 'America/Toronto',
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  created_at timestamptz not null default now()
);
create index clients_user_idx on public.clients (user_id);

create table public.recurring_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  client_id uuid not null references public.clients (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled', 'completed')),
  -- Issue dates are start_date + period_index × (interval_count interval_unit).
  -- Counting from a fixed anchor keeps month-end dates from drifting
  -- (Jan 31 → Feb 28 → Mar 31, not Mar 28).
  start_date date not null,
  period_index int not null default 0 check (period_index >= 0),
  interval_unit text not null default 'month' check (interval_unit in ('week', 'month', 'year')),
  interval_count int not null default 1 check (interval_count between 1 and 36),
  payment_terms_days int not null default 30 check (payment_terms_days >= 0),
  end_date date,
  max_occurrences int check (max_occurrences > 0),
  generated_count int not null default 0,
  last_issued_on date,
  auto_send boolean not null default true, -- generated invoices start as "sent" rather than "draft"
  items jsonb not null default '[]',
  discount_rate numeric(6, 3) not null default 0,
  notes text not null default '',
  payment_link text not null default '',
  currency text not null default 'USD',
  total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recurring_user_idx on public.recurring_invoices (user_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  number text not null,
  client_id uuid not null references public.clients (id) on delete restrict,
  recurring_id uuid references public.recurring_invoices (id) on delete set null,
  issue_date date not null,
  due_date date not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  -- [{ id, description, quantity, unitPrice, taxRate }]
  items jsonb not null default '[]',
  discount_rate numeric(6, 3) not null default 0,
  notes text not null default '',
  payment_link text not null default '',
  currency text not null default 'USD',
  -- Computed by the app on save (lets you query/report on amounts in SQL).
  total numeric(14, 2) not null default 0,
  share_token uuid not null default gen_random_uuid() unique,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, number),
  check (due_date >= issue_date)
);
create index invoices_user_idx on public.invoices (user_id, issue_date desc);
-- Belt and braces against a schedule ever issuing the same period twice.
create unique index invoices_recurring_period_idx on public.invoices (recurring_id, issue_date) where recurring_id is not null;

-- ───────────────────────── Row-level security ─────────────────────────

alter table public.settings enable row level security;
alter table public.clients enable row level security;
alter table public.recurring_invoices enable row level security;
alter table public.invoices enable row level security;

create policy "own settings" on public.settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own clients" on public.clients for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own recurring" on public.recurring_invoices for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own invoices" on public.invoices for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────── Functions ─────────────────────────

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();
create trigger recurring_touch before update on public.recurring_invoices for each row execute function public.touch_updated_at();
create trigger invoices_touch before update on public.invoices for each row execute function public.touch_updated_at();

-- Assigns the next invoice number (prefix + zero-padded counter) atomically
-- when an invoice is inserted without one.
create function public.assign_invoice_number() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.settings;
begin
  if new.number is null or new.number = '' then
    insert into public.settings (user_id) values (new.user_id) on conflict (user_id) do nothing;
    update public.settings set next_number = next_number + 1
      where user_id = new.user_id
      returning * into s;
    new.number := s.invoice_prefix || lpad((s.next_number - 1)::text, greatest(s.number_padding, length((s.next_number - 1)::text)), '0');
  end if;
  return new;
end $$;

create trigger invoices_number before insert on public.invoices
  for each row execute function public.assign_invoice_number();

create function public.recurring_issue_date(start_date date, unit text, every int, period int)
returns date language sql immutable as $$
  select case unit
    when 'week' then start_date + every * period * 7
    when 'month' then (start_date + make_interval(months => every * period))::date
    when 'year' then (start_date + make_interval(years => every * period))::date
  end
$$;

-- Issues every invoice that is due from active schedules, catching up on any
-- missed periods. Runs hourly via pg_cron for all users, and the app also
-- calls it on load (then it only touches the signed-in user's schedules).
create function public.generate_due_recurring_invoices() returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.recurring_invoices;
  today date;
  issue date;
  created int := 0;
begin
  for r in
    select * from public.recurring_invoices
    where status = 'active' and (auth.uid() is null or user_id = auth.uid())
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

revoke all on function public.generate_due_recurring_invoices() from public, anon;
grant execute on function public.generate_due_recurring_invoices() to authenticated;

-- Client-facing invoice page: anyone holding the unguessable share link can
-- view that one invoice (never drafts), without signing in.
create function public.get_shared_invoice(token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'invoice', to_jsonb(i) - 'user_id',
    'client', to_jsonb(c) - 'user_id',
    'business', jsonb_build_object(
      'business_name', s.business_name, 'email', s.email, 'phone', s.phone,
      'address', s.address, 'website', s.website, 'logo', s.logo))
  from public.invoices i
  join public.clients c on c.id = i.client_id
  left join public.settings s on s.user_id = i.user_id
  where i.share_token = token and i.status in ('sent', 'paid')
$$;

revoke all on function public.get_shared_invoice(uuid) from public;
grant execute on function public.get_shared_invoice(uuid) to anon, authenticated;
