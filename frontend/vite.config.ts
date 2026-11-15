import { defineConfig } from 'vite'

// Capacitor serves bundled assets from the app's local origin; GitHub Pages uses the repository subpath.
const isPreviewBuild = process.env.VITE_PREVIEW_BUILD === 'true'
const appBase = process.env.CAPACITOR_BUILD === 'true' ? './' : isPreviewBuild ? '/pishran/preview/' : '/pishran/'
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
    ...(isPreviewBuild ? [] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'پیشران | امکان‌سنجی هوشمند',
        short_name: 'پیشران',
        description: 'پلتفرم هوشمند امکان‌سنجی و ارزیابی سرمایه‌گذاری',
        lang: 'fa',
        dir: 'rtl',
        theme_color: '#185ABD',
        background_color: '#f5f7fa',
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
        cacheId: 'pishran-1-0-1-office-refresh',
        // The integrated feasibility and financial modules are bundled into one offline-first app shell.
        // Keep the full production entry point precached instead of silently omitting it above Workbox's 2 MiB default.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
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
    })]),
  ],
  server: { proxy: { '/api': 'http://localhost:8000' } }
})
