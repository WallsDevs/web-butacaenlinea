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
import { DOMINIO, RUTA_PRECIOS, TEMPORADAS, datosEstructurados, filasSalidas, resumenPar, rutaCiudad, rutaLinea, rutaPar, rutaTemporada, textosCiudad, textosIndice, textosLinea, textosPar, textosGuia, textosPrecios, textosTemporada, textosTerminal } from '../src/seo/contenido.mjs';
import { TERMINALES, nombreVisible, rutaTerminal, todasLasGuias } from '../src/seo/guias.mjs';

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
const tasaBcv = Number((await pedir('/api/tasas/vigentes'))?.bcv) || null;

// Un registro por par origen → destino, con el precio más bajo
const pares = new Map();
for (const r of Array.isArray(rutas) ? rutas : []) {
  if (!r.origen || !r.destino) continue;
  const k = `${r.origen}→${r.destino}`;
  const precios = (r.tarifas ?? []).map((t) => Number(t.precioUsd)).filter((n) => n > 0);
  const min = precios.length ? Math.min(...precios) : null;
  const a = pares.get(k);
  const lugar = (l) => (l && typeof l === 'object' ? l.nombre ?? null : null);
  if (!a) pares.set(k, { origen: r.origen, destino: r.destino, precio: min, duracionMin: r.duracionMin || null, distanciaKm: r.distanciaKm || null, terminalSalida: lugar(r.origenLugar), terminalLlegada: lugar(r.destinoLugar), cambio: r.updatedAt ?? null });
  else {
    if (min != null && (a.precio == null || min < a.precio)) a.precio = min;
    if (r.updatedAt && (!a.cambio || r.updatedAt > a.cambio)) a.cambio = r.updatedAt;
  }
}

// Las próximas salidas de cada par (14 días): son la tabla de horarios y los datos que solo esa ruta tiene
const ahora = new Date();
const hasta = new Date(ahora.getTime() + 14 * 24 * 3600_000);
const salidasDe = new Map();
const listaPares = [...pares.values()];
for (let i = 0; i < listaPares.length; i += 6) {
  await Promise.all(
    listaPares.slice(i, i + 6).map(async (p) => {
      const q = new URLSearchParams({
        'populate[ruta]': 'true',
        'populate[linea]': 'true',
        sort: 'fechaHoraSalida',
        'pagination[pageSize]': '30',
        'filters[ruta][origen][$eq]': p.origen,
        'filters[ruta][destino][$eq]': p.destino,
        'filters[fechaHoraSalida][$gte]': ahora.toISOString(),
        'filters[fechaHoraSalida][$lte]': hasta.toISOString(),
        // Lo mismo que la web: solo lo que todavía se puede comprar (no canceladas ni ya en ruta)
        'filters[estado][$in][0]': 'programada',
        'filters[estado][$in][1]': 'abordando',
      });
      const lista = (await pedir(`/api/salidas?${q}`)) ?? [];
      salidasDe.set(`${p.origen}→${p.destino}`, Array.isArray(lista) ? lista : []);
      // La página cambia cuando cambia la ruta o alguna de sus salidas
      for (const s of salidasDe.get(`${p.origen}→${p.destino}`)) if (s.updatedAt && (!p.cambio || s.updatedAt > p.cambio)) p.cambio = s.updatedAt;
    })
  );
}
const filasDe = (p) => filasSalidas(salidasDe.get(`${p.origen}→${p.destino}`) ?? [], tasaBcv);

const plantilla = await readFile(join(DIST, 'index.html'), 'utf8');

/** La página: la plantilla de la web con su cabecera y su contenido visible. */
function pagina(ruta, t, cuerpo, migas, { noindex = false, viajes = [], comprar = true } = {}) {
  const url = `${DOMINIO}${ruta}`;
  const datos = datosEstructurados(ruta, migas, t.preguntas, viajes);
  let html = plantilla
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(t.titulo)}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${esc(t.descripcion)}" />`)
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(t.titulo)}" />`)
    .replace(/<meta\s+property="og:description"[\s\S]*?\/>/, `<meta property="og:description" content="${esc(t.descripcion)}" />`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}" />`)
    .replace('</head>', `${noindex ? '<meta name="robots" content="noindex, follow" />\n' : ''}<script type="application/ld+json" data-seo-pagina="1">${JSON.stringify(datos).replace(/</g, '\\u003c')}</script>\n</head>`);
  const migasHtml = migas.map((m, i) => (i === migas.length - 1 ? `<span>${esc(m.nombre)}</span>` : `<a href="${m.ruta}">${esc(m.nombre)}</a>`)).join(' › ');
  const preguntas = (t.preguntas ?? []).map((q) => `<h3>${esc(q.p)}</h3><p>${esc(q.r)}</p>`).join('');
  const contenido = `<main style="max-width:1080px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif;color:#0F172A">
<nav style="font-size:13px">${migasHtml}</nav>
<h1>${esc(t.h1)}</h1>
${t.respuesta ? `<p><strong>${esc(t.respuesta)}</strong></p>` : ''}
<p>${esc(t.intro)}</p>
${(t.datos ?? []).length ? `<ul>${t.datos.map((d) => `<li><strong>${esc(d.k)}:</strong> ${esc(d.v)}</li>`).join('')}</ul>` : ''}
${t.notaPrecio ? `<p><small>${esc(t.notaPrecio)}</small></p>` : ''}
${comprar ? `<p><a href="${ruta}">Buscar salidas y comprar pasajes</a></p>` : ''}
${cuerpo}
${preguntas ? `<section><h2>Preguntas frecuentes</h2>${preguntas}</section>` : ''}
<p><a href="/pasajes">Pasajes en todas las ciudades de Venezuela</a> · <a href="/ayuda">Cómo comprar</a></p>
</main>`;
  html = html.replace('<div id="root"></div>', `<div id="root">${contenido}</div>`);
  return html;
}

const tablaSalidas = (titulo, filas) =>
  filas.length
    ? `<section><h2>${esc(titulo)}</h2><table><thead><tr><th>Día</th><th>Sale</th><th>Llega</th><th>Línea</th><th>Desde</th></tr></thead><tbody>${filas
        .slice(0, 20)
        .map((f) => `<tr><td>${esc(f.fecha)}</td><td>${esc(f.hora)}</td><td>${esc(f.horaLlegada ?? '—')}</td><td>${esc(f.linea ?? '')}</td><td>${f.desdeUsd != null ? `$${f.desdeUsd}${f.desdeBs ? ` · Bs ${f.desdeBs.toLocaleString('es-VE')}` : ''}` : '—'}</td></tr>`)
        .join('')}</tbody></table></section>`
    : '';
const lista = (titulo, items) => (items.length ? `<section><h2>${esc(titulo)}</h2><ul>${items.map(([href, texto]) => `<li><a href="${href}">${esc(texto)}</a></li>`).join('')}</ul></section>` : '');
// Como carpeta (/pasajes/merida/index.html) y como archivo (/pasajes/merida.html): con `cleanUrls`
// de Vercel la dirección sin barra ni .html entrega esta página, no la de la web vacía
const escribir = async (ruta, html) => {
  const dir = join(DIST, ruta);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), html);
  await writeFile(`${dir}.html`, html);
};

// Mapa del sitio: solo lo que tiene oferta, con la fecha real del último cambio (sin fecha si no se sabe)
const urls = [{ u: '/' }, { u: '/salidas' }, { u: '/ayuda' }];
const masNueva = (fechas) => fechas.filter(Boolean).sort().pop() ?? null;
const migasBase = [{ nombre: 'Inicio', ruta: '/' }, { nombre: 'Pasajes', ruta: '/pasajes' }];

// Solo se enlazan las ciudades con alguna ruta a la venta: las demás (pueblos de rutas urbanas
// como Táriba) tienen su página por dirección, pero no se ofrecen como destino de bus
// Guías: rutas buscadas que todavía ninguna línea vende aquí (las que ya se venden tienen su página de venta)
const guias = todasLasGuias(ciudades).filter((g) => !pares.has(`${g.origen}→${g.destino}`));
const conRuta = new Set([...pares.values(), ...guias].flatMap((p) => [p.origen, p.destino]));
const conPasajes = ciudades.filter((c) => conRuta.has(c.nombre));

// Índice por estado
const porEstado = new Map();
for (const c of conPasajes) porEstado.set(c.estado ?? 'Otras', [...(porEstado.get(c.estado ?? 'Otras') ?? []), c]);
const indice = [...porEstado.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([e, cs]) => lista(e, cs.map((c) => [rutaCiudad(c.nombre), `Pasajes en ${c.nombre}`]))).join('');
const temporadasVivas = TEMPORADAS.filter((t) => new Date(`${t.hasta}T23:59:59-04:00`).getTime() >= Date.now());
await escribir('/pasajes', pagina('/pasajes', textosIndice(), lista('Precios y temporadas', [[RUTA_PRECIOS, 'Precios de pasajes de autobús hoy, en dólares y bolívares'], ...TERMINALES.map((x) => [rutaTerminal(x.slug), `${x.nombre}: precios de pasajes`]), ...temporadasVivas.map((t) => [rutaTemporada(t.slug), `Pasajes para ${t.nombre} ${t.anio}`])]) + indice, migasBase));
urls.push({ u: '/pasajes', cambio: masNueva(listaPares.map((p) => p.cambio)) });

// Una página por ciudad
for (const c of ciudades) {
  const desde = [...pares.values()].filter((p) => p.origen === c.nombre);
  const hacia = [...pares.values()].filter((p) => p.destino === c.nombre);
  const ruta = rutaCiudad(c.nombre);
  const t = textosCiudad(c.nombre, c.estado, { desde, hacia });
  const gDesde = guias.filter((g) => g.origen === c.nombre);
  const gHacia = guias.filter((g) => g.destino === c.nombre);
  const enlaceGuia = (g) => [rutaPar(g.origen, g.destino), `Pasaje de ${nombreVisible(g.origen)} a ${nombreVisible(g.destino)}${g.precio ? ` desde $${g.precio.min}` : ''}`];
  const cuerpo =
    lista(`Guías de viaje en bus desde ${nombreVisible(c.nombre)}`, gDesde.map(enlaceGuia)) +
    lista(`Guías de viaje en bus hacia ${nombreVisible(c.nombre)}`, gHacia.map(enlaceGuia)) +
    lista(`Viajes desde ${c.nombre}`, desde.map((p) => [rutaPar(p.origen, p.destino), `Pasajes de ${p.origen} a ${p.destino}${p.precio != null ? ` desde $${p.precio}` : ''}`])) +
    lista(`Viajes hacia ${c.nombre}`, hacia.map((p) => [rutaPar(p.origen, p.destino), `Pasajes de ${p.origen} a ${p.destino}`])) +
    (conRuta.has(c.nombre)
      ? lista(`Otras ciudades de ${c.estado ?? ''}`, conPasajes.filter((x) => x.estado === c.estado && x.nombre !== c.nombre).map((x) => [rutaCiudad(x.nombre), `Pasajes en ${x.nombre}`]))
      : lista('Ciudades con pasajes de autobús', conPasajes.map((x) => [rutaCiudad(x.nombre), `Pasajes en ${x.nombre}`])));
  // Sin ninguna ruta que la toque, la página existe para la gente pero no se indexa: 59 páginas
  // casi iguales sin oferta son relleno para Google y bajan al sitio entero
  const conOferta = desde.length > 0 || hacia.length > 0 || gDesde.length > 0 || gHacia.length > 0;
  await escribir(ruta, pagina(ruta, t, cuerpo, [...migasBase, { nombre: c.nombre, ruta }], { noindex: !conOferta }));
  if (conOferta) urls.push({ u: ruta, cambio: masNueva([...desde, ...hacia].map((p) => p.cambio)) });
}

// Una página por ruta publicada
for (const p of pares.values()) {
  const ruta = rutaPar(p.origen, p.destino);
  const filas = filasDe(p);
  const resumen = resumenPar(filas, { precioDesde: p.precio, tasaBcv });
  const t = textosPar(p.origen, p.destino, { precioDesde: p.precio, duracionMin: p.duracionMin, distanciaKm: p.distanciaKm, resumen, terminalSalida: p.terminalSalida, terminalLlegada: p.terminalLlegada });
  const lineasRuta = [...new Map(filas.filter((f) => f.lineaSlug).map((f) => [f.lineaSlug, f.linea])).entries()];
  const cuerpo =
    tablaSalidas(`Horarios de ${p.origen} a ${p.destino}`, filas) +
    lista('Líneas que viajan esta ruta', lineasRuta.map(([sl, nombre]) => [rutaLinea(sl), `Pasajes de ${nombre}`])) +
    lista('Viaje de vuelta', [[rutaPar(p.destino, p.origen), `Pasajes de ${p.destino} a ${p.origen}`]]) +
    lista(`Más viajes desde ${p.origen}`, [...pares.values()].filter((x) => x.origen === p.origen && x.destino !== p.destino).map((x) => [rutaPar(x.origen, x.destino), `Pasajes de ${x.origen} a ${x.destino}`]));
  const viajes = filas.map((f) => ({ ...f, origen: p.origen, destino: p.destino, terminalSalida: p.terminalSalida, terminalLlegada: p.terminalLlegada }));
  await escribir(ruta, pagina(ruta, t, cuerpo, [...migasBase, { nombre: p.origen, ruta: rutaCiudad(p.origen) }, { nombre: `${p.origen} a ${p.destino}`, ruta }], { viajes }));
  urls.push({ u: ruta, cambio: p.cambio });
}

// Una guía por ruta buscada que todavía no se vende: precio de referencia, horas, terminales y «avísame»
for (const g of guias) {
  const ruta = rutaPar(g.origen, g.destino);
  const t = textosGuia(g);
  const vuelta = guias.find((x) => x.origen === g.destino && x.destino === g.origen) || pares.has(`${g.destino}→${g.origen}`);
  const cuerpo =
    `<section><h2>¿Viajas de ${esc(nombreVisible(g.origen))} a ${esc(nombreVisible(g.destino))}?</h2><p>Todavía no vendemos esta ruta en línea. Déjanos tu WhatsApp en esta página y te avisamos apenas una línea la publique.</p></section>` +
    (vuelta ? lista('Viaje de vuelta', [[rutaPar(g.destino, g.origen), `Pasaje de ${nombreVisible(g.destino)} a ${nombreVisible(g.origen)}`]]) : '') +
    lista(`Más rutas desde ${nombreVisible(g.origen)}`, [
      ...[...pares.values()].filter((x) => x.origen === g.origen).map((x) => [rutaPar(x.origen, x.destino), `Pasajes de ${x.origen} a ${x.destino}`]),
      ...guias.filter((x) => x.origen === g.origen && x.destino !== g.destino).map((x) => [rutaPar(x.origen, x.destino), `Pasaje de ${nombreVisible(x.origen)} a ${nombreVisible(x.destino)}`]),
    ]) +
    (TERMINALES.some((x) => x.nombre === g.terminalSalida) ? lista('El terminal', TERMINALES.filter((x) => x.nombre === g.terminalSalida).map((x) => [rutaTerminal(x.slug), `${x.nombre}: precios de pasajes`])) : '');
  await escribir(ruta, pagina(ruta, t, cuerpo, [...migasBase, { nombre: g.origen, ruta: rutaCiudad(g.origen) }, { nombre: `${g.origen} a ${g.destino}`, ruta }], { comprar: false }));
  urls.push({ u: ruta, cambio: null });
}

// Páginas de terminal («terminal la bandera precios de pasajes 2026»)
for (const term of TERMINALES) {
  const destinos = todasLasGuias(ciudades).filter((g) => g.origen === term.ciudad && g.terminalSalida === term.nombre).sort((a, b) => (a.precio?.min ?? 999) - (b.precio?.min ?? 999));
  if (!destinos.length) continue;
  const t = textosTerminal(term, destinos);
  const tabla = `<section><h2>Destinos y precios de referencia</h2><table><thead><tr><th>Destino</th><th>Precio de referencia</th><th>Duración</th></tr></thead><tbody>${destinos
    .map((g) => `<tr><td><a href="${rutaPar(g.origen, g.destino)}">${esc(nombreVisible(g.destino))}</a></td><td>${g.precio ? (g.precio.min === g.precio.max ? `$${g.precio.min}` : `$${g.precio.min}–${g.precio.max}`) : '—'}</td><td>${Math.floor(g.minutos / 60)} h${g.minutos % 60 ? ` ${g.minutos % 60} min` : ''}</td></tr>`)
    .join('')}</tbody></table></section>` + lista('Otros terminales', TERMINALES.filter((x) => x.slug !== term.slug).map((x) => [rutaTerminal(x.slug), `${x.nombre}: precios de pasajes`]));
  await escribir(t.ruta, pagina(t.ruta, t, tabla, [...migasBase, { nombre: term.nombre, ruta: t.ruta }], { comprar: false }));
  urls.push({ u: t.ruta, cambio: null });
}

// Una página por línea que vende: sus rutas (con precio desde) y sus próximas salidas
const lineas = ((await pedir('/api/lineas')) ?? []).filter((l) => l?.slug && l?.activa !== false);
let paginasLinea = 0;
for (const l of lineas) {
  const rutasL = (await pedir(`/api/rutas?populate[tarifas]=true&pagination[pageSize]=100&filters[linea][slug][$eq]=${encodeURIComponent(l.slug)}`)) ?? [];
  if (!Array.isArray(rutasL) || !rutasL.length) continue;
  const salidasL =
    (await pedir(
      `/api/salidas?populate[ruta]=true&populate[linea]=true&sort=fechaHoraSalida&pagination[pageSize]=30&filters[linea][slug][$eq]=${encodeURIComponent(l.slug)}&filters[fechaHoraSalida][$gte]=${encodeURIComponent(ahora.toISOString())}&filters[fechaHoraSalida][$lte]=${encodeURIComponent(hasta.toISOString())}&filters[estado][$in][0]=programada&filters[estado][$in][1]=abordando`
    )) ?? [];
  const filasL = filasSalidas(Array.isArray(salidasL) ? salidasL : [], tasaBcv).map((f, i) => ({ ...f, ruta: salidasL[i]?.ruta ?? null }));
  const paresL = new Map();
  for (const r of rutasL) {
    if (!r.origen || !r.destino) continue;
    const precios = (r.tarifas ?? []).map((t) => Number(t.precioUsd)).filter((n) => n > 0);
    const k = `${r.origen}→${r.destino}`;
    const min = precios.length ? Math.min(...precios) : null;
    const a = paresL.get(k);
    if (!a || (min != null && (a.precio == null || min < a.precio))) paresL.set(k, { origen: r.origen, destino: r.destino, precio: min });
  }
  const rutasLista = [...paresL.values()];
  const semana = filasL.filter((f) => new Date(f.salida).getTime() <= ahora.getTime() + 7 * 24 * 3600_000).length;
  const t = textosLinea(l.nombre, { rutas: rutasLista, salidasSemana: semana, terminalBase: l.terminalBase ?? null });
  const ruta = rutaLinea(l.slug);
  const tablaL = filasL.length
    ? `<section><h2>Próximas salidas de ${esc(l.nombre)}</h2><table><thead><tr><th>Ruta</th><th>Día</th><th>Sale</th><th>Desde</th></tr></thead><tbody>${filasL
        .slice(0, 20)
        .map((f) => `<tr><td>${f.ruta ? `<a href="${rutaPar(f.ruta.origen, f.ruta.destino)}">${esc(f.ruta.origen)} a ${esc(f.ruta.destino)}</a>` : ''}</td><td>${esc(f.fecha)}</td><td>${esc(f.hora)}</td><td>${f.desdeUsd != null ? `$${f.desdeUsd}` : '—'}</td></tr>`)
        .join('')}</tbody></table></section>`
    : '';
  const cuerpo = lista(`Rutas de ${l.nombre}`, rutasLista.map((r) => [rutaPar(r.origen, r.destino), `${r.origen} a ${r.destino}${r.precio != null ? ` · desde $${r.precio}` : ''}`])) + tablaL;
  const viajes = filasL.filter((f) => f.ruta).map((f) => ({ ...f, origen: f.ruta.origen, destino: f.ruta.destino }));
  await escribir(ruta, pagina(ruta, t, cuerpo, [{ nombre: 'Inicio', ruta: '/' }, { nombre: 'Líneas', ruta: '/pasajes' }, { nombre: l.nombre, ruta }], { viajes }));
  urls.push({ u: ruta, cambio: masNueva([l.updatedAt, ...rutasL.map((r) => r.updatedAt), ...(Array.isArray(salidasL) ? salidasL : []).map((x) => x.updatedAt)]) });
  paginasLinea++;
}

// Precios de hoy: todas las rutas con su precio desde, en dólares y en bolívares
if (listaPares.length) {
  const fechaHoy = new Date().toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Caracas' });
  const t = textosPrecios(fechaHoy, listaPares.length);
  const filasP = [...listaPares].sort((a, b) => `${a.origen}${a.destino}`.localeCompare(`${b.origen}${b.destino}`));
  const tablaP = `<section><h2>Precio desde, por ruta</h2><table><thead><tr><th>Ruta</th><th>Desde ($)</th><th>Desde (Bs)</th><th>Duración</th></tr></thead><tbody>${filasP
    .map((p) => `<tr><td><a href="${rutaPar(p.origen, p.destino)}">${esc(p.origen)} a ${esc(p.destino)}</a></td><td>${p.precio != null ? `$${p.precio}` : '—'}</td><td>${p.precio != null && tasaBcv ? `Bs ${Math.round(p.precio * tasaBcv).toLocaleString('es-VE')}` : '—'}</td><td>${p.duracionMin ? `${Math.floor(p.duracionMin / 60)} h ${p.duracionMin % 60 ? `${p.duracionMin % 60} min` : ''}` : '—'}</td></tr>`)
    .join('')}</tbody></table></section>`;
  await escribir(RUTA_PRECIOS, pagina(RUTA_PRECIOS, t, tablaP, [...migasBase, { nombre: 'Precios de hoy', ruta: RUTA_PRECIOS }]));
  urls.push({ u: RUTA_PRECIOS, cambio: new Date().toISOString() });
}

// Temporadas vigentes (hasta que terminan): las salidas publicadas en esas fechas y las rutas con precio
for (const temp of TEMPORADAS) {
  const fin = new Date(`${temp.hasta}T23:59:59-04:00`);
  if (fin.getTime() < ahora.getTime() || !listaPares.length) continue;
  const salidasT =
    (await pedir(
      `/api/salidas?populate[ruta]=true&populate[linea]=true&sort=fechaHoraSalida&pagination[pageSize]=100&filters[fechaHoraSalida][$gte]=${encodeURIComponent(new Date(`${temp.desde}T00:00:00-04:00`).toISOString())}&filters[fechaHoraSalida][$lte]=${encodeURIComponent(fin.toISOString())}&filters[estado][$in][0]=programada&filters[estado][$in][1]=abordando`
    )) ?? [];
  const listaT = Array.isArray(salidasT) ? salidasT : [];
  const filasT = filasSalidas(listaT, tasaBcv).map((f, i) => ({ ...f, ruta: listaT[i]?.ruta ?? null }));
  const t = textosTemporada(temp, { salidas: filasT.length, rutas: listaPares });
  const ruta = rutaTemporada(temp.slug);
  const tablaT = filasT.length
    ? `<section><h2>Salidas publicadas</h2><table><thead><tr><th>Ruta</th><th>Día</th><th>Sale</th><th>Línea</th><th>Desde</th></tr></thead><tbody>${filasT
        .slice(0, 60)
        .map((f) => `<tr><td>${f.ruta ? `<a href="${rutaPar(f.ruta.origen, f.ruta.destino)}">${esc(f.ruta.origen)} a ${esc(f.ruta.destino)}</a>` : ''}</td><td>${esc(f.fecha)}</td><td>${esc(f.hora)}</td><td>${esc(f.linea ?? '')}</td><td>${f.desdeUsd != null ? `$${f.desdeUsd}` : '—'}</td></tr>`)
        .join('')}</tbody></table></section>`
    : '';
  const cuerpo = tablaT + lista('Rutas y precio desde', [...listaPares].sort((a, b) => (a.precio ?? 999) - (b.precio ?? 999)).map((p) => [rutaPar(p.origen, p.destino), `${p.origen} a ${p.destino}${p.precio != null ? ` · desde $${p.precio}` : ''}`]));
  const viajes = filasT.filter((f) => f.ruta).map((f) => ({ ...f, origen: f.ruta.origen, destino: f.ruta.destino }));
  await escribir(ruta, pagina(ruta, t, cuerpo, [{ nombre: 'Inicio', ruta: '/' }, { nombre: 'Pasajes', ruta: '/pasajes' }, { nombre: `${temp.titulo} ${temp.anio}`, ruta }], { viajes }));
  urls.push({ u: ruta, cambio: masNueva([...listaT.map((x) => x.updatedAt), ...listaPares.map((p) => p.cambio)]) });
}

const rutasDePar = new Set([...listaPares, ...guias].map((p) => rutaPar(p.origen, p.destino)));
const prioridad = (u) => (u === '/' ? '1.0' : u === '/pasajes' || u === RUTA_PRECIOS || u.startsWith('/temporada/') || u.startsWith('/terminales/') ? '0.9' : rutasDePar.has(u) ? '0.8' : u.startsWith('/pasajes/') || u.startsWith('/lineas/') ? '0.7' : '0.5');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({ u, cambio }) => `  <url><loc>${DOMINIO}${u}</loc>${cambio ? `<lastmod>${cambio.slice(0, 10)}</lastmod>` : ''}<priority>${prioridad(u)}</priority></url>`).join('\n')}
</urlset>
`;
await writeFile(join(DIST, 'sitemap.xml'), sitemap);
const conSalidas = listaPares.filter((p) => filasDe(p).length).length;
console.log(`SEO: ${guias.length} guías, ${TERMINALES.length} terminales, ${ciudades.length} ciudades, ${pares.size} rutas (${conSalidas} con salidas próximas), ${paginasLinea} líneas, ${urls.length} páginas en el sitemap (datos: ${ciudadesApi ? 'API' : 'catálogo incluido'}${tasaBcv ? `, BCV ${tasaBcv}` : ''})`);
