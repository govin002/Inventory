import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Plus, X, CheckCircle, LoaderCircle, AlertCircle } from 'lucide-react'
import { get, put } from '../../api'
import { useToast } from '../../components/ToastContext'

const SAVE_DEBOUNCE_MS = 500

export default function InventorySettings() {
  const showToast = useToast()
  const [settings, setSettings] = useState({ lowStockThreshold: 20, categories: [], units: [] })
  const [newCategory, setNewCategory] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const saveTimer = useRef(null)

  useEffect(() => {
    get('/api/settings').then(setSettings).finally(() => setLoading(false))
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  /** Immediately save the given settings object to the server */
  async function saveNow(nextSettings) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    try {
      await put('/api/settings', nextSettings)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 1500)
    } catch (err) {
      setSaveStatus('error')
      showToast('Failed to save settings', { variant: 'error' })
      setTimeout(() => setSaveStatus((s) => s === 'error' ? 'idle' : s), 3000)
    }
  }

  /** Debounced save for text inputs */
  function saveDebounced(nextSettings) {
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await put('/api/settings', nextSettings)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 1500)
      } catch (err) {
        setSaveStatus('error')
        showToast('Failed to save settings', { variant: 'error' })
        setTimeout(() => setSaveStatus((s) => s === 'error' ? 'idle' : s), 3000)
      }
    }, SAVE_DEBOUNCE_MS)
  }

  function addCategory() {
    if (newCategory.trim() && !settings.categories.includes(newCategory.trim())) {
      const next = { ...settings, categories: [...settings.categories, newCategory.trim()] }
      setSettings(next)
      setNewCategory('')
      saveNow(next)
    }
  }

  function removeCategory(cat) {
    const next = { ...settings, categories: settings.categories.filter((c) => c !== cat) }
    setSettings(next)
    saveNow(next)
  }

  function addUnit() {
    if (newUnit.trim() && !settings.units.includes(newUnit.trim())) {
      const next = { ...settings, units: [...settings.units, newUnit.trim()] }
      setSettings(next)
      setNewUnit('')
      saveNow(next)
    }
  }

  function removeUnit(unit) {
    const next = { ...settings, units: settings.units.filter((u) => u !== unit) }
    setSettings(next)
    saveNow(next)
  }

  if (loading) return <div className="empty-state">Loading...</div>

  return (
    <>
      <div className="settings-section-header">
        <h2>Inventory Settings</h2>
        <SaveIndicator status={saveStatus} />
      </div>

      <div className="settings-form-card">
        <h3>Low Stock Threshold</h3>
        <p className="settings-description">Items with quantity below this value will be marked as "Low Stock"</p>
        <div className="settings-inline">
          <div className="form-group" style={{ maxWidth: 200 }}>
            <label>Threshold</label>
            <input
              type="number" min="1"
              value={settings.lowStockThreshold}
              onChange={(e) => {
                const next = { ...settings, lowStockThreshold: Number(e.target.value) }
                setSettings(next)
                saveDebounced(next)
              }}
            />
          </div>
        </div>
      </div>

      <div className="settings-form-card">
        <h3>Units</h3>
        <p className="settings-description">Manage measurement units (e.g. Kilogram, Liter, Piece)</p>
        <div className="category-list">
          {(settings.units || []).map((unit) => (
            <div key={unit} className="category-tag">
              {unit}
              <button onClick={() => removeUnit(unit)}><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="category-add">
          <input type="text" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="New unit" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUnit())} />
          <motion.button className="btn btn-secondary btn-sm" onClick={addUnit} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}><Plus size={16} /> Add</motion.button>
        </div>
      </div>

      <div className="settings-form-card">
        <h3>Categories</h3>
        <p className="settings-description">Manage inventory item categories</p>
        <div className="category-list">
          {settings.categories.map((cat) => (
            <div key={cat} className="category-tag">
              {cat}
              <button onClick={() => removeCategory(cat)}><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="category-add">
          <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())} />
          <motion.button className="btn btn-secondary btn-sm" onClick={addCategory} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}><Plus size={16} /> Add</motion.button>
        </div>
      </div>

      <div className="settings-form-card">
        <h3>QR Code Content</h3>
        <p className="settings-description">Select which item fields to include when generating QR codes. Scanning the QR code will return the selected data as JSON.</p>
        <div className="qr-fields-grid">
          {['name', 'sku', 'category', 'quantity', 'price', 'supplier', 'description'].map((field) => (
            <label key={field} className="checkbox-label">
              <input
                type="checkbox"
                checked={(settings.qrFields || ['name', 'sku', 'category']).includes(field)}
                onChange={(e) => {
                  const current = settings.qrFields || ['name', 'sku', 'category']
                  const next = e.target.checked
                    ? { ...settings, qrFields: [...current, field] }
                    : { ...settings, qrFields: current.filter((f) => f !== field) }
                  setSettings(next)
                  saveNow(next)
                }}
              />
              {field === 'sku' ? 'SKU' : field.charAt(0).toUpperCase() + field.slice(1)}
            </label>
          ))}
        </div>
      </div>
    </>
  )
}

/** Small inline status indicator: idle → nothing, saving → spinner, saved → check, error → warning */
function SaveIndicator({ status }) {
  if (status === 'idle') return null
  return (
    <motion.span
      className={`save-indicator save-${status}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 500 }}
    >
      {status === 'saving' && <><LoaderCircle size={14} className="spin" /> Saving…</>}
      {status === 'saved' && <><CheckCircle size={14} style={{ color: 'var(--green)' }} /> Saved</>}
      {status === 'error' && <><AlertCircle size={14} style={{ color: 'var(--red)' }} /> Save failed</>}
    </motion.span>
  )
}
