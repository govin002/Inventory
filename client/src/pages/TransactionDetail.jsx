import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Printer, CheckCircle2, RotateCcw, Package } from 'lucide-react'
import { get, patch } from '../api'
import { useToast } from '../components/ToastContext'
import ConfirmModal from '../components/ConfirmModal'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../utils'

export default function TransactionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const [txn, setTxn] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statusConfirm, setStatusConfirm] = useState(null)

  useEffect(() => {
    Promise.all([
      get(`/api/transactions/${id}`),
      get('/api/settings')
    ]).then(([t, s]) => {
      setTxn(t)
      setSettings(s)
    }).catch(() => navigate('/transactions'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  function handlePrint() {
    window.print()
  }

  async function handleStatusChange(newStatus) {
    try {
      await patch(`/api/transactions/${id}/status`, { status: newStatus })
      setTxn((prev) => ({ ...prev, status: newStatus }))
      showToast(newStatus === 'paid' ? 'Marked as paid' : 'Marked as unpaid', { variant: 'success' })
    } catch (err) {
      showToast('Failed to update status', { variant: 'error' })
    } finally {
      setStatusConfirm(null)
    }
  }

  // Default invoice settings (used when settings haven't been saved yet)
  const DEFAULT_INVOICE_SETTINGS = {
    showSN: true,
    showCompanyPhone: true,
    showCompanyEmail: true,
    showCompanyAddress: true,
    showStatusBadge: true,
    showItemCount: true,
    showBatchColumn: true,
    showUnitPrice: true,
    showLineTotal: true,
    showSubtotal: true,
    showTax: true,
    showNotes: true,
    compactMode: false,
    footerText: ''
  }

  const invSettings = { ...DEFAULT_INVOICE_SETTINGS, ...(settings?.invoiceSettings || {}) }

  if (loading) return <div className="empty-state">Loading...</div>
  if (!txn) return <div className="empty-state">Transaction not found.</div>

  const isBilled = !!txn.invoice_number

  return (
    <>
      <div className="page-header no-print" style={{ marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: '1rem' }}>
            {isBilled ? txn.invoice_number : `Transaction #${txn.id}`}
          </h1>
          <p style={{ fontSize: '0.5rem' }}>
            {txn.type === 'stock_in' ? 'Stock In' : 'Stock Out'}
            {isBilled ? ` — ${txn.customer_name}` : ''}
            {txn.itemCount > 1 ? ` — ${txn.itemCount} items` : ''}
          </p>
        </div>
        <div className="header-actions">
          <motion.button className="btn btn-secondary btn-sm" onClick={() => navigate('/transactions')}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            style={{ padding: '5px 10px', fontSize: '0.75rem', minHeight: 28 }}>
            <ArrowLeft size={14} /> Back
          </motion.button>
          {isBilled && txn.status !== 'paid' && (
            <motion.button className="btn btn-primary btn-sm"
              onClick={() => setStatusConfirm('paid')}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              style={{ padding: '5px 10px', fontSize: '0.75rem', minHeight: 28 }}>
              <CheckCircle2 size={14} /> Mark as Paid
            </motion.button>
          )}
          {isBilled && txn.status === 'paid' && (
            <motion.button className="btn btn-secondary btn-sm"
              onClick={() => setStatusConfirm('unpaid')}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              style={{ padding: '5px 10px', fontSize: '0.75rem', minHeight: 28 }}>
              <RotateCcw size={14} /> Mark as Unpaid
            </motion.button>
          )}
          <motion.button className="btn btn-primary btn-sm" onClick={handlePrint}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            style={{ padding: '5px 10px', fontSize: '0.75rem', minHeight: 28 }}>
            <Printer size={14} /> Print
          </motion.button>
        </div>
      </div>

      <motion.div className="card invoice-print" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="invoice-scrollable">
        <div className="invoice-header">
          <div className="invoice-brand">
            <h2>{settings?.companyName || 'Company Name'}</h2>
            {invSettings.showCompanyAddress && <p>{settings?.companyAddress || ''}</p>}
            {invSettings.showCompanyPhone && settings?.companyPhone && <p>Phone: {settings.companyPhone}</p>}
            {invSettings.showCompanyEmail && settings?.companyEmail && <p>Email: {settings.companyEmail}</p>}
          </div>
          <div className="invoice-meta">
            <h2 className="invoice-title">
              {isBilled ? (txn.type === 'stock_out' ? 'INVOICE' : 'PURCHASE BILL') : (txn.type === 'stock_in' ? 'STOCK IN' : 'STOCK OUT')}
            </h2>
            <table className="invoice-meta-table">
              <tbody>
                {isBilled && <tr><td className="meta-label">Invoice #</td><td className="meta-value">{txn.invoice_number}</td></tr>}
                <tr><td className="meta-label">Date</td><td className="meta-value">{txn.date}</td></tr>
                {isBilled && <tr><td className="meta-label">Customer</td><td className="meta-value">{txn.customer_name}</td></tr>}
                {!isBilled && txn.source && <tr><td className="meta-label">Source</td><td className="meta-value">{txn.source}</td></tr>}
                {!isBilled && txn.destination && <tr><td className="meta-label">Destination</td><td className="meta-value">{txn.destination}</td></tr>}
                {invSettings.showItemCount && <tr><td className="meta-label">Items</td><td className="meta-value">{txn.itemCount}</td></tr>}
                {isBilled && invSettings.showStatusBadge && (
                  <tr><td className="meta-label">Status</td>
                    <td className="meta-value">
                      <span className={`badge ${txn.status === 'paid' ? 'badge-normal' : txn.status === 'cancelled' ? 'badge-low' : 'badge-category'}`}>
                        {txn.status ? txn.status.charAt(0).toUpperCase() + txn.status.slice(1) : 'Unpaid'}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="invoice-divider" />

        <table className="invoice-items-table">
          <thead>
            <tr>
              {invSettings.showSN && <th style={{ textAlign: 'center', width: 40 }}>#</th>}
              <th style={{ textAlign: 'left' }}>Item</th>
              {txn.items?.some((i) => i.batch_number) && invSettings.showBatchColumn && <th style={{ textAlign: 'left' }}>Batch</th>}
              <th style={{ textAlign: 'center', width: 80 }}>Quantity</th>
              {isBilled && invSettings.showUnitPrice && <th style={{ textAlign: 'right', width: 100 }}>Unit Price</th>}
              {isBilled && invSettings.showLineTotal && <th style={{ textAlign: 'right', width: 100 }}>Total</th>}
            </tr>
          </thead>
          <tbody>
            {txn.items?.map((item, i) => (
              <tr key={i}>
                {invSettings.showSN && <td style={{ textAlign: 'center', color: 'var(--gray-500)', fontSize: '0.7rem' }}>{i + 1}</td>}
                <td>
                  <Link to={`/inventory/${item.item_id}`} style={{ textDecoration: 'none', color: 'inherit', fontWeight: 500 }}>
                    {item.item_name}
                  </Link>
                </td>
                {txn.items?.some((i) => i.batch_number) && invSettings.showBatchColumn && (
                  <td style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                    {item.batch_number || <span style={{ color: 'var(--gray-300)' }}>—</span>}
                    {item.expiry_date && <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)', display: 'block' }}>Exp: {item.expiry_date}</span>}
                  </td>
                )}
                <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                {isBilled && invSettings.showUnitPrice && <td style={{ textAlign: 'right' }}>{formatCurrency(item.unit_price, settings?.currency)}</td>}
                {isBilled && invSettings.showLineTotal && <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.quantity * item.unit_price, settings?.currency)}</td>}
              </tr>
            ))}
          </tbody>
        </table>

        {isBilled && (
          <div className="invoice-totals">
            {invSettings.showSubtotal && <div className="invoice-total-row"><span>Subtotal</span><span>{formatCurrency(txn.subtotal, settings?.currency)}</span></div>}
            {invSettings.showTax && <div className="invoice-total-row"><span>Tax</span><span>{formatCurrency(txn.tax, settings?.currency)}</span></div>}
            <div className="invoice-total-row invoice-total-grand"><span>Total</span><span>{formatCurrency(txn.total, settings?.currency)}</span></div>
          </div>
        )}

        {!isBilled && txn.items && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--gray-500)', fontSize: '0.85rem' }}>
            <Package size={24} style={{ display: 'inline', marginBottom: 4, opacity: 0.5 }} />
            <p>Simple stock movement — no financial tracking</p>
          </div>
        )}

        {txn.notes && invSettings.showNotes && (
          <div className="invoice-notes">
            <strong>Notes:</strong>
            <p>{txn.notes}</p>
          </div>
        )}

        {invSettings.footerText && (
          <div style={{ marginTop: 12, padding: '8px 0', textAlign: 'center', fontSize: '0.78rem', color: 'var(--gray-500)', borderTop: '1px solid var(--gray-100)' }}>
            {invSettings.footerText}
          </div>
        )}
        </div>{/* end invoice-scrollable */}
      </motion.div>

      <ConfirmModal
        open={statusConfirm !== null}
        title={statusConfirm === 'paid' ? 'Mark as Paid' : 'Mark as Unpaid'}
        message={statusConfirm === 'paid'
          ? 'Are you sure you want to mark this invoice as paid?'
          : 'Are you sure you want to mark this invoice as unpaid?'}
        confirmLabel={statusConfirm === 'paid' ? 'Mark as Paid' : 'Mark as Unpaid'}
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={() => handleStatusChange(statusConfirm)}
        onCancel={() => setStatusConfirm(null)}
      />
    </>
  )
}
