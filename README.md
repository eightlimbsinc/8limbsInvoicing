# 8 Limbs Inc — Invoicing

Invoicing for 8 Limbs Inc.: customers, one-off and recurring invoices,
payment tracking, and a client-facing invoice page with a **Pay Invoice Here**
button and PDF download. Data lives in a Supabase (Postgres) database.

## Features

- **Invoices** — line items with per-line tax, discount, issue/due dates,
  payment terms (Due on receipt, Net 7/15/30/45/60/90 or custom), payment link
  and rich terms & notes. Numbers are assigned by the database
  (`INV-000156`, `INV-000157`, …) so they never collide.
- **Status tracking** — Draft → Sent → Paid, plus **Void** (keeps the record but
  removes it from what's owed). Sent invoices past due show as **Overdue**.
  Dashboard totals for outstanding, overdue and paid-this-year.
- **Recurring invoices** — issue an invoice every week / 2 weeks / month /
  quarter / 6 months / year (or custom) starting on a chosen date, each with its
  own payment terms (e.g. Net 30 → due 30 days after each issue date). Optional
  end date or number of invoices. Pause, resume (skips the paused periods),
  cancel or duplicate. Month-end dates don't drift (Jan 31 → Feb 28 → Mar 31).
- **Client link** — every sent invoice has a private link
  (`…/#/i/<token>`) that shows the invoice without signing in, with the pay
  button and "Click here to download pdf". Drafts are never shown.
- **Terms & notes template** — one paragraph per line, `**bold**`, and
  placeholders: `{invoice_number}` `{due_date}` `{issue_date}` `{amount_due}`
  `{client_name}` `{terms}` (e.g. "Net 30") `{terms_days}`.
- **Settings** — business name, logo, address, website, currency, default tax,
  default terms, numbering (prefix, digits, next number), time zone, default
  payment link and notes. JSON backup download/import.

## How recurring invoices are generated

The database function `generate_due_recurring_invoices()` issues every invoice
that has come due (and any missed periods). It runs:

1. **hourly** via `pg_cron` inside Supabase — so invoices are created on the
   scheduled date even if nobody opens the app; and
2. whenever the app loads, as a catch-up.

"Today" is evaluated in the time zone set in Settings. Running twice can't
create duplicates (row locks plus a unique index on schedule + issue date).

## Setup (one time)

1. **Create a Supabase project** at <https://supabase.com> (free tier is fine).
2. **Create the database**: in the Supabase dashboard open **SQL Editor**, paste
   and run `supabase/migrations/20261012000001_init.sql`, then
   `supabase/migrations/20261012000002_schedule.sql`.
   (Or with the Supabase CLI: `supabase link` then `supabase db push`.)
3. **Auth**: under **Authentication → URL Configuration**, set the Site URL to
   your GitHub Pages URL (`https://eightlimbsinc.github.io/8limbsInvoicing/`).
4. **Connect the app**: copy the Project URL and the `anon` public key from
   **Project Settings → API**. In GitHub open the repo's **Settings → Secrets and
   variables → Actions → Variables** and add `SUPABASE_URL` and
   `SUPABASE_ANON_KEY`. Re-run the deploy workflow (or push).
5. **Create accounts (admin only)**: the app has no public sign-up. Turn off
   sign-ups in Supabase (**Authentication → Sign In / Providers → Email → Allow
   new users to sign up** off), then add each user under **Authentication →
   Users → Add user → Create new user** with an email and password (tick
   **Auto Confirm User**). After the **Team & users** setup below, admins can do
   this from the app's **Users** page instead.
6. In **Settings**, add your logo, address, website, payment link and bank
   details (start from the Net 30 + bank wire template), and set **Next number**
   to continue your existing sequence (e.g. 157).

Coming from the earlier browser-only version? Open Settings on the same
browser and click **Import … invoices saved in this browser**.

## Team & users

The workspace belongs to the account owner (the first admin). Admins add
people from the app's **Users** page; everyone works on the same invoices,
customers and numbering.

| | Admin | Member |
| --- | --- | --- |
| Invoices: view, create, edit, mark sent/paid, PDF, client link | ✅ | ✅ |
| Add a customer while creating an invoice | ✅ | ✅ |
| Delete / void invoices | ✅ | — |
| Customers page, Recurring, Settings | ✅ | — |
| Users: add, change role, reset password, remove | ✅ | — |

The rules are enforced by row-level security in the database, not just
hidden in the app. The account owner always stays an admin and can't be
removed, and the last admin can't be demoted.

One-time setup:

1. **Run the migration**: in Supabase **SQL Editor**, run
   `supabase/migrations/20261013000003_team_roles.sql`. Existing accounts
   become the admin of their own workspace; data is unchanged.
2. **Deploy the function**: in Supabase **Edge Functions → Deploy a new
   function → Via Editor**, name it exactly `admin-users`, replace the code with
   `supabase/functions/admin-users/index.ts`, and deploy. (CLI alternative:
   `supabase functions deploy admin-users`.) It uses the project's built-in
   service-role key, which never reaches the browser.
3. Keep **Allow new users to sign up** off in Supabase Auth settings.

## Development

```bash
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm install
npm run dev
npm test        # money + schedule date math (mirrors the SQL)
npm run lint
npm run build
```

Stack: React 19, TypeScript, Vite, Tailwind CSS, Zustand, Supabase
(Postgres, Auth, pg_cron). Pushing to `main` or a `claude/**` branch lints,
tests, builds and deploys to GitHub Pages.

## Data model

| Table | Holds |
| --- | --- |
| `settings` | One row per user: business details, defaults, numbering counter |
| `clients` | Customers |
| `invoices` | Every invoice (`items` as JSON, stored `total`, `share_token`, `recurring_id`) |
| `recurring_invoices` | Schedules: frequency, anchor date, terms, end condition, invoice content |

All tables have row-level security limiting each signed-in user to their own
rows. Customers referenced by invoices or schedules can't be deleted.
