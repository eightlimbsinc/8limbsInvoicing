-- Issue recurring invoices automatically, hourly (each user's local "today"
-- comes from settings.timezone, so hourly runs pick up the new day promptly).
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'generate-recurring-invoices',
  '5 * * * *',
  $$select public.generate_due_recurring_invoices()$$
);
