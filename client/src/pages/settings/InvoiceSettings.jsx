import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, LoaderCircle, AlertCircle, FileText, Hash, Building2, BadgeCheck, Package, Receipt, DollarSign, Notebook, LayoutGrid } from 'lucide-react'
import { get, put } from '../../api'
import { useToast } from '../../components/ToastContext'

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

export default function InvoiceSettings() {
  const showToast = useToast()
  const [invoiceSettings, setInvoiceSettings] = useState(DEFAULT_INVOICE_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle')
  const saveTimer = useRef(null)

  useEffect(() => {
    get('/api/settings').then((s) => {
      if (s?.invoiceSettings) {
        setInvoiceSettings({ ...DEFAULT_INVOICE_SETTINGS, ...s.invoiceSettings })
      }
    }).finally(() => setLoading(false))
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  async function saveNow(nextSettings) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    try {
      const current = await get('/api/settings')
      await put('/api/settings', { ...current, invoiceSettings: nextSettings })
      setInvoiceSettings(nextSettings)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 1500)
    } catch (err) {
      setSaveStatus('error')
      showToast('Failed to save invoice settings', { variant: 'error' })
      setTimeout(() => setSaveStatus((s) => s === 'error' ? 'idle' : s), 3000)
    }
  }

  function toggle(field) {
    const next = { ...invoiceSettings, [field]: !invoiceSettings[field] }
    setInvoiceSettings(next)
    saveNow(next)
  }

  function updateFooterText(value) {
    const next = { ...invoiceSettings, footerText: value }
    setInvoiceSettings(next)
    // Debounce save for text input
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        const current = await get('/api/settings')
        await put('/api/settings', { ...current, invoiceSettings: next })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 1500)
      } catch (err) {
        setSaveStatus('error')
        showToast('Failed to save', { variant: 'error' })
        setTimeout(() => setSaveStatus((s) => s === 'error' ? 'idle' : s), 3000)
      }
    }, 600)
  }

  if (loading) return <div className="empty-state">Loading...</div>

  return (
    <>
      <div className="settings-section-header">
        <h2>Invoice Settings</h2>
        <SaveIndicator status={saveStatus} />
      </div>

      {/* Header Section */}
      <div className="settings-form-card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={16} /> Header
        </h3>
        <p className="settings-description">Control what appears in the company and meta section of the invoice</p>
        <ToggleGrid>
          <ToggleItem icon={Building2} label="Company phone" checked={invoiceSettings.showCompanyPhone}
            onChange={() => toggle('showCompanyPhone')} />
          <ToggleItem icon={Building2} label="Company email" checked={invoiceSettings.showCompanyEmail}
            onChange={() => toggle('showCompanyEmail')} />
          <ToggleItem icon={Building2} label="Company address" checked={invoiceSettings.showCompanyAddress}
            onChange={() => toggle('showCompanyAddress')} />
          <ToggleItem icon={BadgeCheck} label="Status badge" checked={invoiceSettings.showStatusBadge}
            onChange={() => toggle('showStatusBadge')} />
          <ToggleItem icon={Package} label="Item count in header" checked={invoiceSettings.showItemCount}
            onChange={() => toggle('showItemCount')} />
        </ToggleGrid>
      </div>

      {/* Table Columns */}
      <div className="settings-form-card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LayoutGrid size={16} /> Table Columns
        </h3>
        <p className="settings-description">Choose which columns to display in the items table</p>
        <ToggleGrid>
          <ToggleItem icon={Hash} label="Serial number (#) column" checked={invoiceSettings.showSN}
            onChange={() => toggle('showSN')} />
          <ToggleItem icon={Package} label="Batch number column" checked={invoiceSettings.showBatchColumn}
            onChange={() => toggle('showBatchColumn')} />
          <ToggleItem icon={DollarSign} label="Unit price column" checked={invoiceSettings.showUnitPrice}
            onChange={() => toggle('showUnitPrice')} />
          <ToggleItem icon={Receipt} label="Line total column" checked={invoiceSettings.showLineTotal}
            onChange={() => toggle('showLineTotal')} />
        </ToggleGrid>
      </div>

      {/* Footer Section */}
      <div className="settings-form-card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Receipt size={16} /> Footer & Totals
        </h3>
        <p className="settings-description">Control the totals breakdown and notes visibility</p>
        <ToggleGrid>
          <ToggleItem icon={DollarSign} label="Show subtotal" checked={invoiceSettings.showSubtotal}
            onChange={() => toggle('showSubtotal')} />
          <ToggleItem icon={DollarSign} label="Show tax" checked={invoiceSettings.showTax}
            onChange={() => toggle('showTax')} />
          <ToggleItem icon={Notebook} label="Show notes section" checked={invoiceSettings.showNotes}
            onChange={() => toggle('showNotes')} />
        </ToggleGrid>
      </div>

      {/* Footer Text */}
      <div className="settings-form-card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={16} /> Custom Footer Text
        </h3>
        <p className="settings-description">Optional text displayed at the bottom of every invoice (e.g. "Thank you for your business!")</p>
        <div className="form-group">
          <input
            type="text"
            value={invoiceSettings.footerText}
            onChange={(e) => updateFooterText(e.target.value)}
            placeholder="e.g. Thank you for your business!"
            style={{ minHeight: 36, fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Compact Mode (future) */}
      <div className="settings-form-card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LayoutGrid size={16} /> Appearance
        </h3>
        <ToggleGrid>
          <ToggleItem icon={LayoutGrid} label="Compact mode (tighter spacing)" checked={invoiceSettings.compactMode}
            onChange={() => toggle('compactMode')} />
        </ToggleGrid>
      </div>
    </>
  )
}

/** A grid of toggle checkboxes */
function ToggleGrid({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
      {children}
    </div>
  )
}

/** A single toggle checkbox item */
function ToggleItem({ icon: Icon, label, checked, onChange }) {
  return (
    <label className="checkbox-label" style={{ cursor: 'pointer', padding: '10px 14px' }}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
        <Icon size={14} style={{ opacity: 0.6 }} />
        {label}
      </span>
    </label>
  )
}

function SaveIndicator({ status }) {
  if (status === 'idle') return null
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 500 }}
    >
      {status === 'saving' && <><LoaderCircle size={14} className="spin" /> Saving…</>}
      {status === 'saved' && <><CheckCircle size={14} style={{ color: 'var(--green)' }} /> Saved</>}
      {status === 'error' && <><AlertCircle size={14} style={{ color: 'var(--red)' }} /> Save failed</>}
    </motion.span>
  )
}
