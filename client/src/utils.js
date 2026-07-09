import NepaliDate from 'nepali-date'
import * as XLSX from 'xlsx'

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
