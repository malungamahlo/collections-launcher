import { DashboardHeader } from '@app/features/collections/components/dashboard-header'

function App() {
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
        </section>
      </div>
    </main>
  )
}

export default App
