import { motion } from 'framer-motion'

export default function StatCard({ icon: Icon, label, value, color, index }) {
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
      whileHover={{ y: -3, boxShadow: '0 10px 20px rgba(0,0,0,0.08)' }}
    >
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        <div className={`stat-icon ${color}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="stat-value">{value}</div>
    </motion.div>
  )
}
