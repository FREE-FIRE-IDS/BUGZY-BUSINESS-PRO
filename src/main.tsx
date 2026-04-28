import {StrictMode, Component, ErrorInfo, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AppProvider } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { registerSW } from 'virtual:pwa-register';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
          <h1 className="text-2xl font-bold mb-4 text-[#008ba3]">Something went wrong</h1>
          <p className="text-slate-400 mb-6 max-w-md">
            The application encountered a runtime error. This might be due to missing data or a connection issue.
          </p>
          <pre className="text-[10px] bg-slate-900 p-4 rounded-xl border border-white/10 max-w-full overflow-auto text-rose-400 font-mono text-left w-full max-w-lg">
            {this.state.error?.name}: {this.state.error?.message}
            {"\n\n"}
            Stack Trace:{"\n"}
            {this.state.error?.stack?.split("\n").slice(0, 3).join("\n")}
          </pre>
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="mt-8 px-8 py-3 bg-[#008ba3] text-white rounded-2xl font-bold hover:bg-[#007a8f] transition-all shadow-lg shadow-[#008ba3]/20"
          >
            Reset & Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Register service worker
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ThemeProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </ThemeProvider>
  </ErrorBoundary>,
);
