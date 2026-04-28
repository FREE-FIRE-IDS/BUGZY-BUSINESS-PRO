import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  // Explicitly define members for environments with poor inheritance inference
  state: State;
  props: Props;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 border border-slate-100 dark:border-slate-800">
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-3xl flex items-center justify-center text-rose-600 mx-auto mb-6">
              <AlertTriangle size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 mb-4 tracking-tight">Something went wrong</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              We encountered a crash. The app is loading or recovering from an error. 
              Don't worry, your data is safe on your device.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl mb-8 text-left overflow-auto max-h-32">
              <code className="text-[10px] text-rose-500 font-mono break-all font-bold uppercase tracking-tight">
                {error?.message || 'Unknown Error'}
              </code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20"
            >
              <RefreshCw size={18} />
              Reload Application
            </button>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="mt-4 text-xs text-slate-400 hover:text-rose-500 font-bold uppercase tracking-widest transition-colors"
            >
              Clear Cache & Reset (Last Resort)
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
