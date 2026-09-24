import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Installable, offline-capable build. The service worker lives in src/sw.js; it is only
// built for production (`npm run dev` never registers one).
const pwa = VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.js',
  registerType: 'prompt', // new versions wait until the player accepts or relaunches
  injectRegister: false, // registered from src/pwa/PwaUpdateToast.jsx
  includeManifestIcons: false, // already matched by globPatterns
  injectManifest: {
    // App shell + every built chunk (incl. the lazy three.js/Scene chunks) + fonts + icons.
    // The big menu photo/music are runtime-cached by the worker instead.
    globPatterns: ['**/*.{js,css,html,woff2,png,svg}'], // + manifest.webmanifest, added by the plugin
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  },
  manifest: {
    id: '/',
    name: 'CAPBALL',
    short_name: 'CAPBALL',
    description: 'Flick-to-play tabletop football. Play a friend, the computer, or online.',
    // A game wants every pixel: fullscreen hides the system bars on Android;
    // browsers without it fall back to standalone automatically (iOS always does).
    display: 'fullscreen',
    orientation: 'any',
    start_url: '/',
    scope: '/',
    theme_color: '#060913',
    background_color: '#060913',
    categories: ['games', 'sports'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  devOptions: { enabled: false },
})

export default defineConfig({
  plugins: [react(), pwa],
  build: {
    // three.js is one big lazily-loaded chunk by design
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        // Keep the heavy 3D/physics libraries in their own cacheable chunks
        advancedChunks: {
          groups: [
            // React first so it isn't swept into the three.js chunk (which must stay lazy)
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|zustand)[\\/]/, priority: 20 },
            { name: 'three', test: /node_modules[\\/](three|@react-three)/ },
            { name: 'physics', test: /node_modules[\\/]matter-js/ },
            { name: 'peer', test: /node_modules[\\/]peerjs/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
