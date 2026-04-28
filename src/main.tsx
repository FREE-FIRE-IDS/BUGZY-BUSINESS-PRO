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

const container = document.getElementById('root');
if (container) {
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
}
