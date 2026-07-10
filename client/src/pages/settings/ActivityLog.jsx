import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, Activity, User, Settings, Package, ArrowDownCircle, ArrowUpCircle, LogIn, LogOut, Trash2, FileSpreadsheet, Save, Folder, Database, HardDrive } from 'lucide-react'
import { get, put } from '../../api'
import DatePicker from '../../components/DatePicker'
import Pagination from '../../components/Pagination'
import { formatDateTimeNepali, exportToExcel } from '../../utils'
import { useToast } from '../../components/ToastContext'

const ACTION_ICONS = {
  'user.login': LogIn,
  'user.logout': LogOut,
  'user.create': User,
  'user.update': User,
  'user.delete': Trash2,
  'inventory.create': Package,
  'inventory.update': Package,
  'inventory.delete': Trash2,
  'transaction.create': ArrowDownCircle,
  'transaction.delete': Trash2,
  'settings.update': Settings
}

const ACTION_LABELS = {
  'user.login': 'Login',
  'user.logout': 'Logout',
  'user.create': 'User Created',
  'user.update': 'User Updated',
  'user.delete': 'User Deleted',
  'inventory.create': 'Item Created',
  'inventory.update': 'Item Updated',
  'inventory.delete': 'Item Deleted',
  'transaction.create': 'Transaction Created',
  'transaction.delete': 'Transaction Deleted',
  'settings.update': 'Settings Changed'
}

const ACTION_COLORS = {
  'user.login': 'green',
  'user.logout': 'gray',
  'user.create': 'blue',
  'user.update': 'blue',
  'user.delete': 'red',
  'inventory.create': 'green',
  'inventory.update': 'amber',
  'inventory.delete': 'red',
  'transaction.create': 'blue',
  'transaction.delete': 'red',
  'settings.update': 'amber'
}

const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { duration: 0.3, delay: i * 0.02, ease: 'easeOut' } }),
}

export default function ActivityLog() {
  const showToast = useToast()
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  
  // Log configuration
  const [logMode, setLogMode] = useState('db')
  const [logFilePath, setLogFilePath] = useState('')
  const [configSaving, setConfigSaving] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  const uniqueActions = [...new Set(logs.map((l) => l.action))].sort()
  const uniqueEntityTypes = [...new Set(logs.map((l) => l.entity_type).filter(Boolean))].sort()

  async function loadLogs() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterAction) params.set('action', filterAction)
      if (filterEntity) params.set('entity_type', filterEntity)
      if (filterDateFrom) params.set('date_from', filterDateFrom)
      if (filterDateTo) params.set('date_to', filterDateTo)
      if (search) params.set('search', search)
      params.set('page', page)
      params.set('perPage', perPage)

      const data = await get(`/api/activity-logs?${params.toString()}`)
      setLogs(data.logs || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      console.error('Failed to load activity logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [filterAction, filterEntity, filterDateFrom, filterDateTo, page, perPage])

  useEffect(() => {
    // Load stats and log config
    get('/api/activity-logs/stats').then(setStats).catch(() => {})
    get('/api/settings').then((s) => {
      if (s.logMode) setLogMode(s.logMode)
      if (s.logFilePath !== undefined) setLogFilePath(s.logFilePath || '')
    }).catch(() => {})
  }, [])

  function handleSearch(v) {
    setSearch(v)
    setPage(1)
  }

  async function saveConfig() {
    setConfigSaving(true)
    try {
      const current = await get('/api/settings')
      await put('/api/settings', { ...current, logMode, logFilePath })
      showToast('Log configuration saved', { variant: 'success' })
      setShowConfig(false)
    } catch (err) {
      showToast('Failed to save configuration', { variant: 'error' })
    } finally {
      setConfigSaving(false)
    }
  }

  function getActionIcon(action) {
    const Icon = ACTION_ICONS[action] || Activity
    return <Icon size={14} />
  }

  function getActionLabel(action) {
    return ACTION_LABELS[action] || action
  }

  function getActionColor(action) {
    return ACTION_COLORS[action] || 'gray'
  }

  function getEntityDisplay(log) {
    if (log.entity_type === 'inventory' && log.details?.name) {
      return log.details.name
    }
    if (log.entity_type === 'user' && log.details?.username) {
      return log.details.username
    }
    if (log.entity_type === 'transaction') {
      return log.details?.invoice_number || `#${log.entity_id}`
    }
    return log.entity_id ? `#${log.entity_id}` : '—'
  }

  function getDetailsSummary(details) {
    if (!details) return ''
    if (typeof details === 'string') return details
    if (details.name) return details.name
    if (details.sku) return `SKU: ${details.sku}`
    if (details.changed) return `Changed: ${details.changed.join(', ')}`
    if (details.username) return details.username
    if (details.invoice_number) return `Invoice: ${details.invoice_number}`
    return JSON.stringify(details)
  }

  return (
    <>
      <div className="settings-section-header">
        <h2>Activity Log</h2>
        <div className="header-actions" style={{ gap: 6 }}>
          {stats && (
            <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>
              {stats.totalLogs} total events
            </span>
          )}
        </div>
      </div>

      {stats && (
        <div className="stats-grid" style={{ marginBottom: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          <motion.div className="card" style={{ padding: '10px 14px' }}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Events</span>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--gray-800)', marginTop: 2 }}>{stats.totalLogs.toLocaleString()}</div>
          </motion.div>
          <motion.div className="card" style={{ padding: '10px 14px' }}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Unique Users</span>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--gray-800)', marginTop: 2 }}>{stats.uniqueUsers}</div>
          </motion.div>
          <motion.div className="card" style={{ padding: '10px 14px' }}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Last 24h</span>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--gray-800)', marginTop: 2 }}>{stats.recent24h}</div>
          </motion.div>
        </div>
      )}

      {/* Log Configuration Toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <motion.button 
          className={`btn btn-sm ${showConfig ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowConfig(!showConfig)}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          style={{ padding: '5px 10px', fontSize: '0.72rem', minHeight: 28 }}>
          <HardDrive size={12} /> {showConfig ? 'Hide Storage Config' : 'Storage Config'}
        </motion.button>
      </div>

      {/* Log Configuration Panel */}
      <AnimatePresence>
        {showConfig && (
          <motion.div className="card" style={{ padding: '14px 16px', marginBottom: 12 }}
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <HardDrive size={14} /> Log Storage Configuration
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>
                  <Database size={12} style={{ marginRight: 4 }} />Storage Mode
                </label>
                <select value={logMode} onChange={(e) => setLogMode(e.target.value)}
                  style={{ minHeight: 34, fontSize: '0.8rem', padding: '4px 8px', maxWidth: 250 }}>
                  <option value="db">Database only</option>
                  <option value="file">File only</option>
                  <option value="both">Both Database & File</option>
                </select>
                <p style={{ fontSize: '0.68rem', color: 'var(--gray-400)', marginTop: 4 }}>
                  {logMode === 'db' && 'Logs are stored in the SQLite database only. Access them here.'}
                  {logMode === 'file' && 'Logs are written to a file on disk. Not stored in the database.'}
                  {logMode === 'both' && 'Logs are stored in both the database AND written to a file.'}
                </p>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>
                  <Folder size={12} style={{ marginRight: 4 }} />Log File Path
                </label>
                <input type="text" value={logFilePath} 
                  onChange={(e) => setLogFilePath(e.target.value)}
                  placeholder="e.g. C:\logs\activity.log or ./logs/activity.log"
                  style={{ minHeight: 34, fontSize: '0.8rem', padding: '4px 10px', fontFamily: 'monospace', width: '100%', maxWidth: 450 }} />
                <p style={{ fontSize: '0.68rem', color: 'var(--gray-400)', marginTop: 4 }}>
                  Only used when mode is "File only" or "Both". Leave empty for default (not written to file).
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <motion.button className="btn btn-primary btn-sm" onClick={saveConfig} disabled={configSaving}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  style={{ padding: '5px 12px', fontSize: '0.75rem', minHeight: 30 }}>
                  <Save size={12} /> {configSaving ? 'Saving...' : 'Save Configuration'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="card-header">
          <div className="search-filters" style={{ flexWrap: 'wrap' }}>
            <div className="search-box" style={{ flex: '0 1 auto', minWidth: 180 }}>
              <Search size={16} />
              <input type="text" placeholder="Search activity..." value={search}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadLogs()} />
            </div>
            <div className="filter-group">
              <Filter size={16} />
              <select value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1) }} className="filter-select">
                <option value="">All Actions</option>
                {uniqueActions.map((a) => (
                  <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
                ))}
              </select>
              <select value={filterEntity} onChange={(e) => { setFilterEntity(e.target.value); setPage(1) }} className="filter-select">
                <option value="">All Types</option>
                {uniqueEntityTypes.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }}>From:</span>
                <DatePicker value={filterDateFrom} onChange={(v) => { setFilterDateFrom(v); setPage(1) }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }}>To:</span>
                <DatePicker value={filterDateTo} onChange={(v) => { setFilterDateTo(v); setPage(1) }} />
              </div>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const cols = [
              { header: 'ID', key: 'id', width: 8 },
              { header: 'Timestamp', key: 'created_at', width: 20 },
              { header: 'User', key: 'username', width: 15 },
              { header: 'Action', key: 'action', width: 22 },
              { header: 'Entity', key: 'entity_type', width: 15 },
              { header: 'Entity ID', key: 'entity_id', width: 10 },
              { header: 'Details', key: 'details', width: 30, formatter: (v) => typeof v === 'object' ? JSON.stringify(v) : v }
            ]
            const exportData = logs.map((l) => ({
              ...l,
              created_at: formatDateTimeNepali(l.created_at)?.en || l.created_at
            }))
            exportToExcel(exportData, cols, 'activity-log-export')
          }} style={{ flexShrink: 0 }}>
            <FileSpreadsheet size={14} /> Export
          </button>
        </div>
        <div className="card-body">
          <div className="table-responsive table-fixed-body" style={{ maxHeight: 'calc(100vh - 340px)' }}>
            <table className="txn-log-table">
              <thead>
                <tr>
                  <th style={{ width: 130 }}>Timestamp</th>
                  <th style={{ width: 80 }}>User</th>
                  <th style={{ width: 90 }}>Action</th>
                  <th style={{ width: 70 }}>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {loading ? (
                    <tr><td colSpan="5"><div className="empty-state" style={{ padding: '40px' }}>Loading...</div></td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan="5"><div className="empty-state" style={{ padding: '40px' }}>
                      <Activity size={36} className="icon" />
                      <p>No activity logs found.</p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>Activity will appear here as users interact with the system.</p>
                    </div></td></tr>
                  ) : (
                    logs.map((log, i) => {
                      const color = getActionColor(log.action)
                      const tdStyle = { fontSize: '0.75rem', color: 'var(--gray-500)', whiteSpace: 'nowrap' }
                      return (
                        <motion.tr key={log.id} custom={i} variants={rowVariants} initial="hidden" animate="visible">
                          <td style={tdStyle}>
                            <div>{formatDateTimeNepali(log.created_at)?.en || new Date(log.created_at).toLocaleString()}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--gray-400)' }}>{formatDateTimeNepali(log.created_at)?.np || ''}</div>
                          </td>
                          <td>
                            <span className="badge badge-category" style={{ fontSize: '0.68rem', padding: '2px 6px', background: 'var(--blue-pale)', color: 'var(--blue)' }}>
                              <User size={10} style={{ display: 'inline', marginRight: 2 }} />
                              {log.username}
                            </span>
                          </td>
                          <td>
                            <span className={`badge badge-${color}`} style={{ fontSize: '0.68rem', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              {getActionIcon(log.action)}
                              {getActionLabel(log.action)}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                            <span style={{ fontWeight: 500 }}>{log.entity_type}</span>
                            {log.entity_id && <span style={{ color: 'var(--gray-400)' }}> #{log.entity_id}</span>}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--gray-500)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {getDetailsSummary(log.details) || (
                              <span style={{ color: 'var(--gray-300)' }}>—</span>
                            )}
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

      {total > 0 && (
        <div className="pagination-card">
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={total}
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
          />
        </div>
      )}
    </>
  )
}
