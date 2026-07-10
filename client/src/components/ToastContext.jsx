import { createContext, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react'

const ToastContext = createContext(null)

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, { variant = 'success', duration = 4000 } = {}) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

/* ---- Toast UI ---- */

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle
}

function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="toast-container">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => {
          const Icon = iconMap[t.variant] || CheckCircle
          return (
            <motion.div
              key={t.id}
              className={`toast toast-${t.variant}`}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            >
              <Icon size={18} className="toast-icon" />
              <span className="toast-message">{t.message}</span>
              <button className="toast-close" onClick={() => onRemove(t.id)} aria-label="Dismiss">
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
