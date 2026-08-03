import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { consumeLaunchToken } from './bootstrap/token';
import { queryClient } from './state/queryClient';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing React root element');

const token = consumeLaunchToken();
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App connected={token !== null} />
    </QueryClientProvider>
  </StrictMode>,
);