import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'
import { reportClientError } from './lib/errorReporting'
import { startSitePresenceTracking } from './lib/sitePresence'
import { AuthProvider } from './auth/AuthContext'
// Self-hosted fonts so the web and Android app render identically, offline too.
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css'
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css'
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

window.addEventListener('error', (event) => {
  void reportClientError(event.error || event.message, 'window-error')
})

window.addEventListener('unhandledrejection', (event) => {
  void reportClientError(event.reason, 'unhandled-rejection')
})

startSitePresenceTracking()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
)
