import { Plus } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@app/shared/components/ui/button'
import { CollectionGrid } from '@app/features/collections/components/collection-grid'
import { CollectionFormDialog } from '@app/features/collections/components/collection-form-dialog'
import { CollectionsEmptyState } from '@app/features/collections/components/collections-empty-state'
import { DashboardHeader } from '@app/features/collections/components/dashboard-header'
import { DeleteCollectionDialog } from '@app/features/collections/components/delete-collection-dialog'
import { DEVELOPMENT_SAMPLE_STATE } from '@app/features/collections/development/sample-collections'
import { useCollectionManagement } from '@app/features/collections/hooks/use-collection-management'
import { useCollectionsState } from '@app/features/collections/hooks/use-collections-state'
import type { WebsiteResource } from '@app/features/collections/model/collection.types'
import { ChromeLocalCollectionsRepository } from '@app/features/collections/storage/chrome-local-collections.repository'
import { BrowserTabsAdapter } from '@app/platform/browser/tabs.adapter'

const collectionsRepository = new ChromeLocalCollectionsRepository()
const tabsAdapter = new BrowserTabsAdapter()

function App() {
  const dashboardFallbackFocusRef = useRef<HTMLButtonElement>(null)
  const storedCollections = useCollectionsState(collectionsRepository)
  const isDevelopmentPreview = import.meta.env.MODE === 'samples'
  const management = useCollectionManagement({
    state: storedCollections.state,
    save: storedCollections.save,
  })

  // Preview mode displays deterministic data without writing it to user storage.
  const collections = isDevelopmentPreview
    ? DEVELOPMENT_SAMPLE_STATE.collections
    : storedCollections.state.collections
  const status = isDevelopmentPreview ? 'ready' : storedCollections.status

  function handleOpenResource(resource: WebsiteResource): void {
    void tabsAdapter.open(resource.url).catch(error => {
      console.error(`Could not open ${resource.url}`, error)
    })
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:gap-10 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <DashboardHeader isDevelopmentPreview={isDevelopmentPreview} />

        <section aria-labelledby="collections-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="collections-heading"
                className="text-xl font-semibold text-foreground"
              >
                Collections
              </h2>

              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                Open a saved resource or launch a complete workspace.
              </p>
            </div>

            {!isDevelopmentPreview && status === 'ready' && (
              <Button
                ref={dashboardFallbackFocusRef}
                className="w-full gap-2 sm:w-auto"
                onClick={management.openCreate}
              >
                <Plus className="size-4" aria-hidden="true" />
                New collection
              </Button>
            )}
          </div>

          {status === 'loading' && (
            <p className="mt-6 text-sm text-muted-foreground" role="status">
              Loading collections…
            </p>
          )}

          {status === 'error' && (
            <p className="mt-6 text-sm text-red-700" role="alert">
              Collections could not be loaded. Open a new tab to try again.
            </p>
          )}

          {status === 'ready' && collections.length === 0 && (
            <CollectionsEmptyState />
          )}

          {status === 'ready' && collections.length > 0 && (
            <CollectionGrid
              collections={collections}
              onOpenResource={handleOpenResource}
              onEditCollection={
                isDevelopmentPreview ? undefined : management.openEdit
              }
              onDeleteCollection={
                isDevelopmentPreview ? undefined : management.requestDelete
              }
            />
          )}
        </section>
      </div>

      {management.editor && (
        <CollectionFormDialog
          mode={management.editor.mode}
          values={management.formValues}
          nameError={management.nameError}
          submissionError={management.formError}
          isSubmitting={management.isSaving}
          fallbackFocusRef={dashboardFallbackFocusRef}
          onValuesChange={management.updateFormValues}
          onSubmit={() => void management.submitEditor()}
          onClose={management.closeEditor}
        />
      )}

      {management.collectionToDelete && (
        <DeleteCollectionDialog
          collection={management.collectionToDelete}
          isDeleting={management.isSaving}
          errorMessage={management.deleteError}
          fallbackFocusRef={dashboardFallbackFocusRef}
          onConfirm={() => void management.confirmDelete()}
          onClose={management.cancelDelete}
        />
      )}
    </main>
  )
}

export default App
