import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogIn, Package } from 'lucide-react'
import { post, setTokens } from '../api'

export default function Login({ onLogin }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await post('/api/auth/login', form)
      setTokens(data.token, data.refreshToken)
      onLogin(data.token, data.user, data.permissions)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <motion.div className="login-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="login-header">
          <div className="login-logo"><Package size={32} /></div>
          <h1>Inventory Management</h1>
          <p>Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input type="text" id="username" name="username" value={form.username} onChange={handleChange} required placeholder="Enter username" autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" name="password" value={form.password} onChange={handleChange} required placeholder="Enter password" />
          </div>
          {error && <motion.p className="error-msg" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.p>}
          <motion.button type="submit" className="btn btn-primary login-btn" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <LogIn size={18} />
            {loading ? 'Signing in...' : 'Sign In'}
          </motion.button>
        </form>
        <div className="login-footer">
          <p>Demo accounts: admin/admin123, manager/manager123, warehouse/warehouse123</p>
        </div>
      </motion.div>
    </div>
  )
}
