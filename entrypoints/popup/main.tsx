import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '../../src/shared/styles/base.css'
import App from './App'
import './style.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Popup root element was not found')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
