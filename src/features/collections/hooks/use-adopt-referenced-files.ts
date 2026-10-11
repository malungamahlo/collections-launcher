import { useEffect, useRef } from 'react'
import type { FileContentAdapter } from '@app/platform/browser/file-content.adapter'
import { listFileResources } from '../model/collection.queries'
import type { CollectionsState, ResourceId } from '../model/collection.types'

interface UseAdoptReferencedFilesOptions {
  readonly state: CollectionsState
  /** Adoption waits until the collections have loaded. */
  readonly isReady: boolean
  readonly fileContent: Pick<FileContentAdapter, 'adopt'>
}

/**
 * Brings files added before collections owned their files into line with the
 * ones added since. Such a file is stored as a reference to the user's
 * original; this replaces the reference with a copy wherever the browser
 * still has access to the original, **without ever prompting** — it runs when
 * the dashboard opens, not from a click.
 *
 * A file the browser would have to ask about is left as it is: it is adopted
 * the next time it is opened, saved or exported, where a prompt can be shown.
 * One whose original is gone stays a reference and reports that when opened.
 *
 * Each file is offered once per page. Nothing here changes the collections
 * themselves, and nothing is shown: to the user their files simply keep working.
 */
export function useAdoptReferencedFiles({
  state,
  isReady,
  fileContent,
}: UseAdoptReferencedFilesOptions): void {
  const offeredRef = useRef(new Set<ResourceId>())

  useEffect(() => {
    if (!isReady) {
      return
    }

    for (const resource of listFileResources(state)) {
      if (!offeredRef.current.has(resource.id)) {
        offeredRef.current.add(resource.id)
        // `adopt` never throws and settles on its own; nothing waits on it.
        void fileContent.adopt(resource.id)
      }
    }
  }, [state, isReady, fileContent])
}
