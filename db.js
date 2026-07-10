const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const bcrypt = require('bcryptjs')

const DB_PATH = path.join(__dirname, 'data.db')
const isNewDb = !fs.existsSync(DB_PATH)

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

function init() {
  // Create new tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      supplier TEXT DEFAULT '',
      description TEXT DEFAULT '',
      image TEXT DEFAULT '',
      track_expiry INTEGER DEFAULT 0,
      base_unit TEXT DEFAULT 'pcs',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE,
      type TEXT NOT NULL CHECK (type IN ('stock_in', 'stock_out', 'wastage')),
      customer_name TEXT DEFAULT '',
      date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      status TEXT DEFAULT NULL CHECK (status IS NULL OR status IN ('draft', 'unpaid', 'paid', 'cancelled')),
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      source TEXT DEFAULT '',
      destination TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL DEFAULT 0,
      total_price REAL DEFAULT 0,
      batch_id INTEGER DEFAULT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES inventory (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      initial_quantity INTEGER NOT NULL DEFAULT 0,
      manufacture_date TEXT,
      expiry_date TEXT,
      received_date TEXT DEFAULT (datetime('now')),
      notes TEXT DEFAULT '',
      FOREIGN KEY (item_id) REFERENCES inventory (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_packaging (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_type TEXT NOT NULL DEFAULT 'pcs',
      FOREIGN KEY (item_id) REFERENCES inventory (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      type TEXT NOT NULL DEFAULT 'customer' CHECK (type IN ('customer', 'supplier', 'both')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      ip_address TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs (user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs (action);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs (entity_type, entity_id);

    CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory (category);
    CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory (sku);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
    CREATE INDEX IF NOT EXISTS idx_transaction_items_txn ON transaction_items (transaction_id);
    CREATE INDEX IF NOT EXISTS idx_transaction_items_item ON transaction_items (item_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_date ON transactions (date);
    CREATE INDEX IF NOT EXISTS idx_batches_item ON batches (item_id);
    CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches (expiry_date);
    CREATE INDEX IF NOT EXISTS idx_product_packaging_item ON product_packaging (item_id);
  `)

  // Migrate existing databases: add new columns if old schema exists
  migrateSchema()

  // Migrate existing data from old schema (invoices + invoice_items → transactions + transaction_items)
  migrateOldData()

  if (isNewDb) {
    seed()
  } else {
    // Ensure default settings and sample data exist for existing databases
    migrateDefaults()
  }
}

function migrateSchema() {
  // Add new columns to transactions table for old schema compatibility
  try { db.exec("ALTER TABLE transactions ADD COLUMN invoice_number TEXT") } catch (e) {}
  try { db.exec("ALTER TABLE transactions ADD COLUMN customer_name TEXT DEFAULT ''") } catch (e) {}
  try { db.exec("ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT NULL") } catch (e) {}
  try { db.exec("ALTER TABLE transactions ADD COLUMN subtotal REAL DEFAULT 0") } catch (e) {}
  try { db.exec("ALTER TABLE transactions ADD COLUMN tax REAL DEFAULT 0") } catch (e) {}
  try { db.exec("ALTER TABLE transactions ADD COLUMN total REAL DEFAULT 0") } catch (e) {}

  // Add new columns to inventory
  try { db.exec("ALTER TABLE inventory ADD COLUMN track_expiry INTEGER DEFAULT 0") } catch (e) {}
  try { db.exec("ALTER TABLE inventory ADD COLUMN base_unit TEXT DEFAULT 'pcs'") } catch (e) {}

  // Add batch_id to transaction_items
  try { db.exec("ALTER TABLE transaction_items ADD COLUMN batch_id INTEGER DEFAULT NULL") } catch (e) {}

  // Update CHECK constraint on transactions.type to include 'wastage'
  // SQLite doesn't allow ALTER CONSTRAINT, so we recreate the table
  const hasWastageType = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'").get()
  if (hasWastageType && !hasWastageType.sql.includes('wastage')) {
    console.log('Updating transactions type check to include wastage...')
    db.pragma('foreign_keys = OFF')
    db.exec(`
      CREATE TABLE transactions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE,
        type TEXT NOT NULL CHECK (type IN ('stock_in', 'stock_out', 'wastage')),
        customer_name TEXT DEFAULT '',
        date TEXT NOT NULL,
        notes TEXT DEFAULT '',
        status TEXT DEFAULT NULL CHECK (status IS NULL OR status IN ('draft', 'unpaid', 'paid', 'cancelled')),
        subtotal REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        total REAL DEFAULT 0,
        source TEXT DEFAULT '',
        destination TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO transactions_new SELECT * FROM transactions;
      DROP TABLE transactions;
      ALTER TABLE transactions_new RENAME TO transactions;
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
      CREATE INDEX IF NOT EXISTS idx_invoices_date ON transactions (date);
    `)
    db.pragma('foreign_keys = ON')
    console.log('Transactions table updated with wastage type.')
  }

  // Remove legacy item_id column from old schema
  const hasItemId = db.prepare("SELECT name FROM pragma_table_info('transactions') WHERE name = 'item_id'").get()
  if (hasItemId) {
    console.log('Removing legacy item_id column from transactions table...')
    db.pragma('foreign_keys = OFF')
    db.exec(`
      CREATE TABLE transactions_new2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE,
        type TEXT NOT NULL CHECK (type IN ('stock_in', 'stock_out', 'wastage')),
        customer_name TEXT DEFAULT '',
        date TEXT NOT NULL,
        notes TEXT DEFAULT '',
        status TEXT DEFAULT NULL CHECK (status IS NULL OR status IN ('draft', 'unpaid', 'paid', 'cancelled')),
        subtotal REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        total REAL DEFAULT 0,
        source TEXT DEFAULT '',
        destination TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO transactions_new2 (id, invoice_number, type, customer_name, date, notes, status, subtotal, tax, total, source, destination, created_at)
        SELECT id, invoice_number, type, customer_name, date, notes, status, subtotal, tax, total, source, destination, created_at FROM transactions;
      DROP TABLE transactions;
      ALTER TABLE transactions_new2 RENAME TO transactions;
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
      CREATE INDEX IF NOT EXISTS idx_invoices_date ON transactions (date);
    `)
    db.pragma('foreign_keys = ON')
    console.log('Legacy item_id column removed successfully')
  }

  // Also remove legacy invoice_id column if present
  const hasInvoiceId = db.prepare("SELECT name FROM pragma_table_info('transactions') WHERE name = 'invoice_id'").get()
  if (hasInvoiceId) {
    console.log('Removing legacy invoice_id column from transactions table...')
    db.pragma('foreign_keys = OFF')
    db.exec(`
      CREATE TABLE transactions_new3 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE,
        type TEXT NOT NULL CHECK (type IN ('stock_in', 'stock_out', 'wastage')),
        customer_name TEXT DEFAULT '',
        date TEXT NOT NULL,
        notes TEXT DEFAULT '',
        status TEXT DEFAULT NULL CHECK (status IS NULL OR status IN ('draft', 'unpaid', 'paid', 'cancelled')),
        subtotal REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        total REAL DEFAULT 0,
        source TEXT DEFAULT '',
        destination TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO transactions_new3 (id, invoice_number, type, customer_name, date, notes, status, subtotal, tax, total, source, destination, created_at)
        SELECT id, invoice_number, type, customer_name, date, notes, status, subtotal, tax, total, source, destination, created_at FROM transactions;
      DROP TABLE transactions;
      ALTER TABLE transactions_new3 RENAME TO transactions;
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
      CREATE INDEX IF NOT EXISTS idx_invoices_date ON transactions (date);
    `)
    db.pragma('foreign_keys = ON')
    console.log('Legacy invoice_id column removed successfully')
  }
}

function migrateOldData() {
  // Check if we need to migrate old data (old invoices table exists)
  const oldTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invoices'").get()
  if (!oldTable) return

  // Check if already migrated
  const alreadyMigrated = db.prepare("SELECT COUNT(*) as c FROM transactions WHERE invoice_number IS NOT NULL").get()
  if (alreadyMigrated.c > 0) return

  console.log('Migrating old invoice data to new schema...')

  const insertTxn = db.prepare(`
    INSERT INTO transactions (invoice_number, type, customer_name, date, notes, status, subtotal, tax, total, source, destination, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertItem = db.prepare(`
    INSERT INTO transaction_items (transaction_id, item_id, item_name, quantity, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const hasItemIdCol = db.prepare("SELECT name FROM pragma_table_info('transactions') WHERE name = 'item_id'").get()
  const hasInvoiceIdCol = db.prepare("SELECT name FROM pragma_table_info('transactions') WHERE name = 'invoice_id'").get()

  const oldInvoices = db.prepare('SELECT * FROM invoices').all()
  for (const inv of oldInvoices) {
    const txnType = inv.type === 'sale' ? 'stock_out' : 'stock_in'
    const result = insertTxn.run(
      inv.invoice_number, txnType, inv.customer_name || '', inv.date,
      inv.notes || '', inv.status || 'unpaid', inv.subtotal || 0,
      inv.tax || 0, inv.total || 0, '', '', inv.created_at
    )
    const txnId = result.lastInsertRowid
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(inv.id)
    for (const item of items) {
      insertItem.run(txnId, item.item_id, item.item_name, item.quantity, item.unit_price, item.total_price)
    }
    if (hasItemIdCol && hasInvoiceIdCol) {
      const oldTxns = db.prepare('SELECT * FROM transactions WHERE invoice_id = ? AND item_id IS NOT NULL').all(inv.id)
      for (const ot of oldTxns) {
        const invItem = db.prepare('SELECT * FROM inventory WHERE id = ?').get(ot.item_id)
        if (invItem) {
          insertItem.run(txnId, ot.item_id, invItem.name, ot.quantity, 0, 0)
        }
      }
    }
  }

  if (hasItemIdCol && hasInvoiceIdCol) {
    const oldStandalone = db.prepare("SELECT * FROM transactions WHERE invoice_id IS NULL AND item_id IS NOT NULL").all()
    for (const ot of oldStandalone) {
      const invItem = db.prepare('SELECT * FROM inventory WHERE id = ?').get(ot.item_id)
      if (invItem) {
        insertItem.run(ot.id, ot.item_id, invItem.name, ot.quantity, 0, 0)
        db.prepare('UPDATE transactions SET source = ?, destination = ? WHERE id = ?')
          .run(ot.source || '', ot.destination || '', ot.id)
      }
    }
  }
  console.log('Migration complete.')
}

function migrateDefaults() {
  const existingSources = getSetting('transactionSources')
  if (!existingSources) {
    setSetting('transactionSources', ['Supplier Warehouse', 'Local Distributor', 'Manufacturer', 'Importer'])
    console.log('Added default transaction sources')
  }
  const existingDestinations = getSetting('transactionDestinations')
  if (!existingDestinations) {
    setSetting('transactionDestinations', ['Retail Store A', 'Retail Store B', 'Warehouse', 'Online Shop', 'Cold Storage'])
    console.log('Added default transaction destinations')
  }
  // Ensure invoice settings exist
  const existingInvoiceSettings = getSetting('invoiceSettings')
  if (!existingInvoiceSettings) {
    const defaultInvoiceSettings = {
      showSN: true,
      showCompanyPhone: true,
      showCompanyEmail: true,
      showCompanyAddress: true,
      showStatusBadge: true,
      showItemCount: true,
      showBatchColumn: true,
      showUnitPrice: true,
      showLineTotal: true,
      showSubtotal: true,
      showTax: true,
      showNotes: true,
      compactMode: false,
      footerText: ''
    }
    setSetting('invoiceSettings', defaultInvoiceSettings)
    console.log('Added default invoice settings')
  }

  const existingCustomerCount = db.prepare('SELECT COUNT(*) as c FROM customers').get()
  if (existingCustomerCount.c === 0) {
    const stmtCustomer = db.prepare('INSERT INTO customers (name, email, phone, address, type) VALUES (?, ?, ?, ?, ?)')
    stmtCustomer.run('Acme Corp', 'orders@acmecorp.com', '+1-555-0100', '123 Business Ave, Suite 100', 'customer')
    stmtCustomer.run("Bob's Shop", 'bob@bobsshop.com', '+1-555-0101', '456 Main Street', 'customer')
    stmtCustomer.run('TechMart Retail', 'purchasing@techmart.com', '+1-555-0102', '789 Market Blvd', 'customer')
    stmtCustomer.run('Global Supplies Co.', 'info@globalsupplies.com', '+1-555-0103', '321 Industry Drive', 'supplier')
    console.log('Seeded sample customers')
  }
}

function seed() {
  const now = new Date().toISOString()

  const defaultSettings = {
    companyName: 'Inventory Management System',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    currency: 'USD',
    lowStockThreshold: 20,
    categories: ['Electronics', 'Furniture', 'Stationery', 'Clothing', 'Food & Beverage', 'Medicine', 'Tools', 'Other'],
    units: ['pcs', 'box', 'carton', 'pack', 'meter', 'kg', 'liter', 'sheet', 'capsule', 'bottle'],
    transactionSources: ['Supplier Warehouse', 'Local Distributor', 'Manufacturer', 'Importer'],
    transactionDestinations: ['Retail Store A', 'Retail Store B', 'Warehouse', 'Online Shop', 'Cold Storage'],
    invoiceSettings: {
      showSN: true,
      showCompanyPhone: true,
      showCompanyEmail: true,
      showCompanyAddress: true,
      showStatusBadge: true,
      showItemCount: true,
      showBatchColumn: true,
      showUnitPrice: true,
      showLineTotal: true,
      showSubtotal: true,
      showTax: true,
      showNotes: true,
      compactMode: false,
      footerText: ''
    },
    permissions: {
      admin: ['*'],
      manager: [
        'inventory:read', 'inventory:create', 'inventory:update', 'inventory:delete',
        'transactions:read', 'transactions:create', 'transactions:update',
        'users:read', 'users:create', 'users:update',
        'settings:read', 'settings:update'
      ],
      warehouse: [
        'inventory:read', 'inventory:create', 'inventory:update',
        'transactions:read', 'transactions:create'
      ],
      viewer: [
        'inventory:read',
        'transactions:read'
      ]
    }
  }

  const stmtSettings = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(defaultSettings)) {
    stmtSettings.run(key, JSON.stringify(value))
  }

  const hash = bcrypt.hashSync('admin123', 10)
  const stmtUser = db.prepare('INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)')
  stmtUser.run('admin', hash, 'admin')
  stmtUser.run('manager', bcrypt.hashSync('manager123', 10), 'manager')
  stmtUser.run('warehouse', bcrypt.hashSync('warehouse123', 10), 'warehouse')

  const stmtInv = db.prepare(`
    INSERT OR IGNORE INTO inventory (id, name, sku, category, quantity, price, supplier, description, image, track_expiry, base_unit, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const items = [
    [1, 'Wireless Mouse', 'WM-001', 'Electronics', 45, 29.99, 'Logitech', 'Ergonomic wireless mouse', '', 0, 'pcs', now],
    [2, 'Mechanical Keyboard', 'MK-002', 'Electronics', 30, 89.99, 'Keychron', 'RGB mechanical keyboard', '', 0, 'pcs', now],
    [3, 'Office Chair', 'OC-003', 'Furniture', 12, 249.99, 'Herman Miller', 'Ergonomic office chair', '', 0, 'pcs', now],
    [4, 'A4 Paper Ream', 'AP-004', 'Stationery', 100, 5.99, 'Staples', '500 sheets per ream', '', 0, 'pcs', now],
    [5, 'Cotton T-Shirt', 'CT-005', 'Clothing', 200, 12.99, 'Gildan', '100% cotton crew neck', '', 0, 'pcs', now],
    [6, 'Adjustable Wrench', 'AW-006', 'Tools', 25, 18.50, 'Crescent', '10-inch adjustable wrench', '', 0, 'pcs', now],
    [7, 'Fresh Milk', 'FM-001', 'Food & Beverage', 200, 2.99, 'Local Dairy', 'Pasteurized whole milk', '', 1, 'liter', now],
    [8, 'Amoxicillin 500mg', 'AMX-001', 'Medicine', 1000, 0.15, 'PharmaCorp', 'Antibiotic capsules', '', 1, 'capsule', now],
    [9, 'Eggs (Farm Fresh)', 'EGG-001', 'Food & Beverage', 5400, 0.12, 'Happy Hens Farm', 'Free-range eggs, 30 per carton, 18 cartons per box', '', 1, 'egg', now]
  ]
  for (const item of items) stmtInv.run(...item)

  // Seed packaging for eggs
  const stmtPkg = db.prepare('INSERT INTO product_packaging (item_id, level, name, quantity, unit_type) VALUES (?, ?, ?, ?, ?)')
  stmtPkg.run(9, 1, 'Box', 18, 'carton')     // 1 box = 18 cartons
  stmtPkg.run(9, 2, 'Carton', 30, 'egg')      // 1 carton = 30 eggs (base)
  stmtPkg.run(8, 1, 'Carton', 10, 'sheet')    // 1 carton = 10 sheets
  stmtPkg.run(8, 2, 'Sheet', 10, 'capsule')   // 1 sheet = 10 capsules (base)

  // Seed batches for track-expiry items
  const stmtBatch = db.prepare('INSERT INTO batches (item_id, batch_number, quantity, initial_quantity, manufacture_date, expiry_date, received_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  stmtBatch.run(7, 'MILK-2401', 120, 120, '2026-07-01', '2026-07-15', now, 'First batch')
  stmtBatch.run(7, 'MILK-2402', 80, 80, '2026-07-05', '2026-07-22', now, 'Second batch')
  stmtBatch.run(8, 'AMX-2401', 600, 600, '2026-01-15', '2027-01-14', now, 'Batch A')
  stmtBatch.run(8, 'AMX-2402', 400, 400, '2026-03-01', '2027-02-28', now, 'Batch B')

  // Seed sample customers
  const stmtCustomer = db.prepare('INSERT INTO customers (name, email, phone, address, type) VALUES (?, ?, ?, ?, ?)')
  stmtCustomer.run('Acme Corp', 'orders@acmecorp.com', '+1-555-0100', '123 Business Ave, Suite 100', 'customer')
  stmtCustomer.run("Bob's Shop", 'bob@bobsshop.com', '+1-555-0101', '456 Main Street', 'customer')
  stmtCustomer.run('TechMart Retail', 'purchasing@techmart.com', '+1-555-0102', '789 Market Blvd', 'customer')
  stmtCustomer.run('Global Supplies Co.', 'info@globalsupplies.com', '+1-555-0103', '321 Industry Drive', 'supplier')

  // Seed sample transactions
  const stmtTxn = db.prepare(`
    INSERT INTO transactions (id, invoice_number, type, customer_name, date, notes, status, subtotal, tax, total, source, destination, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const stmtTxnItem = db.prepare(`
    INSERT INTO transaction_items (transaction_id, item_id, item_name, quantity, unit_price, total_price, batch_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  stmtTxn.run(1, null, 'stock_in', '', '2024-01-15', 'Initial stock of wireless mice', null, 0, 0, 0, 'Supplier Warehouse', 'Warehouse', now)
  stmtTxnItem.run(1, 1, 'Wireless Mouse', 50, 0, 0, null)
  stmtTxn.run(2, null, 'stock_in', '', '2024-01-16', 'Initial stock', null, 0, 0, 0, 'Manufacturer', 'Warehouse', now)
  stmtTxnItem.run(2, 2, 'Mechanical Keyboard', 35, 0, 0, null)
  stmtTxn.run(3, 'INV-2024-0001', 'stock_out', 'Acme Corp', '2024-01-20', 'Office supplies order', 'paid', 599.80, 77.97, 677.77, 'Warehouse', 'Retail Store A', now)
  stmtTxnItem.run(3, 1, 'Wireless Mouse', 10, 29.99, 299.90, null)
  stmtTxnItem.run(3, 2, 'Mechanical Keyboard', 2, 89.99, 179.98, null)
  stmtTxnItem.run(3, 5, 'Cotton T-Shirt', 10, 11.99, 119.92, null)
  stmtTxn.run(4, null, 'stock_out', '', '2024-01-22', 'Transfer to retail outlet', null, 0, 0, 0, 'Warehouse', 'Retail Store B', now)
  stmtTxnItem.run(4, 4, 'A4 Paper Ream', 20, 0, 0, null)
  stmtTxn.run(5, 'INV-2024-0002', 'stock_out', "Bob's Shop", '2024-01-25', 'Single item purchase', 'unpaid', 18.50, 2.41, 20.91, 'Warehouse', "Bob's Shop", now)
  stmtTxnItem.run(5, 6, 'Adjustable Wrench', 1, 18.50, 18.50, null)
  stmtTxn.run(6, null, 'stock_in', '', '2024-01-28', 'Restock', null, 0, 0, 0, 'Supplier Warehouse', 'Warehouse', now)
  stmtTxnItem.run(6, 6, 'Adjustable Wrench', 30, 0, 0, null)

  console.log('Database seeded with default data')
  console.log('Default admin: admin / admin123')
}

// ============================================
// SETTINGS
// ============================================

function getSetting(key, defaultValue = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  if (!row) return defaultValue
  try { return JSON.parse(row.value) } catch { return row.value }
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const obj = {}
  for (const row of rows) {
    try { obj[row.key] = JSON.parse(row.value) } catch { obj[row.key] = row.value }
  }
  return obj
}

// ============================================
// USERS
// ============================================

function getUsers() {
  return db.prepare('SELECT id, username, role, created_at FROM users').all()
}

function getUserById(id) {
  return db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(id)
}

function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username)
}

function createUser(username, password_hash, role) {
  return db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, password_hash, role)
}

function updateUser(id, username, role) {
  if (username && role) {
    return db.prepare('UPDATE users SET username = ?, role = ? WHERE id = ?').run(username, role, id)
  } else if (username) {
    return db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, id)
  } else if (role) {
    return db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)
  }
}

function deleteUser(id) {
  return db.prepare('DELETE FROM users WHERE id = ?').run(id)
}

function updateUserPassword(id, passwordHash) {
  return db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id)
}

// ============================================
// INVENTORY
// ============================================

function getInventory(filters = {}) {
  let sql = 'SELECT * FROM inventory'
  const params = []
  const where = []
  
  if (filters.date_from) { where.push("updated_at >= ?"); params.push(filters.date_from) }
  if (filters.date_to) { where.push("updated_at <= ?"); params.push(filters.date_to + 'T23:59:59') }
  
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY updated_at DESC'
  
  const items = db.prepare(sql).all(...params)
  
  // Attach batch counts for track_expiry items
  for (const item of items) {
    if (item.track_expiry) {
      const batches = db.prepare('SELECT COUNT(*) as count, SUM(quantity) as total FROM batches WHERE item_id = ?').get(item.id)
      item.batchCount = batches?.count || 0
      item.quantity = batches?.total || 0
      // Also attach packaging info
    }
    item.packaging = db.prepare('SELECT * FROM product_packaging WHERE item_id = ? ORDER BY level ASC').all(item.id)
  }
  return items
}

function getInventoryItem(id) {
  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(id)
  if (!item) return null
  if (item.track_expiry) {
    const batches = db.prepare('SELECT COUNT(*) as count, SUM(quantity) as total FROM batches WHERE item_id = ?').get(id)
    item.batchCount = batches?.count || 0
    item.quantity = batches?.total || 0
  }
  item.packaging = db.prepare('SELECT * FROM product_packaging WHERE item_id = ? ORDER BY level ASC').all(id)
  return item
}

function getInventoryStats(filters = {}) {
  const items = getInventory(filters)
  const threshold = getSetting('lowStockThreshold', 20)
  const totalItems = items.length
  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0)
  const totalValue = items.reduce((sum, i) => sum + i.quantity * i.price, 0)
  const lowStock = items.filter((i) => i.quantity < threshold).length
  const inStock = items.filter((i) => i.quantity >= threshold).length
  const expiredBatches = db.prepare("SELECT COUNT(*) as c FROM batches WHERE expiry_date < date('now') AND quantity > 0").get()
  const categoryMap = {}
  items.forEach((item) => { categoryMap[item.category] = (categoryMap[item.category] || 0) + item.quantity })
  const stockByCategory = Object.entries(categoryMap).map(([category, quantity]) => ({ category, quantity }))
  const currency = getSetting('currency', 'USD')
  return { totalItems, totalQuantity, totalValue: parseFloat(totalValue.toFixed(2)), lowStock, inStock, stockByCategory, expiredBatches: expiredBatches?.c || 0, currency }
}

function createInventory(item) {
  const stmt = db.prepare(`
    INSERT INTO inventory (name, sku, category, quantity, price, supplier, description, image, track_expiry, base_unit, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `)
  const result = stmt.run(
    item.name, item.sku, item.category, item.quantity || 0,
    item.price, item.supplier || '', item.description || '',
    item.image || '', item.track_expiry ? 1 : 0, item.base_unit || 'pcs'
  )
  return getInventoryItem(result.lastInsertRowid)
}

function updateInventory(id, item) {
  const stmt = db.prepare(`
    UPDATE inventory SET name = ?, sku = ?, category = ?, quantity = ?, price = ?,
      supplier = ?, description = ?, image = ?, track_expiry = ?, base_unit = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `)
  stmt.run(
    item.name, item.sku, item.category, item.quantity || 0, item.price,
    item.supplier || '', item.description || '', item.image || '',
    item.track_expiry ? 1 : 0, item.base_unit || 'pcs', id
  )
  return getInventoryItem(id)
}

function deleteInventory(id) {
  db.prepare('DELETE FROM batches WHERE item_id = ?').run(id)
  db.prepare('DELETE FROM product_packaging WHERE item_id = ?').run(id)
  return db.prepare('DELETE FROM inventory WHERE id = ?').run(id)
}

// ============================================
// BATCHES
// ============================================

function getBatches(itemId) {
  return db.prepare('SELECT * FROM batches WHERE item_id = ? ORDER BY expiry_date ASC').all(itemId)
}

function getBatch(id) {
  return db.prepare('SELECT * FROM batches WHERE id = ?').get(id)
}

function createBatch(data) {
  const result = db.prepare(`
    INSERT INTO batches (item_id, batch_number, quantity, initial_quantity, manufacture_date, expiry_date, received_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
  `).run(data.item_id, data.batch_number, data.quantity, data.quantity, data.manufacture_date || null, data.expiry_date || null, data.notes || '')
  // Update inventory quantity
  const total = db.prepare('SELECT SUM(quantity) as t FROM batches WHERE item_id = ?').get(data.item_id)
  db.prepare('UPDATE inventory SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(total?.t || 0, data.item_id)
  return getBatch(result.lastInsertRowid)
}

function updateBatch(id, data) {
  db.prepare(`
    UPDATE batches SET batch_number = ?, quantity = ?, manufacture_date = ?, expiry_date = ?, notes = ? WHERE id = ?
  `).run(data.batch_number, data.quantity, data.manufacture_date || null, data.expiry_date || null, data.notes || '', id)
  const batch = getBatch(id)
  if (batch) {
    const total = db.prepare('SELECT SUM(quantity) as t FROM batches WHERE item_id = ?').get(batch.item_id)
    db.prepare('UPDATE inventory SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(total?.t || 0, batch.item_id)
  }
  return getBatch(id)
}

function deleteBatch(id) {
  const batch = getBatch(id)
  if (batch) {
    db.prepare('DELETE FROM batches WHERE id = ?').run(id)
    const total = db.prepare('SELECT SUM(quantity) as t FROM batches WHERE item_id = ?').get(batch.item_id)
    db.prepare('UPDATE inventory SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(total?.t || 0, batch.item_id)
  }
  return { message: 'Batch deleted' }
}

function getExpiredBatches() {
  return db.prepare("SELECT b.*, i.name as item_name, i.sku as item_sku FROM batches b JOIN inventory i ON i.id = b.item_id WHERE b.expiry_date < date('now') AND b.quantity > 0 ORDER BY b.expiry_date ASC").all()
}

// ============================================
// PACKAGING
// ============================================

function getPackaging(itemId) {
  return db.prepare('SELECT * FROM product_packaging WHERE item_id = ? ORDER BY level ASC').all(itemId)
}

function setPackaging(itemId, levels) {
  db.prepare('DELETE FROM product_packaging WHERE item_id = ?').run(itemId)
  const stmt = db.prepare('INSERT INTO product_packaging (item_id, level, name, quantity, unit_type) VALUES (?, ?, ?, ?, ?)')
  for (const level of levels) {
    stmt.run(itemId, level.level, level.name, level.quantity, level.unit_type)
  }
  return getPackaging(itemId)
}

// ============================================
// TRANSACTIONS
// ============================================

let _invoiceCounter = Number(getSetting('invoiceCounter', 0))

function generateInvoiceNumber() {
  _invoiceCounter++
  setSetting('invoiceCounter', _invoiceCounter)
  const y = new Date().getFullYear()
  return `INV-${y}-${String(_invoiceCounter).padStart(4, '0')}`
}

function getTransactions(filters = {}) {
  let sql = `SELECT * FROM transactions`
  const params = []
  const where = []
  if (filters.type) { where.push('type = ?'); params.push(filters.type) }
  if (filters.status) { where.push('status = ?'); params.push(filters.status) }
  if (filters.date_from) { where.push('date >= ?'); params.push(filters.date_from) }
  if (filters.date_to) { where.push('date <= ?'); params.push(filters.date_to + 'T23:59:59') }
  if (filters.search) {
    where.push('(invoice_number LIKE ? OR customer_name LIKE ?)')
    params.push(`%${filters.search}%`, `%${filters.search}%`)
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY date DESC, created_at DESC'

  const txns = db.prepare(sql).all(...params)
  const itemStmt = db.prepare('SELECT ti.*, b.batch_number, b.expiry_date FROM transaction_items ti LEFT JOIN batches b ON b.id = ti.batch_id WHERE ti.transaction_id = ?')

  for (const txn of txns) {
    txn.items = itemStmt.all(txn.id)
    txn.itemCount = txn.items.length
    txn.isBilled = !!txn.invoice_number
  }
  return txns
}

function getTransaction(id) {
  const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
  if (!txn) return null
  txn.items = db.prepare('SELECT ti.*, b.batch_number, b.expiry_date FROM transaction_items ti LEFT JOIN batches b ON b.id = ti.batch_id WHERE ti.transaction_id = ?').all(id)
  for (const item of txn.items) {
    const inv = db.prepare('SELECT image, track_expiry, base_unit FROM inventory WHERE id = ?').get(item.item_id)
    if (inv) {
      item.item_image = inv.image
      item.track_expiry = inv.track_expiry
      item.base_unit = inv.base_unit
    }
  }
  return txn
}

function getTransactionStats() {
  const txns = db.prepare('SELECT * FROM transactions').all()
  const items = getInventory()
  const dateMap = {}
  let totalIn = 0, totalOut = 0, totalRevenue = 0, totalBilled = 0
  for (const t of txns) {
    const d = t.date.split('T')[0]
    if (!dateMap[d]) dateMap[d] = { date: d, stock_in: 0, stock_out: 0 }
    const txnItems = db.prepare('SELECT SUM(quantity) as qty FROM transaction_items WHERE transaction_id = ?').get(t.id)
    const qty = txnItems?.qty || 0
    if (t.type === 'stock_in') { dateMap[d].stock_in += qty; totalIn += qty }
    else if (t.type === 'stock_out') { dateMap[d].stock_out += qty; totalOut += qty }
    if (t.status === 'paid') { totalRevenue += t.total || 0 }
    if (t.invoice_number) { totalBilled++ }
  }
  const overTime = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))
  const expiredBatches = db.prepare("SELECT COUNT(*) as c FROM batches WHERE expiry_date < date('now') AND quantity > 0").get()
  const currency = getSetting('currency', 'USD')
  return {
    overTime, totalIn, totalOut, totalRevenue: parseFloat(totalRevenue.toFixed(2)), totalBilled,
    items: items.length, lowStock: items.filter(i => i.quantity < (getSetting('lowStockThreshold', 20))).length,
    expiredBatches: expiredBatches?.c || 0,
    currency
  }
}

function createTransaction(data) {
  return db.transaction(() => {
    const isBilled = data.items && data.items.length > 0 && (data.type === 'stock_out' || data.type === 'stock_in') && data.customer_name

    // Validate stock for stock_out/wastage
    if (data.type === 'stock_out' || data.type === 'wastage') {
      for (const item of (data.items || [])) {
        const invItem = db.prepare('SELECT * FROM inventory WHERE id = ?').get(item.item_id)
        if (!invItem) throw new Error(`Item ID ${item.item_id} not found`)
        let availableQty = invItem.quantity

        // If item tracks batches and no batch specified, check batch-level availability
        if (invItem.track_expiry && !item.batch_id) {
          const batches = db.prepare("SELECT SUM(quantity) as t FROM batches WHERE item_id = ? AND expiry_date >= date('now')").get(item.item_id)
          availableQty = batches?.t || 0
        } else if (invItem.track_expiry && item.batch_id) {
          const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(item.batch_id)
          if (batch) availableQty = batch.quantity
        }

        if (availableQty < item.quantity) {
          throw new Error(`Insufficient stock for ${invItem.name}: have ${availableQty}, need ${item.quantity}`)
        }
      }
    }

    // Calculate financials
    let subtotal = 0
    if (isBilled) {
      for (const item of data.items) {
        const invItem = db.prepare('SELECT * FROM inventory WHERE id = ?').get(item.item_id)
        const unitPrice = item.unit_price || invItem.price || 0
        subtotal += item.quantity * unitPrice
      }
    }

    const invoiceNumber = isBilled ? generateInvoiceNumber() : null
    const tax = isBilled ? subtotal * (Number(data.taxRate) || 0) : 0
    const total = subtotal + tax
    const status = isBilled ? 'unpaid' : null

    const result = db.prepare(`
      INSERT INTO transactions (invoice_number, type, customer_name, date, notes, status, subtotal, tax, total, source, destination, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      invoiceNumber, data.type, data.customer_name || '', data.date,
      data.notes || '', status, subtotal, tax, total,
      data.source || '', data.destination || ''
    )

    const txnId = result.lastInsertRowid

    const itemStmt = db.prepare(`
      INSERT INTO transaction_items (transaction_id, item_id, item_name, quantity, unit_price, total_price, batch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    for (const item of (data.items || [])) {
      const invItem = db.prepare('SELECT * FROM inventory WHERE id = ?').get(item.item_id)
      const unitPrice = isBilled ? (item.unit_price || invItem.price || 0) : 0
      const totalPrice = item.quantity * unitPrice

      if (data.type === 'stock_in' && invItem.track_expiry) {
        // For stock_in with track_expiry: create or add to batch
        if (item.batch_id) {
          // Add to existing batch
          const existingBatch = db.prepare('SELECT * FROM batches WHERE id = ?').get(item.batch_id)
          if (existingBatch) {
            db.prepare('UPDATE batches SET quantity = quantity + ?, initial_quantity = initial_quantity + ? WHERE id = ?')
              .run(item.quantity, item.quantity, item.batch_id)
          }
        } else if (item.batch_number) {
          // Create new batch
          const batchResult = db.prepare(`
            INSERT INTO batches (item_id, batch_number, quantity, initial_quantity, manufacture_date, expiry_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(item.item_id, item.batch_number, item.quantity, item.quantity, item.manufacture_date || null, item.expiry_date || null, item.notes || '')
          item.batch_id = batchResult.lastInsertRowid
        }
      } else if ((data.type === 'stock_out' || data.type === 'wastage') && invItem.track_expiry) {
        // For stock_out/wastage with track_expiry: deduct from batch(es)
        if (item.batch_id) {
          // Deduct from specified batch
          const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(item.batch_id)
          if (batch) {
            if (batch.quantity < item.quantity) throw new Error(`Batch ${batch.batch_number} only has ${batch.quantity}, need ${item.quantity}`)
            db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?').run(item.quantity, item.batch_id)
          }
        } else {
          // FEFO: deduct from batches closest to expiry first
          let remaining = item.quantity
          const batches = db.prepare("SELECT * FROM batches WHERE item_id = ? AND quantity > 0 ORDER BY expiry_date ASC").all(item.item_id)
          for (const batch of batches) {
            if (remaining <= 0) break
            const deduct = Math.min(batch.quantity, remaining)
            db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?').run(deduct, batch.id)
            remaining -= deduct
          }
          if (remaining > 0) throw new Error(`Insufficient batch stock for ${invItem.name}`)
        }
      }

      itemStmt.run(txnId, item.item_id, invItem.name, item.quantity, unitPrice, totalPrice, item.batch_id || null)

      // Update inventory quantity (only for non-batch-tracked items and wastage)
      if (!invItem.track_expiry || data.type === 'wastage') {
        const newQty = data.type === 'stock_in'
          ? invItem.quantity + item.quantity
          : invItem.quantity - item.quantity
        db.prepare('UPDATE inventory SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(Math.max(0, newQty), item.item_id)
      } else if (data.type === 'stock_in' || data.type === 'stock_out') {
        // For batch-tracked items, recompute quantity from batches
        const total = db.prepare('SELECT SUM(quantity) as t FROM batches WHERE item_id = ?').get(item.item_id)
        db.prepare('UPDATE inventory SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(total?.t || 0, item.item_id)
      }
    }

    return getTransaction(txnId)
  })()
}

function updateTransactionStatus(id, status) {
  const valid = ['draft', 'unpaid', 'paid', 'cancelled']
  if (!valid.includes(status)) throw new Error('Invalid status')
  const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
  if (!txn) throw new Error('Transaction not found')
  if (!txn.invoice_number) throw new Error('Cannot set status on unbilled transaction')
  db.prepare('UPDATE transactions SET status = ? WHERE id = ?').run(status, id)
  return getTransaction(id)
}

function deleteTransaction(id) {
  return db.transaction(() => {
    const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
    if (!txn) throw new Error('Transaction not found')

    const items = db.prepare('SELECT ti.*, i.track_expiry FROM transaction_items ti JOIN inventory i ON i.id = ti.item_id WHERE ti.transaction_id = ?').all(id)
    for (const item of items) {
      if (item.track_expiry) {
        // Revert batch quantities
        if (txn.type === 'stock_in') {
          // Remove from batch
          if (item.batch_id) {
            const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(item.batch_id)
            if (batch) {
              const newQty = batch.quantity - item.quantity
              if (newQty <= 0) {
                db.prepare('DELETE FROM batches WHERE id = ?').run(item.batch_id)
              } else {
                db.prepare('UPDATE batches SET quantity = ?, initial_quantity = initial_quantity - ? WHERE id = ?')
                  .run(newQty, item.quantity, item.batch_id)
              }
            }
          }
        } else {
          // Add back to batch (or re-create batch if FEFO was used)
          // Simplification: add back to the last-used batch or create a generic return batch
          if (item.batch_id) {
            db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?').run(item.quantity, item.batch_id)
          } else {
            // Find a batch for this item or create a return batch
            const existingBatch = db.prepare("SELECT * FROM batches WHERE item_id = ? ORDER BY expiry_date DESC LIMIT 1").get(item.item_id)
            if (existingBatch) {
              db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?').run(item.quantity, existingBatch.id)
            }
          }
        }
        // Recalculate inventory quantity from batches
        const total = db.prepare('SELECT SUM(quantity) as t FROM batches WHERE item_id = ?').get(item.item_id)
        db.prepare('UPDATE inventory SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(total?.t || 0, item.item_id)
      } else {
        // Non-batch-tracked: direct inventory revert
        const invItem = db.prepare('SELECT * FROM inventory WHERE id = ?').get(item.item_id)
        if (invItem) {
          const newQty = txn.type === 'stock_in'
            ? invItem.quantity - item.quantity
            : invItem.quantity + item.quantity
          db.prepare('UPDATE inventory SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(Math.max(0, newQty), item.item_id)
        }
      }
    }

    db.prepare('DELETE FROM transaction_items WHERE transaction_id = ?').run(id)
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
  })()
}

// ============================================
// CUSTOMERS
// ============================================

function getCustomers(type) {
  if (type) {
    return db.prepare("SELECT * FROM customers WHERE type = ? OR type = 'both' ORDER BY name ASC").all(type)
  }
  return db.prepare('SELECT * FROM customers ORDER BY name ASC').all()
}

function getCustomer(id) {
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
}

function createCustomer(data) {
  const result = db.prepare('INSERT INTO customers (name, email, phone, address, type) VALUES (?, ?, ?, ?, ?)')
    .run(data.name, data.email || '', data.phone || '', data.address || '', data.type || 'customer')
  return getCustomer(result.lastInsertRowid)
}

function deleteCustomer(id) {
  return db.prepare('DELETE FROM customers WHERE id = ?').run(id)
}

// ============================================
// TOKENS
// ============================================

function saveRefreshToken(token, userId, expiresAt) {
  db.prepare('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt)
}

function verifyRefreshToken(token) {
  const row = db.prepare("SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime('now')").get(token)
  return row ? { userId: row.user_id } : null
}

function deleteRefreshToken(token) {
  db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token)
}

function deleteUserRefreshTokens(userId) {
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId)
}

function cleanupExpiredTokens() {
  db.prepare("DELETE FROM refresh_tokens WHERE expires_at <= datetime('now')").run()
}

// ============================================
// ACTIVITY LOGS
// ============================================

function logActivity(data) {
  // data: { user_id, username, action, entity_type, entity_id, details, ip_address }
  const result = db.prepare(`
    INSERT INTO activity_logs (user_id, username, action, entity_type, entity_id, details, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    data.user_id || null,
    data.username || 'system',
    data.action,
    data.entity_type,
    data.entity_id || null,
    data.details ? JSON.stringify(data.details) : null,
    data.ip_address || ''
  )
  return result.lastInsertRowid
}

function getActivityLogs(filters = {}) {
  let sql = `SELECT * FROM activity_logs`
  const params = []
  const where = []
  
  if (filters.user_id) { where.push('user_id = ?'); params.push(filters.user_id) }
  if (filters.action) { where.push('action = ?'); params.push(filters.action) }
  if (filters.entity_type) { where.push('entity_type = ?'); params.push(filters.entity_type) }
  if (filters.date_from) { where.push("created_at >= ?"); params.push(filters.date_from) }
  if (filters.date_to) { where.push("created_at <= ?"); params.push(filters.date_to + 'T23:59:59') }
  if (filters.search) {
    where.push('(username LIKE ? OR action LIKE ? OR entity_type LIKE ? OR details LIKE ?)')
    const q = `%${filters.search}%`
    params.push(q, q, q, q)
  }
  
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY created_at DESC'
  
  if (filters.limit) sql += ` LIMIT ${Math.min(Number(filters.limit), 500)}`
  if (filters.offset) sql += ` OFFSET ${Number(filters.offset)}`
  
  const logs = db.prepare(sql).all(...params)
  
  // Parse details JSON
  for (const log of logs) {
    if (log.details) {
      try { log.details = JSON.parse(log.details) } catch {}
    }
  }
  
  return logs
}

function getActivityLogCount(filters = {}) {
  let sql = `SELECT COUNT(*) as total FROM activity_logs`
  const params = []
  const where = []
  
  if (filters.user_id) { where.push('user_id = ?'); params.push(filters.user_id) }
  if (filters.action) { where.push('action = ?'); params.push(filters.action) }
  if (filters.entity_type) { where.push('entity_type = ?'); params.push(filters.entity_type) }
  if (filters.date_from) { where.push("created_at >= ?"); params.push(filters.date_from) }
  if (filters.date_to) { where.push("created_at <= ?"); params.push(filters.date_to + 'T23:59:59') }
  if (filters.search) {
    where.push('(username LIKE ? OR action LIKE ? OR entity_type LIKE ? OR details LIKE ?)')
    const q = `%${filters.search}%`
    params.push(q, q, q, q)
  }
  
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  
  const result = db.prepare(sql).get(...params)
  return result?.total || 0
}

function getActivityLogStats() {
  const totalLogs = db.prepare('SELECT COUNT(*) as c FROM activity_logs').get()
  const uniqueUsers = db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM activity_logs WHERE user_id IS NOT NULL').get()
  const actionBreakdown = db.prepare('SELECT action, COUNT(*) as count FROM activity_logs GROUP BY action ORDER BY count DESC').all()
  const entityBreakdown = db.prepare('SELECT entity_type, COUNT(*) as count FROM activity_logs GROUP BY entity_type ORDER BY count DESC').all()
  
  // Get recent activity (last 24h)
  const recentCount = db.prepare("SELECT COUNT(*) as c FROM activity_logs WHERE created_at >= datetime('now', '-1 day')").get()
  
  return {
    totalLogs: totalLogs?.c || 0,
    uniqueUsers: uniqueUsers?.c || 0,
    recent24h: recentCount?.c || 0,
    actionBreakdown,
    entityBreakdown
  }
}

// ============================================
// FILE LOGGING HELPER
// ============================================

let _logFileStream = null
function getLogFilePath() {
  const path = getSetting('logFilePath', '')
  return path || ''
}

function getLogMode() {
  return getSetting('logMode', 'db') // 'db', 'file', 'both'
}

function writeToLogFile(entry) {
  try {
    const filePath = getLogFilePath()
    if (!filePath) return
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const timestamp = new Date().toISOString()
    const line = `[${timestamp}] [${entry.username}] [${entry.action}] ${entry.entity_type}${entry.entity_id ? ' #'+entry.entity_id : ''} ${entry.details ? JSON.stringify(entry.details) : ''}\n`
    fs.appendFileSync(filePath, line, 'utf-8')
  } catch (err) {
    console.error('Failed to write log file:', err.message)
  }
}

init()

module.exports = {
  db,
  getSetting, setSetting, getAllSettings,
  getUsers, getUserById, getUserByUsername, createUser, updateUser, deleteUser, updateUserPassword,
  getInventory, getInventoryItem, getInventoryStats, createInventory, updateInventory, deleteInventory,
  getBatches, getBatch, createBatch, updateBatch, deleteBatch, getExpiredBatches,
  getPackaging, setPackaging,
  getTransactions, getTransaction, getTransactionStats, createTransaction, updateTransactionStatus, deleteTransaction,
  getCustomers, getCustomer, createCustomer, deleteCustomer,
  saveRefreshToken, verifyRefreshToken, deleteRefreshToken, deleteUserRefreshTokens, cleanupExpiredTokens,
  logActivity, getActivityLogs, getActivityLogCount, getActivityLogStats,
  getLogFilePath, getLogMode, writeToLogFile
}
