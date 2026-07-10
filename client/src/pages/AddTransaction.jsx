import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Save, ArrowLeft, ArrowDownCircle, ArrowUpCircle, Plus, X, Search, ShoppingCart, Package, Image as ImageIcon, AlertTriangle, Layers, Trash2 } from 'lucide-react'
import { get, post } from '../api'
import DatePicker from '../components/DatePicker'
import { useToast } from '../components/ToastContext'
import { formatCurrency } from '../utils'

export default function AddTransaction() {
  const navigate = useNavigate()
  const showToast = useToast()
  const [items, setItems] = useState([])
  const [customers, setCustomers] = useState([])
  const [settings, setSettings] = useState({ transactionSources: [], transactionDestinations: [], currency: 'USD' })
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    type: 'stock_in', date: '', notes: '', source: '', destination: '', taxRate: 0
  })
  const [lineItems, setLineItems] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      get('/api/inventory'),
      get('/api/settings'),
      get('/api/customers?type=customer').catch(() => [])
    ]).then(([inv, s, c]) => {
      setItems(inv)
      setSettings(s || { transactionSources: [], transactionDestinations: [], currency: 'USD' })
      setCustomers(c || [])
    }).catch(() => {})
  }, [])

  // Load batches when a track_expiry item is added
  const [batchCache, setBatchCache] = useState({})

  useEffect(() => {
    const trackExpiryItems = lineItems.filter((li) => li.track_expiry && !batchCache[li.item_id])
    if (trackExpiryItems.length > 0) {
      Promise.all(
        trackExpiryItems.map((li) =>
          get(`/api/inventory/${li.item_id}/batches`).then((batches) => ({
            itemId: li.item_id,
            batches
          })).catch(() => null)
        )
      ).then((results) => {
        const newCache = { ...batchCache }
        for (const r of results) {
          if (r) newCache[r.itemId] = r.batches
        }
        setBatchCache(newCache)
      })
    }
  }, [lineItems])

  const filteredItems = items.filter((item) =>
    !search || item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.sku.toLowerCase().includes(search.toLowerCase())
  )

  const selectedIds = new Set(lineItems.map((li) => li.item_id))

  function addItem(item) {
    const hasPackaging = item.packaging && item.packaging.length > 0
    const defaultUnit = hasPackaging ? item.packaging[item.packaging.length - 1]?.unit_type || item.base_unit || 'pcs' : item.base_unit || 'pcs'
    setLineItems((prev) => [...prev, {
      item_id: item.id,
      item_name: item.name,
      item_sku: item.sku,
      item_image: item.image || '',
      quantity: 1,
      unit_price: item.price,
      track_expiry: !!item.track_expiry,
      batch_id: null,
      batch_number: '',
      manufacture_date: '',
      expiry_date: '',
      base_unit: defaultUnit,
      packaging: item.packaging || [],
      selected_unit_level: hasPackaging ? item.packaging.length : 0,
      converted_quantity: 1
    }])
  }

  function removeLine(index) {
    setLineItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateLine(index, field, value) {
    setLineItems((prev) => {
      const updated = [...prev]
      if (field === 'quantity') value = Math.max(1, Math.round(Number(value)))
      if (field === 'unit_price') value = Math.max(0, Math.round(Number(value) * 100) / 100)
      if (field === 'selected_unit_level') {
        const li = updated[index]
        const level = Number(value)
        const pkg = li.packaging
        let multiplier = 1
        if (pkg && pkg.length > 0 && level < pkg.length) {
          // Calculate how many base units this level represents
          for (let i = level; i < pkg.length; i++) {
            multiplier *= pkg[i].quantity
          }
        }
        updated[index] = {
          ...li,
          selected_unit_level: level,
          converted_quantity: multiplier,
          base_unit: level < pkg.length ? pkg[level]?.unit_type || li.base_unit : pkg[pkg.length - 1]?.unit_type || li.base_unit
        }
        return updated
      }
      if (field === 'batch_id') {
        // Auto-fill batch info when a batch is selected
        const batchId = Number(value)
        const batches = batchCache[updated[index].item_id] || []
        const batch = batches.find((b) => b.id === batchId)
        if (batch) {
          updated[index] = {
            ...updated[index],
            batch_id: batchId,
            batch_number: batch.batch_number,
            expiry_date: batch.expiry_date || '',
            manufacture_date: batch.manufacture_date || ''
          }
          return updated
        }
      }
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const isBilled = form.type === 'stock_out' && customerName.trim()
  const subtotal = isBilled ? lineItems.reduce((sum, li) => sum + (li.quantity || 0) * (li.unit_price || 0), 0) : 0
  const tax = subtotal * (Number(form.taxRate) / 100)
  const total = subtotal + tax

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.date) { setError('Date is required'); return }
    if (!form.source) { setError('Source/From is required'); return }
    if (!form.destination) { setError('Destination/To is required'); return }
    if (lineItems.length === 0) { setError('At least one item is required'); return }

    for (const li of lineItems) {
      if (li.quantity < 1) { setError('Quantity must be at least 1'); return }
    }

    setLoading(true)
    try {
      const payload = {
        type: form.type,
        customer_name: isBilled ? customerName : '',
        date: form.date,
        notes: form.notes || '',
        tax_rate: isBilled ? Number(form.taxRate) : 0,
        source: form.source,
        destination: form.destination,
        items: lineItems.map((li) => {
          const baseQty = li.selected_unit_level > 0 ? li.quantity * li.converted_quantity : li.quantity
          const itemPayload = {
            item_id: Number(li.item_id),
            quantity: baseQty,
            unit_price: isBilled ? Number(li.unit_price) : 0
          }
          if (li.track_expiry) {
            itemPayload.batch_id = li.batch_id || null
            itemPayload.batch_number = li.batch_number || ''
            itemPayload.expiry_date = li.expiry_date || ''
            itemPayload.manufacture_date = li.manufacture_date || ''
          }
          return itemPayload
        })
      }

      const result = await post('/api/transactions', payload)

      if (result?.invoice_number) {
        showToast(`Transaction recorded — Invoice ${result.invoice_number} generated`, { variant: 'success', duration: 5000 })
      } else {
        showToast(result.itemCount > 1
          ? `Transaction recorded — ${result.itemCount} items`
          : 'Transaction recorded successfully', { variant: 'success' })
      }
      navigate('/transactions')
    } catch (err) {
      showToast('Failed to record transaction', { variant: 'error' })
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getAvailableBatches = (itemId) => {
    return batchCache[itemId] || []
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: '0.92rem' }}>New Transaction</h1>
          <p style={{ fontSize: '0.68rem' }}>Record stock movement with batch &amp; source tracking</p>
        </div>
        <motion.button className="btn btn-secondary btn-sm" onClick={() => navigate('/transactions')}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          style={{ padding: '4px 8px', fontSize: '0.7rem', minHeight: 24 }}>
          <ArrowLeft size={12} /> Back
        </motion.button>
      </div>

      <div className="invoice-builder">
        {/* ===== LEFT PANEL: Item Browser ===== */}
        <motion.div className="card inv-builder-panel inv-builder-left"
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
          <div className="inv-builder-search">
            <Search size={14} />
            <input type="text" placeholder="Search items by name or SKU..." value={search}
              onChange={(e) => setSearch(e.target.value)} autoFocus />
          </div>

          <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderBottom: '1px solid var(--gray-100)', flexShrink: 0 }}>
            <div className="type-toggle" style={{ flex: 1, gap: 3 }}>
              <button type="button" className={`type-btn ${form.type === 'stock_in' ? 'active stock-in' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, type: 'stock_in' }))}
                style={{ padding: '4px 6px', minHeight: 26, fontSize: '0.65rem' }}>
                <ArrowDownCircle size={12} /> In
              </button>
              <button type="button" className={`type-btn ${form.type === 'stock_out' ? 'active stock-out' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, type: 'stock_out' }))}
                style={{ padding: '4px 6px', minHeight: 26, fontSize: '0.65rem' }}>
                <ArrowUpCircle size={12} /> Out
              </button>
            </div>
          </div>

          <div className="inv-browser-grid" style={{ flex: 1, overflowY: 'auto' }}>
            {filteredItems.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '24px 12px' }}>
                <Package size={24} className="icon" />
                <p style={{ fontSize: '0.75rem' }}>{search ? 'No items match your search.' : 'No items in inventory.'}</p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isAdded = selectedIds.has(item.id)
                return (
                  <motion.div key={item.id} className={`inv-browser-card ${isAdded ? 'added' : ''}`}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} layout>
                    <div className="inv-browser-card-img">
                      {item.image ? (
                        <img src={item.image} alt={item.name} />
                      ) : (
                        <div className="inv-browser-card-placeholder"><ImageIcon size={14} /></div>
                      )}
                    </div>
                    <div className="inv-browser-card-info">
                      <span className="inv-browser-card-name">{item.name}</span>
                      <span className="inv-browser-card-sku">{item.sku}</span>
                      <div className="inv-browser-card-meta" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                        <span className="inv-browser-card-price">{formatCurrency(item.price, settings.currency)}/{item.base_unit}</span>
                        <span className="inv-browser-card-qty">Stock: {item.quantity} {item.base_unit}</span>
                        {item.track_expiry && (
                          <span className="inv-browser-card-qty" style={{ color: 'var(--amber)' }}>
                            <AlertTriangle size={10} style={{ display: 'inline' }} /> Batch tracked
                          </span>
                        )}
                      </div>
                    </div>
                    <button type="button" className={`inv-browser-card-add ${isAdded ? 'added' : ''}`}
                      onClick={() => !isAdded && addItem(item)} disabled={isAdded}>
                      <span className="btn-icon">{isAdded ? <ShoppingCart size={12} /> : <Plus size={12} />}</span>
                      <span className="btn-text" style={{ fontSize: '0.65rem' }}>{isAdded ? 'Added' : 'Add'}</span>
                    </button>
                  </motion.div>
                )
              })
            )}
          </div>
        </motion.div>

        {/* ===== RIGHT PANEL: Transaction Form ===== */}
        <motion.div className="card inv-builder-panel inv-builder-right"
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}>
          <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 10px' }}>
            {/* Header fields */}
            <div className="inv-builder-form-header">
              {/* Customer - only for stock_out billed */}
              {form.type === 'stock_out' && (
                <div className="form-group" style={{ flex: 2 }}>
                  <label style={{ fontSize: '0.65rem' }}>Customer</label>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {showNewCustomer ? (
                      <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                        <input type="text" value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          placeholder="Type new customer name..." autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const trimmed = newCustomerName.trim()
                              if (trimmed) {
                                post('/api/customers', { name: trimmed, type: 'customer' }).then((created) => {
                                  setCustomers([...customers, created])
                                  setCustomerName(created.name)
                                  setShowNewCustomer(false)
                                  setNewCustomerName('')
                                }).catch(() => {})
                              }
                            }
                          }}
                          style={{ flex: 1, minHeight: 26, fontSize: '0.72rem', padding: '3px 6px' }}
                        />
                        <motion.button type="button" className="btn btn-primary btn-sm"
                          onClick={async () => {
                            const trimmed = newCustomerName.trim()
                            if (trimmed) {
                              const created = await post('/api/customers', { name: trimmed, type: 'customer' })
                              setCustomers([...customers, created])
                              setCustomerName(created.name)
                              setShowNewCustomer(false)
                              setNewCustomerName('')
                            }
                          }}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                          style={{ padding: '3px 6px', fontSize: '0.68rem', minHeight: 26 }}>
                          <Save size={10} /> Save
                        </motion.button>
                        <motion.button type="button" className="btn btn-secondary btn-sm"
                          onClick={() => { setShowNewCustomer(false); setNewCustomerName('') }}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                          style={{ padding: '3px 6px', fontSize: '0.68rem', minHeight: 26 }}>
                          <X size={10} />
                        </motion.button>
                      </div>
                    ) : (
                      <>
                        <select value={customerName}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === '__new__') { setShowNewCustomer(true) }
                            else { setCustomerName(val === '' ? '' : customers.find((c) => c.name === val)?.name || val) }
                          }}
                          style={{ flex: 1, minHeight: 28, fontSize: '0.72rem', padding: '3px 6px' }}>
                          <option value="">No customer (internal movement)</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                          <option value="__new__">+ Add new customer...</option>
                        </select>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Source - always shown */}
              <div className="form-group" style={{ flex: 1 }}>
                <label style={{ fontSize: '0.65rem' }}>Source / From *</label>
                <select value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} required
                  style={{ minHeight: 28, fontSize: '0.72rem', padding: '3px 6px' }}>
                  <option value="">Select source</option>
                  {(settings.transactionSources || []).map((src) => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              </div>

              {/* Destination - always shown */}
              <div className="form-group" style={{ flex: 1 }}>
                <label style={{ fontSize: '0.65rem' }}>Destination / To *</label>
                <select value={form.destination} onChange={(e) => setForm((p) => ({ ...p, destination: e.target.value }))} required
                  style={{ minHeight: 28, fontSize: '0.72rem', padding: '3px 6px' }}>
                  <option value="">Select destination</option>
                  {(settings.transactionDestinations || []).map((dest) => (
                    <option key={dest} value={dest}>{dest}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="form-group" style={{ flex: 1.2 }}>
                <DatePicker label="Date *" value={form.date}
                  onChange={(v) => setForm((prev) => ({ ...prev, date: v }))} required />
              </div>

              {/* Tax */}
              {isBilled && (
                <div className="form-group" style={{ flex: 0.5 }}>
                  <label style={{ fontSize: '0.65rem' }}>Tax %</label>
                  <input type="number" name="taxRate" min="0" step="0.01" value={form.taxRate}
                    onChange={(e) => setForm((p) => ({ ...p, taxRate: e.target.value }))} placeholder="e.g. 13"
                    style={{ minHeight: 28, fontSize: '0.72rem', padding: '3px 6px' }} />
                </div>
              )}
            </div>

            {/* Selected Items with Batch Support */}
            <div className="inv-builder-items" style={{ flex: 1 }}>
              <div className="inv-builder-items-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Items ({lineItems.length})</span>
                {lineItems.some((li) => li.track_expiry) && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--amber)' }}>
                    <AlertTriangle size={10} style={{ display: 'inline', marginRight: 2 }} />Batch info required
                  </span>
                )}
              </div>

              {lineItems.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 12px', flex: 1 }}>
                  <ShoppingCart size={22} className="icon" />
                  <p style={{ fontSize: '0.75rem' }}>No items selected.</p>
                  <p style={{ fontSize: '0.65rem', color: 'var(--gray-400)' }}>Click items from the left panel to add them.</p>
                </div>
              ) : (
                <div className="inv-builder-items-scroll">
                  <table className="inv-builder-items-table">
                    <thead>
                      <tr>
                        <th style={{ width: '28%' }}>Item</th>
                        <th style={{ width: 50 }}>Qty</th>
                        <th style={{ width: 55 }}>Unit</th>
                        {isBilled && <th style={{ width: 60 }}>Price</th>}
                        {isBilled && <th style={{ width: 60, textAlign: 'right' }}>Total</th>}
                        {lineItems.some((li) => li.track_expiry) && <th style={{ width: 90 }}>Batch</th>}
                        <th style={{ width: 28 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((li, index) => {
                        const batches = getAvailableBatches(li.item_id)
                        const hasPackaging = li.packaging && li.packaging.length > 0
                        const displayUnit = li.base_unit || 'pcs'
                        return (
                          <tr key={`${li.item_id}-${index}`}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {li.item_image ? (
                                  <img src={li.item_image} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ImageIcon size={11} style={{ color: 'var(--gray-400)' }} />
                                  </div>
                                )}
                                <span style={{ fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {li.item_name}
                                </span>
                              </div>
                            </td>
                            <td>
                              <input type="number" min="1" value={li.quantity}
                                onChange={(e) => updateLine(index, 'quantity', e.target.value === '' ? 1 : Number(e.target.value))}
                                onBlur={(e) => { if (Number(e.target.value) < 1) updateLine(index, 'quantity', 1) }}
                                style={{ width: '100%', minHeight: 28, padding: '2px 4px', fontSize: '0.75rem', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }} />
                            </td>
                            <td>
                              {hasPackaging ? (
                                <select value={li.selected_unit_level || li.packaging.length}
                                  onChange={(e) => updateLine(index, 'selected_unit_level', e.target.value === '' ? li.packaging.length : Number(e.target.value))}
                                  style={{ width: '100%', minHeight: 28, fontSize: '0.68rem', padding: '2px 4px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
                                  {li.packaging.map((pkg, pi) => (
                                    <option key={pi} value={pi}>
                                      {pkg.name || pkg.unit_type}
                                    </option>
                                  ))}
                                  <option value={li.packaging.length}>
                                    {li.packaging[li.packaging.length - 1]?.unit_type || displayUnit}
                                  </option>
                                </select>
                              ) : (
                                <span style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }}>{displayUnit}</span>
                              )}
                            </td>
                            {isBilled && (
                              <td>
                                <input type="number" min="0" step="0.01" value={li.unit_price}
                                  onChange={(e) => updateLine(index, 'unit_price', e.target.value === '' ? 0 : Number(e.target.value))}
                                  onBlur={(e) => { if (Number(e.target.value) < 0) updateLine(index, 'unit_price', 0) }}
                                  style={{ width: '100%', minHeight: 28, padding: '2px 4px', fontSize: '0.75rem', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }} />
                              </td>
                            )}
                            {isBilled && (
                              <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.75rem' }}>
                                {formatCurrency((li.quantity || 0) * (li.unit_price || 0), settings.currency)}
                              </td>
                            )}
                            {li.track_expiry && (
                              <td>
                                {form.type === 'stock_in' ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <input type="text" value={li.batch_number}
                                      onChange={(e) => updateLine(index, 'batch_number', e.target.value)}
                                      placeholder="Batch #" style={{ minHeight: 22, fontSize: '0.65rem', padding: '1px 4px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', width: '100%' }} />
                                    <input type="date" value={li.expiry_date}
                                      onChange={(e) => updateLine(index, 'expiry_date', e.target.value)}
                                      style={{ minHeight: 22, fontSize: '0.65rem', padding: '1px 4px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', width: '100%' }} />
                                  </div>
                                ) : (
                                  <select value={li.batch_id || ''}
                                    onChange={(e) => updateLine(index, 'batch_id', e.target.value)}
                                    style={{ width: '100%', minHeight: 28, fontSize: '0.68rem', padding: '2px 4px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
                                    <option value="">Auto (FEFO)</option>
                                    {batches.filter((b) => b.quantity > 0).map((b) => (
                                      <option key={b.id} value={b.id}>
                                        {b.batch_number} ({b.quantity} left, exp: {b.expiry_date || 'N/A'})
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>
                            )}
                            <td style={{ textAlign: 'center' }}>
                              <button type="button" className="icon-btn delete" onClick={() => removeLine(index)}
                                style={{ width: 24, height: 24, padding: 0 }}>
                                <X size={10} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Totals */}
            {isBilled && lineItems.length > 0 && (
              <div className="inv-builder-totals">
                <div className="inv-total-row"><span>Subtotal</span><span>{formatCurrency(subtotal, settings.currency)}</span></div>
                <div className="inv-total-row"><span>Tax ({Number(form.taxRate)}%)</span><span>{formatCurrency(tax, settings.currency)}</span></div>
                <div className="inv-total-row inv-total-grand"><span>Total</span><span>{formatCurrency(total, settings.currency)}</span></div>
              </div>
            )}

            {/* Notes */}
            <div className="form-group" style={{ marginTop: 4, flexShrink: 0 }}>
              <label style={{ fontSize: '0.65rem' }}>Notes</label>
              <textarea name="notes" rows="1" maxLength={500} value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes"
                style={{ minHeight: 24, fontSize: '0.72rem', padding: '2px 6px', resize: 'none' }} />
            </div>

            {error && <motion.p className="error-msg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: '0.72rem', marginTop: 3 }}>{error}</motion.p>}

            {/* Actions */}
            <div className="form-actions" style={{ marginTop: 4, paddingTop: 4, flexShrink: 0 }}>
              <motion.button type="submit" className="btn btn-primary" disabled={loading}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                style={{ padding: '5px 12px', fontSize: '0.72rem', minHeight: 28 }}>
                <Save size={12} />
                {loading ? 'Saving...' : isBilled ? `Record & Generate Invoice (${formatCurrency(total, settings.currency)})` : `Record Transaction (${lineItems.length} item${lineItems.length !== 1 ? 's' : ''})`}
              </motion.button>
              <motion.button type="button" className="btn btn-secondary" onClick={() => navigate('/transactions')}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                style={{ padding: '5px 12px', fontSize: '0.72rem', minHeight: 28 }}>Cancel</motion.button>
            </div>
          </form>
        </motion.div>
      </div>
    </>
  )
}
