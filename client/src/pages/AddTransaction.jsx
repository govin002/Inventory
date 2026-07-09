import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Save, ArrowLeft, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { get, post } from '../api'
import DatePicker from '../components/DatePicker'

export default function AddTransaction() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [settings, setSettings] = useState({ transactionSources: [], transactionDestinations: [] })
  const [showCustomSource, setShowCustomSource] = useState(false)
  const [showCustomDest, setShowCustomDest] = useState(false)
  const [customSource, setCustomSource] = useState('')
  const [customDest, setCustomDest] = useState('')
  const [form, setForm] = useState({
    item_id: '', type: 'stock_in', quantity: 1, source: '', destination: '', date: '', notes: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    get('/api/inventory').then(setItems).catch(() => {})
    get('/api/settings').then(setSettings).catch(() => {})
  }, [])

  const selectedItem = items.find((i) => i.id === Number(form.item_id))

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!form.date) {
      setError('Date is required')
      setLoading(false)
      return
    }

    try {
      await post('/api/transactions', {
        ...form,
        quantity: Number(form.quantity),
        item_id: Number(form.item_id),
        date: form.date
      })
      navigate('/transactions')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: '1rem' }}>New Transaction</h1>
          <p style={{ fontSize: '0.5rem' }}>Record stock in or stock out</p>
        </div>
        <motion.button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/transactions')}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          style={{ padding: '5px 10px', fontSize: '0.75rem', minHeight: 28 }}
        >
          <ArrowLeft size={14} />
          Back
        </motion.button>
      </div>

      <motion.div
        className="card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ padding: '10px 14px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="form-grid" style={{ gap: 6 }}>
            <div className="form-group">
              <label htmlFor="type" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Transaction Type *</label>
              <div className="type-toggle" style={{ gap: 6 }}>
                <button
                  type="button"
                  className={`type-btn ${form.type === 'stock_in' ? 'active stock-in' : ''}`}
                  onClick={() => setForm((prev) => ({ ...prev, type: 'stock_in' }))}
                  style={{ padding: '8px 12px', minHeight: 36, fontSize: '0.8rem' }}
                >
                  <ArrowDownCircle size={16} /> Stock In
                </button>
                <button
                  type="button"
                  className={`type-btn ${form.type === 'stock_out' ? 'active stock-out' : ''}`}
                  onClick={() => setForm((prev) => ({ ...prev, type: 'stock_out' }))}
                  style={{ padding: '8px 12px', minHeight: 36, fontSize: '0.8rem' }}
                >
                  <ArrowUpCircle size={16} /> Stock Out
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="item_id" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Item *</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <select
                  id="item_id"
                  name="item_id"
                  value={form.item_id}
                  onChange={handleChange}
                  required
                  style={{ minHeight: 36, padding: '5px 8px', fontSize: '0.8rem', flex: 1 }}
                >
                  <option value="">Select item</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.sku}) — Qty: {item.quantity}
                    </option>
                  ))}
                </select>
                {selectedItem?.image && (
                  <div style={{ flexShrink: 0 }}>
                    <img
                      src={selectedItem.image}
                      alt={selectedItem.name}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 8,
                        objectFit: 'cover',
                        border: '1px solid var(--gray-200)'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="quantity" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Quantity *</label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                min="1"
                value={form.quantity}
                onChange={handleChange}
                required
                style={{ minHeight: 36, padding: '5px 8px', fontSize: '0.8rem' }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="source" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Source / From *</label>
              <select
                id="source"
                name="source"
                value={showCustomSource ? '__other__' : form.source}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '__other__') {
                    setShowCustomSource(true)
                    setCustomSource('')
                  } else {
                    setShowCustomSource(false)
                    setForm((prev) => ({ ...prev, source: val }))
                  }
                }}
                required
                style={{ minHeight: 36, padding: '5px 8px', fontSize: '0.8rem' }}
              >
                <option value="">Select source</option>
                {(settings.transactionSources || []).map((src) => (
                  <option key={src} value={src}>{src}</option>
                ))}
                <option value="__other__">Other (type below)</option>
              </select>
              {showCustomSource && (
                <input
                  type="text"
                  value={customSource}
                  onChange={(e) => {
                    setCustomSource(e.target.value)
                    setForm((prev) => ({ ...prev, source: e.target.value }))
                  }}
                  placeholder="Type custom source"
                  required
                  style={{ minHeight: 36, padding: '5px 8px', fontSize: '0.8rem', marginTop: 4 }}
                  autoFocus
                />
              )}
            </div>

            <div className="form-group">
              <label htmlFor="destination" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Destination / To *</label>
              <select
                id="destination"
                name="destination"
                value={showCustomDest ? '__other__' : form.destination}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '__other__') {
                    setShowCustomDest(true)
                    setCustomDest('')
                  } else {
                    setShowCustomDest(false)
                    setForm((prev) => ({ ...prev, destination: val }))
                  }
                }}
                required
                style={{ minHeight: 36, padding: '5px 8px', fontSize: '0.8rem' }}
              >
                <option value="">Select destination</option>
                {(settings.transactionDestinations || []).map((dest) => (
                  <option key={dest} value={dest}>{dest}</option>
                ))}
                <option value="__other__">Other (type below)</option>
              </select>
              {showCustomDest && (
                <input
                  type="text"
                  value={customDest}
                  onChange={(e) => {
                    setCustomDest(e.target.value)
                    setForm((prev) => ({ ...prev, destination: e.target.value }))
                  }}
                  placeholder="Type custom destination"
                  required
                  style={{ minHeight: 36, padding: '5px 8px', fontSize: '0.8rem', marginTop: 4 }}
                  autoFocus
                />
              )}
            </div>

            <div className="form-group">
              <DatePicker
                label="Date *"
                value={form.date}
                onChange={(v) => setForm((prev) => ({ ...prev, date: v }))}
                required
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="notes" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Notes</label>
              <textarea
                id="notes"
                name="notes"
                rows="2"
                maxLength={1024}
                value={form.notes}
                onChange={handleChange}
                placeholder="Optional notes about this transaction"
                style={{ minHeight: 36, padding: '5px 8px', fontSize: '0.8rem', resize: 'none' }}
              />
            </div>
          </div>

          {error && (
            <motion.p className="error-msg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 6, fontSize: '0.78rem' }}>
              {error}
            </motion.p>
          )}

          <div className="form-actions" style={{ marginTop: 6, paddingTop: 4, gap: 6, flexShrink: 0, borderTop: 'none' }}>
            <motion.button type="submit" className="btn btn-primary" disabled={loading} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ padding: '7px 14px', fontSize: '0.8rem', minHeight: 34 }}>
              <Save size={14} />
              {loading ? 'Saving...' : 'Record Transaction'}
            </motion.button>
            <motion.button type="button" className="btn btn-secondary" onClick={() => navigate('/transactions')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ padding: '7px 14px', fontSize: '0.8rem', minHeight: 34 }}>
              Cancel
            </motion.button>
          </div>
        </form>
      </motion.div>
    </>
  )
}
