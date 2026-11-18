import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { restoreSaves } from './storage/persist';
import { applyTextSize } from './textSize';
import { applyMotion } from './a11y/motion';
import { watchDialogs } from './a11y/dialogs';

applyTextSize();
applyMotion();
watchDialogs();

// On the phones, bring saves back from the native copy first if the WebView storage was wiped.
void restoreSaves().finally(() => {
  applyTextSize();
  applyMotion();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
