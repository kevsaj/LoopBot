import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

const DEMO_FLOORS = 10;

/**
 * Demo builds ship no answers: every floor's reference solution is removed, and floors
 * past the demo are reduced to their id so their designs stay out of the public bundle.
 */
function demoLevels(): Plugin {
  return {
    name: 'loopbot-demo-levels',
    enforce: 'pre',
    transform(code, id) {
      const m = /t1-f(\d+)\.json$/.exec(id.split('?')[0]);
      if (!m) return null;
      const level = JSON.parse(code);
      const kept = Number(m[1]) <= DEMO_FLOORS ? { ...level, reference: '' } : { id: level.id };
      return { code: JSON.stringify(kept), map: null };
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: mode === 'demo' ? [demoLevels(), react()] : [react()],
  // Relative paths so the same build works on itch.io, a web server and inside Capacitor.
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
  },
}));
