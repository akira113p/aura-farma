import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { clientLog } from './lib/clientLog';

// Handlers globais: capturam erros não tratados e promises rejeitadas que
// escapam dos componentes React, logando com stack em JSON estruturado (regra 2).
window.addEventListener('error', (event) => {
  const error = event.error;
  clientLog.error('erro global não tratado', {
    error: error instanceof Error ? error.message : event.message,
    stack: error instanceof Error ? error.stack : undefined,
    source: event.filename,
    line: event.lineno,
    column: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  clientLog.error('promise rejeitada sem tratamento', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
