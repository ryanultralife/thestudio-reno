import React from 'react'
import ReactDOM from 'react-dom/client'
import UnifiedApp from './UnifiedApp'
import DisplayBoard from './DisplayBoard.jsx'
import './index.css'

// Simple routing based on path
const path = window.location.pathname

// Determine which app to show
let AppComponent = UnifiedApp

// Display board / signage screens use a separate dedicated component
if (path.startsWith('/display') || path.startsWith('/tv') || path.startsWith('/signage')) {
  AppComponent = DisplayBoard
}

// Handle SPA navigation
window.addEventListener('popstate', () => {
  // Re-render on navigation
  const root = document.getElementById('root')
  if (root && root._reactRootContainer) {
    root._reactRootContainer.render(
      <React.StrictMode>
        <UnifiedApp />
      </React.StrictMode>
    )
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppComponent />
  </React.StrictMode>,
)
