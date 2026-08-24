/**
 * Displays the Collections Launcher brand symbol.
 */
export function BrandMark() {
  return (
    <div
      className="grid size-11 shrink-0 gap-1 rounded-2xl bg-primary px-2.5 py-2.5 shadow-lg sm:size-12 sm:py-3"
      aria-hidden="true"
    >
      <span className="h-1 rounded-full bg-accent" />
      <span className="h-1 w-3/4 rounded-full bg-accent" />
      <span className="h-1 w-5/6 rounded-full bg-accent" />
    </div>
  )
}
