import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AppProvider } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { registerSW } from 'virtual:pwa-register';
import { ErrorBoundary } from './components/ErrorBoundary';

// Register service worker
registerSW({ immediate: true });

console.log('[DEBUG] main.tsx init');

const container = document.getElementById('root');
console.log('[DEBUG] root container found:', !!container);

if (container) {
  try {
    createRoot(container).render(
      <React.StrictMode>
        <ErrorBoundary>
          <ThemeProvider>
            <AppProvider>
              <App />
            </AppProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
    console.log('[DEBUG] createRoot.render called');
  } catch (err) {
    console.error('[DEBUG] createRoot.render failed fatal:', err);
    container.innerHTML = `
      <div style="background: #0f172a; color: #f87171; padding: 20px; font-family: monospace; height: 100vh;">
        <h1>Fatal Startup Error</h1>
        <pre>${err instanceof Error ? err.stack : String(err)}</pre>
      </div>
    `;
  }
} else {
  console.error('[DEBUG] root container not found');
  document.body.innerHTML = '<h1 style="color:red">Error: #root element missing in index.html</h1>';
}
