import { BrandMark } from '@app/shared/components/brand-mark'

interface DashboardHeaderProps {
  readonly isDevelopmentPreview?: boolean
}

/**
 * Introduces the dashboard and identifies whether it shows stored or sample data.
 */
export function DashboardHeader({
  isDevelopmentPreview = false,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b border-border pb-6 sm:pb-8 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <BrandMark />

        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.16em] text-accent uppercase">
            Collections Launcher
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Your collections
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Everything you need, grouped by purpose and ready to launch.
          </p>
        </div>
      </div>

      <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
        <span
          aria-hidden="true"
          className={`size-2 rounded-full ${
            isDevelopmentPreview ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
        />
        {isDevelopmentPreview
          ? 'Development preview'
          : 'Stored on this device'}
      </div>
    </header>
  )
}
