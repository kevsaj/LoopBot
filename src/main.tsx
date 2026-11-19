import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { restoreSaves } from './storage/persist';
import { applyTextSize, readDeviceTextSize } from './textSize';
import { applyMotion } from './a11y/motion';
import { watchDialogs } from './a11y/dialogs';
import { applyDisplay, devPcPreview } from './display';

applyTextSize();
applyMotion();
applyDisplay(devPcPreview());
watchDialogs();

// On the phones, bring saves back from the native copy first if the WebView storage was wiped,
// and read Android's Font size (it picks the Larger text default).
void Promise.allSettled([restoreSaves(), readDeviceTextSize()]).finally(() => {
  applyTextSize();
  applyMotion();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
