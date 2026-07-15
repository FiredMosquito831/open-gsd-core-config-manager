import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { consumeLaunchToken } from './bootstrap/token';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing React root element');

const token = consumeLaunchToken();
createRoot(root).render(
  <StrictMode>
    <App connected={token !== null} />
  </StrictMode>,
);