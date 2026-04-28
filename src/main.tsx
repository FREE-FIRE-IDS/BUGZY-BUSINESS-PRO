import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { AppProvider } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';

console.log('[App] Starting initialization...');

const container = document.getElementById('root');

if (!container) {
  console.error('[Fatal] Root container not found in index.html');
  document.body.innerHTML = `
    <div style="background: #0f172a; color: white; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif;">
      <h1 style="color: #f87171;">Fatal Error: #root element missing</h1>
    </div>
  `;
} else {
  try {
    const root = createRoot(container);
    root.render(
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
    console.log('[App] Rendered successfully');
  } catch (error) {
    console.error('[Fatal] Failed to render app:', error);
  }
}
