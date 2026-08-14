import { SearchX } from 'lucide-react'
import { Card } from '@app/shared/components/ui/card'

interface NoSearchResultsEmptyStateProps {
  readonly query: string
}

/**
 * Explains that no collection or website matches the current search.
 */
export function NoSearchResultsEmptyState({
  query,
}: NoSearchResultsEmptyStateProps) {
  return (
    <Card className="mt-6 border-dashed px-4 py-10 text-center shadow-none sm:px-6 sm:py-14">
      <span
        className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <SearchX className="size-6" />
      </span>

      <h3 className="mt-4 text-lg font-semibold text-card-foreground">
        No results for &ldquo;{query}&rdquo;
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Try a different collection name, website name, or domain.
      </p>
    </Card>
  )
}
