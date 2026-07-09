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

app.post('/api/auth/logout', (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) db.deleteRefreshToken(refreshToken);
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, name: user.name, email: user.email, role: user.role, permissions: userPermissions(user) });
});

// ============================================
// USER MANAGEMENT API (Admin only)
// ============================================

app.get('/api/users', authenticate, checkPermission('users:read'), (req, res) => {
  const users = db.getUsers();
  res.json(users);
});

app.post('/api/users', authenticate, checkPermission('users:create'), (req, res) => {
  const { username, password, name, email, role } = req.body;
  if (!username || !password || !name || !role) return res.status(400).json({ error: 'Username, password, name, and role are required' });
  if (db.getUserByUsername(username)) return res.status(400).json({ error: 'Username already exists' });
  if (!['admin', 'manager', 'warehouse', 'viewer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.createUser(username, hash, role);
  const user = db.getUserById(result.lastInsertRowid);
  const { password_hash, ...safe } = user;
  res.status(201).json(safe);
});

app.put('/api/users/:id', authenticate, checkPermission('users:update'), (req, res) => {
  const { username, password, name, email, role } = req.body;
  const id = parseInt(req.params.id);
  
  if (username && db.getUserByUsername(username)?.id !== id) return res.status(400).json({ error: 'Username already exists' });

  const updates = {};
  if (username) updates.username = username;
  if (password) updates.password_hash = bcrypt.hashSync(password, 10);
  if (name) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (role) updates.role = role;

  db.updateUser(id, updates.username, updates.role);
  const user = db.getUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password_hash, ...safe } = user;
  res.json(safe);
});

app.delete('/api/users/:id', authenticate, checkPermission('users:delete'), (req, res) => {
  const id = parseInt(req.params.id);
  const user = db.getUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.username === 'admin') return res.status(400).json({ error: 'Cannot delete admin user' });
  db.deleteUser(id);
  db.deleteUserRefreshTokens(id);
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
  for (const [key, value] of Object.entries(updated)) {
    db.setSetting(key, value);
  }
  res.json(updated);
});

// ============================================
// INVENTORY API
// ============================================

app.get('/api/inventory', authenticate, (req, res) => {
  const items = db.getInventory();
  res.json(items.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
});

app.get('/api/inventory/stats', authenticate, (req, res) => {
  const items = db.getInventory();
  const threshold = db.getSetting('lowStockThreshold', 20);
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalValue = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  const lowStock = items.filter((i) => i.quantity < threshold).length;
  const inStock = items.filter((i) => i.quantity >= threshold).length;
  const categoryMap = {};
  items.forEach((item) => { categoryMap[item.category] = (categoryMap[item.category] || 0) + item.quantity; });
  const stockByCategory = Object.entries(categoryMap).map(([category, quantity]) => ({ category, quantity }));
  res.json({ totalItems, totalQuantity, totalValue: parseFloat(totalValue.toFixed(2)), lowStock, inStock, stockByCategory });
});

app.get('/api/inventory/:id', authenticate, (req, res) => {
  const item = db.getInventoryItem(parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

app.post('/api/inventory', authenticate, checkPermission('inventory:create'), (req, res) => {
  const { name, sku, category, quantity, price, supplier, description, image } = req.body;
  if (!name || !sku || !category) return res.status(400).json({ error: 'Name, SKU, and category are required' });
  if (db.getInventory().some((i) => i.sku === sku)) return res.status(400).json({ error: 'SKU already exists' });
  const item = db.createInventory({ name: name.trim(), sku: sku.trim(), category, quantity: Number(quantity) || 0, price: Number(price) || 0, supplier: (supplier || '').trim(), description: (description || '').trim(), image: image || '' });
  res.status(201).json(item);
});

app.put('/api/inventory/:id', authenticate, checkPermission('inventory:update'), (req, res) => {
  const { name, sku, category, quantity, price, supplier, description, image } = req.body;
  if (!name || !sku || !category) return res.status(400).json({ error: 'Name, SKU, and category are required' });
  const id = parseInt(req.params.id);
  if (db.getInventory().some((i) => i.sku === sku && i.id !== id)) return res.status(400).json({ error: 'SKU already exists' });
  const item = db.updateInventory(id, { name: name.trim(), sku: sku.trim(), category, quantity: Number(quantity) || 0, price: Number(price) || 0, supplier: (supplier || '').trim(), description: (description || '').trim(), image: image !== undefined ? image : '' });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

app.delete('/api/inventory/:id', authenticate, checkPermission('inventory:delete'), (req, res) => {
  const id = parseInt(req.params.id);
  const item = db.getInventoryItem(id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.image) { const imgPath = path.join(__dirname, item.image); if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath); }
  db.deleteInventory(id);
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
// TRANSACTIONS API
// ============================================

app.get('/api/transactions', authenticate, checkPermission('transactions:read'), (req, res) => {
  const { type, item_id, date_from, date_to } = req.query;
  const txns = db.getTransactions({ type, item_id: item_id ? parseInt(item_id) : undefined, date_from, date_to });
  res.json(txns);
});

app.get('/api/transactions/stats', authenticate, checkPermission('transactions:read'), (req, res) => {
  res.json(db.getTransactionStats());
});

app.get('/api/transactions/:id', authenticate, checkPermission('transactions:read'), (req, res) => {
  const txns = db.getTransactions({ item_id: parseInt(req.params.id) });
  if (txns.length === 0) return res.status(404).json({ error: 'Transaction not found' });
  res.json(txns[0]);
});

app.post('/api/transactions', authenticate, checkPermission('transactions:create'), (req, res) => {
  try {
    const txn = db.createTransaction({
      item_id: req.body.item_id,
      type: req.body.type,
      quantity: req.body.quantity,
      source: req.body.source,
      destination: req.body.destination,
      date: req.body.date,
      notes: req.body.notes
    });
    res.status(201).json(txn);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/transactions/:id', authenticate, checkPermission('transactions:delete'), (req, res) => {
  try {
    db.deleteTransaction(parseInt(req.params.id));
    res.json({ message: 'Transaction deleted and stock reverted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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
// SPA CATCH-ALL
// ============================================
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Inventory server running at http://localhost:${PORT}`);
  console.log(`Default admin: admin / admin123`);
});