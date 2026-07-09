import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import InventoryItems from './pages/InventoryItems'
import Form from './pages/Form'
import Transactions from './pages/Transactions'
import AddTransaction from './pages/AddTransaction'
import TransactionLog from './pages/TransactionLog'
import ItemDetail from './pages/ItemDetail'
import Settings from './pages/Settings'
import UserManagement from './pages/settings/UserManagement'
import InventorySettings from './pages/settings/InventorySettings'
import CompanyInfo from './pages/settings/CompanyInfo'
import DataManagement from './pages/settings/DataManagement'
import Permissions from './pages/settings/Permissions'
import { clearTokens, getTokens, post, get } from './api'

function App() {
  const [user, setUser] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.exp * 1000 > Date.now()) {
          setUser({ id: payload.id, username: payload.username, role: payload.role })
          // Fetch permissions from /api/auth/me
          get('/api/auth/me').then((data) => {
            if (data.permissions) setPermissions(data.permissions)
          }).catch(() => {}).finally(() => setLoading(false))
        } else {
          clearTokens()
          setToken(null)
          setLoading(false)
        }
      } catch {
        clearTokens()
        setToken(null)
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [token])

  function handleLogin(newToken, userData, perms) {
    setToken(newToken)
    setUser(userData)
    if (perms) setPermissions(perms)
  }

  function handleLogout() {
    const { refreshToken } = getTokens()
    if (refreshToken) {
      post('/api/auth/logout', { refreshToken }).catch(() => {})
    }
    clearTokens()
    setToken(null)
    setUser(null)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} />
        <Route path="/*" element={
          user ? (
            <Layout user={user} permissions={permissions} onLogout={handleLogout}>
              <AnimatePresence mode="wait">
                <Routes>
                  <Route path="/" element={<ProtectedRoute user={user} permissions={permissions}><Dashboard /></ProtectedRoute>} />
                  <Route path="/inventory" element={<ProtectedRoute user={user} permissions={permissions} permission="inventory:read"><InventoryItems user={user} permissions={permissions} /></ProtectedRoute>} />
                  <Route path="/add" element={<ProtectedRoute user={user} permissions={permissions} permission="inventory:create"><Form /></ProtectedRoute>} />
                  <Route path="/edit/:id" element={<ProtectedRoute user={user} permissions={permissions} permission="inventory:update"><Form /></ProtectedRoute>} />
                  <Route path="/inventory/:id" element={<ProtectedRoute user={user} permissions={permissions} permission="inventory:read"><ItemDetail /></ProtectedRoute>} />
                  <Route path="/transactions" element={<ProtectedRoute user={user} permissions={permissions} permission="transactions:read"><Transactions /></ProtectedRoute>} />
                  <Route path="/transactions/log" element={<ProtectedRoute user={user} permissions={permissions} permission="transactions:read"><TransactionLog /></ProtectedRoute>} />
                  <Route path="/transactions/add" element={<ProtectedRoute user={user} permissions={permissions} permission="transactions:create"><AddTransaction /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute user={user} permissions={permissions} permission="settings:read"><Settings user={user} /></ProtectedRoute>}>
                    <Route index element={<Navigate to="inventory" />} />
                    <Route path="users" element={<ProtectedRoute user={user} permissions={permissions} permission="users:read"><UserManagement /></ProtectedRoute>} />
                    <Route path="inventory" element={<ProtectedRoute user={user} permissions={permissions} permission="settings:read"><InventorySettings /></ProtectedRoute>} />
                    <Route path="company" element={<ProtectedRoute user={user} permissions={permissions} permission="settings:read"><CompanyInfo /></ProtectedRoute>} />
                    <Route path="data" element={<ProtectedRoute user={user} permissions={permissions} permission="settings:read"><DataManagement /></ProtectedRoute>} />
                    <Route path="permissions" element={<ProtectedRoute user={user} permissions={permissions} permission="settings:update"><Permissions /></ProtectedRoute>} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </AnimatePresence>
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App
