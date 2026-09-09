import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El backend (Django + waitress) corre en 127.0.0.1:8000. El frontend habla
// con la API por rutas relativas (ver src/api.js); en desarrollo, Vite hace
// de proxy hacia el backend para /api, /media, /admin y /static, de modo que
// todo se ve como un solo origen (igual que Caddy en producción).
const backend = 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // host:true expone el servidor en la red local (no solo localhost).
    host: true,
    // Permite abrir el sitio por cualquier host (IP de LAN, IP de Tailscale,
    // dominio de túnel de preview, SRV-RCP, etc.).
    allowedHosts: true,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/media': { target: backend, changeOrigin: true },
      '/admin': { target: backend, changeOrigin: true },
      '/static': { target: backend, changeOrigin: true },
    },
  },
})
