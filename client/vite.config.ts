import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The browser only talks to our own server; the TMDB credential stays server-side.
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
});
