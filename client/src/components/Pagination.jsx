import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function buildPagination(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  if (current > 3) pages.push('...')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  perPage,
  onPageChange,
  onPerPageChange
}) {
  if (totalItems === 0) return null

  const safePage = Math.min(page, totalPages)
  const from = (safePage - 1) * perPage + 1
  const to = Math.min(safePage * perPage, totalItems)

  return (
    <div className="pagination">
      <div className="pagination-info">
        Showing {from}–{to} of {totalItems}
      </div>
      <div className="pagination-controls">
        <select
          value={perPage}
          onChange={(e) => { onPerPageChange(Number(e.target.value)); onPageChange(1) }}
          className="per-page-select"
        >
          <option value={10}>10 / page</option>
          <option value={15}>15 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
        <motion.button
          className="icon-btn"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          whileTap={{ scale: 0.9 }}
        >
          <ChevronLeft size={16} />
        </motion.button>
        {buildPagination(safePage, totalPages).map((p, idx) =>
          p === '...' ? (
            <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
          ) : (
            <motion.button
              key={p}
              className={`page-btn ${p === safePage ? 'active' : ''}`}
              onClick={() => onPageChange(p)}
              whileTap={{ scale: 0.9 }}
            >
              {p}
            </motion.button>
          )
        )}
        <motion.button
          className="icon-btn"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          whileTap={{ scale: 0.9 }}
        >
          <ChevronRight size={16} />
        </motion.button>
      </div>
    </div>
  )
}
