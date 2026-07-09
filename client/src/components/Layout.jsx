import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, PackagePlus, ArrowDownUp, ClipboardList, Settings, ChevronLeft, ChevronRight, Menu, X, LogOut, User, Shield, Moon, Sun } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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

export default function Layout({ children, user, permissions, onLogout }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dark-mode') === 'true')

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
    localStorage.removeItem('token')
    if (onLogout) onLogout()
    navigate('/login')
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
          {!collapsed && <p>Management System</p>}
        </div>

        <nav className="sidebar-nav">
          {filteredItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/transactions' || to === '/'} className={({ isActive }) => isActive ? 'active' : ''} title={collapsed ? label : undefined}>
              <Icon className="icon" size={20} />
              {!collapsed && <span className="nav-label">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        {!collapsed && (
          <div className="sidebar-footer">
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
            <div className="sidebar-version">Inventory Module v2.0</div>
          </div>
        )}

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
            <motion.button className="logout-btn-collapsed" onClick={handleLogout} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title="Logout">
              <LogOut size={18} />
            </motion.button>
          </>
        )}
      </aside>

      <motion.main className="main" key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
        {children}
      </motion.main>
    </div>
  )
}
