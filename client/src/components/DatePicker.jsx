import { useMemo } from 'react'
import { NepaliDatePicker, getNepaliToday, makeDualDateValueFromAd } from '@etpl/nepali-datepicker'
import '@etpl/nepali-datepicker/styles'

export default function DatePicker({ value, onChange, label, required }) {
  // Today's BS date as NepDate ({ year, month, day }) for maxDate constraint
  const todayNepDate = useMemo(() => getNepaliToday(), [])

  // Convert ISO string (e.g. "2024-07-30") to proper DualDateValue for the picker
  const pickerValue = useMemo(() => {
    if (!value) return null
    const d = new Date(value + 'T00:00:00')
    if (isNaN(d.getTime())) return null
    return makeDualDateValueFromAd(d)
  }, [value])

  function handleChange(val) {
    if (!val) {
      onChange('')
      return
    }
    const ad = val.ad
    if (ad && !isNaN(ad.getTime())) {
      onChange(ad.toISOString().split('T')[0])
    }
  }

  return (
    <div className="date-picker">
      {label && <label className="date-picker-label">{label}</label>}
      <NepaliDatePicker
        value={pickerValue}
        onChange={handleChange}
        calendarSystem="BS"
        language="en"
        showCalendarSystemToggle
        variant="dropdown"
        format="YYYY-MM-DD"
        placeholder="Select date..."
        maxDate={todayNepDate}
      />
      {required && (
        <input
          type="hidden"
          value={value || ''}
          required
          tabIndex={-1}
          onChange={() => {}}
        />
      )}
    </div>
  )
}