import { useRef, useLayoutEffect, useCallback, useState } from 'react'
import { motion } from 'framer-motion'

export default function StatCard({ icon: Icon, label, value, color, index }) {
  const valueRef = useRef(null)
  const [fontSize, setFontSize] = useState(null)

  const measureAndFit = useCallback(() => {
    const el = valueRef.current
    if (!el) return

    const container = el.closest('.stat-card')
    if (!container) return

    // Available width for the value text (account for padding)
    const containerWidth = container.clientWidth - 28

    // Use the element's own computed font (respects media queries & CSS)
    // so max size adapts to the current viewport/card width
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.font = getComputedStyle(el).font

    const text = String(value)
    const textWidth = ctx.measureText(text).width

    // Parse the CSS-computed font size (in px) as the baseline max
    const cssFontPx = parseFloat(getComputedStyle(el).fontSize) || 29.6
    const maxFontPx = cssFontPx
    const minFontPx = 10

    // Scale to fit within the container width, never exceeding the CSS max
    const ratio = (containerWidth - 4) / Math.max(textWidth, 1)
    let computed = maxFontPx * Math.min(1, ratio)
    computed = Math.max(minFontPx, Math.min(maxFontPx, computed))

    setFontSize(Math.round(computed * 10) / 10)
  }, [value])

  useLayoutEffect(() => {
    measureAndFit()
  }, [measureAndFit])

  // Re-fit whenever the container resizes (window resize, sidebar toggle, etc.)
  useLayoutEffect(() => {
    const el = valueRef.current
    if (!el) return
    const container = el.closest('.stat-card')
    if (!container) return

    const observer = new ResizeObserver(measureAndFit)
    observer.observe(container)
    return () => observer.disconnect()
  }, [measureAndFit])

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
      <div
        ref={valueRef}
        className="stat-value"
        style={fontSize ? { fontSize: `${fontSize}px` } : undefined}
        title={String(value)}
      >
        {value}
      </div>
    </motion.div>
  )
}
