/**
 * Displays the Collections Launcher brand symbol.
 */
export function BrandMark() {
  return (
    <div
      className="grid size-12 gap-1 rounded-2xl bg-primary px-2.5 py-3 shadow-lg"
      aria-hidden="true"
    >
      <span className="h-1 rounded-full bg-accent" />
      <span className="h-1 w-3/4 rounded-full bg-accent" />
      <span className="h-1 w-5/6 rounded-full bg-accent" />
    </div>
  )
}
