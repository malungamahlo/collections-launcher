function App() {
  return (
    <main className="popup-shell">
      <div className="popup-brand">
        <span className="popup-mark" aria-hidden="true" />
        <p>Collections Launcher</p>
      </div>
      <h1>Save this page</h1>
      <p className="popup-copy">
        Active-page capture will be connected during Phase F.
      </p>
      <button type="button" disabled>
        Choose a collection
      </button>
    </main>
  )
}

export default App
