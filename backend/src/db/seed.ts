/**
 * Demo data seed.
 *
 * Creates a self-contained demo tenant: one admin + one accountant user, a
 * company, items, customers, invoices, payments, monthly bills, quotations, a
 * credit note and a certificate template. Everything is scoped to the demo
 * company id, so the demo login can never read or write real customer data.
 *
 * Usage:
 *   npm run seed                    -- create the demo tenant (refuses if one exists)
 *   npm run seed -- --reset         -- delete any existing demo tenant, then recreate
 *   SEED_CONFIRM=yes npm run seed -- --reset    -- skip the deletion confirmation
 *   npm run seed -- --check         -- read-only: report whether a demo tenant exists
 *
 * Demo logins use the reserved example.com domain, which can never receive
 * mail, so the account can never be taken over via password reset or OTP.
 */
// Must come first so TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in backend/.env are
// honoured, exactly as they are for the running app (see src/index.ts).
import 'dotenv/config';
import { db, runMigrations } from './connection.js';
import { newId } from '../utils/id.js';
import { hashPassword } from '../utils/password.js';
import {
  aggregateTotals,
  computeGSTINCheckDigit,
  computeLineTax,
  financialYearLabel,
  round2,
  stateCodeFromGSTIN,
  validateGSTIN,
  type TaxableLine,
} from '../services/gst.service.js';
import { nextDocumentNumber } from '../services/numbering.service.js';

const DEMO_DOMAIN = 'example.com';
const ADMIN_EMAIL = `demo@${DEMO_DOMAIN}`;
const ACCOUNTANT_EMAIL = `demo.accounts@${DEMO_DOMAIN}`;
const DEMO_PASSWORD = 'Demo@12345';
/** Company name prefix doubles as the marker used to find a previous demo tenant. */
const COMPANY_PREFIX = 'Demo ';

const args = process.argv.slice(2);
const shouldReset = args.includes('--reset');
const skipConfirm = args.includes('--yes');
const checkOnly = args.includes('--check');

function log(msg: string) {
  console.log(msg);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** First day of the month, `offset` months from the base month. */
function monthOffset(base: Date, offset: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + offset, 1);
}

/** Builds a structurally valid GSTIN by appending the correct checksum digit. */
function gstin(first14: string): string {
  const full = first14 + computeGSTINCheckDigit(first14);
  const check = validateGSTIN(full);
  if (!check.valid) throw new Error(`Seed GSTIN "${full}" is invalid: ${check.reason}`);
  return full;
}

function formatInr(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

/* -------------------------------------------------------------------------- */
/*  Reference data                                                            */
/* -------------------------------------------------------------------------- */

const COMPANY = {
  name: 'Demo Meridian Retail Pvt Ltd',
  gstin: gstin('27AAACD0001M1Z'),
  pan: 'AAACD0001M',
  addressLine1: '4th Floor, Aurum Business Park',
  addressLine2: 'Andheri East',
  city: 'Mumbai',
  state: 'Maharashtra',
  stateCode: '27',
  pincode: '400069',
  fyStartMonth: 4,
  invoicePrefix: 'INV',
  quotationPrefix: 'QTN',
  creditNotePrefix: 'CN',
  debitNotePrefix: 'DN',
  certificatePrefix: 'CERT',
};

interface SeedCustomer {
  name: string;
  group: string | null;
  /** Null for a walk-in/B2C customer with no GSTIN. */
  gstin: string | null;
  email?: string;
  phone?: string;
  city: string;
  state: string;
  archived?: boolean;
}

const CUSTOMERS: SeedCustomer[] = [
  { name: 'Sharma Retail Chains Pvt Ltd', group: 'Retail Chain', gstin: gstin('27AAGCS1122R1Z'), email: 'accounts@sharmaretail.example.com', phone: '+91 98200 11223', city: 'Pune', state: 'Maharashtra' },
  { name: 'Kohli Supermarket Ltd', group: 'Retail Chain', gstin: gstin('27AAECK3344T1Z'), email: 'purchase@kohlismart.example.com', phone: '+91 98330 55661', city: 'Nashik', state: 'Maharashtra' },
  { name: 'Bhatia Kirana Stores', group: 'Retail Chain', gstin: gstin('27AAMFB7788U1Z'), email: 'billing@bhatiakirana.example.com', phone: '+91 90040 22331', city: 'Mumbai', state: 'Maharashtra' },
  { name: 'Nandini Fresh Foods', group: 'Wholesale', gstin: gstin('27AAECN9900V1Z'), email: 'accounts@nandini.example.com', phone: '+91 98111 44556', city: 'Mumbai', state: 'Maharashtra' },
  { name: 'Deccan Distributors LLP', group: 'Wholesale', gstin: gstin('27AAEFD1234W1Z'), email: 'gst@deccandist.example.com', phone: '+91 98220 77889', city: 'Aurangabad', state: 'Maharashtra' },
  { name: 'Konkan Traders', group: 'Wholesale', gstin: gstin('27AAEGK6677Y1Z'), email: 'billing@konkantraders.example.com', phone: '+91 97650 33112', city: 'Ratnagiri', state: 'Maharashtra' },
  { name: 'Vaibhav Hospitality Services', group: 'HoReCa', gstin: gstin('27AAECV2233L1Z'), email: 'admin@vaibhavhospitality.example.com', phone: '+91 99870 44556', city: 'Mumbai', state: 'Maharashtra' },
  { name: 'Spice Route Restaurants', group: 'HoReCa', gstin: gstin('27AAECS4455M1Z'), email: 'accounts@spiceroute.example.com', phone: '+91 88790 66778', city: 'Pune', state: 'Maharashtra' },
  { name: 'Blue Tokai Cafe Co', group: 'HoReCa', gstin: gstin('27AAECT8899K1Z'), email: 'hello@bluetokaicafe.example.com', phone: '+91 99300 11223', city: 'Mumbai', state: 'Maharashtra' },
  // Inter-state customers, so IGST is visible in the demo.
  { name: 'Sunrise Hotels Pvt Ltd', group: 'Hospitality', gstin: gstin('29AAGCS4455N1Z'), email: 'purchase@sunrisehotels.example.com', phone: '+91 80412 33445', city: 'Bengaluru', state: 'Karnataka' },
  { name: 'Lotus IT Services Pvt Ltd', group: 'Services', gstin: gstin('29AACCL6677P1Z'), email: 'ap@lotusit.example.com', phone: '+91 98860 55667', city: 'Bengaluru', state: 'Karnataka' },
  { name: 'Ganga Electronics Ltd', group: 'Wholesale', gstin: gstin('06AAGCG2211Q1Z'), email: 'accounts@gangaelectronics.example.com', phone: '+91 98115 22334', city: 'New Delhi', state: 'Delhi' },
  { name: 'Chennai Textiles Pvt Ltd', group: 'Wholesale', gstin: gstin('33AAGCC3322R1Z'), email: 'billing@chennaittextiles.example.com', phone: '+91 98410 44556', city: 'Chennai', state: 'Tamil Nadu' },
  // No group and no GSTIN: exercises the B2C and ungrouped paths.
  { name: 'Walk-in Customer (Cash Sale)', group: null, gstin: null, city: 'Mumbai', state: 'Maharashtra' },
  { name: 'Ramesh Rao (Individual)', group: null, gstin: null, email: 'ramesh.rao@example.com', phone: '+91 99999 00011', city: 'Mumbai', state: 'Maharashtra' },
  // Archived: shows how archived customers are treated.
  { name: 'Legacy Traders (Closed)', group: 'Wholesale', gstin: gstin('27AAECL7788T1Z'), city: 'Mumbai', state: 'Maharashtra', archived: true },
];

interface SeedItem {
  name: string;
  description: string;
  hsn: string;
  unit: string;
  rate: number;
  gstRate: number;
  itemType: 'goods' | 'service';
}

const ITEMS: SeedItem[] = [
  { name: 'Aashirvaad Whole Wheat Atta 10kg', description: 'Aashirvaad Chakki Fresh Atta, 10 kg pack', hsn: '19059020', unit: 'BAG', rate: 545, gstRate: 5, itemType: 'goods' },
  { name: 'Tata Salt Iodised 1kg', description: 'Tata Salt, iodised, 1 kg', hsn: '25010010', unit: 'KG', rate: 28, gstRate: 5, itemType: 'goods' },
  { name: 'Fortune Sunflower Oil 5L', description: 'Fortune Sunflower Oil, 5 litre pouch', hsn: '15121110', unit: 'NOS', rate: 1150, gstRate: 5, itemType: 'goods' },
  { name: 'Daawat Basmati Rice 5kg', description: 'Daawat Traditional Basmati Rice, 5 kg', hsn: '10063020', unit: 'BAG', rate: 2490, gstRate: 5, itemType: 'goods' },
  { name: 'Surf Excel Matic 2kg', description: 'Surf Excel Matic detergent, 2 kg', hsn: '34022000', unit: 'NOS', rate: 480, gstRate: 18, itemType: 'goods' },
  { name: 'Vim Dishwash Gel 1L', description: 'Vim dishwash gel, 1 litre', hsn: '34022000', unit: 'NOS', rate: 210, gstRate: 18, itemType: 'goods' },
  { name: 'Harpic Toilet Cleaner 1L', description: 'Harpic toilet cleaner, 1 litre', hsn: '34022000', unit: 'NOS', rate: 195, gstRate: 18, itemType: 'goods' },
  { name: 'Dove Beauty Soap 4x100g', description: 'Dove beauty bathing bar, pack of 4', hsn: '34011190', unit: 'PKT', rate: 460, gstRate: 18, itemType: 'goods' },
  { name: 'Colgate MaxFresh Toothpaste 200g', description: 'Colgate MaxFresh Strong Mint, 200 g', hsn: '33061020', unit: 'TUBE', rate: 165, gstRate: 18, itemType: 'goods' },
  { name: 'AAA Alkaline Battery (4-pack)', description: 'AAA alkaline battery, pack of 4', hsn: '85076000', unit: 'PKT', rate: 320, gstRate: 18, itemType: 'goods' },
  { name: 'LED Panel Light 18W', description: 'LED panel light, 18 W, warm white', hsn: '94054090', unit: 'NOS', rate: 640, gstRate: 12, itemType: 'goods' },
  { name: 'Last-mile Delivery (per km)', description: 'Last-mile delivery within city limits, per km', hsn: '996511', unit: 'KM', rate: 22, gstRate: 5, itemType: 'service' },
  { name: 'Monthly AMC — Cold Storage', description: 'Monthly annual maintenance for cold storage unit', hsn: '998719', unit: 'MON', rate: 4500, gstRate: 18, itemType: 'service' },
  { name: 'Installation & Commissioning', description: 'On-site installation and commissioning of equipment', hsn: '998731', unit: 'NOS', rate: 2500, gstRate: 18, itemType: 'service' },
  { name: 'Printed Carry Bag (large)', description: 'Branded recycled paper carry bag, large', hsn: '48191010', unit: 'NOS', rate: 12, gstRate: 12, itemType: 'goods' },
  { name: 'Corrugated Box — 3 tier', description: 'Corrugated shipping box, 3 ply, 18x12x10 in', hsn: '48191010', unit: 'NOS', rate: 38, gstRate: 12, itemType: 'goods' },
];

/** Per-customer standing order backing the monthly bill feature. */
const MONTHLY_BILL_FOR: Record<string, Array<{ item: number; qty: number; rate?: number; discount?: number }>> = {
  'Sharma Retail Chains Pvt Ltd': [
    { item: 0, qty: 40, rate: 530 },
    { item: 2, qty: 12, rate: 1120 },
    { item: 6, qty: 20 },
    { item: 15, qty: 300 },
  ],
  'Kohli Supermarket Ltd': [
    { item: 1, qty: 150, discount: 5 },
    { item: 3, qty: 25, rate: 2440 },
    { item: 7, qty: 40 },
  ],
  'Nandini Fresh Foods': [
    { item: 4, qty: 60, rate: 465 },
    { item: 8, qty: 80 },
    { item: 15, qty: 500 },
  ],
  'Konkan Traders': [
    { item: 2, qty: 25 },
    { item: 12, qty: 1 },
    { item: 13, qty: 2, rate: 2200 },
  ],
  'Spice Route Restaurants': [
    { item: 0, qty: 30 },
    { item: 7, qty: 25 },
    { item: 14, qty: 200 },
  ],
  'Sunrise Hotels Pvt Ltd': [
    { item: 5, qty: 18 },
    { item: 9, qty: 30 },
    { item: 11, qty: 120 },
  ],
};

/* -------------------------------------------------------------------------- */
/*  Existing demo tenant                                                      */
/* -------------------------------------------------------------------------- */

async function findDemoCompany(): Promise<{ id: string; name: string } | null> {
  const row = (await db
    .prepare(`SELECT id, name FROM companies WHERE name LIKE ? ORDER BY created_at LIMIT 1`)
    .get(`${COMPANY_PREFIX}%`)) as any;
  return row || null;
}

async function deleteDemoTenant(): Promise<void> {
  const existing = await findDemoCompany();
  if (!existing) return;

  log(`Removing existing demo tenant: ${existing.name} (${existing.id})`);
  // ON DELETE CASCADE clears every child row; the explicit deletes below cover
  // anything that might predate the cascade.
  await db.prepare(`DELETE FROM companies WHERE id = ?`).run(existing.id);

  for (const email of [ADMIN_EMAIL, ACCOUNTANT_EMAIL]) {
    const user = (await db.prepare(`SELECT id FROM users WHERE email = ?`).get(email)) as any;
    if (!user) continue;
    const remaining = (await db
      .prepare(`SELECT COUNT(*) as count FROM user_company_roles WHERE user_id = ?`)
      .get(user.id)) as any;
    if ((remaining?.count || 0) === 0) {
      await db.prepare(`DELETE FROM users WHERE id = ?`).run(user.id);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Seed                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Guards against seeding the wrong database. render.yaml ships Turso values as
 * visible placeholders, and the app silently falls back to an ephemeral local
 * file when they are unset, so both cases must be caught up front.
 */
function assertRealTarget() {
  const url = process.env.TURSO_DATABASE_URL;
  if (url && /your-database-name-org|PASTE_|changeme|todo/i.test(url)) {
    console.error(
      `\nRefusing to run: TURSO_DATABASE_URL is still a placeholder.\n  ${url}\n` +
        'Set the real Turso URL in backend/.env (Render dashboard → your service → Environment).\n'
    );
    process.exit(1);
  }
}

function describeTarget(): string {
  const url = process.env.TURSO_DATABASE_URL;
  return url
    ? `Turso (production) — ${url.replace(/\/\/.*@/, '//***@')}`
    : `local database ${process.env.DB_PATH || '(default)'}\n` +
        '  WARNING: TURSO_DATABASE_URL is not set, so this is NOT the production database.';
}

/** Read-only inspection: safe to run against production at any time. */
async function check() {
  log(`\nTarget: ${describeTarget()}\n`);

  const demo = await findDemoCompany();
  if (!demo) {
    log('No demo tenant found. Run:  npm run seed\n');
    return;
  }

  const count = async (table: string, where = '', ...p: any[]) =>
    ((await db.prepare(`SELECT COUNT(*) as n FROM ${table} ${where}`).all(...p))[0] as any).n as number;

  const adminUser = (await db.prepare(`SELECT id FROM users WHERE email = ?`).get(ADMIN_EMAIL)) as any;
  log(`Demo tenant    ${demo.name}`);
  log(`  company id  ${demo.id}`);
  log(`  logins      ${ADMIN_EMAIL} (${adminUser ? 'present' : 'MISSING'}), ${ACCOUNTANT_EMAIL}`);
  log(`  customers   ${await count('customers', 'WHERE company_id = ?', demo.id)}`);
  log(`  items       ${await count('items', 'WHERE company_id = ?', demo.id)}`);
  log(`  invoices    ${await count('invoices', 'WHERE company_id = ?', demo.id)}`);
  log(`  monthly bills ${await count('customer_monthly_bills', 'WHERE company_id = ?', demo.id)}`);
  log(`\nOther companies in this database: ${(await count('companies', "WHERE name NOT LIKE 'Demo %'"))}`);
  log('\nRead-only check complete; nothing was modified.\n');
}

async function main() {
  // Refuse to write anywhere if the Turso URL is still a blueprint placeholder.
  assertRealTarget();

  // Idempotent: a no-op on an already-migrated database. Runs before the
  // read-only check too, so `--check` works on a fresh or partially migrated DB.
  await runMigrations();
  if (checkOnly) return check();
  await db.prepare(`PRAGMA foreign_keys = ON`).run();

  const existing = await findDemoCompany();
  if (existing && !shouldReset) {
    console.error(
      `\nA demo tenant already exists (${existing.name}).\n` +
        `Re-run with --reset to delete and recreate it:  npm run seed -- --reset\n` +
        `Add --yes to skip the confirmation prompt.\n`
    );
    process.exit(1);
  }

  if (existing && !skipConfirm) {
    const target = process.env.TURSO_DATABASE_URL
      ? 'the PRODUCTION Turso database'
      : `database ${process.env.DB_PATH || '(local default)'}`;
    log(`\nThis will permanently delete the demo tenant from ${target}:`);
    log(`  company: ${existing.name} (${existing.id})`);
    log(`  logins:  ${ADMIN_EMAIL}, ${ACCOUNTANT_EMAIL}`);
    const answer = (process.env.SEED_CONFIRM || '').trim().toLowerCase();
    if (answer !== 'yes' && answer !== 'y') {
      console.error(
        '\nRefusing to delete without confirmation.\n' +
          'Re-run with SEED_CONFIRM=yes to proceed non-interactively, or pass --yes.\n'
      );
      process.exit(1);
    }
  }

  if (existing) await deleteDemoTenant();

  const today = new Date();
  const stamp = Date.now().toString().slice(-6);

  // --- users -------------------------------------------------------------
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const adminId = newId();
  const accountantId = newId();
  await db
    .prepare(`INSERT INTO users (id, name, email, password_hash, is_active, email_verified) VALUES (?,?,?,?,1,1)`)
    .run(adminId, 'Demo Admin', ADMIN_EMAIL, passwordHash);
  await db
    .prepare(`INSERT INTO users (id, name, email, password_hash, is_active, email_verified) VALUES (?,?,?,?,1,1)`)
    .run(accountantId, 'Demo Accountant', ACCOUNTANT_EMAIL, passwordHash);

  // --- company -----------------------------------------------------------
  const companyId = newId();
  await db
    .prepare(
      `INSERT INTO companies (
         id, name, gstin, pan, address_line1, address_line2, city, state, state_code, pincode,
         financial_year_start_month, invoice_prefix, quotation_prefix, credit_note_prefix,
         debit_note_prefix, certificate_prefix, created_by
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      companyId,
      COMPANY.name,
      COMPANY.gstin,
      COMPANY.pan,
      COMPANY.addressLine1,
      COMPANY.addressLine2,
      COMPANY.city,
      COMPANY.state,
      COMPANY.stateCode,
      COMPANY.pincode,
      COMPANY.fyStartMonth,
      COMPANY.invoicePrefix,
      COMPANY.quotationPrefix,
      COMPANY.creditNotePrefix,
      COMPANY.debitNotePrefix,
      COMPANY.certificatePrefix,
      adminId
    );

  await db
    .prepare(`INSERT INTO company_preferences (company_id, print_design, download_design) VALUES (?, 'classic', 'classic')`)
    .run(companyId);

  for (const [userId, role] of [
    [adminId, 'admin'],
    [accountantId, 'accountant'],
  ] as const) {
    await db
      .prepare(`INSERT INTO user_company_roles (id, user_id, company_id, role) VALUES (?,?,?,?)`)
      .run(newId(), userId, companyId, role);
  }

  // --- items -------------------------------------------------------------
  const itemIds: string[] = [];
  for (const item of ITEMS) {
    const id = newId();
    itemIds.push(id);
    await db
      .prepare(
        `INSERT INTO items (
           id, company_id, name, description, hsn_sac_code, item_type, unit, sale_price, gst_rate,
           track_inventory, is_active
         ) VALUES (?,?,?,?,?,?,?,?,?,0,1)`
      )
      .run(id, companyId, item.name, item.description, item.hsn, item.itemType, item.unit, item.rate, item.gstRate);
  }

  // --- customers ---------------------------------------------------------
  // Only columns that exist in schema.sql are written here. Some long-lived
  // databases carry extra legacy customer columns (city, billing_state_code);
  // those are deliberately not depended upon.
  const customerIds: Record<string, string> = {};
  for (const c of CUSTOMERS) {
    const id = newId();
    customerIds[c.name] = id;
    await db
      .prepare(
        `INSERT INTO customers (id, company_id, name, customer_group, gstin, pan, email, phone, billing_address, is_active)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        id,
        companyId,
        c.name,
        c.group,
        c.gstin,
        c.gstin ? c.gstin.slice(2, 12) : null,
        c.email || null,
        c.phone || null,
        [c.city, c.state].join(', '),
        c.archived ? 0 : 1
      );
  }

  /** GSTIN prefix wins, else the customer's own state, else the company state. */
  const placeOfSupplyFor = (name: string): string => {
    const c = CUSTOMERS.find((x) => x.name === name)!;
    return stateCodeFromGSTIN(c.gstin || '') || COMPANY.stateCode;
  };

  /* ---------------------------------------------------------------------- */
  /*  Invoices across 14 months, so more than one financial year is present.  */
  /* ---------------------------------------------------------------------- */

  const activeCustomers = CUSTOMERS.filter((c) => !c.archived && c.gstin);
  let invoiceCount = 0;
  let paymentCount = 0;
  let totalInvoiced = 0;

  for (let offset = -13; offset <= 0; offset++) {
    const invoiceDate = monthOffset(today, offset);
    // Deterministic rotation: repeated --reset runs produce identical data.
    const roster = [0, 3, 6, 9, 11, 1, 4, 7, 12, 2, 5, 10, 13, 8, 3, 6, 9];
    const count = 3 + (Math.abs(offset) % 3);

    for (let k = 0; k < count; k++) {
      const customer = activeCustomers[roster[(Math.abs(offset) * 2 + k) % roster.length] % activeCustomers.length];
      if (!customer) continue;

      const isInterstate = placeOfSupplyFor(customer.name) !== COMPANY.stateCode;
      const picks = [
        (Math.abs(offset) + k) % ITEMS.length,
        (Math.abs(offset) * 3 + k * 2) % ITEMS.length,
        (Math.abs(offset) + k * 5 + 7) % ITEMS.length,
      ].filter((v, idx, arr) => arr.indexOf(v) === idx);

      const lines = picks.map((idx, li) => {
        const item = ITEMS[idx];
        return {
          itemId: itemIds[idx],
          description: item.description,
          hsn: item.hsn,
          qty: li === 0 ? 10 + (Math.abs(offset) * 3 + k) % 40 : 2 + (Math.abs(offset) + k + li) % 10,
          unit: item.unit,
          rate: item.rate,
          discount: k % 4 === 0 && li === 1 ? 5 : 0,
          gstRate: item.gstRate,
        };
      });

      const taxable: TaxableLine[] = lines.map((l) => ({
        qty: l.qty,
        rate: l.rate,
        discountPercent: l.discount,
        gstRate: l.gstRate,
      }));
      const taxed = taxable.map((l) => computeLineTax(l, isInterstate));
      const totals = aggregateTotals(taxable, taxed);

      const age = Math.abs(offset);
      const roll = (age * 3 + k) % 10;
      // Recent months are still being worked on; older ones are settled or overdue.
      let status: string;
      if (age === 0 && roll < 4) status = 'draft';
      else if (roll === 9) status = 'cancelled';
      else if (age <= 1) status = roll < 5 ? 'sent' : 'partially_paid';
      else if (roll < 4) status = 'paid';
      else if (roll < 6) status = 'partially_paid';
      else if (roll < 9) status = 'overdue';
      else status = 'sent';

      const invoiceId = newId();
      const invoiceNumber = await nextDocumentNumber(companyId, 'invoice', invoiceDate);

      let amountPaid = 0;
      if (status === 'paid') amountPaid = totals.grandTotal;
      else if (status === 'partially_paid') amountPaid = round2(totals.grandTotal * 0.4);

      await db
        .prepare(
          `INSERT INTO invoices (
             id, company_id, invoice_number, financial_year, invoice_date, due_date, customer_id,
             place_of_supply_state_code, is_interstate, subtotal, total_discount, taxable_value,
             total_cgst, total_sgst, total_igst, round_off, grand_total, amount_paid, status,
             notes, terms, reverse_charge, created_by
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)`
        )
        .run(
          invoiceId,
          companyId,
          invoiceNumber,
          financialYearLabel(invoiceDate, COMPANY.fyStartMonth),
          iso(invoiceDate),
          iso(addDays(invoiceDate, 21)),
          customerIds[customer.name],
          placeOfSupplyFor(customer.name),
          isInterstate ? 1 : 0,
          totals.subtotal,
          totals.totalDiscount,
          totals.taxableValue,
          totals.totalCgst,
          totals.totalSgst,
          totals.totalIgst,
          totals.roundOff,
          totals.grandTotal,
          amountPaid,
          status,
          status === 'draft' ? null : 'Thank you for your business.',
          'Payment due within 21 days of invoice date.',
          adminId
        );

      for (const [idx, l] of lines.entries()) {
        const t = taxed[idx];
        await db
          .prepare(
            `INSERT INTO invoice_items (
               id, invoice_id, item_id, description, hsn_sac_code, qty, unit, rate, discount_percent,
               taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, line_total, sort_order
             ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
          )
          .run(
            newId(),
            invoiceId,
            l.itemId,
            l.description,
            l.hsn,
            l.qty,
            l.unit,
            l.rate,
            l.discount,
            t.taxableValue,
            l.gstRate,
            t.cgstAmount,
            t.sgstAmount,
            t.igstAmount,
            t.lineTotal,
            idx
          );
      }

      if (amountPaid > 0) {
        await db
          .prepare(
            `INSERT INTO payments (id, company_id, invoice_id, payment_date, amount, payment_mode, reference_no, created_by)
             VALUES (?,?,?,?,?,?,?,?)`
          )
          .run(
            newId(),
            companyId,
            invoiceId,
            iso(addDays(invoiceDate, 7)),
            amountPaid,
            ['bank_transfer', 'upi', 'cash'][(age + k) % 3],
            `DEMO${stamp}${k}`,
            adminId
          );
        paymentCount++;
      }

      invoiceCount++;
      if (status !== 'cancelled') totalInvoiced += totals.grandTotal;
    }
  }

  // --- monthly bills -----------------------------------------------------
  let monthlyBillCount = 0;
  for (const [name, lines] of Object.entries(MONTHLY_BILL_FOR)) {
    const billId = newId();
    await db
      .prepare(`INSERT INTO customer_monthly_bills (id, company_id, customer_id, notes) VALUES (?,?,?,?)`)
      .run(billId, companyId, customerIds[name], 'Standing monthly supply and service retainer.');
    for (const [idx, l] of lines.entries()) {
      const item = ITEMS[l.item];
      await db
        .prepare(
          `INSERT INTO customer_monthly_bill_items (
             id, monthly_bill_id, item_id, description, hsn_sac_code, qty, unit, rate, discount_percent, gst_rate, sort_order
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          newId(),
          billId,
          itemIds[l.item],
          item.description,
          item.hsn,
          l.qty,
          item.unit,
          l.rate ?? item.rate,
          l.discount ?? 0,
          item.gstRate,
          idx
        );
    }
    monthlyBillCount++;
  }

  // --- quotations --------------------------------------------------------
  let quotationCount = 0;
  for (const [name, idx, status] of [
    ['Vaibhav Hospitality Services', 12, 'draft'],
    ['Lotus IT Services Pvt Ltd', 11, 'sent'],
    ['Ganga Electronics Ltd', 9, 'accepted'],
  ] as const) {
    const date = monthOffset(today, -1);
    const item = ITEMS[idx];
    const qty = 4;
    const taxable: TaxableLine[] = [{ qty, rate: item.rate, discountPercent: 0, gstRate: item.gstRate }];
    const isInterstate = placeOfSupplyFor(name) !== COMPANY.stateCode;
    const taxed = [computeLineTax(taxable[0], isInterstate)];
    const totals = aggregateTotals(taxable, taxed);
    const quotationId = newId();

    await db
      .prepare(
        `INSERT INTO quotations (
           id, company_id, quotation_number, financial_year, quotation_date, valid_until, customer_id,
           place_of_supply_state_code, is_interstate, subtotal, total_discount, taxable_value,
           total_cgst, total_sgst, total_igst, round_off, grand_total, status, notes, terms, created_by
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        quotationId,
        companyId,
        await nextDocumentNumber(companyId, 'quotation', date),
        financialYearLabel(date, COMPANY.fyStartMonth),
        iso(date),
        iso(addDays(date, 30)),
        customerIds[name],
        placeOfSupplyFor(name),
        isInterstate ? 1 : 0,
        totals.subtotal,
        totals.totalDiscount,
        totals.taxableValue,
        totals.totalCgst,
        totals.totalSgst,
        totals.totalIgst,
        totals.roundOff,
        totals.grandTotal,
        status,
        'Quotation valid for 30 days from the date above.',
        null,
        adminId
      );

    await db
      .prepare(
        `INSERT INTO quotation_items (
           id, quotation_id, item_id, description, hsn_sac_code, qty, unit, rate, discount_percent,
           taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, line_total, sort_order
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        newId(),
        quotationId,
        itemIds[idx],
        item.description,
        item.hsn,
        qty,
        item.unit,
        item.rate,
        0,
        taxed[0].taxableValue,
        item.gstRate,
        taxed[0].cgstAmount,
        taxed[0].sgstAmount,
        taxed[0].igstAmount,
        taxed[0].lineTotal,
        0
      );
    quotationCount++;
  }

  // --- one credit note against a real invoice ---------------------------
  const cnDate = monthOffset(today, -2);
  const cnCustomerName = 'Sharma Retail Chains Pvt Ltd';
  const cnItem = ITEMS[0];
  const cnQty = 3;
  const cnTaxable: TaxableLine[] = [{ qty: cnQty, rate: cnItem.rate, discountPercent: 0, gstRate: cnItem.gstRate }];
  const cnIsInter = placeOfSupplyFor(cnCustomerName) !== COMPANY.stateCode;
  const cnTaxed = [computeLineTax(cnTaxable[0], cnIsInter)];
  const cnTotals = aggregateTotals(cnTaxable, cnTaxed);

  const sourceInvoice = (await db
    .prepare(`SELECT id FROM invoices WHERE customer_id = ? AND status = 'paid' ORDER BY invoice_date LIMIT 1`)
    .get(customerIds[cnCustomerName])) as any;

  const creditNoteId = newId();
  await db
    .prepare(
      `INSERT INTO credit_notes (
         id, company_id, note_type, note_number, financial_year, note_date, customer_id, invoice_id,
         reason, place_of_supply_state_code, is_interstate, taxable_value, total_cgst, total_sgst,
         total_igst, round_off, grand_total, status, notes, created_by
       ) VALUES (?,?,'credit',?,?,?,?,?,?,?,?,?,?,?,?,?,?,'issued',?,?)`
    )
    .run(
      creditNoteId,
      companyId,
      await nextDocumentNumber(companyId, 'credit_note', cnDate),
      financialYearLabel(cnDate, COMPANY.fyStartMonth),
      iso(cnDate),
      customerIds[cnCustomerName],
      sourceInvoice?.id || null,
      'Goods returned — damaged in transit',
      placeOfSupplyFor(cnCustomerName),
      cnIsInter ? 1 : 0,
      cnTotals.taxableValue,
      cnTotals.totalCgst,
      cnTotals.totalSgst,
      cnTotals.totalIgst,
      cnTotals.roundOff,
      cnTotals.grandTotal,
      'Issued against returned goods.',
      adminId
    );

  await db
    .prepare(
      `INSERT INTO credit_note_items (
         id, credit_note_id, item_id, description, hsn_sac_code, qty, unit, rate,
         taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, line_total
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      newId(),
      creditNoteId,
      itemIds[0],
      cnItem.description,
      cnItem.hsn,
      cnQty,
      cnItem.unit,
      cnItem.rate,
      cnTaxed[0].taxableValue,
      cnItem.gstRate,
      cnTaxed[0].cgstAmount,
      cnTaxed[0].sgstAmount,
      cnTaxed[0].igstAmount,
      cnTaxed[0].lineTotal
    );

  // --- certificate template ---------------------------------------------
  await db
    .prepare(
      `INSERT INTO certificate_templates (id, company_id, name, subject, body, is_default) VALUES (?,?,?,?,?,1)`
    )
    .run(
      newId(),
      companyId,
      'Certificate of Good Standing',
      'Account Standing',
      'This is to certify that the above named client has been a valued customer and that their account is in good standing.'
    );

  /* ---------------------------------------------------------------------- */

  log('\nDemo tenant created.\n');
  log(`  Company    ${COMPANY.name}`);
  log(`  Sign in as ${ADMIN_EMAIL}  (admin)`);
  log(`             ${ACCOUNTANT_EMAIL}  (accountant)`);
  log(`  Password   ${DEMO_PASSWORD}\n`);
  log('  Seeded:');
  log(`    items              ${ITEMS.length}`);
  log(`    customers          ${CUSTOMERS.length} (${CUSTOMERS.filter((c) => c.archived).length} archived, ${CUSTOMERS.filter((c) => !c.gstin).length} without GSTIN, ${CUSTOMERS.filter((c) => !c.group).length} ungrouped)`);
  log(`    invoices           ${invoiceCount} (${paymentCount} payments)`);
  log(`    monthly bills      ${monthlyBillCount}`);
  log(`    quotations         ${quotationCount}`);
  log(`    credit notes       1`);
  log(`    certificate tmpl   1`);
  log(`\n  Live invoice value: ${formatInr(totalInvoiced)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nSeed failed:\n', err);
    process.exit(1);
  });
