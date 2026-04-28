import React, { Component, ReactNode } from 'react';

export class ErrorBoundary extends Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#0f172a', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
          <h1 style={{ color: '#008ba3', fontSize: '24px', fontWeight: 'bold' }}>Application Crash Detected</h1>
          <p style={{ color: '#94a3b8', margin: '10px 0 30px', maxWidth: '400px' }}>
            We've encountered a fatal error. This usually happens due to corrupted local data or a connection issue.
          </p>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => window.location.reload()}
              style={{ padding: '12px 24px', backgroundColor: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '12px', cursor: 'pointer', fontWeight: '600' }}
            >
              Try Refreshing
            </button>
            <button 
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              style={{ padding: '12px 24px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '600' }}
            >
              Reset All Data (Danger)
            </button>
          </div>

          {this.state.error && (
            <div style={{ marginTop: '40px', width: '100%', maxWidth: '600px', textAlign: 'left' }}>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Error Details:</p>
              <pre style={{ padding: '16px', backgroundColor: '#020617', borderRadius: '12px', overflow: 'auto', fontSize: '11px', color: '#fda4af', border: '1px solid #1e293b', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {this.state.error.name}: {this.state.error.message}
                {"\n\n"}
                {this.state.error.stack}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
