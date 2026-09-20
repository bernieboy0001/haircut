import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Apply the saved theme before first paint to avoid a flash of the wrong palette.
;(() => {
  const stored = window.localStorage.getItem('haircut-theme')
  if (stored === 'light' || stored === 'dark') {
    document.documentElement.setAttribute('data-theme', stored)
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    document.documentElement.setAttribute('data-theme', 'light')
  }
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)