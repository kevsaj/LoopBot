import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative paths so the same build works on itch.io, a web server and inside Capacitor.
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
