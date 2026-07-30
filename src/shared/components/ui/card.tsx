import type { ComponentProps } from 'react'
import { cn } from '@app/shared/lib/utils'

/**
 * Provides the shared visual surface used by dashboard cards.
 */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Provides consistent spacing for a card heading.
 */
export function CardHeader({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col gap-1.5 p-5', className)}
      {...props}
    />
  )
}

/**
 * Provides consistent spacing for card content.
 */
export function CardContent({
  className,
  ...props
}: ComponentProps<'div'>) {
  return <div className={cn('px-5 pb-5', className)} {...props} />
}
