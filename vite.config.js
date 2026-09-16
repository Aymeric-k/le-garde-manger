import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/app/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      base: '/app/',
      scope: '/',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/app/index.html',
        navigateFallbackDenylist: [/\.php$/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.php'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /openfoodfacts\.org/,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'Kësoir',
        short_name: 'Kësoir',
        description: 'Ton inventaire, tes recettes, tes courses',
        theme_color: '#6b4226',
        background_color: '#f5f0e8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/app/',
        scope: '/app/',
        icons: [
          { src: '/app/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/app/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/app/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
