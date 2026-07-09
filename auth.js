const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'inventory-management-secret-key-2024';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'inventory-refresh-secret-key-2024';
const TOKEN_EXPIRY = '24h';
const REFRESH_EXPIRY = '7d';

const ROLE_HIERARCHY = { admin: 4, manager: 3, warehouse: 2, viewer: 1 };

const DEFAULT_PERMISSIONS = {
  admin: ['*'],
  manager: ['inventory:read', 'inventory:create', 'inventory:update', 'inventory:delete', 'transactions:read', 'transactions:create', 'transactions:delete', 'settings:read'],
  warehouse: ['inventory:read', 'transactions:read', 'transactions:create'],
  viewer: ['inventory:read', 'transactions:read']
};

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Access denied.' });
    if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions.' });
    next();
  };
}

function hasPermission(userRole, requiredRole) {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

function getEffectivePermissions() {
  try {
    const settings = db.getAllSettings();
    if (settings && settings.permissions) return settings.permissions;
  } catch {}
  return DEFAULT_PERMISSIONS;
}

function getAllPermissionKeys() {
  return ['inventory:read', 'inventory:create', 'inventory:update', 'inventory:delete', 'transactions:read', 'transactions:create', 'transactions:delete', 'users:read', 'users:create', 'users:update', 'users:delete', 'settings:read', 'settings:update'];
}

function checkPermission(perm) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Access denied.' });
    const permissions = getEffectivePermissions();
    const rolePerms = permissions[req.user.role] || [];
    if (rolePerms.includes('*') || rolePerms.includes(perm)) return next();
    return res.status(403).json({ error: 'Insufficient permissions.' });
  };
}

function userPermissions(user) {
  const permissions = getEffectivePermissions();
  const rolePerms = permissions[user.role] || [];
  return rolePerms.includes('*') ? getAllPermissionKeys() : rolePerms;
}

function generateTokens(user) {
  const payload = { id: user.id, username: user.username, name: user.name, role: user.role };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
  return { accessToken, refreshToken };
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

module.exports = { authenticate, authorize, hasPermission, checkPermission, getEffectivePermissions, getAllPermissionKeys, userPermissions, generateTokens, verifyRefreshToken, DEFAULT_PERMISSIONS, JWT_SECRET, REFRESH_SECRET, TOKEN_EXPIRY, REFRESH_EXPIRY, ROLE_HIERARCHY };