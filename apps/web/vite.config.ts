import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 0.0.0.0 so the dev server is reachable from outside the container.
    host: '0.0.0.0',
    port: 5173,
    watch: { usePolling: true },
  },
});
