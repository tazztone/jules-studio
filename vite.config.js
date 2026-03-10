import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/v1alpha': {
        target: 'https://jules.googleapis.com',
        changeOrigin: true,
        secure: false
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    include: ['src/__tests__/**/*.{test,spec}.{js,jsx}', 'src/components/__tests__/**/*.{test,spec}.{js,jsx}'],
  }
})
