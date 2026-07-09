import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Upload, X } from 'lucide-react'

export default function ImageUpload({ value, onChange }) {
  const [preview, setPreview] = useState(value || '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef()

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return

    setError('')
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)

    const formData = new FormData()
    formData.append('image', file)

    try {
      setUploading(true)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      onChange(data.url)
      setPreview(data.url)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  function handleRemove() {
    setPreview('')
    onChange('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="image-upload">
      {preview ? (
        <div className="image-preview">
          <img src={preview} alt="Product" />
          <motion.button
            type="button"
            className="image-remove"
            onClick={handleRemove}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X size={16} />
          </motion.button>
        </div>
      ) : (
        <div className="image-dropzone" onClick={() => inputRef.current?.click()}>
          <Upload size={24} className="upload-icon" />
          <p>{uploading ? 'Uploading...' : 'Click to upload image'}</p>
          <span>JPG, PNG, GIF, WEBP (max 5MB)</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
      {error && <p className="error-msg">{error}</p>}
    </div>
  )
}
