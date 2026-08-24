import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { queryClient } from './state/queryClient';
import { applyThemeToDocument, readStoredTheme } from './state/uiStore';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing React root element');

// Stamp the persisted theme before first paint so tokens switch without a flash.
// Dark is the default (no attribute); only 'light' is stamped explicitly.
applyThemeToDocument(readStoredTheme());

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);