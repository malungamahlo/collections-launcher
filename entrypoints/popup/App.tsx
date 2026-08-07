import { AlertCircle } from 'lucide-react'
import { ToolbarCaptureForm } from '@app/features/capture/components/toolbar-capture-form'
import { useActivePage } from '@app/features/capture/hooks/use-active-page'
import { useToolbarCapture } from '@app/features/capture/hooks/use-toolbar-capture'
import { useCollectionsState } from '@app/features/collections/hooks/use-collections-state'
import type { CollectionsState } from '@app/features/collections/model/collection.types'
import type { CollectionsRepository } from '@app/features/collections/storage/collections.repository'
import { ChromeLocalCollectionsRepository } from '@app/features/collections/storage/chrome-local-collections.repository'
import { BrowserActiveTabAdapter } from '@app/platform/browser/active-tab.adapter'
import type {
  ActivePage,
  ActiveTabAdapter,
} from '@app/platform/browser/active-tab.adapter'
import { BrandMark } from '@app/shared/components/brand-mark'

const collectionsRepository = new ChromeLocalCollectionsRepository()
const activeTabAdapter = new BrowserActiveTabAdapter()

interface CaptureReadyProps {
  readonly page: ActivePage
  readonly state: CollectionsState
  readonly save: (state: CollectionsState) => Promise<void>
}

/** Connects the capture form to domain operations after all data has loaded. */
function CaptureReady({ page, state, save }: CaptureReadyProps) {
  const capture = useToolbarCapture({ page, state, save })

  return (
    <ToolbarCaptureForm
      page={page}
      collections={state.collections}
      values={capture.values}
      nameError={capture.nameError}
      collectionError={capture.collectionError}
      submissionError={capture.submissionError}
      successMessage={capture.successMessage}
      isSaving={capture.isSaving}
      onValuesChange={capture.updateValues}
      onSubmit={() => void capture.submit()}
    />
  )
}

interface AppProps {
  readonly repository?: CollectionsRepository
  readonly tabAdapter?: ActiveTabAdapter
}

/** Composes active-tab capture with shared collection persistence. */
function App({
  repository = collectionsRepository,
  tabAdapter = activeTabAdapter,
}: AppProps) {
  const activePage = useActivePage(tabAdapter)
  const collections = useCollectionsState(repository)
  const isLoading =
    activePage.status === 'loading' || collections.status === 'loading'

  return (
    <main className="p-5">
      <header className="mb-5 flex items-center gap-3 border-b border-border pb-4">
        <BrandMark />
        <div>
          <p className="text-xs font-bold tracking-[0.12em] text-accent uppercase">
            Collections Launcher
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground">
            Save this page
          </h1>
        </div>
      </header>

      {isLoading && (
        <p className="text-sm text-muted-foreground" role="status">
          Reading the active page…
        </p>
      )}

      {!isLoading && collections.status === 'error' && (
        <ErrorMessage>
          Your collections could not be loaded. Close and reopen the popup to
          try again.
        </ErrorMessage>
      )}

      {!isLoading && activePage.status === 'error' && (
        <ErrorMessage>
          The active page could not be read. Close and reopen the popup to try
          again.
        </ErrorMessage>
      )}

      {!isLoading && activePage.status === 'unavailable' && (
        <ErrorMessage>
          {activePage.reason === 'unsupported-url'
            ? 'This browser page cannot be saved. Open a normal HTTP or HTTPS website and try again.'
            : 'The active page does not provide a website address that can be saved.'}
        </ErrorMessage>
      )}

      {!isLoading &&
        collections.status === 'ready' &&
        activePage.status === 'available' && (
          <CaptureReady
            page={activePage.page}
            state={collections.state}
            save={collections.save}
          />
        )}
    </main>
  )
}

/** Displays a consistent accessible popup-level failure state. */
function ErrorMessage({ children }: { readonly children: string }) {
  return (
    <div
      className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-800"
      role="alert"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}

export default App
