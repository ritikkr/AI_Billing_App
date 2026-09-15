-- Billing App schema (SQLite)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  email_verified INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_otps (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'register' CHECK (purpose IN ('register', 'login', 'reset')),
  expires_at TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gstin TEXT,
  pan TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT NOT NULL,
  state_code TEXT NOT NULL,
  pincode TEXT,
  phone TEXT,
  email TEXT,
  bank_name TEXT,
  bank_account_no TEXT,
  bank_ifsc TEXT,
  bank_branch TEXT,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  credit_note_prefix TEXT NOT NULL DEFAULT 'CN',
  debit_note_prefix TEXT NOT NULL DEFAULT 'DN',
  financial_year_start_month INTEGER NOT NULL DEFAULT 4,
  logo_url TEXT,
  signature_url TEXT,
  terms_and_conditions TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_company_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'accountant', 'viewer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, company_id)
);

CREATE TABLE IF NOT EXISTS company_preferences (
  company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  print_design TEXT NOT NULL DEFAULT 'classic' CHECK (print_design IN ('classic', 'modern', 'minimal', 'vyapar')),
  download_design TEXT NOT NULL DEFAULT 'classic' CHECK (download_design IN ('classic', 'modern', 'minimal', 'vyapar')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  customer_group TEXT,
  gstin TEXT,
  pan TEXT,
  email TEXT,
  phone TEXT,
  billing_address TEXT,
  shipping_address TEXT,
  credit_limit REAL NOT NULL DEFAULT 0,
  opening_balance REAL NOT NULL DEFAULT 0,
  receivable_balance REAL NOT NULL DEFAULT 0,
  payable_balance REAL NOT NULL DEFAULT 0,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  hsn_sac_code TEXT,
  item_type TEXT NOT NULL DEFAULT 'goods' CHECK (item_type IN ('goods', 'service')),
  unit TEXT NOT NULL DEFAULT 'NOS',
  sale_price REAL NOT NULL DEFAULT 0,
  purchase_price REAL,
  gst_rate REAL NOT NULL DEFAULT 18,
  stock_qty REAL,
  track_inventory INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_company ON items(company_id);

CREATE TABLE IF NOT EXISTS invoice_counters (
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  financial_year TEXT NOT NULL,
  series TEXT NOT NULL CHECK (series IN ('invoice', 'credit_note', 'debit_note')),
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, financial_year, series)
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  due_date TEXT,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  place_of_supply_state_code TEXT NOT NULL,
  is_interstate INTEGER NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  total_discount REAL NOT NULL DEFAULT 0,
  taxable_value REAL NOT NULL DEFAULT 0,
  total_cgst REAL NOT NULL DEFAULT 0,
  total_sgst REAL NOT NULL DEFAULT 0,
  total_igst REAL NOT NULL DEFAULT 0,
  round_off REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  terms TEXT,
  reverse_charge INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES items(id),
  description TEXT NOT NULL,
  hsn_sac_code TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'NOS',
  rate REAL NOT NULL DEFAULT 0,
  discount_percent REAL NOT NULL DEFAULT 0,
  taxable_value REAL NOT NULL DEFAULT 0,
  gst_rate REAL NOT NULL DEFAULT 0,
  cgst_amount REAL NOT NULL DEFAULT 0,
  sgst_amount REAL NOT NULL DEFAULT 0,
  igst_amount REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payment_mode IN ('cash', 'bank_transfer', 'cheque', 'upi', 'card', 'other')),
  reference_no TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(company_id);

CREATE TABLE IF NOT EXISTS credit_notes (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL DEFAULT 'credit' CHECK (note_type IN ('credit', 'debit')),
  note_number TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  note_date TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  invoice_id TEXT REFERENCES invoices(id),
  reason TEXT,
  place_of_supply_state_code TEXT NOT NULL,
  is_interstate INTEGER NOT NULL DEFAULT 0,
  taxable_value REAL NOT NULL DEFAULT 0,
  total_cgst REAL NOT NULL DEFAULT 0,
  total_sgst REAL NOT NULL DEFAULT 0,
  total_igst REAL NOT NULL DEFAULT 0,
  round_off REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'cancelled')),
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id, note_number)
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_company ON credit_notes(company_id);

CREATE TABLE IF NOT EXISTS credit_note_items (
  id TEXT PRIMARY KEY,
  credit_note_id TEXT NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES items(id),
  description TEXT NOT NULL,
  hsn_sac_code TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'NOS',
  rate REAL NOT NULL DEFAULT 0,
  taxable_value REAL NOT NULL DEFAULT 0,
  gst_rate REAL NOT NULL DEFAULT 0,
  cgst_amount REAL NOT NULL DEFAULT 0,
  sgst_amount REAL NOT NULL DEFAULT 0,
  igst_amount REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_credit_note_items_note ON credit_note_items(credit_note_id);
