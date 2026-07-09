import { NepaliDatePicker } from '@etpl/nepali-datepicker'
import '@etpl/nepali-datepicker/styles'

export default function DatePicker({ value, onChange, label, required }) {
  // Convert ISO string to DualDateValue for the picker
  const pickerValue = value
    ? { ad: new Date(value + 'T00:00:00') }
    : null

  function handleChange(val) {
    if (!val) {
      onChange('')
      return
    }
    // Extract AD date and format as ISO string
    const ad = val.ad
    if (ad && !isNaN(ad.getTime())) {
      onChange(ad.toISOString().split('T')[0])
    }
  }

  return (
    <div>
      {label && <label className="date-picker-label">{label}</label>}
      <NepaliDatePicker
        value={pickerValue}
        onChange={handleChange}
        calendarSystem="BS"
        language="en"
        showCalendarSystemToggle
        variant="dropdown"
        format="YYYY/MM/DD"
        placeholder="Select date..."
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
