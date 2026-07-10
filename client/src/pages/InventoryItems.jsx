import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, Eye, Search, Filter, Package, Image, FileSpreadsheet, Calendar, X } from 'lucide-react'
import { get, del } from '../api'
import Pagination from '../components/Pagination'
import ConfirmModal from '../components/ConfirmModal'
import { useToast } from '../components/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { formatDateTimeNepali, exportToExcel, formatCurrency } from '../utils'
import DatePicker from '../components/DatePicker'

const DEFAULT_THRESHOLD = 20


const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { duration: 0.3, delay: i * 0.03, ease: 'easeOut' } }),
  exit: { opacity: 0, x: 10, transition: { duration: 0.2 } }
}

export default function InventoryItems() {
  const { permissions } = useAuth()
  const navigate = useNavigate()
  const showToast = useToast()
  const [items, setItems] = useState([])
  const [settings, setSettings] = useState({ lowStockThreshold: DEFAULT_THRESHOLD, currency: 'USD' })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [sortBy, setSortBy] = useState('updated_at')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(15)

  const canEdit = permissions?.includes('inventory:update')
  const canDelete = permissions?.includes('inventory:delete')
  const [deleteTarget, setDeleteTarget] = useState(null)

  async function loadData() {
    try {
      const params = new URLSearchParams()
      if (filterDateFrom) params.set('date_from', filterDateFrom)
      if (filterDateTo) params.set('date_to', filterDateTo)
      const qs = params.toString()
      const [inv, cfg] = await Promise.all([
        get(`/api/inventory${qs ? '?'+qs : ''}`),
        get('/api/settings')
      ])
      setItems(inv)
      if (cfg?.lowStockThreshold != null) setSettings({ lowStockThreshold: cfg.lowStockThreshold, currency: cfg.currency || 'USD' })
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await del(`/api/inventory/${deleteTarget}`)
      setDeleteTarget(null)
      showToast('Item deleted successfully', { variant: 'success' })
      loadData()
    } catch (err) {
      showToast('Failed to delete item', { variant: 'error' })
    }
  }

  useEffect(() => { loadData() }, [filterDateFrom, filterDateTo])

  const categories = [...new Set(items.map((i) => i.category))]

  let filtered = items.filter((item) => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase())
    const matchCategory = !filterCategory || item.category === filterCategory
    const isLow = item.quantity < settings.lowStockThreshold
    const matchStatus = !filterStatus || (filterStatus === 'low' && isLow) || (filterStatus === 'in' && !isLow)
    return matchSearch && matchCategory && matchStatus
  })

  if (sortBy === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name))
  else if (sortBy === 'quantity') filtered.sort((a, b) => b.quantity - a.quantity)
  else if (sortBy === 'price') filtered.sort((a, b) => b.price - a.price)
  else filtered.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  function handleSearch(v) { setSearch(v); setPage(1) }
  function handleCategory(v) { setFilterCategory(v); setPage(1) }
  
  const hasActiveFilters = search || filterCategory || filterStatus || filterDateFrom || filterDateTo
  
  function clearFilters() {
    setSearch('')
    setFilterCategory('')
    setFilterStatus('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setPage(1)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Inventory Items</h1>
          <p>{items.length} total items</p>
        </div>
        <div className="header-actions">
          {items.length > 0 && (
            <motion.button className="btn btn-secondary" onClick={() => {
              const cols = [
                { header: 'Name', key: 'name', width: 25 },
                { header: 'SKU', key: 'sku', width: 15 },
                { header: 'Category', key: 'category', width: 18 },
                { header: 'Quantity', key: 'quantity', width: 12 },
                { header: 'Price', key: 'price', width: 12, formatter: (v) => formatCurrency(v, settings.currency) },
                { header: 'Value', key: 'value', width: 12, formatter: (_, row) => formatCurrency(row.quantity * row.price, settings.currency) },
                { header: 'Supplier', key: 'supplier', width: 20 },
                { header: 'Description', key: 'description', width: 30 },
                { header: 'Date', key: 'updated_at', width: 20, formatter: (v) => formatDateTimeNepali(v)?.en || '' }
              ]
              exportToExcel(filtered, cols, 'inventory-export')
            }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <FileSpreadsheet size={14} /> Export Excel
            </motion.button>
          )}
          {permissions?.includes('inventory:create') && (
            <motion.button className="btn btn-primary" onClick={() => navigate('/add')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Plus size={14} /> Add Item
            </motion.button>
          )}
        </div>
      </div>

      <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="card-header">
          <div className="search-filters">
            <div className="search-box">
              <Search size={16} />
              <input type="text" placeholder="Search by name or SKU..." value={search} onChange={(e) => handleSearch(e.target.value)} />
            </div>
            <div className="filter-group">
              <Filter size={16} />
              <select value={filterCategory} onChange={(e) => handleCategory(e.target.value)} className="filter-select">
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
                <option value="">All Status</option>
                <option value="in">In Stock</option>
                <option value="low">Low Stock</option>
              </select>              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
                <option value="updated_at">Recently Updated</option>
                <option value="name">Name (A-Z)</option>
                <option value="quantity">Quantity (High-Low)</option>
                <option value="price">Price (High-Low)</option>
              </select>
            </div>
            <div className="filter-group" style={{ gap: 4 }}>
              <Calendar size={14} style={{ color: 'var(--gray-400)' }} />
              <DatePicker value={filterDateFrom} onChange={(v) => { setFilterDateFrom(v); setPage(1) }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>to</span>
              <DatePicker value={filterDateTo} onChange={(v) => { setFilterDateTo(v); setPage(1) }} />
            </div>
            {hasActiveFilters && (
              <motion.button
                className="btn btn-secondary btn-sm"
                onClick={clearFilters}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{ padding: '4px 10px', fontSize: '0.72rem', minHeight: 30, flexShrink: 0 }}
              >
                <X size={12} /> Clear
              </motion.button>
            )}
          </div>
        </div>
        <div className="card-body">
          <div className="table-responsive table-fixed-body">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Date</th>
                  <th>Price</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {loading ? (
                    <tr><td colSpan="9"><div className="empty-state">Loading...</div></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan="9"><div className="empty-state"><Package size={40} className="icon" /><p>No items found.</p></div></td></tr>
                  ) : (
                    paginated.map((item, i) => {
                      const value = item.quantity * item.price
                      const isLow = item.quantity < settings.lowStockThreshold
                      return (
                        <motion.tr key={item.id} custom={i} variants={rowVariants} initial="hidden" animate="visible" exit="exit" layout>
                          <td>
                            <div className="table-product">
                              {item.image ? <img src={item.image} alt={item.name} className="table-thumb" /> : <div className="table-thumb-placeholder"><Image size={16} /></div>}
                              <span className="table-name">{item.name}</span>
                            </div>
                          </td>
                          <td><span className="table-sku">{item.sku}</span></td>
                          <td><span className="badge badge-category">{item.category}</span></td>
                          <td><span className="table-qty">{item.quantity}</span></td>
                          <td style={{ fontSize: '0.72rem', color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
                            {(() => { const fd = formatDateTimeNepali(item.updated_at); return fd ? <><div>{fd.en}</div><div>{fd.np}</div></> : '' })()}
                          </td>
                          <td><span className="table-price">{formatCurrency(item.price, settings.currency)}</span></td>
                          <td><span className="table-value">{formatCurrency(value, settings.currency)}</span></td>
                          <td><span className={`badge ${isLow ? 'badge-low' : 'badge-normal'}`}>{isLow ? 'Low Stock' : 'In Stock'}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="actions" style={{ justifyContent: 'flex-end' }}>
                              <Link to={`/inventory/${item.id}`}><motion.button className="icon-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><Eye size={16} /></motion.button></Link>
                              {canEdit && <Link to={`/edit/${item.id}`}><motion.button className="icon-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><Pencil size={16} /></motion.button></Link>}
                              {canDelete && <motion.button className="icon-btn delete" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setDeleteTarget(item.id)}><Trash2 size={16} /></motion.button>}
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
       
      </motion.div>

      {filtered.length > 0 && (
        <div className="pagination-card">
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={filtered.length}
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
          />
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete Item"
        message="Are you sure you want to delete this item? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
