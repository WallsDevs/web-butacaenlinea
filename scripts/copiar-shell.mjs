/**
 * Antes de `vite build`: copia index.html a spa.html.
 *
 * index.html es la portada y, al publicar, sale ya armada en HTML para Google
 * (scripts/prerender-seo.mjs). spa.html es la carcasa vacía de la app: la que
 * sirve el hosting (vercel.json, _redirects) y el service worker para
 * cualquier otra dirección (/ayuda, /salidas…). Si esas direcciones recibieran
 * index.html, mostrarían la portada antes de cargar y Google la vería repetida.
 * Se genera (no se versiona) para que las dos tengan siempre la misma cabecera.
 */
import { copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
await copyFile(join(raiz, 'index.html'), join(raiz, 'spa.html'));
