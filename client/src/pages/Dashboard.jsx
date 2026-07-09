import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, Hash, DollarSign, AlertTriangle, ArrowRight } from 'lucide-react'
import StatCard from '../components/StatCard'
import { StockByCategoryChart, StockStatusPieChart } from '../components/Charts'
import { get } from '../api'

function formatCurrency(value) {
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Dashboard() {
  const [stats, setStats] = useState({ totalItems: 0, totalQuantity: 0, totalValue: 0, lowStock: 0, inStock: 0, stockByCategory: [] })
  const [loading, setLoading] = useState(true)

  async function loadData() {
    try {
      const statsData = await get('/api/inventory/stats')
      setStats(statsData)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const statCards = [
    { icon: Package, label: 'Total Items', value: stats.totalItems, color: 'blue' },
    { icon: Hash, label: 'Total Quantity', value: (stats.totalQuantity || 0).toLocaleString(), color: 'green' },
    { icon: DollarSign, label: 'Total Value', value: formatCurrency(stats.totalValue || 0), color: 'amber' },
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
