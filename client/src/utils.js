import NepaliDate from 'nepali-date'
import * as XLSX from 'xlsx'

/**
 * Currency code → display data mapping.
 * Add new currencies here and they'll appear in the settings dropdown.
 */
export const CURRENCY_MAP = {
  USD: { symbol: '$', code: 'USD', name: 'US Dollar' },
  NPR: { symbol: 'रु', code: 'NPR', name: 'Nepalese Rupee' },
  INR: { symbol: '₹', code: 'INR', name: 'Indian Rupee' },
  EUR: { symbol: '€', code: 'EUR', name: 'Euro' },
  GBP: { symbol: '£', code: 'GBP', name: 'British Pound' },
  CAD: { symbol: 'C$', code: 'CAD', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', code: 'AUD', name: 'Australian Dollar' },
  JPY: { symbol: '¥', code: 'JPY', name: 'Japanese Yen' },
  CNY: { symbol: '¥', code: 'CNY', name: 'Chinese Yuan' },
  CHF: { symbol: 'Fr.', code: 'CHF', name: 'Swiss Franc' },
  NZD: { symbol: 'NZ$', code: 'NZD', name: 'New Zealand Dollar' },
  KRW: { symbol: '₩', code: 'KRW', name: 'South Korean Won' },
  SEK: { symbol: 'kr', code: 'SEK', name: 'Swedish Krona' },
  NOK: { symbol: 'kr', code: 'NOK', name: 'Norwegian Krone' },
  DKK: { symbol: 'kr', code: 'DKK', name: 'Danish Krone' },
  PKR: { symbol: '₨', code: 'PKR', name: 'Pakistani Rupee' },
  BDT: { symbol: '৳', code: 'BDT', name: 'Bangladeshi Taka' },
  LKR: { symbol: '₨', code: 'LKR', name: 'Sri Lankan Rupee' },
}

/**
 * Format a number amount with the given currency code.
 * @param {number} amount
 * @param {string} currencyCode - e.g. 'USD', 'NPR', 'EUR' (defaults to 'USD')
 * @returns {string} e.g. "$1,234.56" or "Rs. 1,234.56"
 */
export function formatCurrency(amount, currencyCode = 'USD') {
  const currency = CURRENCY_MAP[currencyCode] || CURRENCY_MAP.USD
  const formatted = Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  // JPY and KRW don't use decimals typically, but we keep 2 for consistency
  // Add a space after dot-ended symbols (e.g. "Rs. 1,234") and non-dot symbols (e.g. "$ 1,234")
  return `${currency.symbol} ${formatted}`.trim()
}

const nepaliMonths = [
  'Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Aswin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
]

/**
 * Format a date string showing both English (AD) and Nepali (BS) dates.
 * English: "Jan 15, 2025"
 * Nepali: "2081 Poush 15"
 */
export function formatDateNepali(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return isoStr

  // English format
  const en = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  // Nepali format
  const nd = new NepaliDate(d)
  const bsYear = nd.getYear()
  const bsMonth = nepaliMonths[nd.getMonth()]
  const bsDay = nd.getDate()

  return { en, np: `${bsYear} ${bsMonth} ${bsDay}` }
}

/**
 * Format a date string showing both English and Nepali dates with time.
 * English: "Jan 15, 2025, 02:30 PM"
 * Nepali: "2081 Poush 15"
 */
export function formatDateTimeNepali(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return isoStr

  // English format with time
  const en = d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  // Nepali format
  const nd = new NepaliDate(d)
  const bsYear = nd.getYear()
  const bsMonth = nepaliMonths[nd.getMonth()]
  const bsDay = nd.getDate()

  return { en, np: `${bsYear} ${bsMonth} ${bsDay}` }
}

/**
 * Export an array of objects to an Excel (.xlsx) file and trigger download.
 * @param {Array} data - Array of row objects
 * @param {Array} columns - Column definitions [{ header: 'Name', key: 'name', width: 20 }]
 * @param {string} filename - Output filename (without extension)
 */
export function exportToExcel(data, columns, filename) {
  const wsData = [
    columns.map((c) => c.header),
    ...data.map((row) => columns.map((c) => {
      const val = c.formatter ? c.formatter(row[c.key], row) : row[c.key]
      return val !== undefined && val !== null ? val : ''
    }))
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Set column widths
  ws['!cols'] = columns.map((c) => ({ wch: c.width || 15 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
