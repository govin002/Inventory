import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, Hash, DollarSign, AlertTriangle, ArrowRight, Calendar, RotateCcw, Clock } from 'lucide-react'
import StatCard from '../components/StatCard'
import DatePicker from '../components/DatePicker'
import { StockByCategoryChart, StockStatusPieChart } from '../components/Charts'
import { get } from '../api'
import { formatCurrency } from '../utils'

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
]

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export default function Dashboard() {
  const [stats, setStats] = useState({ totalItems: 0, totalQuantity: 0, totalValue: 0, lowStock: 0, inStock: 0, stockByCategory: [], currency: 'USD' })
  const [loading, setLoading] = useState(true)
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [quickInput, setQuickInput] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterDateFrom) params.set('date_from', filterDateFrom)
      if (filterDateTo) params.set('date_to', filterDateTo)
      const qs = params.toString()
      const url = `/api/inventory/stats${qs ? '?' + qs : ''}`

      const [statsData, settings] = await Promise.all([
        get(url),
        get('/api/settings').catch(() => null)
      ])
      const latestCurrency = settings?.currency || statsData?.currency || 'USD'
      setStats({ ...statsData, currency: latestCurrency })
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [filterDateFrom, filterDateTo])

  useEffect(() => {
    loadData()
  }, [loadData])

  function applyQuickRange(days) {
    setFilterDateFrom(daysAgo(days))
    setFilterDateTo('')
    setQuickInput(String(days))
  }

  function handleQuickInput(e) {
    const val = e.target.value
    // Only allow digits
    if (val && !/^\d+$/.test(val)) return
    setQuickInput(val)
  }

  function applyQuickInput() {
    if (quickInput) {
      const n = parseInt(quickInput, 10)
      if (n > 0 && n <= 3650) {
        setFilterDateFrom(daysAgo(n))
        setFilterDateTo('')
      }
    } else {
      clearFilters()
    }
  }

  function clearFilters() {
    setFilterDateFrom('')
    setFilterDateTo('')
    setQuickInput('')
  }

  const hasFilters = filterDateFrom || filterDateTo

  const statCards = [
    { icon: Package, label: 'Total Items', value: stats.totalItems, color: 'blue' },
    { icon: Hash, label: 'Total Quantity', value: (stats.totalQuantity || 0).toLocaleString(), color: 'green' },
    { icon: DollarSign, label: 'Total Value', value: formatCurrency(stats.totalValue || 0, stats.currency), color: 'amber' },
    { icon: AlertTriangle, label: 'Low Stock', value: stats.lowStock || 0, color: 'red' },
  ]

  const topCategories = [...(stats.stockByCategory || [])].sort((a, b) => b.quantity - a.quantity).slice(0, 5)

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of your inventory</p>
        </div>
      </div>

      {/* Date Filter Bar */}
      <motion.div
        className="dashboard-filters"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="dashboard-filters-inner">
          {/* Quick range input */}
          <div className="filter-group dash-filter-quick">
            <Clock size={15} className="filter-icon" />
            <input
              type="text"
              className="dash-quick-input"
              placeholder="Days"
              value={quickInput}
              onChange={handleQuickInput}
              onKeyDown={(e) => { if (e.key === 'Enter') applyQuickInput() }}
              onBlur={applyQuickInput}
              maxLength={4}
              title="Enter number of days back. Press Enter or click away to apply."
            />
            <span className="dash-quick-suffix">days back</span>
          </div>

          {/* Preset chips */}
          <div className="dash-presets">
            {PRESETS.map((p) => (
              <motion.button
                key={p.days}
                className={`dash-preset-chip ${quickInput === String(p.days) ? 'active' : ''}`}
                onClick={() => applyQuickRange(p.days)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {p.label}
              </motion.button>
            ))}
          </div>

          <div className="dash-filter-divider" />

          {/* Date pickers */}
          <div className="filter-group">
            <Calendar size={16} className="filter-icon" />
            <span className="filter-label">From</span>
            <DatePicker value={filterDateFrom} onChange={(v) => { setFilterDateFrom(v); setQuickInput('') }} />
          </div>
          <div className="filter-group">
            <span className="filter-label">To</span>
            <DatePicker value={filterDateTo} onChange={(v) => { setFilterDateTo(v); setQuickInput('') }} />
          </div>

          {/* Clear button — always visible when there's any filter */}
          {hasFilters && (
            <motion.button
              className="dash-clear-btn"
              onClick={clearFilters}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              title="Clear all filters"
            >
              <RotateCcw size={13} /> Reset
            </motion.button>
          )}
        </div>
        {loading && (
          <div className="dashboard-filters-loading">
            <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            <span>Updating...</span>
          </div>
        )}
      </motion.div>

      <div className="stats-grid">
        {statCards.map((card, i) => (
          <StatCard key={card.label} {...card} index={i} />
        ))}
      </div>

      <div className="charts-grid">
        <motion.div className="card chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
          <div className="card-header">
            <h2>Stock by Category</h2>
            <Link to="/inventory" className="card-link">View All <ArrowRight size={14} /></Link>
          </div>
          <div className="card-body chart-body">
            <StockByCategoryChart data={topCategories} />
          </div>
        </motion.div>

        <motion.div className="card chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <div className="card-header">
            <h2>Stock Status</h2>
          </div>
          <div className="card-body chart-body">
            <StockStatusPieChart inStock={stats.inStock} lowStock={stats.lowStock} />
          </div>
        </motion.div>
      </div>
    </>
  )
}
