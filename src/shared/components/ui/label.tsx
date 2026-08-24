import type { ComponentProps } from 'react'
import { cn } from '@app/shared/lib/utils'

/**
 * Renders a form field label as a block element. `<label>` is inline by
 * default, so without this it only appears stacked above narrow fields by
 * accident, whenever the field itself happens to be wide enough to force a
 * line wrap.
 */
export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      className={cn('block text-sm font-medium text-card-foreground', className)}
      {...props}
    />
  )
}
