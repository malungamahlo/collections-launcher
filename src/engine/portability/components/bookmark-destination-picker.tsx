import { useId } from 'react'
import type {
  Collection,
  CollectionId,
} from '@app/features/collections/model/collection.types'
import { cn } from '@app/shared/lib/utils'

interface BookmarkDestinationPickerProps {
  /** The chosen bookmark folder's name, shown as what a new collection would be called. */
  readonly folderName: string
  readonly collections: readonly Collection[]
  /** The chosen existing collection; absent means "a new collection". */
  readonly selectedTargetId?: CollectionId
  readonly onSelectTarget: (collectionId: CollectionId | undefined) => void
}

interface DestinationOptionProps {
  readonly groupName: string
  readonly label: string
  readonly hint: string
  readonly checked: boolean
  readonly onSelect: () => void
}

function DestinationOption({
  groupName,
  label,
  hint,
  checked,
  onSelect,
}: DestinationOptionProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm',
        checked ? 'bg-accent/15 text-accent' : 'hover:bg-muted/70',
      )}
    >
      <input
        type="radio"
        name={groupName}
        className="size-4 shrink-0 accent-current"
        checked={checked}
        onChange={onSelect}
      />
      <span className={cn('min-w-0 flex-1 truncate', checked && 'font-medium')}>
        {label}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>
    </label>
  )
}

/**
 * The second step of importing bookmarks: choosing where the chosen folder's
 * bookmarks go — a new collection (the default) or one of the user's
 * existing collections. Read-only apart from reporting the choice.
 */
export function BookmarkDestinationPicker({
  folderName,
  collections,
  selectedTargetId,
  onSelectTarget,
}: BookmarkDestinationPickerProps) {
  const groupName = useId()

  return (
    <div
      role="radiogroup"
      aria-label="Where should these bookmarks go?"
      className="scroll-slim max-h-72 space-y-0.5 overflow-y-auto"
    >
      <DestinationOption
        groupName={groupName}
        label="New collection"
        hint={`named “${folderName || 'Untitled folder'}”`}
        checked={selectedTargetId === undefined}
        onSelect={() => onSelectTarget(undefined)}
      />

      {collections.map(collection => (
        <DestinationOption
          key={collection.id}
          groupName={groupName}
          label={collection.name}
          hint={
            collection.resources.length === 1
              ? '1 resource'
              : `${collection.resources.length} resources`
          }
          checked={selectedTargetId === collection.id}
          onSelect={() => onSelectTarget(collection.id)}
        />
      ))}
    </div>
  )
}
