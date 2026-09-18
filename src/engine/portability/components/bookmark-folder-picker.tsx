import { ChevronRight, Folder } from 'lucide-react'
import { useState } from 'react'
import type { BookmarkTreeNode } from '@app/platform/browser/bookmarks.adapter'
import { cn } from '@app/shared/lib/utils'

interface BookmarkFolderPickerProps {
  readonly nodes: readonly BookmarkTreeNode[]
  readonly selectedFolderId?: string
  readonly onSelectFolder: (folder: BookmarkTreeNode) => void
}

/** A bookmark leaf has a URL; a folder never does. */
function isBookmarkFolder(node: BookmarkTreeNode): boolean {
  return node.url === undefined
}

function BookmarkFolderTreeItem({
  node,
  depth,
  selectedFolderId,
  onSelectFolder,
}: {
  readonly node: BookmarkTreeNode
  readonly depth: number
  readonly selectedFolderId: string | undefined
  readonly onSelectFolder: (folder: BookmarkTreeNode) => void
}) {
  const subfolders = (node.children ?? []).filter(isBookmarkFolder)
  const hasSubfolders = subfolders.length > 0
  const [isExpanded, setIsExpanded] = useState(depth === 0 && hasSubfolders)
  const isSelected = node.id === selectedFolderId
  const title = node.title || 'Untitled folder'

  return (
    <li>
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm',
          isSelected
            ? 'bg-accent/15 font-medium text-accent'
            : 'hover:bg-muted/70',
        )}
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
      >
        <button
          type="button"
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded text-muted-foreground transition-colors',
            hasSubfolders ? 'hover:bg-slate-300' : 'invisible',
          )}
          aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
          aria-expanded={hasSubfolders ? isExpanded : undefined}
          disabled={!hasSubfolders}
          onClick={() => setIsExpanded(current => !current)}
        >
          <ChevronRight
            className={cn(
              'size-3.5 transition-transform',
              isExpanded && 'rotate-90',
            )}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 truncate text-left"
          aria-pressed={isSelected}
          onClick={() => onSelectFolder(node)}
        >
          <Folder className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </button>
      </div>

      {hasSubfolders && isExpanded && (
        <ul>
          {subfolders.map(subfolder => (
            <BookmarkFolderTreeItem
              key={subfolder.id}
              node={subfolder}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * A read-only, expandable view of the user's bookmark folders, letting them
 * select exactly one. Individual bookmarks (not folders) are never shown or
 * selectable, and nothing here writes back to the browser's bookmarks.
 */
export function BookmarkFolderPicker({
  nodes,
  selectedFolderId,
  onSelectFolder,
}: BookmarkFolderPickerProps) {
  const folders = nodes.filter(isBookmarkFolder)

  if (folders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No bookmark folders found.
      </p>
    )
  }

  return (
    <ul className="scroll-slim max-h-72 space-y-0.5 overflow-y-auto">
      {folders.map(folder => (
        <BookmarkFolderTreeItem
          key={folder.id}
          node={folder}
          depth={0}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
        />
      ))}
    </ul>
  )
}
