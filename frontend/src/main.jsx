import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import PublicWebsite from './PublicWebsite.jsx'
import DisplayBoard from './DisplayBoard.jsx'
import './index.css'

// Simple routing based on path
const path = window.location.pathname

// Determine which app to show
let AppComponent = PublicWebsite

if (path.startsWith('/admin') || path.startsWith('/staff')) {
  AppComponent = App
} else if (path.startsWith('/display') || path.startsWith('/tv') || path.startsWith('/signage')) {
  AppComponent = DisplayBoard
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppComponent />
  </React.StrictMode>,
)
