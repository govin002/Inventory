import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ user, permissions, permission, roles, children }) {
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
