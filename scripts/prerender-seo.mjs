/**
 * Arma, al publicar, las páginas de pasajes como HTML listo para buscadores:
 * /pasajes, /pasajes/<ciudad> y /pasajes/<origen>-a-<destino> (por cada ruta
 * publicada). Cada una lleva su título, descripción, canónica, vista previa,
 * datos estructurados y el contenido visible (H1, texto, enlaces, preguntas),
 * así Google la entiende sin ejecutar JavaScript. Al abrirla, la web la
 * reemplaza por la versión viva (con el buscador y las salidas del día).
 *
 * También genera sitemap.xml con todas esas páginas.
 *
 * Los datos salen del API público (ciudades, rutas, próximas salidas). Si no
 * responde, se usan las ciudades del catálogo incluidas en la web: la
 * publicación nunca falla por esto.
 *
 * Uso: node scripts/prerender-seo.mjs   (después de `vite build`)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMINIO, datosEstructurados, rutaCiudad, rutaPar, textosCiudad, textosIndice, textosPar } from '../src/seo/contenido.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(raiz, 'dist');
const API = (process.env.SEO_API_URL || process.env.VITE_API_URL || 'https://api-butacaenlinea-production.up.railway.app').replace(/\/$/, '');
const usarApi = !/localhost|127\.0\.0\.1/.test(API) || process.env.SEO_API_URL;

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function pedir(ruta) {
  if (!usarApi) return null;
  try {
    const r = await fetch(`${API}${ruta}`, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.data ?? j;
  } catch {
    return null;
  }
}

const respaldo = JSON.parse(await readFile(join(raiz, 'src/seo/ciudades.json'), 'utf8'));
const ciudadesApi = await pedir('/api/ciudades');
const ciudades = (Array.isArray(ciudadesApi) && ciudadesApi.length ? ciudadesApi : respaldo).map((c) => ({ nombre: c.nombre, estado: c.estado ?? null }));
const rutas = (await pedir('/api/rutas?populate[tarifas]=true&pagination[pageSize]=100')) ?? [];
const proximas = (await pedir(`/api/salidas?populate[ruta]=true&populate[linea]=true&sort=fechaHoraSalida&pagination[pageSize]=100&filters[fechaHoraSalida][$gte]=${encodeURIComponent(new Date().toISOString())}`)) ?? [];

// Un registro por par origen → destino, con el precio más bajo
const pares = new Map();
for (const r of Array.isArray(rutas) ? rutas : []) {
  if (!r.origen || !r.destino) continue;
  const k = `${r.origen}→${r.destino}`;
  const precios = (r.tarifas ?? []).map((t) => Number(t.precioUsd)).filter((n) => n > 0);
  const min = precios.length ? Math.min(...precios) : null;
  const a = pares.get(k);
  if (!a) pares.set(k, { origen: r.origen, destino: r.destino, precio: min, duracionMin: r.duracionMin || null, distanciaKm: r.distanciaKm || null });
  else if (min != null && (a.precio == null || min < a.precio)) a.precio = min;
}
const lineasDe = (o, d) => [...new Set((Array.isArray(proximas) ? proximas : []).filter((s) => s.ruta?.origen === o && s.ruta?.destino === d).map((s) => s.linea?.nombre).filter(Boolean))];

const plantilla = await readFile(join(DIST, 'index.html'), 'utf8');

/** La página: la plantilla de la web con su cabecera y su contenido visible. */
function pagina(ruta, t, cuerpo, migas) {
  const url = `${DOMINIO}${ruta}`;
  const datos = datosEstructurados(ruta, migas, t.preguntas);
  let html = plantilla
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(t.titulo)}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${esc(t.descripcion)}" />`)
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(t.titulo)}" />`)
    .replace(/<meta\s+property="og:description"[\s\S]*?\/>/, `<meta property="og:description" content="${esc(t.descripcion)}" />`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}" />`)
    .replace('</head>', `<script type="application/ld+json" data-seo-pagina="1">${JSON.stringify(datos).replace(/</g, '\\u003c')}</script>\n</head>`);
  const migasHtml = migas.map((m, i) => (i === migas.length - 1 ? `<span>${esc(m.nombre)}</span>` : `<a href="${m.ruta}">${esc(m.nombre)}</a>`)).join(' › ');
  const preguntas = (t.preguntas ?? []).map((q) => `<h3>${esc(q.p)}</h3><p>${esc(q.r)}</p>`).join('');
  const contenido = `<main style="max-width:1080px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif;color:#0F172A">
<nav style="font-size:13px">${migasHtml}</nav>
<h1>${esc(t.h1)}</h1>
<p>${esc(t.intro)}</p>
${(t.datos ?? []).length ? `<ul>${t.datos.map((d) => `<li><strong>${esc(d.k)}:</strong> ${esc(d.v)}</li>`).join('')}</ul>` : ''}
<p><a href="${ruta}">Buscar salidas y comprar pasajes</a></p>
${cuerpo}
${preguntas ? `<section><h2>Preguntas frecuentes</h2>${preguntas}</section>` : ''}
<p><a href="/pasajes">Pasajes en todas las ciudades de Venezuela</a> · <a href="/ayuda">Cómo comprar</a></p>
</main>`;
  html = html.replace('<div id="root"></div>', `<div id="root">${contenido}</div>`);
  return html;
}

const lista = (titulo, items) => (items.length ? `<section><h2>${esc(titulo)}</h2><ul>${items.map(([href, texto]) => `<li><a href="${href}">${esc(texto)}</a></li>`).join('')}</ul></section>` : '');
// Como carpeta (/pasajes/merida/index.html) y como archivo (/pasajes/merida.html): con `cleanUrls`
// de Vercel la dirección sin barra ni .html entrega esta página, no la de la web vacía
const escribir = async (ruta, html) => {
  const dir = join(DIST, ruta);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), html);
  await writeFile(`${dir}.html`, html);
};

const urls = ['/', '/salidas', '/ayuda', '/pasajes'];
const migasBase = [{ nombre: 'Inicio', ruta: '/' }, { nombre: 'Pasajes', ruta: '/pasajes' }];

// Índice por estado
const porEstado = new Map();
for (const c of ciudades) porEstado.set(c.estado ?? 'Otras', [...(porEstado.get(c.estado ?? 'Otras') ?? []), c]);
const indice = [...porEstado.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([e, cs]) => lista(e, cs.map((c) => [rutaCiudad(c.nombre), `Pasajes en ${c.nombre}`]))).join('');
await escribir('/pasajes', pagina('/pasajes', textosIndice(), indice, migasBase));

// Una página por ciudad
for (const c of ciudades) {
  const desde = [...pares.values()].filter((p) => p.origen === c.nombre);
  const hacia = [...pares.values()].filter((p) => p.destino === c.nombre);
  const ruta = rutaCiudad(c.nombre);
  const t = textosCiudad(c.nombre, c.estado, { desde, hacia });
  const cuerpo =
    lista(`Viajes desde ${c.nombre}`, desde.map((p) => [rutaPar(p.origen, p.destino), `Pasajes de ${p.origen} a ${p.destino}${p.precio != null ? ` desde $${p.precio}` : ''}`])) +
    lista(`Viajes hacia ${c.nombre}`, hacia.map((p) => [rutaPar(p.origen, p.destino), `Pasajes de ${p.origen} a ${p.destino}`])) +
    lista(`Otras ciudades de ${c.estado ?? ''}`, ciudades.filter((x) => x.estado === c.estado && x.nombre !== c.nombre).map((x) => [rutaCiudad(x.nombre), `Pasajes en ${x.nombre}`]));
  await escribir(ruta, pagina(ruta, t, cuerpo, [...migasBase, { nombre: c.nombre, ruta }]));
  urls.push(ruta);
}

// Una página por ruta publicada
for (const p of pares.values()) {
  const ruta = rutaPar(p.origen, p.destino);
  const t = textosPar(p.origen, p.destino, { precioDesde: p.precio, duracionMin: p.duracionMin, distanciaKm: p.distanciaKm, lineas: lineasDe(p.origen, p.destino) });
  const cuerpo =
    lista('Viaje de vuelta', [[rutaPar(p.destino, p.origen), `Pasajes de ${p.destino} a ${p.origen}`]]) +
    lista(`Más viajes desde ${p.origen}`, [...pares.values()].filter((x) => x.origen === p.origen && x.destino !== p.destino).map((x) => [rutaPar(x.origen, x.destino), `Pasajes de ${x.origen} a ${x.destino}`]));
  await escribir(ruta, pagina(ruta, t, cuerpo, [...migasBase, { nombre: p.origen, ruta: rutaCiudad(p.origen) }, { nombre: `${p.origen} a ${p.destino}`, ruta }]));
  urls.push(ruta);
}

// Mapa del sitio
const hoy = new Date().toISOString().slice(0, 10);
const rutasDePar = new Set([...pares.values()].map((p) => rutaPar(p.origen, p.destino)));
const prioridad = (u) => (u === '/' ? '1.0' : u === '/pasajes' ? '0.9' : rutasDePar.has(u) ? '0.8' : u.startsWith('/pasajes/') ? '0.7' : '0.5');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${DOMINIO}${u}</loc><lastmod>${hoy}</lastmod><changefreq>${u === '/' || u.startsWith('/pasajes') ? 'daily' : 'weekly'}</changefreq><priority>${prioridad(u)}</priority></url>`).join('\n')}
</urlset>
`;
await writeFile(join(DIST, 'sitemap.xml'), sitemap);
console.log(`SEO: ${ciudades.length} ciudades, ${pares.size} rutas, ${urls.length} páginas en el sitemap (datos: ${ciudadesApi ? 'API' : 'catálogo incluido'})`);
