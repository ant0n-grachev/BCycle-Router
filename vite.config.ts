import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Netlify owns the explicit SPA navigation fallback. Keeping Vite's preview
  // server in MPA mode prevents missing scripts, styles, and images from being
  // rewritten to index.html during local production verification.
  appType: 'mpa',
  plugins: [
    react(),
    VitePWA({
      injectRegister: false,
      manifest: false,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png', 'manifest.json'],
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/assets\//, /\/icons\//, /\.[^/?]+(?:\?.*)?$/],
        runtimeCaching: [],
      },
    }),
  ],
  build: {
    target: 'es2020',
  },
});
