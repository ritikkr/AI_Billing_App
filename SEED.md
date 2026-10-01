# Demo Data Seed

The backend ships with an idempotent seed script that creates a **self-contained demo company** populated with realistic sample data. The demo data lives entirely inside its own company, is fully isolated from real tenants, and can be safely run against production databases.

- [Quick start](#quick-start)
- [Safety & guardrails](#safety--guardrails)
- [Demo credentials](#demo-credentials)
- [What's seeded](#whats-seeded)
- [How it works](#how-it-works)
- [Running on production](#running-on-production)
- [Resetting the demo](#resetting-the-demo)
- [Verification & integrity checks](#verification--integrity-checks)
- [Troubleshooting](#troubleshooting)

---

## Quick start

From `backend/`:

```bash
# Inspect first (read-only, safe on production)
npm run seed -- --check

# Create the demo tenant (refuses if one already exists)
npm run seed

# Rebuild the demo tenant from scratch (requires confirmation or --yes)
npm run seed -- --reset --yes
```

Or with non-interactive confirmation on CI/one-liners:

```bash
SEED_CONFIRM=yes npm run seed -- --reset
```

### Verifying it worked

After seeding, the login should work:

```bash
curl -s -X POST https://<your-api-host>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"Demo@12345"}'
```

A successful response contains a `token`. A `401 {"error":"Invalid email or password"}` means
the demo tenant does not exist in the database the API is actually using — usually because the
seed was run against a different database than the one the API points at. Run `npm run seed -- --check`
to confirm which database the seed sees.

---

## Safety & guardrails

The seed is designed to be safe to run against production databases:

- **Company-scoped isolation.** The demo tenant is created under a company whose name starts with `Demo `. All seeded rows use that `company_id`. The script never touches any company whose name does **not** start with `Demo `.
- **Cascading deletes.** When resetting, only the demo company is deleted (`DELETE FROM companies WHERE name LIKE 'Demo %'`). All child tables are cleaned up via `ON DELETE CASCADE`.
- **Refuses to overwrite by default.** If a demo tenant already exists, `npm run seed` exits with code `1` and prints instructions.
- **Destructive reset is guarded.** `--reset` without `--yes` (or `SEED_CONFIRM=yes`) will print exactly what will be deleted (company name + IDs, demo logins) and refuse to proceed.
- **Orphan-free.** Verified: after `--reset`, orphaned rows across invoices, customers, items, monthly bills, quotations, credit notes, certificate templates and roles are `0`.
- **Cross-tenant isolation verified.** A demo-authenticated token cannot access any non-demo company (returns `403 "You do not have access to this company"`).
- **Uses example.com domain.** Demo emails are `demo@example.com` and `demo.accounts@example.com`. `example.com` is IANA-reserved and cannot receive mail, so the demo accounts cannot be compromised via password reset or OTP flows.

---

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | `demo@example.com` | `Demo@12345` |
| Accountant | `demo.accounts@example.com` | `Demo@12345` |

The password is fixed intentionally to make live demos frictionless. The accounts are scoped to the demo company only.

---

## What's seeded

| Entity | Count | Notes |
|---|---|---|
| Company | 1 | `Demo Meridian Retail Pvt Ltd` (GSTIN 27AAACD0001M1Z, Maharashtra) |
| Users | 2 | Admin + Accountant, `example.com` domain, email verified, active |
| Items | 16 | Goods + services, 5 GST slabs (0%, 5%, 12%, 18%), real HSN/SAC codes |
| Customers | 16 | 5 groups (`Retail Chain`, `Wholesale`, `HoReCa`, `Hospitality`, `Services`), 2 ungrouped, 2 without GSTIN (B2C), 1 archived, inter-state + intra-state |
| Invoices | 55 | Spread across 14 months, covering **two financial years** (2025–26 and 2026–27), with all statuses (`draft`, `sent`, `partially_paid`, `paid`, `overdue`, `cancelled`). Invoice numbers are sequential per FY and reset correctly. |
| Payments | 27 | Distributed across Bank Transfer, UPI, Cash against paid/partially paid invoices |
| Monthly bills | 6 | Standing monthly items, quantities, discounts and GST rates for key customers (used by the Monthly Bills generation flow) |
| Quotations | 3 | Draft, Sent, Accepted with line items and GST computed |
| Credit notes | 1 | Issued against a returned item, linked to an invoice when applicable |
| Certificate templates | 1 | Active certificate template |

**Live invoice value (non-cancelled):** ~₹23,84,421. Totals, CGST/SGST/IGST splits, round-off and taxable values are all computed using the same `gst.service.ts` and `numbering.service.ts` as production.

---

## How it works

The seed:

1. Calls `runMigrations()` (idempotent) so tables exist even on a fresh database.
2. Finds any existing demo company (`name LIKE 'Demo %'`). If present and no `--reset`, it aborts.
3. If `--reset` is provided, deletes only the demo company (and its users if they have no other company memberships). Real tenants remain untouched.
4. Creates users with a bcrypt-hashed password (`Demo@12345`).
5. Creates the demo company, preferences, roles (admin + accountant).
6. Seeds catalogue items and customers using **only columns that exist in `schema.sql`** (it never assumes legacy columns). This keeps it compatible with fresh installs and legacy prod databases alike.
7. Generates 55 invoices over the last 14 months by rotating customers and items. Statuses are intentionally varied so filters on the Invoices page show meaningful data. Invoice numbers use the real `nextDocumentNumber()` (atomic per company + financial year).
8. Creates payments for paid/partially paid invoices, 6 monthly bills, 3 quotations, 1 credit note and 1 certificate template.
9. All tax calculations go through `computeLineTax()` and `aggregateTotals()` so CGST/SGST vs IGST and round-off match production exactly.

The seed script lives at [`backend/src/db/seed.ts`](backend/src/db/seed.ts) and is invoked via `npm run seed` (defined in [`backend/package.json`](backend/package.json#L10)).

---

## Running on production

You run the seed **from your own machine**, not from the Render shell. The script connects
directly to the Turso database using the same credentials the app uses, so it only needs the two
Turso env vars — no redeploy and no shell access to the server required.

### Step 1 — get the credentials

In Render: your service → **Environment**. Copy the values of:

- `TURSO_DATABASE_URL` — e.g. `libsql://your-db-yourname.turso.io`
- `TURSO_AUTH_TOKEN` — the long JWT string

> If either is still the literal placeholder from `render.yaml` (`your-database-name-org…` or
> `PASTE_YOUR_TURSO_TOKEN_HERE`), the app is **not** using Turso at all — it silently falls back to
> `/tmp/data/billing.db` on Render's ephemeral disk, which is wiped on every redeploy. Fix that
> first; the seed now refuses to run against a placeholder URL.

You can also mint a fresh read/write token with the Turso CLI:

```bash
turso db tokens create <db-name> --type jwt
```

### Step 2 — point the seed at production

Put the credentials in `backend/.env` (already gitignored). The seed loads `.env` the same way the
app does, so this is sufficient — no need to export anything into your shell:

```dotenv
TURSO_DATABASE_URL=libsql://your-db-yourname.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
```

### Step 3 — confirm the target (read-only)

```bash
cd backend
npm run seed -- --check
```

You must see the Turso line. Anything else means you are pointed at a local file:

```
Target: Turso (production) — libsql://your-db-yourname.turso.io
```

```
Target: local database backend/data/billing.db
  WARNING: TURSO_DATABASE_URL is not set, so this is NOT the production database.
```

### Step 4 — seed

```bash
SEED_CONFIRM=yes npm run seed -- --reset
```

Add `--yes` instead of `SEED_CONFIRM=yes` if you prefer. The command prints what it deleted and what
it created, ending with the demo login details.

### Step 5 — verify

```bash
curl -s -X POST https://billgst-api.onrender.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"Demo@12345"}'
```

A `token` in the response means the demo account is live on prod.

### Notes

- Running the seed with `--reset` deletes **only** the company whose name starts with `Demo `. Your
  real companies, customers and invoices are untouched. This was verified against a database
  containing real production data.
- Only one demo tenant can exist. Re-running without `--reset` exits with code `1`.
- Seeded invoice dates are relative to the day you seed. Re-run with `--reset` to refresh them.

### Production troubleshooting

| Symptom | Cause |
|---|---|
| `401 Invalid email or password` after seeding | Seed ran against a different database than the API. Re-check with `--check`. |
| `Refusing to run: TURSO_DATABASE_URL is still a placeholder` | Credentials in `.env` are the `render.yaml` placeholders. |
| `SERVER_ERROR: Server returned HTTP status 404` | Turso URL is wrong, or the token lacks write permission. |
| Login works but the dashboard is empty | The app is pointed at a different DB. Confirm the company switcher shows `Demo Meridian Retail Pvt Ltd`. |

---

## Resetting the demo

To rebuild demo data from scratch (e.g. to refresh invoice dates to "today"):

```bash
npm run seed -- --reset --yes
```

This deletes **only** the demo company and its users (if unshared), and recreates everything with fresh dates. Real companies, customers, invoices, payments and other data remain completely untouched. This has been verified against a database containing real production data.

---

## Verification & integrity checks

The seed enforces and validates several invariants:

- **Tax integrity:** No invoice has both CGST/SGST and IGST > 0; `is_interstate` matches whether IGST > 0; place of supply never conflicts with the interstate flag.
- **Totals reconcile:** `grand_total == taxable_value + total_cgst + total_sgst + total_igst + round_off` (within ₹0.01) for every invoice.
- **Payments valid:** `amount_paid <= grand_total` for all invoices; `amount_paid > 0` only for `paid`/`partially_paid` statuses.
- **Numbering:** Invoice/counter sequences are independent per company and per financial year (verified against a legacy company that already had its own counters).
- **Isolation:** Demo token cannot access non-demo company routes (403). The demo company list returned to the demo user contains only the demo company.
- **Backward compatibility:** Runs successfully on both fresh databases (no legacy columns) and legacy production databases (which may contain columns like `customers.billing_state_code` that are no longer in `schema.sql`).

---

## Troubleshooting

**"A demo tenant already exists"**  
Run `npm run seed -- --reset --yes` to replace it.

**"Refusing to delete without confirmation"**  
Add `--yes` to the command, or set `SEED_CONFIRM=yes` in your environment.

**Seed fails on startup with "no such table: companies"**  
The seed calls `runMigrations()` internally, so this should not happen. If it does, ensure the backend can read `backend/src/db/schema.sql` (the build copies it to `dist/db/schema.sql`).

**Column mismatch errors (e.g. "table items has no column named created_by")**  
These indicate the seed was written against a different schema. The current seed validates against `schema.sql` and only inserts columns that actually exist. If you modify the schema, update the `INSERT` column lists in `seed.ts` to match.

**Demo login fails after seeding**  
Verify the credentials exactly: `demo@example.com` / `Demo@12345` (case-sensitive). Also confirm the app is running with the same database the seed wrote to (`DB_PATH`/`TURSO_*` env vars).

---

For implementation details, see [`backend/src/db/seed.ts`](backend/src/db/seed.ts).