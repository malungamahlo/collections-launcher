import { CollectionGrid } from '@app/features/collections/components/collection-grid'
import { CollectionsEmptyState } from '@app/features/collections/components/collections-empty-state'
import { DashboardHeader } from '@app/features/collections/components/dashboard-header'
import { useCollectionsState } from '@app/features/collections/hooks/use-collections-state'
import type { WebsiteResource } from '@app/features/collections/model/collection.types'
import { ChromeLocalCollectionsRepository } from '@app/features/collections/storage/chrome-local-collections.repository'
import { BrowserTabsAdapter } from '@app/platform/browser/tabs.adapter'

const collectionsRepository = new ChromeLocalCollectionsRepository()
const tabsAdapter = new BrowserTabsAdapter()

function App() {
  const { collections, status } = useCollectionsState(collectionsRepository)

  function handleOpenResource(resource: WebsiteResource): void {
    void tabsAdapter.open(resource.url).catch(error => {
      console.error(`Could not open ${resource.url}`, error)
    })
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <DashboardHeader />

        <section aria-labelledby="collections-heading">
          <div>
            <h2
              id="collections-heading"
              className="text-xl font-semibold text-foreground"
            >
              Collections
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Open a saved resource or launch a complete workspace.
            </p>
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
            />
          )}
        </section>
      </div>
    </main>
  )
}

export default App
