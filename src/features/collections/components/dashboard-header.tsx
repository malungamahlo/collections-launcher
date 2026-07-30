import { BrandMark } from '@app/shared/components/brand-mark'

/**
 * Introduces the dashboard and communicates its local-first behavior.
 */
export function DashboardHeader() {
  return (
    <header className="flex flex-col gap-6 border-b border-border pb-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <BrandMark />

        <div>
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

      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
        <span className="size-2 rounded-full bg-emerald-500" />
        Stored on this device
      </div>
    </header>
  )
}
