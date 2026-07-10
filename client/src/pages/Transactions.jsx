import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, ArrowDownCircle, ArrowUpCircle, ListOrdered, Package, ExternalLink, FileText, DollarSign } from 'lucide-react'
import StatCard from '../components/StatCard'
import { TransactionsOverTimeChart } from '../components/Charts'
import { get } from '../api'
import { formatDateNepali, formatCurrency } from '../utils'


const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { duration: 0.3, delay: i * 0.03, ease: 'easeOut' } }),
}

export default function Transactions() {
  const [chartData, setChartData] = useState({ overTime: [], totalIn: 0, totalOut: 0, totalRevenue: 0, totalBilled: 0, currency: 'USD' })
  const [loading, setLoading] = useState(true)
  const [recentTxns, setRecentTxns] = useState([])
  const [recentLoading, setRecentLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [stats, settings] = await Promise.all([
          get('/api/transactions/stats'),
          get('/api/settings').catch(() => null)
        ])
        const latestCurrency = settings?.currency || stats?.currency || 'USD'
        setChartData({ ...stats, currency: latestCurrency })
      } catch (err) {
        console.error('Failed to load chart data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()

    async function loadRecent() {
      try {
        const data = await get('/api/transactions')
        setRecentTxns(data.slice(0, 8))
      } catch (err) {
        console.error('Failed to load recent transactions:', err)
      } finally {
        setRecentLoading(false)
      }
    }
    loadRecent()
  }, [])

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Transactions</h1>
          <p>Stock in and out history</p>
        </div>
        <Link to="/transactions/add">
          <motion.button className="btn btn-primary" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Plus size={18} /> New Transaction
          </motion.button>
        </Link>
      </div>

      <div className="stats-grid">
        <StatCard icon={ListOrdered} label="Total Transactions" value={(recentTxns.length || 0).toLocaleString()} color="blue" index={0} />
        <StatCard icon={ArrowDownCircle} label="Stock In" value={(chartData.totalIn || 0).toLocaleString()} color="green" index={1} />
        <StatCard icon={ArrowUpCircle} label="Stock Out" value={(chartData.totalOut || 0).toLocaleString()} color="red" index={2} />
        <StatCard icon={DollarSign} label="Revenue (Paid)" value={formatCurrency(chartData.totalRevenue || 0, chartData.currency)} color="amber" index={3} />
      </div>

      <div className="charts-grid">
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="card-header">
            <h2>Transactions Over Time</h2>
            <div className="txn-legend">
              <span className="txn-legend-item"><span className="dot green" /> In: {(chartData.totalIn || 0).toLocaleString()}</span>
              <span className="txn-legend-item"><span className="dot red" /> Out: {(chartData.totalOut || 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="card-body chart-body">
            {loading ? (
              <div className="chart-empty">Loading chart...</div>
            ) : (
              <TransactionsOverTimeChart data={chartData.overTime || []} />
            )}
          </div>
        </motion.div>

        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <div className="card-header">
            <h2>Recent Transactions</h2>
            <Link to="/transactions/log" className="card-link">
              View All <ExternalLink size={14} />
            </Link>
          </div>
          <div className="card-body">
            {recentLoading ? (
              <div className="chart-empty">Loading...</div>
            ) : recentTxns.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px' }}>
                <Package size={32} className="icon" />
                <p>No transactions yet.</p>
              </div>
            ) : (
              <div className="txn-log-list">
                <AnimatePresence initial={false}>
                  {recentTxns.map((txn, i) => (
                    <motion.div key={txn.id} className="txn-log-item" custom={i} variants={rowVariants} initial="hidden" animate="visible">
                      <div className="txn-log-icon">
                        {txn.type === 'stock_in' ? (
                          <ArrowDownCircle size={18} className="txn-icon-in" />
                        ) : (
                          <ArrowUpCircle size={18} className="txn-icon-out" />
                        )}
                      </div>
                      <div className="txn-log-body">
                        <div className="txn-log-top">
                          <Link to={`/transactions/${txn.id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
                            <span className="table-name" style={{ fontSize: '0.82rem' }}>
                              {txn.items?.[0]?.item_name || txn.invoice_number || `Txn #${txn.id}`}
                              {txn.itemCount > 1 && <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}> +{txn.itemCount - 1} more</span>}
                            </span>
                          </Link>
                          <span className="txn-log-qty" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                            {(txn.items || []).reduce((s, i) => s + i.quantity, 0)} units
                          </span>
                        </div>
                        <div className="txn-log-flow">
                          {txn.source && <span>From: {txn.source}</span>}
                          {txn.destination && <span>To: {txn.destination}</span>}
                          {txn.customer_name && <span>Customer: {txn.customer_name}</span>}
                        </div>
                        <div className="txn-log-meta">
                          <span>{(() => { const fd = formatDateNepali(txn.date); return fd ? <><div>{fd.en}</div><div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{fd.np}</div></> : '' })()}</span>
                          {txn.invoice_number && <span className="badge badge-normal" style={{ fontSize: '0.62rem', padding: '2px 6px' }}><FileText size={10} /> {txn.invoice_number}</span>}
                          {txn.notes && <span className="txn-log-notes">{txn.notes}</span>}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      </div>

    </>
  )
}
