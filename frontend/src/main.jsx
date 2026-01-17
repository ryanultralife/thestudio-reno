import React from 'react'
import ReactDOM from 'react-dom/client'
import PublicWebsite from './PublicWebsite.jsx'
import DisplayBoard from './DisplayBoard.jsx'
import './index.css'

// Simple routing based on path
const path = window.location.pathname

// Determine which app to show
let AppComponent = PublicWebsite

// Only use DisplayBoard for digital signage routes
if (path.startsWith('/display') || path.startsWith('/tv') || path.startsWith('/signage')) {
  AppComponent = DisplayBoard
}
// Otherwise use PublicWebsite (which now includes integrated staff portal)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppComponent />
  </React.StrictMode>,
)
