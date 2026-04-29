'use client'

import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Modal confirm dialog styled to match the rest of the app. Wraps the
// native <dialog> element, which gives us focus trapping, ESC-to-close,
// and a backdrop "for free." Use destructive=true to color the confirm
// button seal-red (e.g. delete actions).
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      className="bg-transparent p-0 backdrop:bg-black/40"
    >
      <div className="bg-paper border border-[color:var(--border-soft)] rounded-lg shadow-lg p-6 max-w-sm w-full">
        {title ? (
          <h2 className="font-serif-content text-lg mb-2">{title}</h2>
        ) : null}
        <p className="text-sm text-ink leading-relaxed mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="bg-paper-warm border border-[color:var(--border-soft)] text-ink px-4 py-1.5 rounded-md text-sm hover:bg-white transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              destructive
                ? 'bg-seal text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-black transition-colors'
                : 'bg-ink text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-black transition-colors'
            }
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
