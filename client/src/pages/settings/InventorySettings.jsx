import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Save, Plus, X } from 'lucide-react'
import { get, put } from '../../api'

export default function InventorySettings() {
  const [settings, setSettings] = useState({ lowStockThreshold: 20, categories: [], units: [] })
  const [newCategory, setNewCategory] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get('/api/settings').then(setSettings).finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    await put('/api/settings', settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function addCategory() {
    if (newCategory.trim() && !settings.categories.includes(newCategory.trim())) {
      setSettings({ ...settings, categories: [...settings.categories, newCategory.trim()] })
      setNewCategory('')
    }
  }

  function removeCategory(cat) {
    setSettings({ ...settings, categories: settings.categories.filter((c) => c !== cat) })
  }

  function addUnit() {
    if (newUnit.trim() && !settings.units.includes(newUnit.trim())) {
      setSettings({ ...settings, units: [...settings.units, newUnit.trim()] })
      setNewUnit('')
    }
  }

  function removeUnit(unit) {
    setSettings({ ...settings, units: settings.units.filter((u) => u !== unit) })
  }

  if (loading) return <div className="empty-state">Loading...</div>

  return (
    <>
      <div className="settings-section-header">
        <h2>Inventory Settings</h2>
      </div>

      <div className="settings-form-card">
        <h3>Low Stock Threshold</h3>
        <p className="settings-description">Items with quantity below this value will be marked as "Low Stock"</p>
        <div className="settings-inline">
          <div className="form-group" style={{ maxWidth: 200 }}>
            <label>Threshold</label>
            <input type="number" min="1" value={settings.lowStockThreshold} onChange={(e) => setSettings({ ...settings, lowStockThreshold: Number(e.target.value) })} />
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
                  if (e.target.checked) {
                    setSettings({ ...settings, qrFields: [...current, field] })
                  } else {
                    setSettings({ ...settings, qrFields: current.filter((f) => f !== field) })
                  }
                }}
              />
              {field === 'sku' ? 'SKU' : field.charAt(0).toUpperCase() + field.slice(1)}
            </label>
          ))}
        </div>
      </div>

      <div className="settings-actions">
        <motion.button className="btn btn-primary" onClick={handleSave} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Save size={18} /> {saved ? 'Saved!' : 'Save Changes'}
        </motion.button>
      </div>
    </>
  )
}
