import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ permission, roles, children }) {
  const { user, permissions } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  if (permission && permissions) {
    if (!permissions.includes(permission)) {
      return <Navigate to="/" replace />
    }
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return children
}
