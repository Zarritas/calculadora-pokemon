import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Servido en la raíz del dominio propio (pkmncalc.jesuslorenzo.es).
  base: '/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate', // instala la nueva versión y recarga al detectar cambios
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Calculadora Pokémon Champions',
        short_name: 'PkmnCalc',
        description: 'Calculadora y simulador de combate para Pokémon Champions',
        lang: 'es',
        theme_color: '#ee4035',
        background_color: '#16161e',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache del app-shell y chunks (offline tras la primera visita).
        globPatterns: ['**/*.{js,css,html,svg}'],
        // El chunk de learnsets supera el límite por defecto (2 MiB).
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
})
