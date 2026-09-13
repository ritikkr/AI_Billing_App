# BillGST — India GST-Compliant Billing App

A full-stack, enterprise-style billing application for Indian businesses: customers, items,
GST-correct invoices (CGST/SGST/IGST), payments, credit/debit notes, GST reports, multi-company
support, and role-based access control (Admin / Accountant / Viewer).

## Tech stack

- **Backend:** Node.js, Express, TypeScript, SQLite (via `better-sqlite3`), JWT auth, Zod validation
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Router,
  Recharts, `@react-pdf/renderer` for GST tax-invoice PDFs

No external services are required — SQLite runs as a local file, so the whole app runs on your
machine with nothing to sign up for.

## Features

- **Multi-company / multi-tenant** — one login can belong to several companies (e.g. an
  accountant managing multiple clients), each with its own GSTIN, invoice numbering, and team.
- **Role-based access control** — Admin (full control incl. users/settings), Accountant
  (create/edit records), Viewer (read-only), enforced on both the API and the UI.
- **Customers & Items** — full CRUD, GSTIN validation (format + official checksum algorithm),
  HSN/SAC codes, GST rate per item, optional stock tracking.
- **GST tax engine** — automatically applies CGST+SGST for intra-state supplies or IGST for
  inter-state supplies, based on the company's state vs. the invoice's place of supply. Handles
  per-line discounts, all standard GST rate slabs (0/0.25/3/5/12/18/28%), and invoice-level
  rounding per common GST practice.
- **Sequential invoice numbering** per company per Indian financial year (Apr–Mar), e.g.
  `INV/2026-27/0001`, with separate series for credit and debit notes.
- **Payments** — record full/partial payments against invoices; invoice status
  (draft/sent/partially paid/paid) updates automatically.
- **Credit & debit notes** — issue GST-correct adjustment documents, optionally linked to the
  original invoice.
- **Reports** — dashboard KPIs & revenue trend, Sales Register, GST Summary (rate-wise +
  B2B/B2C split), HSN/SAC Summary, and a Receivables Aging report (current/30/60/90+ buckets).
- **CSV exports** — download the current filtered customer, item, and invoice lists in a single
  click for bookkeeping or spreadsheet workflows.
- **GST tax-invoice PDF** — generated client-side, includes tax breakup, bank details, and
  amount-in-words.

## Project structure

```
billing-app/
  backend/     Express API (TypeScript) + SQLite database
  frontend/    React + Vite + Tailwind single-page app
```

## Getting started

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # then open .env and set a real JWT_SECRET (a long random string)
npm run dev                # starts the API on http://localhost:4000
```

The SQLite database file is created automatically at `backend/data/billing.db` on first run —
nothing else to configure.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev                # starts the app on http://localhost:5173
```

Open http://localhost:5173, click **Create an account**, then **Create your company** (fill in
your GSTIN, address, bank details — these appear on every invoice). From there you can add
customers and items, and start creating invoices.

### Production build

```bash
# backend
cd backend && npm run build && npm start

# frontend
cd frontend && npm run build   # outputs static files to frontend/dist — serve with any static host
```

For a production deployment, remember to also set `frontend/.env`'s `VITE_API_URL` to wherever
you host the backend, and use a strong, secret `JWT_SECRET`.

## How the GST calculation works

For every invoice line, the app compares the **company's registered state** to the invoice's
**place of supply**:

- **Same state (intra-state):** tax is split evenly into **CGST + SGST** (e.g. 18% GST → 9% CGST
  + 9% SGST).
- **Different state (inter-state):** the full rate is charged as **IGST**.

This mirrors how the invoice would need to be filed under India's GST returns (GSTR-1). The GST
Summary report further breaks this down by rate slab and by B2B (customer has a GSTIN) vs. B2C.

GSTIN fields are validated both for format and for the official check-digit (mod-36 checksum)
algorithm, so typos are caught immediately rather than surfacing later in a return.

## Roles

| Role | Can view | Can create/edit records | Manage users & company settings |
|---|---|---|---|
| Admin | ✅ | ✅ | ✅ |
| Accountant | ✅ | ✅ | ❌ |
| Viewer | ✅ | ❌ | ❌ |

A company always needs at least one Admin — the last Admin can't be removed or demoted.

## Notes & next steps

This is a working, tested foundation, not a finished commercial product. A few things worth
adding before real-world/production use:

- **E-invoicing / IRN** integration with the GST e-invoice portal (currently out of scope).
- **GSTR-1/3B export files** in the government's exact JSON/Excel format (the Reports tab gives
  you the underlying numbers, but not the filing-ready file format).
- Email delivery of invoices/receipts (currently PDF download only).
- Automated backups of the SQLite database file for production use.
- Migrate SQLite → PostgreSQL if you expect heavy concurrent multi-user load.
