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
    // iOS 15.4 is the oldest the app supports (Capacitor 8 needs 15; the game uses structuredClone,
    // which arrived in 15.4; an iPad mini 4 stops at iPadOS 15.8).
    // Vite's default stops at Safari 16, so ask for Safari 15 syntax too.
    target: ['es2021', 'chrome107', 'edge107', 'firefox104', 'safari15'],
  },
}));
