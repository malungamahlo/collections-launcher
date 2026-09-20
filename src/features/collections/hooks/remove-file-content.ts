import type { FileContentAdapter } from '@app/platform/browser/file-content.adapter'
import type { CollectionResource } from '../model/collection.types'
import { isFileResource } from '../model/resource.guards'

/**
 * Removes the stored file content behind every file resource in `resources`;
 * website resources have none and are skipped.
 *
 * Called *after* the resources have been removed and saved, so a failure here
 * can only leave orphaned bytes behind — never a resource whose content is
 * gone. It therefore logs rather than throws: failing a delete the user has
 * already seen succeed would be worse than a stray entry in storage.
 */
export async function removeStoredFileContent(
  fileContent: FileContentAdapter,
  resources: readonly CollectionResource[],
): Promise<void> {
  const results = await Promise.allSettled(
    resources
      .filter(isFileResource)
      .map(resource => fileContent.remove(resource.id)),
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Could not remove stored file content', result.reason)
    }
  }
}
