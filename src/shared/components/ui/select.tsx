import type { ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@app/shared/lib/utils'

/**
 * Provides shared styling and native keyboard behavior for select controls.
 */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
      <select
        className={cn(
          'h-10 w-full appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm text-card-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}
