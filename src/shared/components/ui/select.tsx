import type { ComponentProps } from 'react'
import { cn } from '@app/shared/lib/utils'

/**
 * Provides shared styling and native keyboard behavior for select controls.
 */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-card-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
