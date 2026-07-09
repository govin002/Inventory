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
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('stock_in', 'stock_out')),
      quantity INTEGER NOT NULL,
      source TEXT DEFAULT '',
      destination TEXT DEFAULT '',
      date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
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

    CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory (category);
    CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory (sku);
    CREATE INDEX IF NOT EXISTS idx_transactions_item_date ON transactions (item_id, date);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);
  `)

  if (isNewDb) seed()
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
    categories: ['Electronics', 'Furniture', 'Stationery', 'Clothing', 'Food & Beverage', 'Tools', 'Other'],
    units: ['pcs', 'box', 'pack', 'meter', 'kg', 'liter'],
    permissions: {
      admin: ['*'],
      manager: [
        'inventory:read', 'inventory:create', 'inventory:update', 'inventory:delete',
        'transactions:read', 'transactions:create',
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
    INSERT OR IGNORE INTO inventory (id, name, sku, category, quantity, price, supplier, description, image, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const items = [
    [1, 'Wireless Mouse', 'WM-001', 'Electronics', 45, 29.99, 'Logitech', 'Ergonomic wireless mouse', '', now],
    [2, 'Mechanical Keyboard', 'MK-002', 'Electronics', 30, 89.99, 'Keychron', 'RGB mechanical keyboard', '', now],
    [3, 'Office Chair', 'OC-003', 'Furniture', 12, 249.99, 'Herman Miller', 'Ergonomic office chair', '', now],
    [4, 'A4 Paper Ream', 'AP-004', 'Stationery', 100, 5.99, 'Staples', '500 sheets per ream', '', now],
    [5, 'Cotton T-Shirt', 'CT-005', 'Clothing', 200, 12.99, 'Gildan', '100% cotton crew neck', '', now],
    [6, 'Adjustable Wrench', 'AW-006', 'Tools', 25, 18.50, 'Crescent', '10-inch adjustable wrench', '', now]
  ]
  for (const item of items) stmtInv.run(...item)

  const stmtTxn = db.prepare(`
    INSERT OR IGNORE INTO transactions (id, item_id, type, quantity, source, destination, date, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const txns = [
    [1, 1, 'stock_in', 50, 'Logitech Warehouse', '', '2024-01-15', 'Initial stock', now],
    [2, 2, 'stock_in', 35, 'Keychron Direct', '', '2024-01-16', 'Initial stock', now],
    [3, 3, 'stock_in', 15, 'Herman Miller Depot', '', '2024-01-17', 'Initial stock', now],
    [4, 4, 'stock_in', 120, 'Staples Distribution', '', '2024-01-18', 'Initial stock', now],
    [5, 5, 'stock_out', 20, '', 'Retail Store A', '2024-01-20', 'Sale', now],
    [6, 6, 'stock_in', 30, 'Crescent Tools', '', '2024-01-22', 'Restock', now]
  ]
  for (const t of txns) stmtTxn.run(...t)

  console.log('Database seeded with default data')
}

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

function getInventory() {
  return db.prepare('SELECT * FROM inventory ORDER BY updated_at DESC').all()
}

function getInventoryItem(id) {
  return db.prepare('SELECT * FROM inventory WHERE id = ?').get(id)
}

function createInventory(item) {
  const stmt = db.prepare(`
    INSERT INTO inventory (name, sku, category, quantity, price, supplier, description, image, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `)
  const result = stmt.run(item.name, item.sku, item.category, item.quantity, item.price, item.supplier || '', item.description || '', item.image || '')
  return { ...item, id: result.lastInsertRowid, updated_at: new Date().toISOString() }
}

function updateInventory(id, item) {
  const stmt = db.prepare(`
    UPDATE inventory SET name = ?, sku = ?, category = ?, quantity = ?, price = ?, supplier = ?, description = ?, image = ?, updated_at = datetime('now')
    WHERE id = ?
  `)
  stmt.run(item.name, item.sku, item.category, item.quantity, item.price, item.supplier || '', item.description || '', item.image || '', id)
  return getInventoryItem(id)
}

function deleteInventory(id) {
  return db.prepare('DELETE FROM inventory WHERE id = ?').run(id)
}

function getTransactions(filters = {}) {
  let sql = 'SELECT t.*, i.name as item_name, i.sku as item_sku FROM transactions t JOIN inventory i ON t.item_id = i.id'
  const params = []
  const where = []
  if (filters.type) { where.push('t.type = ?'); params.push(filters.type) }
  if (filters.item_id) { where.push('t.item_id = ?'); params.push(filters.item_id) }
  if (filters.date_from) { where.push('t.date >= ?'); params.push(filters.date_from) }
  if (filters.date_to) { where.push('t.date <= ?'); params.push(filters.date_to + 'T23:59:59') }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY t.date DESC, t.created_at DESC'
  return db.prepare(sql).all(...params)
}

function getTransactionStats() {
  const txns = db.prepare('SELECT * FROM transactions').all()
  const items = db.prepare('SELECT * FROM inventory').all()
  const dateMap = {}
  let totalIn = 0, totalOut = 0
  for (const t of txns) {
    const d = t.date.split('T')[0]
    if (!dateMap[d]) dateMap[d] = { date: d, stock_in: 0, stock_out: 0 }
    if (t.type === 'stock_in') { dateMap[d].stock_in += t.quantity; totalIn += t.quantity }
    else { dateMap[d].stock_out += t.quantity; totalOut += t.quantity }
  }
  const overTime = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))
  return { overTime, totalIn, totalOut, items: items.length, lowStock: items.filter(i => i.quantity < (getSetting('lowStockThreshold', 20))).length }
}

function createTransaction(txn) {
  return db.transaction(() => {
    const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(txn.item_id)
    if (!item) throw new Error('Item not found')
    if (txn.type === 'stock_out' && item.quantity < txn.quantity) throw new Error('Insufficient stock')

    const newQty = txn.type === 'stock_in' ? item.quantity + txn.quantity : item.quantity - txn.quantity
    db.prepare('UPDATE inventory SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newQty, txn.item_id)

    const stmt = db.prepare(`
      INSERT INTO transactions (item_id, type, quantity, source, destination, date, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `)
    const result = stmt.run(txn.item_id, txn.type, txn.quantity, txn.source || '', txn.destination || '', txn.date, txn.notes || '')
    return { ...txn, id: result.lastInsertRowid, item_name: item.name, item_sku: item.sku }
  })()
}

function deleteTransaction(id) {
  return db.transaction(() => {
    const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
    if (!txn) throw new Error('Transaction not found')

    const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(txn.item_id)
    if (item) {
      const newQty = txn.type === 'stock_in' ? item.quantity - txn.quantity : item.quantity + txn.quantity
      db.prepare('UPDATE inventory SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').run(Math.max(0, newQty), txn.item_id)
    }
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
  })()
}

function saveRefreshToken(token, userId, expiresAt) {
  db.prepare('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt)
}

function verifyRefreshToken(token) {
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime(\'now\')').get(token)
  return row ? { userId: row.user_id } : null
}

function deleteRefreshToken(token) {
  db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token)
}

function deleteUserRefreshTokens(userId) {
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId)
}

function cleanupExpiredTokens() {
  db.prepare('DELETE FROM refresh_tokens WHERE expires_at <= datetime(\'now\')').run()
}

init()

module.exports = {
  db,
  getSetting,
  setSetting,
  getAllSettings,
  getUsers,
  getUserById,
  getUserByUsername,
  createUser,
  updateUser,
  deleteUser,
  getInventory,
  getInventoryItem,
  createInventory,
  updateInventory,
  deleteInventory,
  getTransactions,
  getTransactionStats,
  createTransaction,
  deleteTransaction,
  saveRefreshToken,
  verifyRefreshToken,
  deleteRefreshToken,
  deleteUserRefreshTokens,
  cleanupExpiredTokens
}