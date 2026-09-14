import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'billing.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function runMigrations() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  // Add receivable/payable balance columns to customers for existing databases.
  const cols = db.prepare(`PRAGMA table_info(customers)`).all() as Array<{ name: string }>;
  const existing = new Set(cols.map((c) => c.name));
  if (!existing.has('receivable_balance')) {
    db.exec(`ALTER TABLE customers ADD COLUMN receivable_balance REAL NOT NULL DEFAULT 0`);
  }
  if (!existing.has('payable_balance')) {
    db.exec(`ALTER TABLE customers ADD COLUMN payable_balance REAL NOT NULL DEFAULT 0`);
  }
  if (!existing.has('customer_group')) {
    db.exec(`ALTER TABLE customers ADD COLUMN customer_group TEXT`);
  }

  // Rebuild company_preferences when it predates the 'vyapar' design option.
  // SQLite cannot ALTER a CHECK constraint, so recreate the table in place.
  const pref = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'company_preferences'`).get() as
    | { sql: string }
    | undefined;
  if (pref && !pref.sql.includes('vyapar')) {
    const migrate = db.transaction(() => {
      db.exec(`ALTER TABLE company_preferences RENAME TO company_preferences_old`);
      db.exec(`CREATE TABLE company_preferences (
        company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
        print_design TEXT NOT NULL DEFAULT 'classic' CHECK (print_design IN ('classic', 'modern', 'minimal', 'vyapar')),
        download_design TEXT NOT NULL DEFAULT 'classic' CHECK (download_design IN ('classic', 'modern', 'minimal', 'vyapar')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
      db.exec(
        `INSERT INTO company_preferences (company_id, print_design, download_design, updated_at)
         SELECT company_id, print_design, download_design, updated_at FROM company_preferences_old`
      );
      db.exec(`DROP TABLE company_preferences_old`);
    });
    migrate();
  }
}
