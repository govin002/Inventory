import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Custom hook that warns users when they try to leave a page with unsaved changes.
 *
 * @param {boolean} isDirty - Whether there are unsaved changes
 * @returns {{ state: string, proceed: () => void, reset: () => void }}
 *
 * Usage:
 *   const blocker = useUnsavedChanges(isDirty)
 *   // Render a confirm modal when blocker.state === 'blocked'
 *   // Call blocker.proceed() to navigate away, blocker.reset() to stay
 */
export default function useUnsavedChanges(isDirty) {
  // Block SPA navigation (React Router route changes)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  )

  // Warn on page refresh / tab close
  useEffect(() => {
    if (isDirty) {
      const handler = (e) => {
        e.preventDefault()
        // Modern browsers show a generic warning regardless of returnValue
        e.returnValue = ''
      }
      window.addEventListener('beforeunload', handler)
      return () => window.removeEventListener('beforeunload', handler)
    }
  }, [isDirty])

  return blocker
}
