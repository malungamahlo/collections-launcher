import { Plus } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@app/shared/components/ui/button'
import { CollectionGrid } from '@app/features/collections/components/collection-grid'
import { CollectionFormDialog } from '@app/features/collections/components/collection-form-dialog'
import { CollectionSearchInput } from '@app/features/collections/components/collection-search-input'
import { CollectionsEmptyState } from '@app/features/collections/components/collections-empty-state'
import { DashboardHeader } from '@app/features/collections/components/dashboard-header'
import { DeleteCollectionDialog } from '@app/features/collections/components/delete-collection-dialog'
import { DeleteWebsiteResourceDialog } from '@app/features/collections/components/delete-website-resource-dialog'
import { NoSearchResultsEmptyState } from '@app/features/collections/components/no-search-results-empty-state'
import { WebsiteResourceFormDialog } from '@app/features/collections/components/website-resource-form-dialog'
import { DEVELOPMENT_SAMPLE_STATE } from '@app/features/collections/development/sample-collections'
import { useCollectionManagement } from '@app/features/collections/hooks/use-collection-management'
import { useCollectionSearch } from '@app/features/collections/hooks/use-collection-search'
import { useCollectionsState } from '@app/features/collections/hooks/use-collections-state'
import { useResourceReorder } from '@app/features/collections/hooks/use-resource-reorder'
import { useWebsiteResourceManagement } from '@app/features/collections/hooks/use-website-resource-management'
import type {
  Collection,
  WebsiteResource,
} from '@app/features/collections/model/collection.types'
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
  const resourceManagement = useWebsiteResourceManagement({
    state: storedCollections.state,
    save: storedCollections.save,
  })
  const resourceReorder = useResourceReorder({
    state: storedCollections.state,
    save: storedCollections.save,
  })

  // Preview mode displays deterministic data without writing it to user storage.
  const collections = isDevelopmentPreview
    ? DEVELOPMENT_SAMPLE_STATE.collections
    : storedCollections.state.collections
  const status = isDevelopmentPreview ? 'ready' : storedCollections.status
  const search = useCollectionSearch(collections)

  function handleOpenResource(resource: WebsiteResource): void {
    void tabsAdapter.open(resource.url).catch(error => {
      console.error(`Could not open ${resource.url}`, error)
    })
  }

  function handleOpenAll(collection: Collection): void {
    if (collection.resources.length === 0) {
      return
    }

    void tabsAdapter
      .openMany(collection.resources.map(resource => resource.url))
      .catch(error => {
        console.error(`Could not open collection ${collection.id}`, error)
      })
  }

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <div className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div className="shrink-0">
          <DashboardHeader isDevelopmentPreview={isDevelopmentPreview} />
        </div>

        <section
          aria-labelledby="collections-heading"
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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

            {status === 'ready' && collections.length > 0 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <CollectionSearchInput
                  value={search.query}
                  onChange={search.setQuery}
                />

                {!isDevelopmentPreview && (
                  <Button
                    ref={dashboardFallbackFocusRef}
                    className="w-full shrink-0 gap-2 whitespace-nowrap sm:w-auto"
                    onClick={management.openCreate}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    New collection
                  </Button>
                )}
              </div>
            )}

            {!isDevelopmentPreview &&
              status === 'ready' &&
              collections.length === 0 && (
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
            <p
              className="mt-6 shrink-0 text-sm text-muted-foreground"
              role="status"
            >
              Loading collections…
            </p>
          )}

          {status === 'error' && (
            <p className="mt-6 shrink-0 text-sm text-red-700" role="alert">
              Collections could not be loaded. Open a new tab to try again.
            </p>
          )}

          {status === 'ready' && collections.length === 0 && (
            <div className="shrink-0">
              <CollectionsEmptyState />
            </div>
          )}

          {status === 'ready' &&
            collections.length > 0 &&
            search.filteredCollections.length === 0 && (
              <div className="shrink-0">
                <NoSearchResultsEmptyState query={search.query} />
              </div>
            )}

          {status === 'ready' && search.filteredCollections.length > 0 && (
            <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
              <CollectionGrid
                collections={search.filteredCollections}
                onOpenResource={handleOpenResource}
                onOpenAll={handleOpenAll}
                onEditCollection={
                  isDevelopmentPreview ? undefined : management.openEdit
                }
                onDeleteCollection={
                  isDevelopmentPreview ? undefined : management.requestDelete
                }
                onAddResource={
                  isDevelopmentPreview
                    ? undefined
                    : resourceManagement.openCreate
                }
                onEditResource={
                  isDevelopmentPreview
                    ? undefined
                    : resourceManagement.openEdit
                }
                onDeleteResource={
                  isDevelopmentPreview
                    ? undefined
                    : resourceManagement.requestDelete
                }
                onReorderResources={
                  isDevelopmentPreview || search.query.trim()
                    ? undefined
                    : (collection, orderedResourceIds) =>
                        void resourceReorder.reorder(
                          collection,
                          orderedResourceIds,
                        )
                }
              />
            </div>
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

      {resourceManagement.editor && (
        <WebsiteResourceFormDialog
          mode={resourceManagement.editor.mode}
          values={resourceManagement.formValues}
          collections={storedCollections.state.collections}
          nameError={resourceManagement.nameError}
          urlError={resourceManagement.urlError}
          submissionError={resourceManagement.formError}
          isSubmitting={resourceManagement.isSaving}
          fallbackFocusRef={dashboardFallbackFocusRef}
          onValuesChange={resourceManagement.updateFormValues}
          onSubmit={() => void resourceManagement.submitEditor()}
          onClose={resourceManagement.closeEditor}
        />
      )}

      {resourceManagement.resourceToDelete && (
        <DeleteWebsiteResourceDialog
          collection={resourceManagement.resourceToDelete.collection}
          resource={resourceManagement.resourceToDelete.resource}
          isDeleting={resourceManagement.isSaving}
          errorMessage={resourceManagement.deleteError}
          fallbackFocusRef={dashboardFallbackFocusRef}
          onConfirm={() => void resourceManagement.confirmDelete()}
          onClose={resourceManagement.cancelDelete}
        />
      )}
    </main>
  )
}

export default App
