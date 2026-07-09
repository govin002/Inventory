import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Save, ArrowLeft } from 'lucide-react'
import ImageUpload from '../components/ImageUpload'
import DatePicker from '../components/DatePicker'
import { get, post, put } from '../api'

const categories = [
  'Electronics', 'Furniture', 'Stationery', 'Clothing',
  'Food & Beverage', 'Tools', 'Other'
]

export default function Form() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [form, setForm] = useState({
    name: '', sku: '', category: '', quantity: 0, price: 0, unit: 'Piece', supplier: '', description: '', image: '', date: new Date().toISOString().split('T')[0]
  })
  const [units, setUnits] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(isEditing)

  useEffect(() => {
    get('/api/settings').then((s) => setUnits(s.units || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEditing) return
    get(`/api/inventory/${id}`)
      .then((item) => {
        setForm({
          name: item.name,
          sku: item.sku,
          category: item.category,
          quantity: item.quantity,
          price: Number(item.price).toFixed(2),
          unit: item.unit || 'Piece',
          supplier: item.supplier || '',
          description: item.description || '',
          image: item.image || '',
          date: item.date ? item.date.split('T')[0] : ''
        })
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, isEditing])

  function handleChange(e) {
    const { name, value } = e.target
    // Description: only allow alphanumeric, spaces, and basic punctuation
    if (name === 'description') {
      const sanitized = value.replace(/[^a-zA-Z0-9\s.,!?;:'"()@#\-]/g, '')
      if (sanitized.length <= 1024) {
        setForm((prev) => ({ ...prev, description: sanitized }))
      }
      return
    }
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function getCharCount() {
    return form.description.length
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // Validate description alphanumeric
    const alphanumericRegex = /^[a-zA-Z0-9\s.,!?;:'"()@#\-]*$/
    if (form.description && !alphanumericRegex.test(form.description)) {
      setError('Description can only contain letters, numbers, and basic punctuation')
      return
    }

    const payload = {
      ...form,
      quantity: Number(form.quantity),
      price: Number(form.price)
    }

    try {
      if (isEditing) {
        await put(`/api/inventory/${id}`, payload)
      } else {
        await post('/api/inventory', payload)
      }
      navigate('/inventory')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return <div className="empty-state">Loading item...</div>
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: '1rem' }}>{isEditing ? 'Edit Item' : 'Add New Item'}</h1>
          <p style={{ fontSize: '0.5rem' }}>{isEditing ? 'Update inventory item details' : 'Add a new item to your inventory'}</p>
        </div>
        <motion.button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/inventory')}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          style={{ padding: '5px 10px', fontSize: '0.75rem', minHeight: 28 }}
        >
          <ArrowLeft size={14} />
          Back
        </motion.button>
      </div>

      <motion.div
        className="card form-card form-compact"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Product Image</label>
              <ImageUpload
                value={form.image}
                onChange={(url) => setForm((prev) => ({ ...prev, image: url }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="name">Item Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="e.g. Wireless Mouse"
              />
            </div>

            <div className="form-group">
              <label htmlFor="sku">SKU *</label>
              <input
                type="text"
                id="sku"
                name="sku"
                value={form.sku}
                onChange={handleChange}
                required
                placeholder="e.g. WM-001"
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">Category *</label>
              <select
                id="category"
                name="category"
                value={form.category}
                onChange={handleChange}
                required
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="quantity">Quantity *</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number"
                  id="quantity"
                  name="quantity"
                  min="0"
                  value={form.quantity}
                  onChange={handleChange}
                  required
                  style={{ flex: 1 }}
                />
                <select
                  id="unit"
                  name="unit"
                  value={form.unit}
                  onChange={handleChange}
                  style={{ width: 120, minHeight: 44, padding: '5px 8px', fontSize: '0.78rem' }}
                >
                  {units.length === 0 && <option value="Piece">Piece</option>}
                  {units.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="price">Unit Price ($) *</label>
              <input
                type="number"
                id="price"
                name="price"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="supplier">Supplier</label>
              <input
                type="text"
                id="supplier"
                name="supplier"
                value={form.supplier}
                onChange={handleChange}
                required
                placeholder="e.g. Logitech"
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <DatePicker
                label="Date"
                value={form.date}
                onChange={(v) => setForm((prev) => ({ ...prev, date: v }))}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                rows="1"
                maxLength={1024}
                value={form.description}
                onChange={handleChange}
                placeholder="Optional details about the item (letters, numbers, and basic punctuation only)"
                style={{ resize: 'none' }}
              />
              <div className="char-counter">{getCharCount()}/1024</div>
            </div>
          </div>

          {error && (
            <motion.p className="error-msg" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {error}
            </motion.p>
          )}

          <div className="form-actions" style={{ marginTop: 4, paddingTop: 3, gap: 4, flexShrink: 0 }}>
            <motion.button type="submit" className="btn btn-primary" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ padding: '6px 12px', fontSize: '0.78rem', minHeight: 30 }}>
              <Save size={14} />
              {isEditing ? 'Update' : 'Save'}
            </motion.button>
            <motion.button type="button" className="btn btn-secondary" onClick={() => navigate('/inventory')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ padding: '6px 12px', fontSize: '0.78rem', minHeight: 30 }}>
              Cancel
            </motion.button>
          </div>
        </form>
      </motion.div>
    </>
  )
}
