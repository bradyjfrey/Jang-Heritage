import { useEffect, useRef } from 'react'

// Debounced save: triggers `onSave(value)` after `delay` ms of no changes.
// `flushRef.current()` exposes a way to save immediately (call on blur,
// Cmd+S, or beforeunload).
//
// `lastSavedRef` tracks the last value handed off to onSave so we don't
// fire spurious saves when state cycles back to a previously-saved value
// (e.g. the user re-enters the same text).
export function useAutosave<T>({
  value,
  onSave,
  delay = 3000,
  flushRef,
}: {
  value: T
  onSave: (value: T) => void | Promise<void>
  delay?: number
  flushRef?: React.MutableRefObject<(() => void) | null>
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef(value)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  useEffect(() => {
    if (Object.is(value, lastSavedRef.current)) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      lastSavedRef.current = value
      onSaveRef.current(value)
    }, delay)

    if (flushRef) {
      flushRef.current = () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        if (Object.is(value, lastSavedRef.current)) return
        lastSavedRef.current = value
        onSaveRef.current(value)
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value, delay, flushRef])
}
