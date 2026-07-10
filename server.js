const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const QRCode = require('qrcode');
const JsBarcode = require('jsbarcode');
const { createCanvas } = require('canvas');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate, checkPermission, generateTokens, verifyRefreshToken, userPermissions, DEFAULT_PERMISSIONS } = require('./auth');
const db = require('./db');

// ============================================
// ACTIVITY LOGGING HELPER
// ============================================

function logUserActivity(req, action, entity_type, entity_id = null, details = null) {
  const logData = {
    user_id: req.user?.id,
    username: req.user?.username || 'system',
    action,
    entity_type,
    entity_id,
    details,
    ip_address: req.ip || req.connection?.remoteAddress || ''
  }
  
  // Always log to DB
  const mode = db.getLogMode()
  if (mode === 'db' || mode === 'both') {
    db.logActivity(logData)
  }
  
  // Optionally log to file
  if (mode === 'file' || mode === 'both') {
    db.writeToLogFile(logData)
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const clientDist = path.join(__dirname, 'client', 'dist');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(clientDist));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `product-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// ============================================
// AUTH API
// ============================================

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = db.getUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const tokens = generateTokens(user);
  db.saveRefreshToken(tokens.refreshToken, user.id, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

  logUserActivity(req, 'user.login', 'user', user.id, { username: user.username, role: user.role });

  res.json({ token: tokens.accessToken, refreshToken: tokens.refreshToken, user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role }, permissions: userPermissions(user) });
});

app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  const stored = db.verifyRefreshToken(refreshToken);
  if (!stored) return res.status(401).json({ error: 'Invalid refresh token' });

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = db.getUserById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const tokens = generateTokens(user);
    db.deleteRefreshToken(refreshToken);
    db.saveRefreshToken(tokens.refreshToken, user.id, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

    res.json({ token: tokens.accessToken, refreshToken: tokens.refreshToken, user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    db.deleteRefreshToken(refreshToken);
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

app.post('/api/auth/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current password and new password are required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const user = db.getUserByUsername(req.user.username);
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.updateUserPassword(user.id, hash);

  // Invalidate all refresh tokens for this user (force re-login on other sessions)
  db.deleteUserRefreshTokens(user.id);

  logUserActivity(req, 'user.change_password', 'user', user.id, { username: user.username });
  res.json({ message: 'Password changed successfully. Please log in again.' });
});

app.post('/api/auth/logout', (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const stored = db.getSetting('lastRefreshToken');
    const user = req.user || {};
    logUserActivity({ ...req, user }, 'user.logout', 'user', user.id, { username: user.username });
    db.deleteRefreshToken(refreshToken);
  }
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, name: user.name, email: user.email, role: user.role, permissions: userPermissions(user) });
});

// ============================================
// USER MANAGEMENT API
// ============================================

app.get('/api/users', authenticate, checkPermission('users:read'), (req, res) => {
  res.json(db.getUsers());
});

app.post('/api/users', authenticate, checkPermission('users:create'), (req, res) => {
  const { username, password, name, email, role } = req.body;
  if (!username || !password || !name || !role) return res.status(400).json({ error: 'Username, password, name, and role are required' });
  if (db.getUserByUsername(username)) return res.status(400).json({ error: 'Username already exists' });
  if (!['admin', 'manager', 'warehouse', 'viewer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.createUser(username, hash, role);
  const newUser = db.getUserById(result.lastInsertRowid);
  const { password_hash, ...safe } = newUser;
  logUserActivity(req, 'user.create', 'user', newUser.id, { username: newUser.username, role: newUser.role });
  res.status(201).json(safe);
});

app.put('/api/users/:id', authenticate, checkPermission('users:update'), (req, res) => {
  const { username, password, name, email, role } = req.body;
  const id = parseInt(req.params.id);
  if (username && db.getUserByUsername(username)?.id !== id) return res.status(400).json({ error: 'Username already exists' });
  const oldUser = db.getUserById(id);
  db.updateUser(id, username, role);
  const updatedUser = db.getUserById(id);
  if (!updatedUser) return res.status(404).json({ error: 'User not found' });
  logUserActivity(req, 'user.update', 'user', id, { 
    username: updatedUser.username,
    oldRole: oldUser?.role,
    newRole: updatedUser.role
  });
  const { password_hash, ...safe } = updatedUser;
  res.json(safe);
});

app.delete('/api/users/:id', authenticate, checkPermission('users:delete'), (req, res) => {
  const id = parseInt(req.params.id);
  const user = db.getUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.username === 'admin') return res.status(400).json({ error: 'Cannot delete admin user' });
  db.deleteUser(id);
  db.deleteUserRefreshTokens(id);
  logUserActivity(req, 'user.delete', 'user', id, { username: user.username, role: user.role });
  res.json({ message: 'User deleted' });
});

// ============================================
// SETTINGS API
// ============================================

app.get('/api/settings', authenticate, checkPermission('settings:read'), (req, res) => {
  res.json(db.getAllSettings());
});

app.put('/api/settings', authenticate, checkPermission('settings:update'), (req, res) => {
  const current = db.getAllSettings();
  const updated = { ...current, ...req.body };
  if (updated.permissions) updated.permissions.admin = ['*'];
  
  // Log which settings changed
  const changedKeys = Object.keys(req.body).filter(k => JSON.stringify(req.body[k]) !== JSON.stringify(current[k]))
  if (changedKeys.length > 0) {
    logUserActivity(req, 'settings.update', 'settings', null, { changed: changedKeys });
  }
  
  for (const [key, value] of Object.entries(updated)) {
    db.setSetting(key, value);
  }
  res.json(updated);
});

// ============================================
// INVENTORY API
// ============================================

app.get('/api/inventory', authenticate, (req, res) => {
  const { date_from, date_to } = req.query;
  const filters = {};
  if (date_from) filters.date_from = date_from;
  if (date_to) filters.date_to = date_to;
  const items = db.getInventory(filters);
  res.json(items.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
});

app.get('/api/inventory/stats', authenticate, (req, res) => {
  const { date_from, date_to } = req.query;
  const filters = {};
  if (date_from) filters.date_from = date_from;
  if (date_to) filters.date_to = date_to;
  res.json(db.getInventoryStats(filters));
});

app.get('/api/inventory/:id', authenticate, (req, res) => {
  const item = db.getInventoryItem(parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

app.post('/api/inventory', authenticate, checkPermission('inventory:create'), (req, res) => {
  const { name, sku, category, quantity, price, supplier, description, image, track_expiry, base_unit } = req.body;
  if (!name || !sku || !category) return res.status(400).json({ error: 'Name, SKU, and category are required' });
  if (db.getInventory().some((i) => i.sku === sku)) return res.status(400).json({ error: 'SKU already exists' });
  let qty = Math.round(Number(quantity))
  let prc = Math.round(Number(price) * 100) / 100
  const isTrackExpiry = req.body.track_expiry ? true : false
  if (isNaN(qty) || (!isTrackExpiry && qty < 1)) return res.status(400).json({ error: 'Quantity must be at least 1' });
  if (isNaN(prc) || prc < 1) return res.status(400).json({ error: 'Price must be at least $1' });
  const item = db.createInventory({
    name: name.trim(), sku: sku.trim(), category, quantity: qty, price: prc,
    supplier: (supplier || '').trim(), description: (description || '').trim(), image: image || '',
    track_expiry: track_expiry ? 1 : 0, base_unit: base_unit || 'pcs'
  });
  logUserActivity(req, 'inventory.create', 'inventory', item.id, { name: item.name, sku: item.sku, category: item.category });
  res.status(201).json(item);
});

app.put('/api/inventory/:id', authenticate, checkPermission('inventory:update'), (req, res) => {
  const { name, sku, category, quantity, price, supplier, description, image, track_expiry, base_unit } = req.body;
  if (!name || !sku || !category) return res.status(400).json({ error: 'Name, SKU, and category are required' });
  const id = parseInt(req.params.id);
  if (db.getInventory().some((i) => i.sku === sku && i.id !== id)) return res.status(400).json({ error: 'SKU already exists' });
  let qty = Math.round(Number(quantity))
  let prc = Math.round(Number(price) * 100) / 100
  const isTrackExpiry = req.body.track_expiry ? true : false
  if (isNaN(qty) || (!isTrackExpiry && qty < 1)) return res.status(400).json({ error: 'Quantity must be at least 1' });
  if (isNaN(prc) || prc < 1) return res.status(400).json({ error: 'Price must be at least $1' });
  const item = db.updateInventory(id, {
    name: name.trim(), sku: sku.trim(), category, quantity: qty, price: prc,
    supplier: (supplier || '').trim(), description: (description || '').trim(), image: image !== undefined ? image : '',
    track_expiry: track_expiry ? 1 : 0, base_unit: base_unit || 'pcs'
  });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  logUserActivity(req, 'inventory.update', 'inventory', id, { name: item.name, sku: item.sku });
  res.json(item);
});

app.delete('/api/inventory/:id', authenticate, checkPermission('inventory:delete'), (req, res) => {
  const id = parseInt(req.params.id);
  const item = db.getInventoryItem(id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.image) { const imgPath = path.join(__dirname, item.image); if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath); }
  db.deleteInventory(id);
  logUserActivity(req, 'inventory.delete', 'inventory', id, { name: item.name, sku: item.sku });
  res.json({ message: 'Item deleted' });
});

// ============================================
// FILE UPLOAD API
// ============================================

app.post('/api/upload', authenticate, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ============================================
// BATCHES & PACKAGING API
// ============================================

app.get('/api/batches/expired', authenticate, (req, res) => {
  const batches = db.getExpiredBatches();
  res.json(batches);
});

app.get('/api/inventory/:id/batches', authenticate, (req, res) => {
  const item = db.getInventoryItem(parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const batches = db.getBatches(parseInt(req.params.id));
  res.json(batches);
});

app.post('/api/batches', authenticate, checkPermission('inventory:update'), (req, res) => {
  const { item_id, batch_number, quantity, manufacture_date, expiry_date, notes } = req.body;
  if (!item_id || !batch_number || !quantity) return res.status(400).json({ error: 'item_id, batch_number, and quantity are required' });
  try {
    const batch = db.createBatch({
      item_id: parseInt(item_id),
      batch_number: batch_number.trim(),
      quantity: Math.round(Number(quantity)),
      manufacture_date: manufacture_date || null,
      expiry_date: expiry_date || null,
      notes: notes || ''
    });
    res.status(201).json(batch);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/batches/:id', authenticate, checkPermission('inventory:update'), (req, res) => {
  const { batch_number, quantity, manufacture_date, expiry_date, notes } = req.body;
  try {
    const batch = db.updateBatch(parseInt(req.params.id), {
      batch_number, quantity: Math.round(Number(quantity)),
      manufacture_date, expiry_date, notes
    });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json(batch);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/batches/:id', authenticate, checkPermission('inventory:update'), (req, res) => {
  try {
    const result = db.deleteBatch(parseInt(req.params.id));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/inventory/:id/packaging', authenticate, (req, res) => {
  const item = db.getInventoryItem(parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const packaging = db.getPackaging(parseInt(req.params.id));
  res.json(packaging);
});

app.put('/api/inventory/:id/packaging', authenticate, checkPermission('inventory:update'), (req, res) => {
  const { levels } = req.body;
  if (!Array.isArray(levels)) return res.status(400).json({ error: 'levels array is required' });
  const packaging = db.setPackaging(parseInt(req.params.id), levels);
  res.json(packaging);
});

// ============================================
// TRANSACTIONS API (merged with invoices)
// ============================================

app.get('/api/transactions', authenticate, checkPermission('transactions:read'), (req, res) => {
  const { type, status, date_from, date_to, search } = req.query;
  const txns = db.getTransactions({ type, status, date_from, date_to, search });
  res.json(txns);
});

app.get('/api/transactions/stats', authenticate, checkPermission('transactions:read'), (req, res) => {
  res.json(db.getTransactionStats());
});

app.get('/api/transactions/:id', authenticate, checkPermission('transactions:read'), (req, res) => {
  const txn = db.getTransaction(parseInt(req.params.id));
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  res.json(txn);
});

app.post('/api/transactions', authenticate, checkPermission('transactions:create'), (req, res) => {
  try {
    // Validate source and destination are always required
    if (!req.body.source) return res.status(400).json({ error: 'Source/From is required' });
    if (!req.body.destination) return res.status(400).json({ error: 'Destination/To is required' });

    const items = req.body.items || [{ item_id: req.body.item_id, quantity: req.body.quantity }];
    for (const item of items) {
      let qty = Math.round(Number(item.quantity))
      if (isNaN(qty) || qty < 1) return res.status(400).json({ error: 'Each item quantity must be at least 1' });
      item.quantity = qty
    }

    const txn = db.createTransaction({
      type: req.body.type,
      items,
      customer_name: req.body.customer_name || '',
      date: req.body.date,
      notes: req.body.notes || '',
      taxRate: Number(req.body.tax_rate) / 100 || 0,
      source: req.body.source,
      destination: req.body.destination
    });
    logUserActivity(req, 'transaction.create', 'transaction', txn.id, {
      type: txn.type,
      invoice_number: txn.invoice_number,
      itemCount: txn.items?.length || items.length,
      customer_name: txn.customer_name
    });
    res.status(201).json(txn);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/transactions/:id/status', authenticate, (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const updated = db.updateTransactionStatus(parseInt(req.params.id), status);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/transactions/:id', authenticate, checkPermission('transactions:delete'), (req, res) => {
  try {
    const txn = db.getTransaction(parseInt(req.params.id));
    db.deleteTransaction(parseInt(req.params.id));
    logUserActivity(req, 'transaction.delete', 'transaction', parseInt(req.params.id), {
      type: txn?.type,
      invoice_number: txn?.invoice_number
    });
    res.json({ message: 'Transaction deleted and stock reverted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// CUSTOMERS & SUPPLIERS API
// ============================================

app.get('/api/customers', authenticate, (req, res) => {
  const { type } = req.query;
  res.json(db.getCustomers(type));
});

app.get('/api/customers/:id/invoices', authenticate, (req, res) => {
  const customer = db.getCustomer(parseInt(req.params.id));
  if (!customer) return res.status(404).json({ error: 'Contact not found' });
  // Find transactions (billed) by customer name
  const txns = db.getTransactions({ search: customer.name });
  const billedTxns = txns.filter(t => t.invoice_number && t.customer_name === customer.name);
  res.json(billedTxns);
});

app.post('/api/customers', authenticate, (req, res) => {
  const { name, email, phone, address, type } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const customer = db.createCustomer({ name: name.trim(), email, phone, address, type });
  res.status(201).json(customer);
});

app.delete('/api/customers/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id);
  const customer = db.getCustomer(id);
  if (!customer) return res.status(404).json({ error: 'Contact not found' });
  db.deleteCustomer(id);
  res.json({ message: 'Contact deleted' });
});

// ============================================
// CSV EXPORT
// ============================================

app.get('/api/export/inventory', authenticate, checkPermission('inventory:read'), (req, res) => {
  const items = db.getInventory();
  const header = 'ID,Name,SKU,Category,Quantity,Price,Supplier,Description,Created,Updated\n';
  const rows = items.map((i) => `${i.id},"${i.name}","${i.sku}","${i.category}",${i.quantity},${i.price},"${i.supplier}","${i.description}",${i.created_at},${i.updated_at}`).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=inventory-export.csv');
  res.send(header + rows);
});

// ============================================
// QR CODE & BARCODE
// ============================================

app.get('/api/inventory/:id/qr', async (req, res) => {
  const item = db.getInventoryItem(parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Item not found' });
  try {
    const settings = db.getAllSettings();
    const qrFields = settings.qrFields || ['name', 'sku', 'category'];
    const payload = {};
    qrFields.forEach((field) => { if (item[field] !== undefined) payload[field] = item[field]; });
    const svg = await QRCode.toString(JSON.stringify(payload), { type: 'svg', margin: 2, width: 250 });
    res.type('svg').send(svg);
  } catch (err) { res.status(500).json({ error: 'Failed to generate QR code' }); }
});

app.get('/api/inventory/:id/barcode', (req, res) => {
  const item = db.getInventoryItem(parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Item not found' });
  try {
    const canvas = createCanvas(300, 150);
    JsBarcode(canvas, item.sku, { format: 'CODE128', width: 2, height: 60, displayValue: true, fontSize: 16, margin: 10 });
    res.type('png').send(canvas.toBuffer('image/png'));
  } catch (err) {
    const svgText = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><text x="150" y="40" text-anchor="middle" font-family="monospace" font-size="20">${item.sku}</text><text x="150" y="70" text-anchor="middle" font-family="sans-serif" font-size="14">${item.name}</text></svg>`;
    res.type('svg').send(svgText);
  }
});

// ============================================
// ACTIVITY LOGS API
// ============================================

app.get('/api/activity-logs', authenticate, checkPermission('audit:read'), (req, res) => {
  const { user_id, action, entity_type, date_from, date_to, search, page = 1, perPage = 50 } = req.query
  
  const filters = {}
  if (user_id) filters.user_id = parseInt(user_id)
  if (action) filters.action = action
  if (entity_type) filters.entity_type = entity_type
  if (date_from) filters.date_from = date_from
  if (date_to) filters.date_to = date_to
  if (search) filters.search = search
  
  const perPageNum = Math.min(parseInt(perPage) || 50, 200)
  const pageNum = parseInt(page) || 1
  filters.limit = perPageNum
  filters.offset = (pageNum - 1) * perPageNum
  
  const logs = db.getActivityLogs(filters)
  const total = db.getActivityLogCount(filters)
  
  res.json({
    logs,
    total,
    page: pageNum,
    perPage: perPageNum,
    totalPages: Math.ceil(total / perPageNum)
  })
})

app.get('/api/activity-logs/stats', authenticate, checkPermission('audit:read'), (req, res) => {
  const stats = db.getActivityLogStats()
  res.json(stats)
})

app.get('/api/activity-logs/export', authenticate, checkPermission('audit:export'), (req, res) => {
  const { user_id, action, entity_type, date_from, date_to } = req.query
  
  const filters = { limit: 10000 } // max 10K rows for export
  if (user_id) filters.user_id = parseInt(user_id)
  if (action) filters.action = action
  if (entity_type) filters.entity_type = entity_type
  if (date_from) filters.date_from = date_from
  if (date_to) filters.date_to = date_to
  
  const logs = db.getActivityLogs(filters)
  
  const header = 'ID,Timestamp,User,Action,Entity Type,Entity ID,Details\n'
  const rows = logs.map((l) => {
    const details = l.details ? JSON.stringify(l.details).replace(/"/g, '""') : ''
    return `${l.id},"${l.created_at}","${l.username}","${l.action}","${l.entity_type}",${l.entity_id || ''},"${details}"`
  }).join('\n')
  
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=activity-log-export.csv')
  res.send(header + rows)
})

// ============================================
// SPA CATCH-ALL
// ============================================
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Inventory server running at http://localhost:${PORT}`);
  console.log(`Default admin: admin / admin123`);
});
