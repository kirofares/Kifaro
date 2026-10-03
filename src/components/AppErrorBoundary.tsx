import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportClientError } from '../lib/errorReporting'

type Props = { children: ReactNode }
type State = { failed: boolean }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void reportClientError(error, 'react-error-boundary', {
      componentStack: info.componentStack?.slice(0, 8000),
    })
  }

  render() {
    if (this.state.failed) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f7f9fc' }}>
          <div style={{ maxWidth: 520, textAlign: 'center', background: '#fff', padding: 28, borderRadius: 18, boxShadow: '0 14px 40px rgba(15,45,91,.12)' }}>
            <h1 style={{ marginTop: 0 }}>AnatoMate needs a refresh</h1>
            <p style={{ color: '#607087', lineHeight: 1.6 }}>We recorded the technical error. Reload the app to continue.</p>
            <button
              onClick={() => window.location.reload()}
              style={{ border: 0, borderRadius: 12, padding: '12px 18px', background: '#0F2D5B', color: '#fff', fontWeight: 800 }}
            >
              Reload AnatoMate
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
