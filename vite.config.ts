import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/vigil/',
  server: {
    proxy: {
      // Proxy OAuth token requests → acleddata.com/oauth
      '/oauth': {
        target: 'https://acleddata.com',
        changeOrigin: true,
        secure: true,
      },
      // Proxy API requests → acleddata.com/api/acled
      '/acled-api': {
        target: 'https://acleddata.com/api/acled',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/acled-api/, ''),
      },
    },
  },
})
