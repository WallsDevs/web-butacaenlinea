import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: { enabled: true, type: 'module' },
      manifest: {
        name: 'Butaca En Línea',
        short_name: 'Butaca',
        description: 'Boletería y gestión de flota para líneas de transporte',
        lang: 'es',
        display: 'standalone',
        start_url: '/',
        theme_color: '#0B2A6B',
        background_color: '#F4F7FC',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  // Dos páginas con la misma app: la portada (se arma en HTML al publicar) y la carcasa para todo lo demás
  build: { rollupOptions: { input: { index: 'index.html', spa: 'spa.html' } } },
});
