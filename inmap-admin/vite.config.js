import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
      proxy: {
        '/api': {
          target: 'https://suzanne-nonprincipled-submaniacally.ngrok-free.dev',
          changeOrigin: true,
          secure: false, // Ignorar problemas de certificados SSL
          rewrite: (path) => path.replace(/^\/api/, '') // Le quita el '/api' antes de enviarlo a Ngrok
        }
      }
    },
    test: {
        environment: 'jsdom',
        globals: true,
      }
})