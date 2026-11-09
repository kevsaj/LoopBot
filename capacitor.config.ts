import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Android app ID and iOS bundle ID. Permanent once the app is on Google Play or App Store Connect:
  // never change it after the first upload.
  appId: 'com.kisstudios.loopbot',
  appName: 'LoopBot',
  webDir: 'dist',
  // The night sky colour, so the app never flashes white while the page loads.
  backgroundColor: '#2b2546',
  android: {
    // Only the bundled game runs here, never remote pages.
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      // index.html asks for viewport-fit=cover; the CSS pads with env(safe-area-inset-*).
      initialViewportFitValueHint: 'cover',
      style: 'DARK', // light status bar icons over the dark sky
    },
  },
};

export default config;
