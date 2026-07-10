import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Shield, Check, LoaderCircle, CheckCircle, AlertCircle } from 'lucide-react'
import { get, put } from '../../api'
import { useToast } from '../../components/ToastContext'

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
  'settings:update': 'Update Settings',
  'audit:read': 'View Activity Log',
  'audit:export': 'Export Activity Log'
}

const PERMISSION_GROUPS = {
  'inventory': { label: 'Inventory', color: 'blue' },
  'transactions': { label: 'Transactions', color: 'green' },
  'users': { label: 'Users', color: 'red' },
  'settings': { label: 'Settings', color: 'amber' },
  'audit': { label: 'Audit', color: 'purple' }
}

const ROLES = ['admin', 'manager', 'warehouse', 'viewer']

const ROLE_COLORS = { admin: 'red', manager: 'blue', warehouse: 'amber', viewer: 'green' }
const ROLE_LABELS = { admin: 'Administrator', manager: 'Manager', warehouse: 'Warehouse Staff', viewer: 'Viewer' }

export default function Permissions() {
  const showToast = useToast()
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const saveTimer = useRef(null)

  useEffect(() => {
    get('/api/settings').then((s) => {
      setPermissions(s.permissions || {})
    }).finally(() => setLoading(false))
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  /** Save the current permissions to the server immediately */
  async function saveNow(perms) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    try {
      const current = await get('/api/settings')
      await put('/api/settings', { ...current, permissions: perms })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 1500)
    } catch (err) {
      setSaveStatus('error')
      showToast('Failed to save permissions', { variant: 'error' })
      setTimeout(() => setSaveStatus((s) => s === 'error' ? 'idle' : s), 3000)
    }
  }

  function toggle(role, perm) {
    // Admin always has full access — cannot be modified
    if (role === 'admin') return
    setPermissions((prev) => {
      const rolePerms = [...(prev[role] || [])]
      const idx = rolePerms.indexOf(perm)
      if (idx >= 0) rolePerms.splice(idx, 1)
      else rolePerms.push(perm)
      const next = { ...prev, [role]: rolePerms }
      saveNow(next)
      return next
    })
  }

  function setAll(role, value) {
    // Admin always has full access — cannot be un-toggled
    if (role === 'admin') return
    const allPerms = Object.keys(PERMISSION_LABELS)
    setPermissions((prev) => {
      const next = { ...prev, [role]: value ? [...allPerms] : [] }
      saveNow(next)
      return next
    })
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
        <SaveIndicator status={saveStatus} />
      </div>

      <p className="settings-description">Control which actions each role can perform. Admin has full access by default. All changes are saved automatically.</p>

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

/** Small inline status indicator */
function SaveIndicator({ status }) {
  if (status === 'idle') return null
  return (
    <motion.span
      className={`save-indicator save-${status}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 500 }}
    >
      {status === 'saving' && <><LoaderCircle size={14} className="spin" /> Saving…</>}
      {status === 'saved' && <><CheckCircle size={14} style={{ color: 'var(--green)' }} /> Saved</>}
      {status === 'error' && <><AlertCircle size={14} style={{ color: 'var(--red)' }} /> Save failed</>}
    </motion.span>
  )
}
