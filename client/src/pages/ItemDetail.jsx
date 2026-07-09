import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Pencil, QrCode, Barcode, Package, Download, Printer, ArrowDownCircle, ArrowUpCircle, ExternalLink, Plus, X, ArrowUpDown } from 'lucide-react'
import { get, post } from '../api'
import DatePicker from '../components/DatePicker'
import Pagination from '../components/Pagination'
import { formatDateNepali } from '../utils'

function formatCurrency(value) {
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { duration: 0.3, delay: i * 0.03, ease: 'easeOut' } }),
}

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [txnLoading, setTxnLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [showBarcode, setShowBarcode] = useState(false)
  const [showQuickForm, setShowQuickForm] = useState(false)
  const [quickForm, setQuickForm] = useState({ type: 'stock_in', quantity: 1, source: '', destination: '', date: new Date().toISOString().split('T')[0], notes: '' })
  const [quickFormSubmitting, setQuickFormSubmitting] = useState(false)
  const [quickFormError, setQuickFormError] = useState('')
  const [txnPage, setTxnPage] = useState(1)
  const [txnPerPage, setTxnPerPage] = useState(10)
  const [txnSort, setTxnSort] = useState('desc')

  useEffect(() => {
    fetch(`/api/inventory/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((res) => {
        if (!res.ok) throw new Error('Item not found')
        return res.json()
      })
      .then(setItem)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  function loadTransactions() {
    if (!id) return
    setTxnLoading(true)
    get(`/api/transactions?item_id=${id}`)
      .then((data) => {
        setTransactions(data)
        setTxnPage(1)
      })
      .catch(() => {})
      .finally(() => setTxnLoading(false))
  }

  function loadItem() {
    fetch(`/api/inventory/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((res) => {
        if (!res.ok) throw new Error('Item not found')
        return res.json()
      })
      .then(setItem)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    if (!id) return
    loadTransactions()
  }, [id])

  async function handleQuickSubmit(e) {
    e.preventDefault()
    setQuickFormError('')
    setQuickFormSubmitting(true)
    try {
      await post('/api/transactions', {
        ...quickForm,
        item_id: parseInt(id),
        quantity: Number(quickForm.quantity),
        date: quickForm.date || new Date().toISOString()
      })
      setQuickForm({ type: 'stock_in', quantity: 1, source: '', destination: '', date: new Date().toISOString().split('T')[0], notes: '' })
      setShowQuickForm(false)
      loadTransactions()
      loadItem()
    } catch (err) {
      setQuickFormError(err.message)
    } finally {
      setQuickFormSubmitting(false)
    }
  }

  if (loading) return <div className="empty-state">Loading...</div>
  if (error) return <div className="empty-state">Error: {error}</div>
  if (!item) return <div className="empty-state">Item not found</div>

  const value = item.quantity * item.price
  const isLow = item.quantity < 20

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{item.name}</h1>
          <p>SKU: {item.sku} — {item.category}</p>
        </div>
        <div className="header-actions">
          <Link to={`/edit/${item.id}`}>
            <motion.button className="btn btn-secondary" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Pencil size={18} /> Edit
            </motion.button>
          </Link>
          <motion.button className="btn btn-secondary" onClick={() => navigate('/')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <ArrowLeft size={18} /> Back
          </motion.button>
        </div>
      </div>

      <div className="detail-grid">
        {/* Product Info Card */}
        <motion.div className="card detail-info" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="detail-image-section">
            {item.image ? (
              <img src={item.image} alt={item.name} className="detail-image" />
            ) : (
              <div className="detail-image-placeholder"><Package size={48} /></div>
            )}
          </div>
          <div className="detail-info-body">
            <div className="detail-row">
              <span className="detail-label">Category</span>
              <span className="badge badge-category">{item.category}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Supplier</span>
              <span>{item.supplier || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Description</span>
              <span>{item.description || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Created</span>
              <span>{(() => { const d = new Date(item.created_at); const en = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); const fd = formatDateNepali(item.created_at); return fd ? <><div>{en}</div><div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{fd.np}</div></> : '' })()}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Updated</span>
              <span>{(() => { const d = new Date(item.updated_at); const en = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); const fd = formatDateNepali(item.updated_at); return fd ? <><div>{en}</div><div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{fd.np}</div></> : '' })()}</span>
            </div>
          </div>
        </motion.div>

        {/* Stats Card */}
        <motion.div className="card detail-stats" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <h3>Inventory Stats</h3>
          <div className="detail-stat-grid">
            <div className="detail-stat-item">
              <span className="detail-stat-label">Quantity</span>
              <span className="detail-stat-value">{item.quantity}</span>
              <span className={`badge ${isLow ? 'badge-low' : 'badge-normal'}`}>{isLow ? 'Low Stock' : 'In Stock'}</span>
            </div>
            <div className="detail-stat-item">
              <span className="detail-stat-label">Unit Price</span>
              <span className="detail-stat-value">{formatCurrency(item.price)}</span>
            </div>
            <div className="detail-stat-item">
              <span className="detail-stat-label">Total Value</span>
              <span className="detail-stat-value highlight">{formatCurrency(value)}</span>
            </div>
          </div>
        </motion.div>

        {/* QR Code & Barcode Card */}
        <motion.div className="card detail-codes print-area" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <h3 className="no-print">Codes & Labels</h3>
          <div className="codes-toggle no-print">
            <button className={`code-btn ${showQR ? 'active' : ''}`} onClick={() => { setShowQR(true); setShowBarcode(false) }}>
              <QrCode size={18} /> QR Code
            </button>
            <button className={`code-btn ${showBarcode ? 'active' : ''}`} onClick={() => { setShowBarcode(true); setShowQR(false) }}>
              <Barcode size={18} /> Barcode
            </button>
          </div>

          <div className="code-display">
            {showQR && (
              <motion.div className="code-container print-code" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
                <div className="print-header">
                  <h2 className="print-title">{item.name}</h2>
                  <p className="print-sku">SKU: {item.sku}</p>
                </div>
                <img src={`/api/inventory/${item.id}/qr`} alt="QR Code" className="code-image" />
                <p className="code-label">Scan to view item details</p>
                <div className="code-actions">
                  <a href={`/api/inventory/${item.id}/qr`} download={`${item.sku}-qr.svg`} className="btn btn-sm btn-secondary no-print">
                    <Download size={14} /> Download
                  </a>
                  <motion.button
                    className="btn btn-sm btn-secondary no-print"
                    onClick={() => window.print()}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Printer size={14} /> Print
                  </motion.button>
                </div>
              </motion.div>
            )}
            {showBarcode && (
              <motion.div className="code-container print-code" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
                <div className="print-header">
                  <h2 className="print-title">{item.name}</h2>
                  <p className="print-sku">SKU: {item.sku}</p>
                </div>
                <img src={`/api/inventory/${item.id}/barcode`} alt="Barcode" className="code-image barcode" />
                <p className="code-label">{item.sku}</p>
                <div className="code-actions">
                  <a href={`/api/inventory/${item.id}/barcode`} download={`${item.sku}-barcode.png`} className="btn btn-sm btn-secondary no-print">
                    <Download size={14} /> Download
                  </a>
                  <motion.button
                    className="btn btn-sm btn-secondary no-print"
                    onClick={() => window.print()}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Printer size={14} /> Print
                  </motion.button>
                </div>
              </motion.div>
            )}
            {!showQR && !showBarcode && (
              <div className="code-placeholder">
                <QrCode size={40} className="icon" />
                <p>Select QR Code or Barcode to preview</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Transaction Log Card */}
        <motion.div className="card detail-txns" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h3>Transaction Log</h3>
              <motion.button
                className={`btn btn-sm ${showQuickForm ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setShowQuickForm(!showQuickForm)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {showQuickForm ? <X size={14} /> : <Plus size={14} />}
                {showQuickForm ? 'Cancel' : 'New Transaction'}
              </motion.button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.button
                className="btn btn-sm btn-secondary"
                onClick={() => setTxnSort(txnSort === 'desc' ? 'asc' : 'asc')}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{ padding: '6px 10px', fontSize: '0.75rem', minHeight: 32 }}
                title={txnSort === 'desc' ? 'Sorted newest first' : 'Sorted oldest first'}
              >
                <ArrowUpDown size={14} />
                {txnSort === 'desc' ? 'Newest' : 'Oldest'}
              </motion.button>
              <Link to={`/transactions?item_id=${item.id}`} className="card-link">
                View All <ExternalLink size={14} />
              </Link>
            </div>
          </div>

          {/* Quick Transaction Form */}
          <AnimatePresence>
            {showQuickForm && (
              <motion.div
                className="quick-txn-form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                <form onSubmit={handleQuickSubmit}>
                  <div className="quick-txn-grid">
                    <div className="form-group">
                      <label>Type</label>
                      <div className="type-toggle" style={{ minHeight: 40 }}>
                        <button
                          type="button"
                          className={`type-btn ${quickForm.type === 'stock_in' ? 'active stock-in' : ''}`}
                          onClick={() => setQuickForm((p) => ({ ...p, type: 'stock_in' }))}
                          style={{ padding: '8px 12px', minHeight: 40, fontSize: '0.82rem' }}
                        >
                          <ArrowDownCircle size={16} /> Stock In
                        </button>
                        <button
                          type="button"
                          className={`type-btn ${quickForm.type === 'stock_out' ? 'active stock-out' : ''}`}
                          onClick={() => setQuickForm((p) => ({ ...p, type: 'stock_out' }))}
                          style={{ padding: '8px 12px', minHeight: 40, fontSize: '0.82rem' }}
                        >
                          <ArrowUpCircle size={16} /> Stock Out
                        </button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Quantity *</label>
                      <input
                        type="number"
                        min="1"
                        value={quickForm.quantity}
                        onChange={(e) => setQuickForm((p) => ({ ...p, quantity: e.target.value }))}
                        required
                        style={{ minHeight: 40, fontSize: '0.85rem' }}
                      />
                    </div>
                    <div className="form-group">
                      <label>Date</label>
                      <DatePicker
                        value={quickForm.date}
                        onChange={(v) => setQuickForm((p) => ({ ...p, date: v }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>{quickForm.type === 'stock_in' ? 'Source' : 'From'}</label>
                      <input
                        type="text"
                        value={quickForm.source}
                        onChange={(e) => setQuickForm((p) => ({ ...p, source: e.target.value }))}
                        placeholder={quickForm.type === 'stock_in' ? 'Supplier name' : 'Warehouse'}
                        style={{ minHeight: 40, fontSize: '0.85rem' }}
                      />
                    </div>
                    <div className="form-group">
                      <label>{quickForm.type === 'stock_in' ? 'Destination' : 'To'}</label>
                      <input
                        type="text"
                        value={quickForm.destination}
                        onChange={(e) => setQuickForm((p) => ({ ...p, destination: e.target.value }))}
                        placeholder={quickForm.type === 'stock_in' ? 'Warehouse' : 'Customer name'}
                        style={{ minHeight: 40, fontSize: '0.85rem' }}
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Notes</label>
                      <input
                        type="text"
                        value={quickForm.notes}
                        onChange={(e) => setQuickForm((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Optional notes"
                        style={{ minHeight: 40, fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  {quickFormError && (
                    <p className="error-msg" style={{ marginTop: 8, fontSize: '0.8rem' }}>{quickFormError}</p>
                  )}

                  <div className="quick-txn-actions">
                    <motion.button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={quickFormSubmitting}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {quickFormSubmitting ? 'Recording...' : `Record ${quickForm.type === 'stock_in' ? 'Stock In' : 'Stock Out'}`}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="card-body">
            {txnLoading ? (
              <div className="empty-state" style={{ padding: '24px' }}>Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <Package size={32} className="icon" />
                <p>No transactions for this item yet.</p>
              </div>
            ) : (
              <>
                <div className="txn-log-list">
                  <AnimatePresence initial={false}>
                    {(() => {
                      const sorted = [...transactions].sort((a, b) => {
                        const dateA = new Date(a.date).getTime()
                        const dateB = new Date(b.date).getTime()
                        return txnSort === 'desc' ? dateB - dateA : dateA - dateB
                      })
                      const safePage = Math.min(txnPage, Math.max(1, Math.ceil(sorted.length / txnPerPage)))
                      const from = (safePage - 1) * txnPerPage
                      const to = from + txnPerPage
                      return sorted.slice(from, to).map((txn, i) => (
                        <motion.div
                          key={txn.id}
                          className="txn-log-item"
                          custom={i}
                          variants={rowVariants}
                          initial="hidden"
                          animate="visible"
                        >
                          <div className="txn-log-icon">
                            {txn.type === 'stock_in' ? (
                              <ArrowDownCircle size={18} className="txn-icon-in" />
                            ) : (
                              <ArrowUpCircle size={18} className="txn-icon-out" />
                            )}
                          </div>
                          <div className="txn-log-body">
                            <div className="txn-log-top">
                              <span className={`badge ${txn.type === 'stock_in' ? 'badge-normal' : 'badge-low'}`}>
                                {txn.type === 'stock_in' ? 'Stock In' : 'Stock Out'}
                              </span>
                              <span className="txn-log-qty">{txn.quantity} units</span>
                            </div>
                            <div className="txn-log-flow">
                              {txn.source && <span>From: {txn.source}</span>}
                              {txn.destination && <span>To: {txn.destination}</span>}
                            </div>
                            <div className="txn-log-meta">
                              <span className="txn-log-date">{(() => { const fd = formatDateNepali(txn.date); return fd ? <><div>{fd.en}</div><div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{fd.np}</div></> : '' })()}</span>
                              {txn.notes && <span className="txn-log-notes">{txn.notes}</span>}
                            </div>
                          </div>
                        </motion.div>
                      ))
                    })()}
                  </AnimatePresence>
                </div>
                <div className="txn-log-pagination">
                  <Pagination
                    page={txnPage}
                    totalPages={Math.max(1, Math.ceil(transactions.length / txnPerPage))}
                    totalItems={transactions.length}
                    perPage={txnPerPage}
                    onPageChange={setTxnPage}
                    onPerPageChange={setTxnPerPage}
                  />
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </>
  )
}
