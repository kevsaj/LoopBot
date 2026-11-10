import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { restoreSaves } from './storage/persist';

// On the phones, bring saves back from the native copy first if the WebView storage was wiped.
void restoreSaves().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
