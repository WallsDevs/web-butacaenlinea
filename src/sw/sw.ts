/// <reference lib="webworker" />
/**
 * Service worker de Butaca En Línea.
 * - Precache del app shell (el conductor y el pasajero abren la app sin señal).
 * - Boletos del pasajero: NetworkFirst con caché de respaldo — el boleto queda
 *   consultable sin conexión.
 * - Manifiesto y clave pública del chófer: NetworkFirst (la cola de
 *   validaciones offline vive en IndexedDB, no aquí).
 * El diseño asume conectividad intermitente en carretera: ninguna acción
 * crítica del chófer requiere red en el momento.
 */
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

// Una versión nueva entra apenas se descarga: si esperaba a que se cerraran
// todas las pestañas, en el teléfono (que casi nunca cierra la app) se seguía
// viendo la versión vieja después de cada despliegue. Al tomar el control, la
// página se recarga sola con lo nuevo (registerType: 'autoUpdate').
self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

// SPA: navegaciones caen al shell precacheado (solo en build: en dev el
// manifest de precache está vacío y createHandlerBoundToURL fallaría)
if (import.meta.env.PROD) {
  // Lo que es un archivo (sitemap.xml, robots.txt, una imagen subida) va a la red tal cual:
  // si cayera al shell, la app lo mostraría como «esta página no existe»
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/\/[^/?]+\.[a-z0-9]{2,5}$/i, /^\/uploads\//] }));
}

// Tipografía de Google Fonts
registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
  new CacheFirst({ cacheName: 'fuentes' })
);

// Boleto del pasajero — consultable sin señal
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/boletos/codigo/'),
  new NetworkFirst({ cacheName: 'boletos', networkTimeoutSeconds: 4 })
);

// Datos del chófer: manifiesto, clave pública, mapa
registerRoute(
  ({ url }) =>
    /\/api\/salidas\/[^/]+\/(manifiesto|mapa-asientos)$/.test(url.pathname) ||
    url.pathname === '/api/abordaje/clave-publica' ||
    url.pathname === '/api/tasas/vigentes',
  new NetworkFirst({ cacheName: 'operacion', networkTimeoutSeconds: 4 })
);

// Imágenes
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({ cacheName: 'imagenes' })
);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
