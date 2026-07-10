import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Save, ArrowLeft, Package, Hash, Tags, DollarSign, CalendarDays, AlignLeft, Ruler, Plus, X, AlertTriangle, Layers } from 'lucide-react'
import { get, post, put } from '../api'
import ImageUpload from '../components/ImageUpload'
import DatePicker from '../components/DatePicker'
import { useToast } from '../components/ToastContext'
import { formatCurrency } from '../utils'

const DESCRIPTION_REGEX = /^[\w\s\-.,/()@#!&%$+=:;'"*?]+$/

export default function Form() {
  const { id } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const isEditing = !!id

  const [form, setForm] = useState({
    name: '', sku: '', category: '', quantity: 1, unit: '', price: 0,
    description: '', image: '', date: '', track_expiry: false, base_unit: 'pcs',
    supplier: ''
  })
  const [packaging, setPackaging] = useState([])
  const [categories, setCategories] = useState([])
  const [units, setUnits] = useState([])
  const [currency, setCurrency] = useState('USD')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get('/api/settings').then((s) => {
      if (s?.categories) setCategories(s.categories)
      if (s?.units) setUnits(s.units)
      if (s?.currency) setCurrency(s.currency)
    }).catch(() => {})
    if (isEditing) {
      get(`/api/inventory/${id}`).then((item) => {
        if (item) {
          setForm({
            name: item.name || '',
            sku: item.sku || '',
            category: item.category || '',
            quantity: item.quantity ?? 1,
            unit: item.unit || '',
            price: item.price ?? 0,
            description: item.description || '',
            image: item.image || '',
            date: item.created_at?.split('T')[0] || '',
            track_expiry: !!item.track_expiry,
            base_unit: item.base_unit || 'pcs'
          })
          if (item.packaging) setPackaging(item.packaging)
        }
      }).catch(() => navigate('/inventory'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [id, isEditing, navigate])

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    if (type === 'checkbox') {
      setForm((prev) => ({ ...prev, [name]: checked }))
      return
    }
    if (name === 'description') {
      const sanitized = value.replace(/[^\w\s\-.,/()@#!&%$+=:;'"*?]/g, '')
      if (sanitized.length <= 1024) setForm((prev) => ({ ...prev, description: sanitized }))
    } else if (name === 'quantity') {
      const num = value === '' ? '' : Math.max(1, Math.round(Number(value)))
      setForm((prev) => ({ ...prev, [name]: num }))
    } else if (name === 'price') {
      const num = value === '' ? '' : Math.max(1, Math.round(Number(value) * 100) / 100)
      setForm((prev) => ({ ...prev, [name]: num }))
    } else {
      setForm((prev) => ({ ...prev, [name]: value }))
    }
  }

  function handlePackagingChange(index, field, value) {
    setPackaging((prev) => {
      const updated = [...prev]
      if (!updated[index]) {
        updated[index] = { level: index + 1, name: '', quantity: 1, unit_type: 'pcs' }
      }
      if (field === 'quantity') value = Math.max(1, Math.round(Number(value)))
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  function addPackagingLevel() {
    setPackaging((prev) => [
      ...prev,
      { level: prev.length + 1, name: '', quantity: 1, unit_type: 'pcs' }
    ])
  }

  function removePackagingLevel(index) {
    setPackaging((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      // Re-index levels
      return updated.map((p, i) => ({ ...p, level: i + 1 }))
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.name || !form.sku || !form.category) {
      setError('Name, SKU, and category are required')
      return
    }
    if (form.description && form.description.length > 1024) {
      setError('Description must be under 1024 characters')
      return
    }
    if (form.description && !DESCRIPTION_REGEX.test(form.description)) {
      setError('Description contains invalid characters')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        category: form.category,
        quantity: form.quantity,
        price: form.price,
        supplier: (form.supplier || '').trim(),
        description: (form.description || '').trim(),
        image: form.image || '',
        track_expiry: form.track_expiry,
        base_unit: form.base_unit || 'pcs'
      }

      let item
      if (isEditing) {
        item = await put(`/api/inventory/${id}`, payload)
      } else {
        item = await post('/api/inventory', payload)
      }

      // Save packaging levels
      if (packaging.length > 0 && item?.id) {
        await put(`/api/inventory/${item.id}/packaging`, {
          levels: packaging.map((p) => ({
            level: p.level,
            name: p.name,
            quantity: p.quantity,
            unit_type: p.unit_type
          }))
        })
      }

      showToast(`Item ${isEditing ? 'updated' : 'added'} successfully`, { variant: 'success' })
      navigate('/inventory')
    } catch (err) {
      showToast(`Failed to ${isEditing ? 'update' : 'add'} item`, { variant: 'error' })
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="empty-state">Loading...</div>

  const descLen = form.description.length
  const packagingNames = packaging.filter((p) => p.name).map((p) => p.name)
  const packagingInfo = packaging.map((p) => p.name ? `${p.name} (${p.quantity} ${p.unit_type})` : null).filter(Boolean)

  return (
    <>
      <div className="page-header" style={{ marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: '1rem' }}>{isEditing ? 'Edit Item' : 'Add Item'}</h1>
          <p style={{ fontSize: '0.5rem' }}>{isEditing ? `SKU: ${form.sku}` : 'Add a new product to inventory'}</p>
        </div>
        <motion.button className="btn btn-secondary btn-sm" onClick={() => navigate('/inventory')}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          style={{ padding: '5px 10px', fontSize: '0.75rem', minHeight: 28 }}>
          <ArrowLeft size={14} /> Back
        </motion.button>
      </div>

      <div className="form-builder" style={{ overflow: 'visible' }}>
        {/* ===== LEFT PANEL ===== */}
        <motion.div className="card form-builder-left"
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-100)' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: 8, display: 'block' }}>Product Image</label>
            <ImageUpload
              currentImage={form.image}
              onUpload={(url) => setForm((prev) => ({ ...prev, image: url }))}
            />
          </div>

          {/* Live Preview */}
          <div style={{ padding: '14px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: 10, display: 'block' }}>Preview</label>
            <div className="form-preview-card">
              <div className="form-preview-img">
                {form.image ? (
                  <img src={form.image} alt={form.name || 'Preview'} />
                ) : (
                  <div className="form-preview-placeholder"><Package size={32} /></div>
                )}
              </div>
              <div className="form-preview-info">
                {form.name ? (
                  <span className="form-preview-name">{form.name}</span>
                ) : (
                  <span className="form-preview-name" style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>Item Name</span>
                )}
                <span className="form-preview-sku">{form.sku || 'SKU-000'}</span>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {form.category && <span className="badge badge-category" style={{ fontSize: '0.62rem' }}>{form.category}</span>}
                  <span className="form-preview-price">{formatCurrency(form.price, currency)}/{form.base_unit}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                  Stock: <strong style={{ color: 'var(--gray-700)' }}>{form.quantity}</strong> {form.base_unit}
                </div>
                {form.track_expiry && (
                  <div style={{ marginTop: 4, fontSize: '0.72rem', color: 'var(--amber)' }}>
                    <AlertTriangle size={12} style={{ display: 'inline', marginRight: 2 }} /> Tracking expiry dates
                  </div>
                )}
                {packagingInfo.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)' }}>Packaging:</span>
                    {packagingInfo.map((info, i) => (
                      <span key={i} style={{ fontSize: '0.68rem', color: 'var(--gray-500)' }}>1 {info}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Ruler size={12} /> Stock value: <strong style={{ color: 'var(--gray-600)' }}>{formatCurrency(form.quantity * form.price, currency)}</strong>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ===== RIGHT PANEL ===== */}
        <motion.div className="card form-builder-right"
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}>
          <form onSubmit={handleSubmit} style={{ padding: '12px 14px' }}>
            <div className="form-builder-grid">
              {/* Name */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.72rem', marginBottom: 2 }}><Hash size={12} style={{ marginRight: 4 }} />Name *</label>
                <input type="text" name="name" value={form.name} onChange={handleChange} required placeholder="Product name"
                  style={{ minHeight: 36, fontSize: '0.82rem', padding: '6px 10px' }} />
              </div>

              {/* SKU */}
              <div className="form-group">
                <label style={{ fontSize: '0.72rem', marginBottom: 2 }}><Tags size={12} style={{ marginRight: 4 }} />SKU *</label>
                <input type="text" name="sku" value={form.sku} onChange={handleChange} required placeholder="e.g. PRD-001"
                  style={{ minHeight: 36, fontSize: '0.82rem', padding: '6px 10px' }} />
              </div>

              {/* Category */}
              <div className="form-group">
                <label style={{ fontSize: '0.72rem', marginBottom: 2 }}><Package size={12} style={{ marginRight: 4 }} />Category *</label>
                <select name="category" value={form.category} onChange={handleChange} required
                  style={{ minHeight: 36, fontSize: '0.82rem', padding: '6px 10px' }}>
                  <option value="">Select category</option>
                  {(categories || []).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="form-group">
                <label style={{ fontSize: '0.72rem', marginBottom: 2 }}>Quantity</label>
                <input type="number" name="quantity" min="1" value={form.quantity} onChange={handleChange}
                  style={{ minHeight: 36, fontSize: '0.82rem', padding: '6px 10px' }} />
              </div>

              {/* Base Unit */}
              <div className="form-group">
                <label style={{ fontSize: '0.72rem', marginBottom: 2 }}><Ruler size={12} style={{ marginRight: 4 }} />Base Unit</label>
                <select name="base_unit" value={form.base_unit} onChange={handleChange}
                  style={{ minHeight: 36, fontSize: '0.82rem', padding: '6px 10px' }}>
                  {units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              {/* Price */}
              <div className="form-group">
                <label style={{ fontSize: '0.72rem', marginBottom: 2 }}><DollarSign size={12} style={{ marginRight: 4 }} />Unit Price</label>
                <input type="number" name="price" min="1" step="0.01" value={form.price} onChange={handleChange} placeholder="0.00"
                  style={{ minHeight: 36, fontSize: '0.82rem', padding: '6px 10px' }} />
              </div>

              {/* Date */}
              <div className="form-group">
                <label style={{ fontSize: '0.72rem', marginBottom: 2 }}><CalendarDays size={12} style={{ marginRight: 4 }} />Date</label>
                <DatePicker value={form.date} onChange={(v) => setForm((p) => ({ ...p, date: v }))} />
              </div>

              {/* Track Expiry Toggle */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="checkbox-label" style={{ width: 'fit-content', marginTop: 4 }}>
                  <input type="checkbox" name="track_expiry" checked={form.track_expiry} onChange={handleChange} />
                  <AlertTriangle size={14} /> Track batch &amp; expiry dates
                </label>
                {form.track_expiry && (
                  <p style={{ fontSize: '0.68rem', color: 'var(--amber)', marginTop: 4 }}>
                    Stock quantity will be computed from batch totals. Use batch tracking for food, medicine, or any expiry-sensitive items.
                  </p>
                )}
              </div>

              {/* Packaging Levels */}
              <div className="form-group" style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--gray-100)', paddingTop: 12, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Layers size={14} />
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-700)' }}>
                    Packaging Levels
                  </label>
                  {packaging.length === 0 && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)' }}>(e.g., Box → Carton → Unit)</span>
                  )}
                </div>

                {packaging.length === 0 ? (
                  <motion.button type="button" className="btn btn-secondary btn-sm" onClick={addPackagingLevel}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    style={{ fontSize: '0.75rem', minHeight: 32, padding: '4px 10px' }}>
                    <Plus size={12} /> Add Packaging Level
                  </motion.button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 60px 80px 28px', gap: 4, alignItems: 'center', fontSize: '0.65rem', color: 'var(--gray-400)', padding: '0 4px' }}>
                      <span>#</span>
                      <span>Name</span>
                      <span style={{ textAlign: 'center' }}>Qty</span>
                      <span>Unit</span>
                      <span></span>
                    </div>
                    {packaging.map((p, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 60px 80px 28px', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)', textAlign: 'center' }}>{i + 1}</span>
                        <input type="text" value={p.name} onChange={(e) => handlePackagingChange(i, 'name', e.target.value)}
                          placeholder="e.g. Box" style={{ minHeight: 28, fontSize: '0.75rem', padding: '2px 6px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }} />
                        <input type="number" min="1" value={p.quantity} onChange={(e) => handlePackagingChange(i, 'quantity', e.target.value)}
                          style={{ minHeight: 28, fontSize: '0.75rem', padding: '2px 6px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', textAlign: 'center', width: '100%' }} />
                        <input type="text" value={p.unit_type} onChange={(e) => handlePackagingChange(i, 'unit_type', e.target.value)}
                          placeholder="e.g. carton" style={{ minHeight: 28, fontSize: '0.75rem', padding: '2px 6px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', width: '100%' }} />
                        <button type="button" className="icon-btn delete" onClick={() => removePackagingLevel(i)}
                          style={{ width: 24, height: 24, padding: 0 }}>
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    <motion.button type="button" className="btn btn-secondary btn-sm" onClick={addPackagingLevel}
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      style={{ fontSize: '0.72rem', minHeight: 28, padding: '2px 8px', width: 'fit-content' }}>
                      <Plus size={10} /> Add Another Level
                    </motion.button>
                    <p style={{ fontSize: '0.65rem', color: 'var(--gray-400)', marginTop: 2 }}>
                      Base unit is <strong>{form.base_unit}</strong>. Packaging goes from largest (level 1) to smallest (last level = base unit).
                    </p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                <label style={{ fontSize: '0.72rem', marginBottom: 2 }}>
                  <AlignLeft size={12} style={{ marginRight: 4 }} />Description
                  <span className="char-counter" style={{ float: 'right' }}>{descLen}/1024</span>
                </label>
                <textarea name="description" rows="3" value={form.description} onChange={handleChange}
                  placeholder="Product description (alphanumeric and basic punctuation only)"
                  style={{ minHeight: 72, fontSize: '0.82rem', padding: '6px 10px', resize: 'vertical' }} />
              </div>
            </div>

            {error && (
              <motion.p className="error-msg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: '0.78rem', marginTop: 8 }}>
                {error}
              </motion.p>
            )}

            <div className="form-actions" style={{ marginTop: 10, paddingTop: 8, gap: 8 }}>
              <motion.button type="submit" className="btn btn-primary" disabled={saving}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                style={{ padding: '7px 14px', fontSize: '0.8rem', minHeight: 34 }}>
                <Save size={14} /> {saving ? 'Saving...' : isEditing ? 'Update Item' : 'Add Item'}
              </motion.button>
              <motion.button type="button" className="btn btn-secondary" onClick={() => navigate('/inventory')}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                style={{ padding: '7px 14px', fontSize: '0.8rem', minHeight: 34 }}>Cancel</motion.button>
            </div>
          </form>
        </motion.div>
      </div>
    </>
  )
}
