import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import './styles.css'

const isNative = Capacitor.isNativePlatform()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (isNative) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => undefined)

      if ('caches' in window) {
        caches.keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch(() => undefined)
      }
      return
    }

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('AnatoMate service worker registration failed:', error)
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
)
