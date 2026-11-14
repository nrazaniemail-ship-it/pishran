// Pishran boots as a local-first PWA; authentication and remote sync are intentionally deferred.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './style.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)
