import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Trash2, AlertTriangle } from 'lucide-react'
import { get, del } from '../../api'
import ConfirmModal from '../../components/ConfirmModal'
import { useToast } from '../../components/ToastContext'

export default function DataManagement() {
  const showToast = useToast()
  const [exporting, setExporting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)

  async function exportCSV() {
    setExporting(true)
    try {
      const res = await fetch('/api/export/inventory', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'inventory-export.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  async function handleReset() {
    setShowResetModal(false)
    setResetting(true)
    try {
      const items = await get('/api/inventory')
      for (const item of items) {
        await del(`/api/inventory/${item.id}`)
      }
      const txns = await get('/api/transactions')
      for (const txn of txns) {
        await del(`/api/transactions/${txn.id}`)
      }
      showToast('Data has been reset successfully', { variant: 'success', duration: 6000 })
    } catch (err) {
      showToast('Reset failed: ' + err.message, { variant: 'error' })
    } finally {
      setResetting(false)
    }
  }

  return (
    <>
      <div className="settings-section-header">
        <h2>Data Management</h2>
      </div>

      <div className="settings-form-card">
        <h3>Export Data</h3>
        <p className="settings-description">Download your inventory data as a CSV file</p>
        <motion.button className="btn btn-primary" onClick={exportCSV} disabled={exporting} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Download size={18} /> {exporting ? 'Exporting...' : 'Export Inventory CSV'}
        </motion.button>
      </div>

      <div className="settings-form-card danger-zone">
        <h3><AlertTriangle size={18} /> Danger Zone</h3>
        <p className="settings-description">Irreversible actions. Proceed with caution.</p>
        <motion.button className="btn btn-danger" onClick={() => setShowResetModal(true)} disabled={resetting} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Trash2 size={14} /> {resetting ? 'Resetting...' : 'Reset Demo Data'}
        </motion.button>
      </div>

      <ConfirmModal
        open={showResetModal}
        title="Reset Demo Data"
        message="This will permanently delete all inventory items and transactions. This action cannot be undone."
        confirmLabel="Reset Everything"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={handleReset}
        onCancel={() => setShowResetModal(false)}
      />
    </>
  )
}
