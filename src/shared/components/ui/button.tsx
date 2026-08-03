import type { ComponentProps } from 'react'
import { cn } from '@app/shared/lib/utils'

type ButtonVariant = 'primary' | 'secondary'

interface ButtonProps extends ComponentProps<'button'> {
  readonly variant?: ButtonVariant
}

/**
 * Provides a consistent accessible action button without a runtime UI library.
 */
export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary'
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border border-border bg-card text-card-foreground hover:bg-muted',
        className,
      )}
      {...props}
    />
  )
}
