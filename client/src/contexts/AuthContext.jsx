import { createContext, useContext, useState, useEffect } from 'react'
import { clearTokens, getTokens, post, get } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [token, setToken] = useState(() => sessionStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.exp * 1000 > Date.now()) {
          setUser({ id: payload.id, username: payload.username, role: payload.role })
          get('/api/auth/me')
            .then((data) => {
              if (data.permissions) setPermissions(data.permissions)
            })
            .catch(() => {})
            .finally(() => setLoading(false))
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

  return (
    <AuthContext.Provider value={{ user, permissions, loading, handleLogin, handleLogout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
