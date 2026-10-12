# 8 Limbs Inc — Invoicing

A lightweight invoicing app: manage clients, create invoices, track what's
been paid, and print or save invoices as PDF. Runs entirely in the browser —
no backend, no account.

## Features

- **Clients** — name, email, phone, address. Clients with invoices can't be
  deleted (delete their invoices first).
- **Invoices** — line items, discount %, tax %, issue/due dates, notes.
  Numbers are assigned automatically from a configurable prefix + counter
  (`INV-1001`, `INV-1002`, …). Duplicate an invoice to bill again.
- **Status tracking** — Draft → Sent → Paid. Sent invoices past their due date
  show as **Overdue**. The dashboard totals outstanding, overdue and
  paid-this-year amounts, with status filters and search.
- **Print / PDF** — the invoice page has a print-ready layout; use
  **Print / PDF** and choose "Save as PDF". **Email** opens a pre-filled
  message to the client (attach the PDF).
- **Business settings** — name, logo, address, contact info, currency,
  default tax rate, payment terms, numbering and payment instructions.
- **Backup** — download all data as JSON and restore it on another device.

Totals: discount applies to the subtotal, tax applies to the discounted
amount, and every step is rounded to cents.

## Data storage

Everything is saved in the browser's `localStorage` (key `invoicing-app`).
Data does not sync between devices or browsers, and clearing site data erases
it — use **Settings → Backup** regularly.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests for the money/date math
npm run lint
npm run build
```

Stack: React 19, TypeScript, Vite, Tailwind CSS, Zustand.

## Deployment

Pushing to `main` (or any `claude/**` branch) lints, tests, builds and
deploys to GitHub Pages via `.github/workflows/deploy.yml`. The build uses
relative paths and hash routing, so it works at
`https://<owner>.github.io/<repo>/` without extra config.
