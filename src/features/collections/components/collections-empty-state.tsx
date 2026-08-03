import { FolderPlus } from 'lucide-react'
import { Card } from '@app/shared/components/ui/card'

/**
 * Explains the dashboard when the user has no collections.
 */
export function CollectionsEmptyState() {
  return (
    <Card className="mt-6 border-dashed px-6 py-14 text-center shadow-none">
      <span
        className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <FolderPlus className="size-6" />
      </span>

      <h3 className="mt-4 text-lg font-semibold text-card-foreground">
        No collections yet
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Collections you create will appear here with all their related websites
        grouped together.
      </p>
    </Card>
  )
}
