import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
}

const modalVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 350 } },
  exit: { opacity: 0, scale: 0.92, y: 20, transition: { duration: 0.15 } }
}

export default function ConfirmModal({ open, title, message, confirmLabel, cancelLabel, variant, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.2 }}
          onClick={onCancel}
        >
          <motion.div
            className="modal-card"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button className="modal-close" onClick={onCancel} aria-label="Close">
              <X size={18} />
            </button>

            <div className={`modal-icon ${variant || 'danger'}`}>
              <AlertTriangle size={24} />
            </div>

            <h2 className="modal-title">{title || 'Confirm'}</h2>
            <p className="modal-message">{message || 'Are you sure?'}</p>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onCancel}>
                {cancelLabel || 'Cancel'}
              </button>
              <button className={`btn ${variant === 'warning' ? 'btn-warning' : 'btn-danger'}`} onClick={onConfirm}>
                {confirmLabel || 'Delete'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
