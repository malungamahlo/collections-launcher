import { X } from 'lucide-react'
import { Button } from '@app/shared/components/ui/button'
import { cn } from '@app/shared/lib/utils'
import type { FileActionNotice } from '../hooks/use-file-resource-actions'

interface FileActionToastProps {
  readonly notice: FileActionNotice
  /** Called when the notice's button is pressed (only shown if the notice has one). */
  readonly onAction: () => void
  readonly onDismiss: () => void
}

/**
 * A short message over the bottom of the dashboard about opening or saving a
 * file — "Opening …", "Opened …", a permission to grant, a failure. Not modal:
 * the dashboard stays usable underneath. An error is announced to assistive
 * technology as an alert, anything else as a polite status.
 */
export function FileActionToast({
  notice,
  onAction,
  onDismiss,
}: FileActionToastProps) {
  return (
    <div
      role={notice.tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-lg items-center gap-3 rounded-xl border bg-card p-3 pl-4 text-sm shadow-[0_12px_30px_rgb(17_26_46_/_0.18)]',
        notice.tone === 'error' ? 'border-red-200' : 'border-border',
      )}
    >
      <p className="min-w-0 flex-1 leading-6 text-card-foreground">
        {notice.message}
      </p>

      {notice.actionLabel && (
        <Button variant="secondary" className="shrink-0" onClick={onAction}>
          {notice.actionLabel}
        </Button>
      )}

      <Button
        variant="secondary"
        className="size-9 shrink-0 px-0"
        aria-label="Dismiss"
        title="Dismiss"
        onClick={onDismiss}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}
