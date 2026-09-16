import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// getElementById returns HTMLElement | null — the element is in index.html, but
// the compiler has no way to know that, so the failure is made explicit.
const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('No #root element found in index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
