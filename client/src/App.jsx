import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { ToastProvider } from './components/ToastContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import InventoryItems from './pages/InventoryItems'
import Form from './pages/Form'
import Transactions from './pages/Transactions'
import AddTransaction from './pages/AddTransaction'
import TransactionLog from './pages/TransactionLog'
import TransactionDetail from './pages/TransactionDetail'
import ItemDetail from './pages/ItemDetail'
import Settings from './pages/Settings'
import UserManagement from './pages/settings/UserManagement'
import InventorySettings from './pages/settings/InventorySettings'
import CompanyInfo from './pages/settings/CompanyInfo'
import DataManagement from './pages/settings/DataManagement'
import Permissions from './pages/settings/Permissions'
import ActivityLog from './pages/settings/ActivityLog'
import InvoiceSettings from './pages/settings/InvoiceSettings'

/* ===== Route-level wrapper components ===== */

/** Checks auth: shows spinner while loading, redirects to /login if no user */
function AppLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

/** Login page wrapper — redirects to / if already logged in */
function LoginPage() {
  const { user, handleLogin } = useAuth()
  if (user) return <Navigate to="/" replace />
  return <Login onLogin={handleLogin} />
}

/* ===== Route definition (data router — required for useBlocker) ===== */

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'inventory', element: <ProtectedRoute permission="inventory:read"><InventoryItems /></ProtectedRoute> },
      { path: 'add', element: <ProtectedRoute permission="inventory:create"><Form /></ProtectedRoute> },
      { path: 'edit/:id', element: <ProtectedRoute permission="inventory:update"><Form /></ProtectedRoute> },
      { path: 'inventory/:id', element: <ProtectedRoute permission="inventory:read"><ItemDetail /></ProtectedRoute> },
      { path: 'transactions', element: <ProtectedRoute permission="transactions:read"><Transactions /></ProtectedRoute> },
      { path: 'transactions/log', element: <ProtectedRoute permission="transactions:read"><TransactionLog /></ProtectedRoute> },
      { path: 'transactions/:id', element: <ProtectedRoute permission="transactions:read"><TransactionDetail /></ProtectedRoute> },
      { path: 'transactions/add', element: <ProtectedRoute permission="transactions:create"><AddTransaction /></ProtectedRoute> },
      {
        path: 'settings',
        element: <ProtectedRoute permission="settings:read"><Settings /></ProtectedRoute>,
        children: [
          { index: true, element: <Navigate to="inventory" replace /> },
          { path: 'users', element: <ProtectedRoute permission="users:read"><UserManagement /></ProtectedRoute> },
          { path: 'inventory', element: <ProtectedRoute permission="settings:read"><InventorySettings /></ProtectedRoute> },
          { path: 'company', element: <ProtectedRoute permission="settings:read"><CompanyInfo /></ProtectedRoute> },
          { path: 'data', element: <ProtectedRoute permission="settings:read"><DataManagement /></ProtectedRoute> },
          { path: 'permissions', element: <ProtectedRoute permission="settings:update"><Permissions /></ProtectedRoute> },
          { path: 'invoice', element: <ProtectedRoute permission="settings:read"><InvoiceSettings /></ProtectedRoute> },
          { path: 'activity', element: <ProtectedRoute permission="audit:read"><ActivityLog /></ProtectedRoute> }
        ]
      },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
])

/* ===== Root App ===== */

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  )
}
