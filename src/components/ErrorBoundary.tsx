import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    const self = this as any;
    if (self.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#0f172a', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ color: '#008ba3' }}>Something went wrong.</h1>
          <p>The application crashed. Please try refreshing or resetting the data.</p>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#008ba3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Reset Application Data
          </button>
          {self.state.error && (
            <pre style={{ marginTop: '20px', padding: '10px', backgroundColor: '#1e293b', borderRadius: '8px', maxWidth: '80%', overflow: 'auto', fontSize: '12px', color: '#fda4af' }}>
              {self.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return self.props.children;
  }
}
