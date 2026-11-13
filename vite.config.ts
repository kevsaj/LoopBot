import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

const DEMO_FLOORS = 10;

/**
 * Shipped builds carry no answers: every floor's reference solution is removed (the game
 * never reads it; only the level checks do). In the demo, floors past the demo are also
 * reduced to their id so their designs stay out of the public bundle.
 */
function shippedLevels(demo: boolean): Plugin {
  return {
    name: 'loopbot-shipped-levels',
    apply: 'build', // dev server and tests keep the references
    enforce: 'pre',
    transform(code, id) {
      const m = /t1-f(\d+)\.json$/.exec(id.split('?')[0]);
      if (!m) return null;
      const level = JSON.parse(code);
      const kept = !demo || Number(m[1]) <= DEMO_FLOORS ? { ...level, reference: '' } : { id: level.id };
      return { code: JSON.stringify(kept), map: null };
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [shippedLevels(mode === 'demo'), react()],
  // Relative paths so the same build works on itch.io, a web server and inside Capacitor.
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
    // Older phones run an older WebView than you'd think: Android System WebView only updates
    // through the Play Store, and a 1.0.0 player hit a missing structuredClone (WebView < 98).
    // esbuild lowers newer syntax to these targets (Chrome 80 is early 2020; iOS 15.4 is the
    // oldest the app supports). It does not add missing functions, so src/compat.test.ts keeps
    // newer built-ins like structuredClone out of the game's own code.
    target: ['es2020', 'chrome80', 'edge80', 'firefox78', 'safari15'],
  },
}));
