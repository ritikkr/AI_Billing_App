import { createClient, type InStatement, type InValue, type ResultSet } from '@libsql/client';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'billing.db');

/**
 * The app talks to SQLite through Turso's libSQL client. In production the
 * database lives on Turso (set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN); in
 * development it defaults to a local file so nothing else needs configuring.
 */
const url = process.env.TURSO_DATABASE_URL || `file:${DB_PATH}`;
export const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface Statement {
  get(...args: unknown[]): Promise<any>;
  all(...args: unknown[]): Promise<any[]>;
  run(...args: unknown[]): Promise<RunResult>;
}

/** Drop-in-ish async surface matching how the app used `better-sqlite3`. */
export interface DbLike {
  prepare(sql: string): Statement;
  transaction<T>(fn: (tx: DbLike) => Promise<T>): Promise<T>;
}

type Executor = (stmt: InStatement) => Promise<ResultSet>;

function makeStatement(exec: Executor, sql: string): Statement {
  return {
    async get(...args: unknown[]): Promise<any> {
      const rs = await exec({ sql, args: args as InValue[] });
      return rs.rows[0];
    },
    async all(...args: unknown[]): Promise<any[]> {
      const rs = await exec({ sql, args: args as InValue[] });
      return rs.rows as any[];
    },
    async run(...args: unknown[]): Promise<RunResult> {
      const rs = await exec({ sql, args: args as InValue[] });
      return { changes: Number(rs.rowsAffected), lastInsertRowid: rs.lastInsertRowid ?? 0 };
    },
  };
}

export const db: DbLike = {
  prepare(sql: string): Statement {
    return makeStatement((stmt) => client.execute(stmt), sql);
  },
  async transaction<T>(fn: (tx: DbLike) => Promise<T>): Promise<T> {
    const tx = await client.transaction('write');
    const txDb: DbLike = {
      prepare(sql: string): Statement {
        return makeStatement((stmt) => tx.execute(stmt), sql);
      },
      transaction: db.transaction.bind(db) as DbLike['transaction'],
    };
    try {
      const result = await fn(txDb);
      await tx.commit();
      return result;
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        // ignore rollback failures
      }
      throw err;
    }
  },
};

export async function runMigrations(): Promise<void> {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.toUpperCase().startsWith('PRAGMA'));
  await client.batch(statements.map((sql) => ({ sql })));
  // Foreign keys are on by default in Turso; enforce them too in local-file mode.
  await client.execute('PRAGMA foreign_keys = ON');

  // Add email_verified column to users for existing databases (existing accounts are trusted).
  const userCols = (await db.prepare(`PRAGMA table_info(users)`).all()) as Array<{ name: string }>;
  if (!new Set(userCols.map((c) => c.name)).has('email_verified')) {
    await db.prepare(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1`).run();
  }

  // Add receivable/payable balance columns to customers for existing databases.
  const cols = (await db.prepare(`PRAGMA table_info(customers)`).all()) as Array<{ name: string }>;
  const existing = new Set(cols.map((c) => c.name));
  if (!existing.has('receivable_balance')) {
    await db.prepare(`ALTER TABLE customers ADD COLUMN receivable_balance REAL NOT NULL DEFAULT 0`).run();
  }
  if (!existing.has('payable_balance')) {
    await db.prepare(`ALTER TABLE customers ADD COLUMN payable_balance REAL NOT NULL DEFAULT 0`).run();
  }
  if (!existing.has('customer_group')) {
    await db.prepare(`ALTER TABLE customers ADD COLUMN customer_group TEXT`).run();
  }

  // Add signature_url column to companies for existing databases.
  const companyCols = (await db.prepare(`PRAGMA table_info(companies)`).all()) as Array<{ name: string }>;
  const companyExisting = new Set(companyCols.map((c) => c.name));
  if (!companyExisting.has('signature_url')) {
    await db.prepare(`ALTER TABLE companies ADD COLUMN signature_url TEXT`).run();
  }

  // Rebuild company_preferences when it predates the 'vyapar' design option.
  const pref = (await db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'company_preferences'`)
    .get()) as { sql: string } | undefined;
  if (pref && !pref.sql.includes('vyapar')) {
    await db.transaction(async (tx) => {
      await tx.prepare(`ALTER TABLE company_preferences RENAME TO company_preferences_old`).run();
      await tx.prepare(`CREATE TABLE company_preferences (
        company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
        print_design TEXT NOT NULL DEFAULT 'classic' CHECK (print_design IN ('classic', 'modern', 'minimal', 'vyapar')),
        download_design TEXT NOT NULL DEFAULT 'classic' CHECK (download_design IN ('classic', 'modern', 'minimal', 'vyapar')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`).run();
      await tx
        .prepare(
          `INSERT INTO company_preferences (company_id, print_design, download_design, updated_at)
           SELECT company_id, print_design, download_design, updated_at FROM company_preferences_old`
        )
        .run();
      await tx.prepare(`DROP TABLE company_preferences_old`).run();
    });
  }

  // Add quotation_prefix and certificate_prefix columns to companies for existing databases.
  if (!companyExisting.has('quotation_prefix')) {
    await db.prepare(`ALTER TABLE companies ADD COLUMN quotation_prefix TEXT NOT NULL DEFAULT 'EST'`).run();
  }
  if (!companyExisting.has('certificate_prefix')) {
    await db.prepare(`ALTER TABLE companies ADD COLUMN certificate_prefix TEXT NOT NULL DEFAULT 'CERT'`).run();
  }

  // Rebuild invoice_counters when it predates 'quotation'/'certificate' series.
  const counterDef = (await db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'invoice_counters'`)
    .get()) as { sql: string } | undefined;
  if (counterDef && !counterDef.sql.includes('quotation')) {
    await db.transaction(async (tx) => {
      await tx.prepare(`ALTER TABLE invoice_counters RENAME TO invoice_counters_old`).run();
      await tx.prepare(`CREATE TABLE invoice_counters (
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        financial_year TEXT NOT NULL,
        series TEXT NOT NULL CHECK (series IN ('invoice', 'credit_note', 'debit_note', 'quotation', 'certificate')),
        last_number INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (company_id, financial_year, series)
      )`).run();
      await tx
        .prepare(
          `INSERT INTO invoice_counters (company_id, financial_year, series, last_number)
           SELECT company_id, financial_year, series, last_number FROM invoice_counters_old`
        )
        .run();
      await tx.prepare(`DROP TABLE invoice_counters_old`).run();
    });
  }

  // Seed a default certificate template if none exist.
  const templateCount = (await db.prepare(`SELECT COUNT(*) as cnt FROM certificate_templates`).get()) as { cnt: number };
  if (templateCount.cnt === 0) {
    const defaultBody = `This is to certify that {{service_type}} service was successfully carried out at {{outlet_name}}, {{outlet_address}} on {{service_date}} by {{company_name}}.

The service was performed in accordance with the agreed standards and there are no issues or concerns regarding the quality of service provided.

This certificate is valid from {{valid_from}} to {{valid_until}}.

Authorized Signatory: _______________
Company: {{company_name}}
Date: {{certificate_date}}
Certificate No: {{certificate_number}}`;
    await db
      .prepare(
        `INSERT INTO certificate_templates (id, company_id, name, subject, body, is_default)
         VALUES (?, NULL, ?, ?, ?, 1)`
      )
      .run(crypto.randomUUID(), 'Default Service Certificate', 'Service Completion Certificate', defaultBody);
  }
}