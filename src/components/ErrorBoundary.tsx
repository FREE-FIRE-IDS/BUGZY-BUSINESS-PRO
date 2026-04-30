import React from 'react';
import { X, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-center bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 m-4">
          <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-3xl flex items-center justify-center mb-6">
            <X size={40} />
          </div>
          <h2 className="text-2xl font-black mb-2 dark:text-white">Section Error</h2>
          <p className="text-slate-500 mb-8 max-w-xs mx-auto">Something went wrong while rendering this part of the app.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
            >
              <RefreshCcw size={18} />
              Reload App
            </button>
            <button 
              onClick={() => this.setState({ hasError: false })}
              className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl font-bold border border-slate-200 dark:border-slate-700 active:scale-95 transition-all"
            >
              <Home size={18} />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
