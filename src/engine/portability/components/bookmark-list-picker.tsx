import { Button } from '@app/shared/components/ui/button'
import { cn } from '@app/shared/lib/utils'
import {
  isImportableBookmark,
  type FolderBookmark,
} from '../services/import-bookmark-folder'

interface BookmarkListPickerProps {
  readonly bookmarks: readonly FolderBookmark[]
  readonly selectedIds: readonly string[]
  readonly onToggle: (bookmarkId: string) => void
  readonly onSelectAll: () => void
  readonly onClear: () => void
}

/**
 * The third step's list: a folder's bookmarks as checkboxes, with a count
 * and Select all / Clear. A bookmark that can't be imported (an internal
 * browser page, say) stays visible but disabled and labelled, so it's clear
 * why it isn't counted rather than it silently vanishing. Read-only apart
 * from reporting the selection — it never touches the browser's bookmarks.
 */
export function BookmarkListPicker({
  bookmarks,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
}: BookmarkListPickerProps) {
  if (bookmarks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This folder has no bookmarks. Bookmarks inside subfolders aren’t
        included — go back and choose the subfolder.
      </p>
    )
  }

  const importableCount = bookmarks.filter(isImportableBookmark).length
  const selected = new Set(selectedIds)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p
          className="text-sm font-medium text-card-foreground"
          role="status"
        >
          {selectedIds.length} of {importableCount} selected
        </p>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="h-8 px-3"
            disabled={selectedIds.length === importableCount}
            onClick={onSelectAll}
          >
            Select all
          </Button>
          <Button
            variant="secondary"
            className="h-8 px-3"
            disabled={selectedIds.length === 0}
            onClick={onClear}
          >
            Clear
          </Button>
        </div>
      </div>

      <ul className="scroll-slim max-h-72 space-y-0.5 overflow-y-auto">
        {bookmarks.map(bookmark => {
          const isImportable = isImportableBookmark(bookmark)
          const isChecked = selected.has(bookmark.id)

          return (
            <li key={bookmark.id}>
              <label
                className={cn(
                  'flex items-start gap-2.5 rounded-lg px-2 py-2 text-sm',
                  isImportable
                    ? 'cursor-pointer hover:bg-muted/70'
                    : 'cursor-not-allowed opacity-60',
                  isChecked && 'bg-accent/15',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-current"
                  checked={isChecked}
                  disabled={!isImportable}
                  onChange={() => onToggle(bookmark.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {bookmark.title.trim() || 'Untitled bookmark'}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {bookmark.url}
                  </span>
                </span>
                {!isImportable && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Can’t be imported
                  </span>
                )}
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
