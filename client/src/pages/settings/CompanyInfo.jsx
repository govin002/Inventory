import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Save, Plus, X, Trash2, UserPlus, Receipt, ExternalLink, LoaderCircle, CheckCircle, AlertCircle, DollarSign } from 'lucide-react'
import { get, put, post, del } from '../../api'
import { useToast } from '../../components/ToastContext'
import ConfirmModal from '../../components/ConfirmModal'
import { Link } from 'react-router-dom'
import { CURRENCY_MAP, formatCurrency } from '../../utils'

const DEFAULTS = {
  companyName: '', companyAddress: '', companyPhone: '', companyEmail: '', currency: 'USD',
  warehouseLocations: [], transactionSources: [], transactionDestinations: []
}

export default function CompanyInfo() {
  const showToast = useToast()
  const [settings, setSettings] = useState(DEFAULTS)
  const [newLocation, setNewLocation] = useState('')
  const [newSource, setNewSource] = useState('')
  const [newDestination, setNewDestination] = useState('')

  // Customer/Supplier state
  const [customers, setCustomers] = useState([])
  const [contactFilter, setContactFilter] = useState('all')
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [customerForm, setCustomerForm] = useState({ name: '', email: '', phone: '', address: '', type: 'customer' })
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Transaction viewer state
  const [viewingCustomer, setViewingCustomer] = useState(null)
  const [customerTxns, setCustomerTxns] = useState([])
  const [loadingTxns, setLoadingTxns] = useState(false)

  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const saveTimer = useRef(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      get('/api/settings'),
      get('/api/customers').catch(() => [])
    ]).then(([s, c]) => {
      setSettings({ ...DEFAULTS, ...s })
      setCustomers(c || [])
    }).finally(() => setLoading(false))
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  /** Immediately save settings to the server */
  async function saveNow(nextSettings) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    try {
      await put('/api/settings', nextSettings)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 1500)
    } catch (err) {
      setSaveStatus('error')
      showToast('Failed to save company info', { variant: 'error' })
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
        showToast('Failed to save company info', { variant: 'error' })
        setTimeout(() => setSaveStatus((s) => s === 'error' ? 'idle' : s), 3000)
      }
    }, 500)
  }

  function addLocation() {
    if (newLocation.trim() && !settings.warehouseLocations.includes(newLocation.trim())) {
      const next = { ...settings, warehouseLocations: [...settings.warehouseLocations, newLocation.trim()] }
      setSettings(next)
      setNewLocation('')
      saveNow(next)
    }
  }
  function removeLocation(loc) {
    const next = { ...settings, warehouseLocations: settings.warehouseLocations.filter((l) => l !== loc) }
    setSettings(next)
    saveNow(next)
  }
  function addSource() {
    if (newSource.trim() && !settings.transactionSources.includes(newSource.trim())) {
      const next = { ...settings, transactionSources: [...(settings.transactionSources || []), newSource.trim()] }
      setSettings(next)
      setNewSource('')
      saveNow(next)
    }
  }
  function removeSource(src) {
    const next = { ...settings, transactionSources: (settings.transactionSources || []).filter((s) => s !== src) }
    setSettings(next)
    saveNow(next)
  }
  function addDestination() {
    if (newDestination.trim() && !settings.transactionDestinations.includes(newDestination.trim())) {
      const next = { ...settings, transactionDestinations: [...(settings.transactionDestinations || []), newDestination.trim()] }
      setSettings(next)
      setNewDestination('')
      saveNow(next)
    }
  }
  function removeDestination(dest) {
    const next = { ...settings, transactionDestinations: (settings.transactionDestinations || []).filter((d) => d !== dest) }
    setSettings(next)
    saveNow(next)
  }

  async function handleAddCustomer(e) {
    e.preventDefault()
    if (!customerForm.name.trim()) return
    try {
      const created = await post('/api/customers', customerForm)
      setCustomers([...customers, created])
      setCustomerForm({ name: '', email: '', phone: '', address: '', type: 'customer' })
      setShowCustomerForm(false)
      showToast('Customer added successfully', { variant: 'success' })
    } catch (err) {
      showToast('Failed to add customer', { variant: 'error' })
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await del(`/api/customers/${deleteTarget}`)
      setCustomers(customers.filter((c) => c.id !== deleteTarget))
      setDeleteTarget(null)
      showToast('Deleted successfully', { variant: 'success' })
    } catch (err) {
      showToast('Failed to delete', { variant: 'error' })
    }
  }

  async function viewTransactions(customer) {
    setViewingCustomer(customer)
    setLoadingTxns(true)
    setCustomerTxns([])
    try {
      const txns = await get(`/api/customers/${customer.id}/invoices`)
      setCustomerTxns(txns || [])
    } catch (err) {
      showToast('Failed to load transactions', { variant: 'error' })
    } finally {
      setLoadingTxns(false)
    }
  }

  if (loading) return <div className="empty-state">Loading...</div>

  return (
    <>
      <div className="settings-section-header">
        <h2>Company Information</h2>
        <SaveIndicator status={saveStatus} />
      </div>

      <div className="settings-form-card">
        <h3>Company Details</h3>
        <div className="settings-form-grid">
          <div className="form-group full-width">
            <label>Company Name</label>
            <input type="text" value={settings.companyName} onChange={(e) => { const next = { ...settings, companyName: e.target.value }; setSettings(next); saveDebounced(next); }} placeholder="Your company name" />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Currency</label>
            <select value={settings.currency || 'USD'}
              onChange={(e) => { const next = { ...settings, currency: e.target.value }; setSettings(next); saveNow(next); }}
              style={{ minHeight: 36, fontSize: '0.82rem', padding: '4px 8px' }}>
              {Object.entries(CURRENCY_MAP).map(([code, curr]) => (
                <option key={code} value={code}>{curr.symbol} — {curr.name} ({code})</option>
              ))}
            </select>
            <p style={{ fontSize: '0.68rem', color: 'var(--gray-400)', marginTop: 4 }}>
              Preview: {formatCurrency(1234.56, settings.currency || 'USD')}
            </p>
          </div>
          <div className="form-group full-width">
            <label>Address</label>
            <textarea rows="3" value={settings.companyAddress} onChange={(e) => { const next = { ...settings, companyAddress: e.target.value }; setSettings(next); saveDebounced(next); }} placeholder="Company address" />
          </div>
        </div>
      </div>

      <div className="settings-form-card">
        <h3>Transaction Sources</h3>
        <p className="settings-description">Where inventory comes from (suppliers, warehouses, etc.)</p>
        <div className="category-list">
          {(settings.transactionSources || []).map((src) => (
            <div key={src} className="category-tag">{src}<button onClick={() => removeSource(src)}><X size={14} /></button></div>
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
            <div key={dest} className="category-tag">{dest}<button onClick={() => removeDestination(dest)}><X size={14} /></button></div>
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
          {(settings.warehouseLocations || []).map((loc) => (
            <div key={loc} className="category-tag">{loc}<button onClick={() => removeLocation(loc)}><X size={14} /></button></div>
          ))}
        </div>
        <div className="category-add">
          <input type="text" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="New location" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())} />
          <motion.button className="btn btn-secondary btn-sm" onClick={addLocation} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}><Plus size={16} /> Add</motion.button>
        </div>
      </div>

      {/* Customers & Suppliers Section */}
      <div className="settings-section-header" style={{ marginTop: 24 }}>
        <h2>Customers & Suppliers</h2>
        <motion.button className="btn btn-primary btn-sm" onClick={() => setShowCustomerForm(!showCustomerForm)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <UserPlus size={16} /> {showCustomerForm ? 'Cancel' : 'Add New'}
        </motion.button>
      </div>

      {showCustomerForm && (
        <motion.div className="settings-form-card" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h3>Add New Contact</h3>
          <form onSubmit={handleAddCustomer}>
            <div className="settings-form-grid">
              <div className="form-group">
                <label>Name *</label>
                <input type="text" value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} required placeholder="Contact name" />
              </div>
              <div className="form-group">
                <label>Type *</label>
                <select value={customerForm.type} onChange={(e) => setCustomerForm({ ...customerForm, type: e.target.value })} required>
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} placeholder="email@example.com" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input type="text" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} placeholder="+1 234 567 890" />
              </div>
              <div className="form-group full-width">
                <label>Address</label>
                <input type="text" value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} placeholder="Address" />
              </div>
            </div>
            <div className="form-actions">
              <motion.button type="submit" className="btn btn-primary btn-sm" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}><Save size={14} /> Save</motion.button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {[
          { key: 'all', label: `All (${customers.length})` },
          { key: 'customer', label: `Customers (${customers.filter(c => c.type === 'customer' || c.type === 'both').length})` },
          { key: 'supplier', label: `Suppliers (${customers.filter(c => c.type === 'supplier' || c.type === 'both').length})` }
        ].map((tab) => (
          <motion.button key={tab.key}
            className={`settings-tab ${contactFilter === tab.key ? 'active' : ''}`}
            onClick={() => setContactFilter(tab.key)}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            style={{ padding: '6px 14px', fontSize: '0.78rem', marginBottom: 0 }}
          >
            {tab.label}
          </motion.button>
        ))}
      </div>

      <div className="settings-table-card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Email</th>
              <th>Phone</th>
              <th style={{ textAlign: 'center' }}>Transactions</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const filtered = contactFilter === 'all'
                ? customers
                : customers.filter(c => c.type === contactFilter || c.type === 'both')
              if (filtered.length === 0) {
                return <tr><td colSpan="6"><div className="empty-state" style={{ padding: '24px' }}>No {contactFilter === 'customer' ? 'customers' : contactFilter === 'supplier' ? 'suppliers' : 'contacts'} yet.</div></td></tr>
              }
              return filtered.map((c) => (
                <tr key={c.id}>
                  <td><span className="table-name">{c.name}</span></td>
                  <td><span className={`badge ${c.type === 'supplier' ? 'badge-category' : c.type === 'both' ? 'badge-normal' : 'badge-low'}`}>{c.type.charAt(0).toUpperCase() + c.type.slice(1)}</span></td>
                  <td>{c.email || '-'}</td>
                  <td>{c.phone || '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <motion.button className="icon-btn" onClick={() => viewTransactions(c)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} title="View transactions">
                      <Receipt size={16} />
                    </motion.button>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <motion.button className="icon-btn delete" onClick={() => setDeleteTarget(c.id)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <Trash2 size={16} />
                    </motion.button>
                  </td>
                </tr>
              ))
            })()}
          </tbody>
        </table>
      </div>

      {/* Transaction Viewer Modal */}
      <AnimatePresence>
        {viewingCustomer && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setViewingCustomer(null)}>
            <motion.div className="modal-card" style={{ maxWidth: 600, textAlign: 'left', padding: 24 }}
              initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }} transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setViewingCustomer(null)}><X size={18} /></button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <Receipt size={24} style={{ color: 'var(--blue)' }} />
                <div>
                  <h2 className="modal-title" style={{ fontSize: '1rem', marginBottom: 2 }}>{viewingCustomer.name}</h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                    {customerTxns.length} billed transaction{customerTxns.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              {loadingTxns ? (
                <div className="empty-state" style={{ padding: '32px' }}>Loading transactions...</div>
              ) : customerTxns.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px' }}>
                  <p style={{ fontSize: '0.85rem' }}>No billed transactions found for this customer.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '6px 8px', fontSize: '0.68rem' }}>Invoice #</th>
                        <th style={{ padding: '6px 8px', fontSize: '0.68rem' }}>Items</th>
                        <th style={{ padding: '6px 8px', fontSize: '0.68rem' }}>Status</th>
                        <th style={{ padding: '6px 8px', fontSize: '0.68rem', textAlign: 'right' }}>Total</th>
                        <th style={{ padding: '6px 8px', fontSize: '0.68rem', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerTxns.map((txn) => (
                        <tr key={txn.id}>
                          <td style={{ padding: '6px 8px', fontSize: '0.82rem', fontWeight: 600 }}>{txn.invoice_number}</td>
                          <td style={{ padding: '6px 8px', fontSize: '0.82rem', color: 'var(--gray-500)' }}>
                            {txn.items?.[0]?.item_name}
                            {txn.itemCount > 1 && <span style={{ color: 'var(--gray-400)' }}> +{txn.itemCount - 1} more</span>}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <span className={`badge ${txn.status === 'paid' ? 'badge-normal' : txn.status === 'cancelled' ? 'badge-low' : 'badge-category'}`} style={{ fontSize: '0.65rem' }}>
                              {txn.status ? txn.status.charAt(0).toUpperCase() + txn.status.slice(1) : 'Unpaid'}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px', fontSize: '0.82rem', fontWeight: 600, textAlign: 'right' }}>{formatCurrency(txn.total, settings.currency)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <Link to={`/transactions/${txn.id}`} onClick={() => setViewingCustomer(null)}>
                              <motion.button className="icon-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ width: 26, height: 26 }}>
                                <ExternalLink size={12} />
                              </motion.button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete Contact"
        message="Are you sure you want to delete this contact?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}

/** Small inline status indicator */
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
