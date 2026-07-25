function App() {
  return (
    <main className="newtab-shell">
      <header className="newtab-header">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <p className="eyebrow">Collections Launcher</p>
          <h1>Your resources, grouped by purpose.</h1>
          <p className="intro">
            The extension foundation is ready. Your collections will live here.
          </p>
        </div>
      </header>

      <section className="foundation-card" aria-labelledby="foundation-title">
        <p className="status">Phase A</p>
        <h2 id="foundation-title">New-tab entry point connected</h2>
        <p>
          Collection management arrives in the next implementation phases.
        </p>
      </section>
    </main>
  )
}

export default App
