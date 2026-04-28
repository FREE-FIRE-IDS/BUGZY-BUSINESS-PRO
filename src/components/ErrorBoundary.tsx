import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center', 
          backgroundColor: '#0f172a', 
          color: 'white', 
          minHeight: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          fontFamily: 'system-ui, sans-serif' 
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
          <h1 style={{ color: '#008ba3', fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>
            App crashed or failed to load
          </h1>
          <p style={{ color: '#94a3b8', marginBottom: '30px', maxWidth: '400px' }}>
            We've encountered a fatal error. This is often caused by connection issues or invalid data.
          </p>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => window.location.reload()}
              style={{ padding: '12px 24px', backgroundColor: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '12px', cursor: 'pointer', fontWeight: '600' }}
            >
              Reload Page
            </button>
            <button 
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              style={{ padding: '12px 24px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '600' }}
            >
              Reset App Data
            </button>
          </div>

          {this.state.error && (
            <div style={{ marginTop: '40px', width: '100%', maxWidth: '600px', textAlign: 'left' }}>
              <pre style={{ padding: '16px', backgroundColor: '#020617', borderRadius: '12px', overflow: 'auto', fontSize: '11px', color: '#fda4af', border: '1px solid #1e293b', whiteSpace: 'pre-wrap' }}>
                {this.state.error.stack || this.state.error.message}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
