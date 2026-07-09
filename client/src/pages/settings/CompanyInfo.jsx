import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Save, Plus, X } from 'lucide-react'
import { get, put } from '../../api'

export default function CompanyInfo() {
  const [settings, setSettings] = useState({ companyName: '', companyAddress: '', warehouseLocations: [], transactionSources: [], transactionDestinations: [] })
  const [newLocation, setNewLocation] = useState('')
  const [newSource, setNewSource] = useState('')
  const [newDestination, setNewDestination] = useState('')
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

  function addLocation() {
    if (newLocation.trim() && !settings.warehouseLocations.includes(newLocation.trim())) {
      setSettings({ ...settings, warehouseLocations: [...settings.warehouseLocations, newLocation.trim()] })
      setNewLocation('')
    }
  }

  function removeLocation(loc) {
    setSettings({ ...settings, warehouseLocations: settings.warehouseLocations.filter((l) => l !== loc) })
  }

  function addSource() {
    if (newSource.trim() && !settings.transactionSources.includes(newSource.trim())) {
      setSettings({ ...settings, transactionSources: [...(settings.transactionSources || []), newSource.trim()] })
      setNewSource('')
    }
  }

  function removeSource(src) {
    setSettings({ ...settings, transactionSources: (settings.transactionSources || []).filter((s) => s !== src) })
  }

  function addDestination() {
    if (newDestination.trim() && !settings.transactionDestinations.includes(newDestination.trim())) {
      setSettings({ ...settings, transactionDestinations: [...(settings.transactionDestinations || []), newDestination.trim()] })
      setNewDestination('')
    }
  }

  function removeDestination(dest) {
    setSettings({ ...settings, transactionDestinations: (settings.transactionDestinations || []).filter((d) => d !== dest) })
  }

  if (loading) return <div className="empty-state">Loading...</div>

  return (
    <>
      <div className="settings-section-header">
        <h2>Company Information</h2>
      </div>

      <div className="settings-form-card">
        <h3>Company Details</h3>
        <div className="settings-form-grid">
          <div className="form-group full-width">
            <label>Company Name</label>
            <input type="text" value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} placeholder="Your company name" />
          </div>
          <div className="form-group full-width">
            <label>Address</label>
            <textarea rows="3" value={settings.companyAddress} onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })} placeholder="Company address" />
          </div>
        </div>
      </div>

      <div className="settings-form-card">
        <h3>Transaction Sources</h3>
        <p className="settings-description">Where inventory comes from (suppliers, warehouses, etc.)</p>
        <div className="category-list">
          {(settings.transactionSources || []).map((src) => (
            <div key={src} className="category-tag">
              {src}
              <button onClick={() => removeSource(src)}><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="category-add">
          <input type="text" value={newSource} onChange={(e) => setNewSource(e.target.value)} placeholder="New source" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSource())} />
          <motion.button className="btn btn-secondary btn-sm" onClick={addSource} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}><Plus size={16} /> Add</motion.button>
        </div>
      </div>

      <div className="settings-form-card">
        <h3>Transaction Destinations</h3>
        <p className="settings-description">Where inventory goes to (branches, customers, etc.)</p>
        <div className="category-list">
          {(settings.transactionDestinations || []).map((dest) => (
            <div key={dest} className="category-tag">
              {dest}
              <button onClick={() => removeDestination(dest)}><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="category-add">
          <input type="text" value={newDestination} onChange={(e) => setNewDestination(e.target.value)} placeholder="New destination" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDestination())} />
          <motion.button className="btn btn-secondary btn-sm" onClick={addDestination} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}><Plus size={16} /> Add</motion.button>
        </div>
      </div>

      <div className="settings-form-card">
        <h3>Warehouse Locations</h3>
        <p className="settings-description">Manage warehouse and storage locations</p>
        <div className="category-list">
          {settings.warehouseLocations.map((loc) => (
            <div key={loc} className="category-tag">
              {loc}
              <button onClick={() => removeLocation(loc)}><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="category-add">
          <input type="text" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="New location" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())} />
          <motion.button className="btn btn-secondary btn-sm" onClick={addLocation} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}><Plus size={16} /> Add</motion.button>
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
