import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Save, Shield, Check } from 'lucide-react'
import { get, put } from '../../api'

const PERMISSION_LABELS = {
  'inventory:read': 'View Items',
  'inventory:create': 'Add Items',
  'inventory:update': 'Edit Items',
  'inventory:delete': 'Delete Items',
  'transactions:read': 'View Transactions',
  'transactions:create': 'Add Transactions',
  'transactions:delete': 'Delete Transactions',
  'users:read': 'View Users',
  'users:create': 'Add Users',
  'users:update': 'Edit Users',
  'users:delete': 'Delete Users',
  'settings:read': 'View Settings',
  'settings:update': 'Update Settings'
}

const PERMISSION_GROUPS = {
  'inventory': { label: 'Inventory', color: 'blue' },
  'transactions': { label: 'Transactions', color: 'green' },
  'users': { label: 'Users', color: 'red' },
  'settings': { label: 'Settings', color: 'amber' }
}

const ROLES = ['admin', 'manager', 'warehouse', 'viewer']

const ROLE_COLORS = { admin: 'red', manager: 'blue', warehouse: 'amber', viewer: 'green' }
const ROLE_LABELS = { admin: 'Administrator', manager: 'Manager', warehouse: 'Warehouse Staff', viewer: 'Viewer' }

export default function Permissions() {
  const [permissions, setPermissions] = useState({})
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get('/api/settings').then((s) => {
      setPermissions(s.permissions || {})
    }).finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    const current = await get('/api/settings')
    await put('/api/settings', { ...current, permissions })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggle(role, perm) {
    // Admin always has full access — cannot be modified
    if (role === 'admin') return
    setPermissions((prev) => {
      const rolePerms = [...(prev[role] || [])]
      const idx = rolePerms.indexOf(perm)
      if (idx >= 0) rolePerms.splice(idx, 1)
      else rolePerms.push(perm)
      return { ...prev, [role]: rolePerms }
    })
  }

  function setAll(role, value) {
    // Admin always has full access — cannot be un-toggled
    if (role === 'admin') return
    const allPerms = Object.keys(PERMISSION_LABELS)
    setPermissions((prev) => ({ ...prev, [role]: value ? [...allPerms] : [] }))
  }

  function isAllSelected(role) {
    const allPerms = Object.keys(PERMISSION_LABELS)
    const rolePerms = permissions[role] || []
    return allPerms.every((p) => rolePerms.includes(p))
  }

  if (loading) return <div className="empty-state">Loading...</div>

  return (
    <>
      <div className="settings-section-header">
        <h2>Role Permissions</h2>
        <motion.button className="btn btn-primary btn-sm" onClick={handleSave} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Save size={16} /> {saved ? 'Saved!' : 'Save Changes'}
        </motion.button>
      </div>

      <p className="settings-description">Control which actions each role can perform. Admin has full access by default.</p>

      <div className="perm-table-wrap">
        <table className="perm-table">
          <thead>
            <tr>
              <th>Role</th>
              {Object.entries(PERMISSION_GROUPS).map(([, group]) => (
                <th key={group.label} colSpan={Object.keys(PERMISSION_LABELS).filter((k) => k.startsWith(group.label.toLowerCase()) || k.startsWith(group.label === 'Inventory' ? 'inventory' : group.label.toLowerCase())).length} className={`perm-group-header ${group.color}`}>
                  {group.label}
                </th>
              ))}
              <th>All</th>
            </tr>
            <tr>
              <th></th>
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <th key={key} className="perm-label">{label}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role}>
                <td className={`perm-role ${role}`}>
                  <Shield size={14} />
                  <span>{ROLE_LABELS[role]}</span>
                </td>
                {Object.keys(PERMISSION_LABELS).map((perm) => {
                  const selected = role === 'admin' || (permissions[role] || []).includes(perm) || (permissions[role] || []).includes('*')
                  return (
                    <td key={perm} className={`perm-cell ${role === 'admin' ? 'perm-disabled' : ''}`} onClick={() => toggle(role, perm)}>
                      <div className={`perm-check ${selected ? 'on' : ''}`}>
                        {selected && <Check size={12} />}
                      </div>
                    </td>
                  )
                })}
                <td className={`perm-cell ${role === 'admin' ? 'perm-disabled' : ''}`} onClick={() => setAll(role, !isAllSelected(role))}>
                  <div className={`perm-check ${(role === 'admin' || isAllSelected(role)) ? 'on' : ''}`}>
                    {(role === 'admin' || isAllSelected(role)) && <Check size={12} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
