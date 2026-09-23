import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
