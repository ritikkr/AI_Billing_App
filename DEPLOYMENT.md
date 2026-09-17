# Deploying BillGST to Production (free)

This guide deploys the BillGST stack at **$0 / month**:

| Layer | Service | Free tier |
|-------|---------|-----------|
| Frontend | Cloudflare Pages | unlimited static sites |
| Backend | Render (Web Service) | 750 hrs/mo, spins down after 15 min idle |
| Database | Turso (libSQL) | 5 GB storage, 500 M reads / 10 M writes / mo |

---

## 1. Create a Turso database

```bash
# Install the Turso CLI (macOS)
brew install tursodatabase/tap/turso

# Sign up / log in
turso auth login

# Create the database
turso db create billgst

# Get the connection URL (e.g. libsql://billgst-yourorg.turso.io)
turso db show billgst --url

# Create an auth token
turso db tokens create billgst
```

Keep both values handy — you'll set them on Render next.

---

## 2. Deploy the backend to Render

### Option A: Render Blueprint (one-click)

Push the repo to GitHub/GitLab, then:

1. Go to <https://dashboard.render.com/blueprints>.
2. Click **New Blueprint**, select your repo.
3. Render reads `render.yaml` in the repo root.
4. In the **Environment** section, set:
   - `TURSO_DATABASE_URL` — the `libsql://…` URL from step 1.
   - `TURSO_AUTH_TOKEN` — the token from step 1.
   - `PUBLIC_API_URL` — the service's public URL, e.g. `https://billgst-api-xyz.onrender.com`. This is what Swagger UI `/api-docs` "Try it out" calls so requests go to the deployed origin instead of `localhost` (it also falls back to the incoming `Host` header if unset).
   - `BREVO_SMTP_USER` + `BREVO_SMTP_PASS` — Brevo SMTP login/key (needed for OTP emails; without them OTPs fall back to the server console).
5. Click **Apply**. Render builds and starts the service.
6. Copy the public URL (e.g. `https://billgst-api-xyz.onrender.com`).

### Option B: Manual setup

1. Go to <https://dashboard.render.com> → **New** → **Web Service**.
2. Connect your repo. Settings:
   - **Root directory:** `backend`
   - **Runtime:** Node
   - **Build command:** `npm ci && npm run build`
   - **Start command:** `npm start`
   - **Instance type:** Free
3. Under **Environment**, add:
   - `NODE_VERSION` = `20`
   - `JWT_SECRET` = *(generate a random string)*
   - `JWT_EXPIRES_IN` = `7d`
   - `PUBLIC_API_URL` = `https://billgst-api-xyz.onrender.com` *(the public API URL — used by Swagger "Try it out")*
   - `TURSO_DATABASE_URL` = *(from step 1)*
   - `TURSO_AUTH_TOKEN` = *(from step 1)*
   - `BREVO_SMTP_USER` + `BREVO_SMTP_PASS` = *(Brevo SMTP login/key for OTP emails)*
   - `BREVO_FROM_EMAIL` = `billing@yourdomain.com` *(optional)*
4. Create the service. It will build, run migrations on first boot, and listen on `/api/health`.

---

## 3. Deploy the frontend to Cloudflare Pages

### First-time setup

```bash
# Install the Cloudflare CLI
npm install -g wrangler

# Log in (opens a browser)
wrangler login

# Create the Pages project (from the frontend/ directory)
cd frontend
wrangler pages project create billgst-app
```

### Set the API base URL

In the Cloudflare Pages dashboard (or via CLI), set an environment variable:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://billgst-api-xyz.onrender.com/api` |

> **Important:** Vite bakes `VITE_*` env vars into the build at build time, so
> this variable **must** be set before you run the build.

### Build & deploy

```bash
# Build (uses VITE_API_URL baked in)
npm ci && npm run build

# Deploy to production
wrangler pages deploy dist --project-name=billgst-app
```

**Automated deployments:** Connect your repo to Cloudflare Pages via the
dashboard (Settings → Builds & deployments → Connect to Git). Set
`VITE_API_URL` in the Pages environment variables, and every push to `main`
will trigger a build and deploy.

---

## 4. Verify everything is live

1. Open `https://billgst-app.pages.dev` (your Pages URL).
2. Register a new account.
3. Create a company, add a customer, create an invoice.
4. Check the backend logs on Render if anything goes wrong.

---

## 5. (Optional) Seed some test data

```bash
cd backend
# Create a local copy of the Turso database for seeding
TURSO_DATABASE_URL=libsql://billgst-xxx.turso.io \
TURSO_AUTH_TOKEN=eyJ... \
npm run seed
```

> **Note:** The seed script is currently a stub (`src/db/seed.ts` is missing).
> Populate it before using.

---

## Local development

```bash
# Backend (uses a local SQLite file at backend/data/billing.db by default)
cd backend
npm install
npm run dev     # starts on http://localhost:4000

# Frontend (proxies /api to localhost:4000)
cd frontend
npm install
npm run dev     # starts on http://localhost:5173
```

No Turso env vars needed locally — the backend falls back to a file-based DB.

---

## How the migration was done (internal reference)

The app originally used `better-sqlite3` (synchronous). All routes, services,
and middleware were converted to async `@libsql/client` calls. Key points:

- **`db.prepare(sql).get/all/run`** — all now return Promises; every call site
  was wrapped in `await`.
- **Transactions** — `db.transaction(async (tx) => { … })`; the tx object has
  `.prepare()` just like the main `db`. No nested transactions.
- **`nextDocumentNumber()`** — accepts an optional `tx` parameter; callers inside
  transactions pass the tx object through.
- **Express middleware** — async middleware wrapped in `void (async () => { … })()`
  with errors forwarded to `next()`.
- **`runMigrations()`** — async, called at top level in `index.ts`.
