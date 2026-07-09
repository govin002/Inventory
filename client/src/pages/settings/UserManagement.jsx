import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Pencil, Trash2, Shield } from 'lucide-react'
import { get, post, put, del } from '../../api'

const ROLE_COLORS = { admin: 'red', manager: 'blue', warehouse: 'amber', viewer: 'green' }

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', name: '', email: '', role: 'viewer' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadUsers() {
    try {
      setUsers(await get('/api/users'))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadUsers() }, [])

  function openCreate() {
    setEditUser(null)
    setForm({ username: '', password: '', name: '', email: '', role: 'viewer' })
    setShowForm(true)
    setError('')
  }

  function openEdit(user) {
    setEditUser(user)
    setForm({ username: user.username, password: '', name: user.name, email: user.email || '', role: user.role })
    setShowForm(true)
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const payload = { ...form }
    if (editUser && !payload.password) delete payload.password

    try {
      if (editUser) {
        await put(`/api/users/${editUser.id}`, payload)
      } else {
        await post('/api/users', payload)
      }
      setShowForm(false)
      loadUsers()
    } catch (err) { setError(err.message) }
  }

  async function deleteUser(id) {
    if (!confirm('Delete this user?')) return
    await del(`/api/users/${id}`)
    loadUsers()
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
                <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required disabled={!!editUser} />
              </div>
              <div className="form-group">
                <label>{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editUser} />
              </div>
              <div className="form-group">
                <label>Full Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required>
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
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
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
                    <motion.button className="icon-btn delete" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => deleteUser(user.id)}><Trash2 size={16} /></motion.button>
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
