import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '../../src/shared/styles/base.css'
import App from './App'

const root = document.getElementById('root')

if (!root) {
  throw new Error('New-tab root element was not found')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
