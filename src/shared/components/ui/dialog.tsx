import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react'

interface DialogProps {
  readonly title: string
  readonly description?: string
  readonly children: ReactNode
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>
  readonly onClose: () => void
}

/**
 * Displays content in the browser's native modal dialog without a UI runtime.
 */
export function Dialog({
  title,
  description,
  children,
  fallbackFocusRef,
  onClose,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocusElementRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  )
  const focusRestorationControllerRef = useRef<AbortController | undefined>(
    undefined,
  )
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const returnFocusElement = returnFocusElementRef.current
    const fallbackFocusElement = fallbackFocusRef?.current
    const restorationController = new AbortController()

    focusRestorationControllerRef.current?.abort()
    focusRestorationControllerRef.current = restorationController

    if (dialog && !dialog.open) {
      dialog.showModal()
    }

    return () => {
      if (dialog?.open) {
        dialog.close()
      }

      queueMicrotask(() => {
        if (restorationController.signal.aborted) {
          return
        }

        const focusTarget = returnFocusElement?.isConnected
          ? returnFocusElement
          : fallbackFocusElement

        focusTarget?.focus()
      })
    }
  }, [fallbackFocusRef])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-[2px]"
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="p-5 sm:p-6">
        <div className="mb-5">
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>
          {description && (
            <p
              id={descriptionId}
              className="mt-2 text-sm leading-6 text-muted-foreground"
            >
              {description}
            </p>
          )}
        </div>

        {children}
      </div>
    </dialog>
  )
}
