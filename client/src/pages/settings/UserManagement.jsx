import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Pencil, Trash2, Shield } from 'lucide-react'
import { get, post, put, del } from '../../api'
import ConfirmModal from '../../components/ConfirmModal'
import { useToast } from '../../components/ToastContext'
import useUnsavedChanges from '../../hooks/useUnsavedChanges'

const ROLE_COLORS = { admin: 'red', manager: 'blue', warehouse: 'amber', viewer: 'green' }

export default function UserManagement() {
  const showToast = useToast()
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', name: '', email: '', role: 'viewer' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [isFormDirty, setIsFormDirty] = useState(false)
  const [pendingCancel, setPendingCancel] = useState(false)

  const blocker = useUnsavedChanges(isFormDirty)

  async function loadUsers() {
    try {
      setUsers(await get('/api/users'))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadUsers() }, [])

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setIsFormDirty(true)
  }

  function openCreate() {
    setEditUser(null)
    setForm({ username: '', password: '', name: '', email: '', role: 'viewer' })
    setShowForm(true)
    setIsFormDirty(false)
    setError('')
    setPendingCancel(false)
  }

  function openEdit(user) {
    setEditUser(user)
    setForm({ username: user.username, password: '', name: user.name, email: user.email || '', role: user.role })
    setShowForm(true)
    setIsFormDirty(false)
    setError('')
    setPendingCancel(false)
  }

  function handleCancelClick() {
    if (isFormDirty) {
      setPendingCancel(true)
    } else {
      setShowForm(false)
    }
  }

  function confirmCancel() {
    setPendingCancel(false)
    setShowForm(false)
    setIsFormDirty(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const payload = { ...form }
    if (editUser && !payload.password) delete payload.password

    try {
      if (editUser) {
        await put(`/api/users/${editUser.id}`, payload)
        showToast('User updated successfully', { variant: 'success' })
      } else {
        await post('/api/users', payload)
        showToast('User created successfully', { variant: 'success' })
      }
      setShowForm(false)
      setIsFormDirty(false)
      loadUsers()
    } catch (err) {
      showToast('Failed to save user', { variant: 'error' })
      setError(err.message)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await del(`/api/users/${deleteTarget}`)
      setDeleteTarget(null)
      showToast('User deleted successfully', { variant: 'success' })
      loadUsers()
    } catch (err) {
      showToast('Failed to delete user', { variant: 'error' })
    }
  }

  return (
    <>
      <div className="settings-section-header">
        <h2>User Management</h2>
        <motion.button className="btn btn-primary btn-sm" onClick={openCreate} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Plus size={16} /> Add User
        </motion.button>
      </div>

      {showForm && (
        <motion.div className="settings-form-card" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h3>{editUser ? 'Edit User' : 'Create User'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="settings-form-grid">
              <div className="form-group">
                <label>Username *</label>
                <input type="text" value={form.username} onChange={(e) => handleFormChange('username', e.target.value)} required disabled={!!editUser} />
              </div>
              <div className="form-group">
                <label>{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input type="password" value={form.password} onChange={(e) => handleFormChange('password', e.target.value)} required={!editUser} />
              </div>
              <div className="form-group">
                <label>Full Name *</label>
                <input type="text" value={form.name} onChange={(e) => handleFormChange('name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => handleFormChange('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select value={form.role} onChange={(e) => handleFormChange('role', e.target.value)} required>
                  <option value="viewer">Viewer (read-only)</option>
                  <option value="warehouse">Warehouse Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin (full access)</option>
                </select>
              </div>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <div className="form-actions">
              <motion.button type="submit" className="btn btn-primary btn-sm" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>Save</motion.button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleCancelClick}>Cancel</button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="settings-table-card">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td><span className="table-name">{user.name}</span></td>
                <td><span className="table-sku">{user.username}</span></td>
                <td>{user.email || '-'}</td>
                <td><span className={`badge badge-${ROLE_COLORS[user.role] || 'category'}`}><Shield size={10} /> {user.role}</span></td>
                <td><span className="date-text">{new Date(user.created_at).toLocaleDateString()}</span></td>
                <td style={{ textAlign: 'right' }}>
                  <div className="actions" style={{ justifyContent: 'flex-end' }}>
                    <motion.button className="icon-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => openEdit(user)}><Pencil size={16} /></motion.button>
                    <motion.button className="icon-btn delete" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setDeleteTarget(user.id)}><Trash2 size={16} /></motion.button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirm cancel with unsaved form changes */}
      <ConfirmModal
        open={pendingCancel}
        title="Discard Changes?"
        message="You have unsaved changes in the form. Are you sure you want to cancel? Your changes will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        variant="warning"
        onConfirm={confirmCancel}
        onCancel={() => setPendingCancel(false)}
      />

      {/* Navigation blocker when form has unsaved changes */}
      <ConfirmModal
        open={blocker.state === 'blocked'}
        title="Unsaved Changes"
        message="You have unsaved changes in the user form. Are you sure you want to leave? Your changes will be lost."
        confirmLabel="Leave Page"
        cancelLabel="Stay"
        variant="warning"
        onConfirm={() => blocker.proceed()}
        onCancel={() => blocker.reset()}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
