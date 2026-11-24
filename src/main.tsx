import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './colourful.css';
import { restoreSaves } from './storage/persist';
import { applyTextSize, readDeviceTextSize } from './textSize';
import { applyMotion } from './a11y/motion';
import { applyColourful } from './colourful';
import { watchDialogs } from './a11y/dialogs';
import { applyDisplay, devPcPreview } from './display';

applyTextSize();
applyMotion();
applyColourful();
applyDisplay(devPcPreview());
watchDialogs();

// On the phones, bring saves back from the native copy first if the WebView storage was wiped,
// and read Android's Font size (it picks the Larger text default).
void Promise.allSettled([restoreSaves(), readDeviceTextSize()]).finally(() => {
  applyTextSize();
  applyMotion();
  applyColourful();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  hideSplash();
});

/** Fades the HTML splash (index.html) once the first screen has painted underneath it. */
function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      splash.classList.add('gone');
      window.setTimeout(() => splash.remove(), document.documentElement.classList.contains('reduce-motion') ? 0 : 400);
    }),
  );
}
