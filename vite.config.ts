import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev/preview proxy for official downloadable files that may not send CORS headers.
// Only the path prefix is rewritten; data is served unmodified from the origin.
const proxy = {
  '/proxy/ncei': {
    target: 'https://www.ncei.noaa.gov',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/proxy\/ncei/, ''),
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
});
