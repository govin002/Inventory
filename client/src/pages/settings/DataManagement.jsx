import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Trash2, AlertTriangle } from 'lucide-react'
import { get, del } from '../../api'

export default function DataManagement() {
  const [exporting, setExporting] = useState(false)
  const [resetting, setResetting] = useState(false)

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

  async function resetDemoData() {
    if (!confirm('This will reset all inventory and transaction data to defaults. Are you sure?')) return
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
      alert('Data has been reset. Please refresh the page.')
    } catch (err) {
      alert('Reset failed: ' + err.message)
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
        <motion.button className="btn btn-danger" onClick={resetDemoData} disabled={resetting} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Trash2 size={14} /> {resetting ? 'Resetting...' : 'Reset Demo Data'}
        </motion.button>
      </div>
    </>
  )
}
