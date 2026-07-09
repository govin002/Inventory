import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Package, Building2, Database, ShieldCheck } from 'lucide-react'

const tabs = [
  { to: '/settings/users', label: 'Users', icon: Users },
  { to: '/settings/inventory', label: 'Inventory', icon: Package },
  { to: '/settings/company', label: 'Company', icon: Building2 },
  { to: '/settings/data', label: 'Data', icon: Database },
  { to: '/settings/permissions', label: 'Permissions', icon: ShieldCheck },
]

export default function Settings() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Manage your application settings</p>
        </div>
      </div>
      <div className="settings-layout">
        <nav className="settings-tabs">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `settings-tab ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="settings-content">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Outlet />
          </motion.div>
        </div>
      </div>
    </>
  )
}
