import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LayoutDashboard, Package, PackagePlus, ArrowDownUp, ClipboardList, Settings, ChevronLeft, ChevronRight, Menu, X, LogOut, User, Shield, Moon, Sun, KeyRound } from 'lucide-react'
import { post } from '../api'
import { useToast } from './ToastContext'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/add', label: 'Add Item', icon: PackagePlus, permission: 'inventory:create' },
  { to: '/inventory', label: 'Inventory Items', icon: Package, permission: 'inventory:read' },
  { to: '/transactions', label: 'Transactions', icon: ArrowDownUp, permission: 'transactions:read' },
  { to: '/transactions/log', label: 'Log', icon: ClipboardList, permission: 'transactions:read' },
  { to: '/settings', label: 'Settings', icon: Settings, permission: 'settings:read' },
]

const roleLabels = { admin: 'Administrator', manager: 'Manager', warehouse: 'Warehouse Staff', viewer: 'Viewer' }
const roleIcons = { admin: Shield, manager: User, warehouse: Package, viewer: User }

export default function Layout({ children }) {
  const { user, permissions, handleLogout: onLogout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dark-mode') === 'true')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordError, setPasswordError] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const showToast = useToast()

  useEffect(() => { localStorage.setItem('sidebar-collapsed', collapsed) }, [collapsed])
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  useEffect(() => {
    localStorage.setItem('dark-mode', darkMode)
    document.documentElement.classList.toggle('dark-mode', darkMode)
  }, [darkMode])

  function toggleDark() {
    setDarkMode((prev) => !prev)
  }

  function handleLogout() {
    if (onLogout) onLogout()
    navigate('/login')
  }

  function openPasswordModal() {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setPasswordError('')
    setShowPasswordModal(true)
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    setPasswordError('')

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    setPasswordLoading(true)
    try {
      await post('/api/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      })
      showToast('Password changed successfully! Please log in again.', { variant: 'success' })
      setShowPasswordModal(false)
      // Force re-login after password change (tokens invalidated)
      setTimeout(() => handleLogout(), 1500)
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setPasswordLoading(false)
    }
  }

  const filteredItems = navItems.filter((item) => !item.permission || permissions?.includes(item.permission))
  const RoleIcon = roleIcons[user?.role] || User

  return (
    <div className={`layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="mobile-header">
        <button className="hamburger" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <h1 className="mobile-logo">Inventory</h1>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="sidebar-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
        )}
      </AnimatePresence>

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <h1>Inventory</h1>
          <AnimatePresence>
            {!collapsed && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                Management System
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <nav className="sidebar-nav">
          {filteredItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/transactions' || to === '/'} className={({ isActive }) => isActive ? 'active' : ''} title={collapsed ? label : undefined}>
              <Icon className="icon" size={20} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    className="nav-label"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          ))}
        </nav>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              className="sidebar-footer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <div className="sidebar-user">
                <div className="user-avatar"><RoleIcon size={16} /></div>
                <div className="user-info">
                  <span className="user-name">{user?.username || 'User'}</span>
                  <span className="user-role">{roleLabels[user?.role] || user?.role}</span>
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  <motion.button
                    className="logout-btn"
                    onClick={toggleDark}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  >
                    {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                  </motion.button>
                  <motion.button className="logout-btn" onClick={handleLogout} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title="Logout">
                    <LogOut size={16} />
                  </motion.button>
                </div>
              </div>
              <motion.button
                className="sidebar-password-btn"
                onClick={openPasswordModal}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                title="Change Password"
              >
                <KeyRound size={14} />
                <span>Change Password</span>
              </motion.button>
              <div className="sidebar-version">Inventory Module v2.0</div>
            </motion.div>
          )}
        </AnimatePresence>

        {collapsed && (
          <>
            <motion.button
              className="logout-btn-collapsed"
              onClick={toggleDark}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </motion.button>
            <motion.button
              className="logout-btn-collapsed"
              onClick={openPasswordModal}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Change Password"
            >
              <KeyRound size={18} />
            </motion.button>
            <motion.button className="logout-btn-collapsed" onClick={handleLogout} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title="Logout">
              <LogOut size={18} />
            </motion.button>
          </>
        )}
      </aside>

      <motion.button
        className="sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.span
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          animate={{ rotate: collapsed ? 180 : 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <ChevronLeft size={16} />
        </motion.span>
      </motion.button>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPasswordModal(false)}>
            <motion.div className="modal-card" style={{ maxWidth: 420 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}><X size={18} /></button>
              <div className="modal-icon warning" style={{ margin: '0 auto 16px' }}>
                <KeyRound size={28} />
              </div>
              <h3 className="modal-title">Change Password</h3>
              <form onSubmit={handlePasswordChange}>
                <div className="form-group" style={{ marginBottom: 12, textAlign: 'left' }}>
                  <label>Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 12, textAlign: 'left' }}>
                  <label>New Password</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 20, textAlign: 'left' }}>
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
                {passwordError && <p className="error-msg" style={{ marginBottom: 16 }}>{passwordError}</p>}
                <div className="modal-actions" style={{ marginTop: 0 }}>
                  <motion.button type="submit" className="btn btn-primary btn-sm" disabled={passwordLoading} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    {passwordLoading ? 'Changing...' : 'Change Password'}
                  </motion.button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.main className="main" key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  )
}
