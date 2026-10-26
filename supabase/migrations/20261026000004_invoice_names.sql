-- Invoice names ("Podcast Services", "8 Limbs Recurring Invoice - Blend 360"...),
-- shown first in the invoice list. Recurring invoices take their schedule's name.

alter table public.invoices add column if not exists name text not null default '';

-- Name invoices that recurring schedules already issued.
update public.invoices i set name = r.name
from public.recurring_invoices r
where i.recurring_id = r.id and i.name = '';

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

      insert into public.invoices (user_id, name, client_id, recurring_id, issue_date, due_date, status,
                                   items, discount_rate, notes, payment_link, currency, total, sent_at)
      values (r.user_id, r.name, r.client_id, r.id, issue, issue + r.payment_terms_days,
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
