import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Package, Building2, Database, ShieldCheck, Activity, Receipt } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const allTabs = [
  { to: '/settings/users', label: 'Users', icon: Users, permission: 'users:read' },
  { to: '/settings/inventory', label: 'Inventory', icon: Package, permission: 'settings:read' },
  { to: '/settings/company', label: 'Company', icon: Building2, permission: 'settings:read' },
  { to: '/settings/invoice', label: 'Invoice', icon: Receipt, permission: 'settings:read' },
  { to: '/settings/activity', label: 'Activity', icon: Activity, permission: 'audit:read' },
  { to: '/settings/data', label: 'Data', icon: Database, permission: 'settings:read' },
  { to: '/settings/permissions', label: 'Permissions', icon: ShieldCheck, permission: 'settings:update' },
]

export default function Settings() {
  const { permissions } = useAuth()
  
  const tabs = allTabs.filter((tab) =>
    !tab.permission || (permissions && (permissions.includes('*') || permissions.includes(tab.permission)))
  )
  
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
