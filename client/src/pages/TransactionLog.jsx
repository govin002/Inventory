import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowDownCircle, ArrowUpCircle, ArrowUpDown, ArrowUp, ArrowDown, Package, Filter, FileSpreadsheet, FileText } from 'lucide-react'
import { get } from '../api'
import DatePicker from '../components/DatePicker'
import Pagination from '../components/Pagination'
import ImagePreview from '../components/ImagePreview'
import { formatDateTimeNepali, exportToExcel } from '../utils'

const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { duration: 0.3, delay: i * 0.03, ease: 'easeOut' } }),
}

export default function TransactionLog() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(15)
  const [previewImage, setPreviewImage] = useState(null)

  async function loadData() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterType) params.set('type', filterType)
      if (filterDateFrom) params.set('date_from', filterDateFrom)
      if (filterDateTo) params.set('date_to', filterDateTo)
      const qs = params.toString()
      const url = qs ? `/api/transactions?${qs}` : '/api/transactions'
      const data = await get(url)
      setTransactions(data)
      setPage(1)
    } catch (err) {
      console.error('Failed to load transactions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [filterType, filterDateFrom, filterDateTo])

  const filtered = transactions.filter((txn) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (txn.items || []).some(item => item.item_name?.toLowerCase().includes(q)) ||
           txn.invoice_number?.toLowerCase().includes(q) ||
           txn.customer_name?.toLowerCase().includes(q)
  })

  function handleSearch(v) { setSearch(v); setPage(1) }

  function handleSort(column) {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
    setPage(1)
  }

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    switch (sortBy) {
      case 'item':
        const aName = (a.items?.[0]?.item_name || a.invoice_number || '')
        const bName = (b.items?.[0]?.item_name || b.invoice_number || '')
        cmp = aName.localeCompare(bName)
        break
      case 'qty': {
        const aQty = (a.items || []).reduce((s, i) => s + i.quantity, 0)
        const bQty = (b.items || []).reduce((s, i) => s + i.quantity, 0)
        cmp = aQty - bQty
        break
      }
      case 'source':
        cmp = ((a.source || '') + (a.destination || '')).localeCompare((b.source || '') + (b.destination || ''))
        break
      case 'date':
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
        break
      case 'notes':
        cmp = (a.notes || '').localeCompare(b.notes || '')
        break
      default:
        cmp = 0
    }
    return sortOrder === 'desc' ? -cmp : cmp
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const paginated = sorted.slice((safePage - 1) * perPage, safePage * perPage)

  function SortIcon({ column }) {
    if (sortBy !== column) return <ArrowUpDown size={11} className="sort-icon-idle" />
    return sortOrder === 'asc' ? <ArrowUp size={11} className="sort-icon-active" /> : <ArrowDown size={11} className="sort-icon-active" />
  }

  function SortTh({ column, children, style }) {
    return (
      <th style={style} className="sortable-th" onClick={() => handleSort(column)}>
        <span className="sort-th-inner">
          {children}
          <SortIcon column={column} />
        </span>
      </th>
    )
  }

  function hasBatchInfo() {
    return paginated.some(txn => txn.items?.some(item => item.batch_number))
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Transaction Log</h1>
          <p>{transactions.length} total entries</p>
        </div>
        <div className="header-actions">
          {sorted.length > 0 && (
            <motion.button className="btn btn-secondary" onClick={() => {
              const cols = [
                { header: 'Type', key: 'type', width: 12, formatter: (v) => v === 'stock_in' ? 'Stock In' : 'Stock Out' },
                { header: 'Items', key: 'items', width: 22, formatter: (v) => (v || []).map(i => i.item_name).join(', ') },
                { header: 'Total Qty', key: 'items', width: 12, formatter: (v) => (v || []).reduce((s, i) => s + i.quantity, 0) },
                { header: 'Customer', key: 'customer_name', width: 15 },
                { header: 'Invoice #', key: 'invoice_number', width: 15 },
                { header: 'Source', key: 'source', width: 12 },
                { header: 'Destination', key: 'destination', width: 12 },
                { header: 'Date', key: 'date', width: 18, formatter: (v) => formatDateTimeNepali(v)?.en || '' },
                { header: 'Notes', key: 'notes', width: 20 }
              ]
              exportToExcel(sorted, cols, 'transactions-export')
            }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <FileSpreadsheet size={14} /> Export Excel
            </motion.button>
          )}
        </div>
      </div>

      <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="card-header">
          <div className="search-filters">
            <div className="search-box" style={{ flex: '0 1 auto', minWidth: 160 }}>
              <Search size={16} />
              <input type="text" placeholder="Search by name or SKU..." value={search} onChange={(e) => handleSearch(e.target.value)} />
            </div>
            <div className="filter-group">
              <Filter size={16} />
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="filter-select">
                <option value="">All Types</option>
                <option value="stock_in">Stock In</option>
                <option value="stock_out">Stock Out</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>From:</span>
                <DatePicker value={filterDateFrom} onChange={(v) => setFilterDateFrom(v)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>To:</span>
                <DatePicker value={filterDateTo} onChange={(v) => setFilterDateTo(v)} />
              </div>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="table-responsive table-fixed-body">
            <table className="txn-log-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>Type</th>
                  <SortTh column="item">Transaction</SortTh>
                  <SortTh column="qty" style={{ width: 60 }}>Qty</SortTh>
                  {hasBatchInfo() && <th style={{ width: 100, fontSize: '0.6rem' }}>Batch / Expiry</th>}
                  <SortTh column="source" style={{ width: 110 }}>Source / Dest</SortTh>
                  <SortTh column="date" style={{ width: 110 }}>Date</SortTh>
                  <SortTh column="notes">Notes</SortTh>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {loading ? (
                    <tr><td colSpan="7"><div className="empty-state" style={{ padding: '40px' }}>Loading...</div></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan="7"><div className="empty-state" style={{ padding: '40px' }}><Package size={40} className="icon" /><p>No transactions found.</p></div></td></tr>
                  ) : (
                    paginated.map((txn, i) => {
                      const firstItem = txn.items?.[0]
                      const totalQty = (txn.items || []).reduce((s, i) => s + i.quantity, 0)
                      return (
                      <motion.tr key={txn.id} custom={i} variants={rowVariants} initial="hidden" animate="visible">
                        <td>
                          {txn.type === 'stock_in' ? (
                            <ArrowDownCircle size={16} style={{ color: 'var(--green)' }} />
                          ) : (
                            <ArrowUpCircle size={16} style={{ color: 'var(--red)' }} />
                          )}
                        </td>
                        <td>
                          <Link to={`/transactions/${txn.id}`} className="table-name" style={{ fontSize: '0.82rem', textDecoration: 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {firstItem ? (
                                <span>{firstItem.item_name}</span>
                              ) : txn.invoice_number ? (
                                <span style={{ color: 'var(--blue)' }}>{txn.invoice_number}</span>
                              ) : (
                                <span>Transaction #{txn.id}</span>
                              )}
                              {txn.itemCount > 1 && (
                                <span className="badge badge-category" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>+{txn.itemCount - 1} more</span>
                              )}
                            </div>
                            {txn.invoice_number && (
                              <span className="table-sku" style={{ fontSize: '0.68rem' }}>{txn.invoice_number}</span>
                            )}
                            {txn.customer_name && !txn.invoice_number && (
                              <span className="table-sku" style={{ fontSize: '0.68rem' }}>{txn.customer_name}</span>
                            )}
                          </Link>
                        </td>
                        <td>
                          <span className="table-qty" style={{ color: txn.type === 'stock_in' ? 'var(--green)' : 'var(--red)' }}>
                            {txn.type === 'stock_in' ? '+' : '-'}{totalQty}
                          </span>
                          <div style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }}>
                            {txn.itemCount} item{txn.itemCount !== 1 ? 's' : ''}
                          </div>
                        </td>
                        {hasBatchInfo() && (
                          <td style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                            {(txn.items || []).filter(item => item.batch_number).length > 0 ? (
                              (txn.items || []).filter(item => item.batch_number).map((item, bi) => (
                                <div key={bi} style={{ marginBottom: 2 }}>
                                  <span style={{ fontWeight: 500 }}>{item.batch_number}</span>
                                  {item.expiry_date && <span style={{ fontSize: '0.62rem', color: 'var(--gray-400)', marginLeft: 4 }}>Exp: {item.expiry_date}</span>}
                                </div>
                              ))
                            ) : (
                              <span style={{ color: 'var(--gray-300)' }}>—</span>
                            )}
                          </td>
                        )}
                        <td style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                          {txn.source || txn.destination ? (
                            <>{txn.source && <span>From: {txn.source}</span>}{txn.source && txn.destination && ' → '}{txn.destination && <span>To: {txn.destination}</span>}</>
                          ) : (
                            <span style={{ color: 'var(--gray-400)' }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                          {(() => { const fd = formatDateTimeNepali(txn.date); return fd ? <><div>{fd.en}</div><div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{fd.np}</div></> : '—' })()}
                        </td>
<td style={{ fontSize: '0.78rem', color: 'var(--gray-400)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {txn.notes && <span>{txn.notes}</span>}
                              {!txn.notes && <span style={{ color: 'var(--gray-300)' }}>—</span>}
                              {txn.invoice_number && (
                                <Link to={`/transactions/${txn.id}`} style={{ flexShrink: 0 }} title={`View ${txn.invoice_number}`}>
                                  <span className="badge badge-normal" style={{ fontSize: '0.65rem', gap: 3, cursor: 'pointer' }}>
                                    <FileText size={10} /> {txn.invoice_number}
                                  </span>
                                </Link>
                              )}
                            </div>
                          </td>
                      </motion.tr>
                    )})
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

      <ImagePreview
        src={previewImage?.src}
        alt={previewImage?.alt}
        onClose={() => setPreviewImage(null)}
      />
    </>
  )
}
