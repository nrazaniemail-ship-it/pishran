import { defineConfig } from 'vite'

// Capacitor serves bundled assets from the app's local origin; GitHub Pages uses the repository subpath.
const appBase = process.env.CAPACITOR_BUILD === 'true' ? './' : '/pishran/'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // GitHub project page: https://<user>.github.io/pishran/
  // For a custom domain, change this to '/'.
  base: appBase,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'پیشران | امکان‌سنجی هوشمند',
        short_name: 'پیشران',
        description: 'پلتفرم هوشمند امکان‌سنجی و ارزیابی سرمایه‌گذاری',
        lang: 'fa',
        dir: 'rtl',
        theme_color: '#101b2b',
        background_color: '#f4f6f9',
        display: 'standalone',
        start_url: '/pishran/',
        scope: '/pishran/',
        icons: [
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        // Force installed PWAs to discard stale pre-removal bundles and claim updated clients.
        cacheId: 'pishran-1-0-1-refresh',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/api/'),
            handler: 'NetworkFirst',
            options: { cacheName: 'api-read-cache', networkTimeoutSeconds: 4 }
          }
        ]
      }
    })
  ],
  server: { proxy: { '/api': 'http://localhost:8000' } }
})
