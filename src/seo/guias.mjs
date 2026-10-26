/**
 * Guías de ruta: las rutas de bus que la gente busca en Google aunque todavía
 * ninguna línea las venda en Butaca. Cada guía responde lo que se busca
 * («cuánto cuesta», «cuántas horas», «de qué terminal sale») con datos reales,
 * y pide el WhatsApp para avisar cuando la ruta se venda. Cuando una línea
 * publica la ruta, la misma dirección pasa a ser la página de venta.
 *
 * Qué rutas: las que aparecen en las sugerencias de Google para «pasaje de
 * [ciudad] a», «precio pasaje caracas», «cuántas horas de caracas a» (oct 2026).
 *
 * Los datos:
 *   · km y minutos: aproximados por carretera; se dicen como «unas 13 h».
 *   · precio: SOLO con fuente publicada y su fecha. Sin fuente, no se pone.
 *   · líneas: las que la prensa o los agregadores nombran en esa ruta.
 * Se comparten con el HTML para Google (scripts/prerender-seo.mjs).
 */

/** De dónde sale cada precio de referencia. */
export const FUENTES = {
  sitssa: { nombre: 'la tarifa referencial de SITSSA', fecha: '2025-08', url: 'https://eldiario.com/2025/08/04/sitssa-precios-pasajes-autobus-caracas-interior-del-pais/' },
  eldiario: { nombre: 'el sondeo de El Diario', fecha: '2026-03', url: 'https://eldiario.com/2026/03/26/semana-santa-2026-cuanto-cuesta-viajar-en-autobus-desde-caracas/' },
  rome2rio: { nombre: 'la estimación de Rome2Rio para líneas privadas', fecha: '2026-10', url: 'https://www.rome2rio.com/' },
  elnacional: { nombre: 'el sondeo de El Nacional', fecha: '2024-12', url: 'https://www.elnacional.com/2024/12/cuanto-cuesta-viajar-en-venezuela-durante-la-epoca-decembrina/' },
  temporada: { nombre: 'la lista de temporada de Venezuela en Marcha', fecha: '2025-12', url: 'https://venezuelaenmarcha.org/la-lista-de-precios-para-viajar-en-autobus-a-varios-estados-de-venezuela-durante-la-temporada-decembrina/' },
};

/** Cómo se busca una ciudad cuando su nombre del catálogo no es el de la calle. */
export const ALIAS = { 'Ciudad Guayana': 'Puerto Ordaz' };
export const nombreVisible = (c) => (ALIAS[c] ? `${ALIAS[c]} (${c})` : c);

/** Estados que en Caracas salen del Terminal de Oriente; el resto, de La Bandera. */
const ESTADOS_ORIENTE = new Set(['Anzoátegui', 'Sucre', 'Monagas', 'Bolívar', 'Delta Amacuro', 'Nueva Esparta']);
const TERMINAL = {
  Valencia: 'Terminal Big Low Center',
  Mérida: 'Terminal José Antonio Paredes',
  'Ciudad Guayana': 'Terminal de Puerto Ordaz',
  'San Cristóbal': 'Terminal de Pasajeros de San Cristóbal',
};
/** Terminal de una ciudad en un viaje; Caracas depende de hacia dónde va. */
export function terminalDe(ciudad, otraEstado) {
  if (ciudad === 'Caracas') return ESTADOS_ORIENTE.has(otraEstado) ? 'Terminal de Oriente' : 'Terminal La Bandera';
  return TERMINAL[ciudad] ?? `Terminal de pasajeros de ${ciudad}`;
}

const L = { sitssa: 'SITSSA', llanos: 'Expresos Los Llanos', aero: 'Aeroexpresos Ejecutivos', busi: 'Busi', flamingo: 'Expresos Flamingo' };
const p = (min, max, ...fuentes) => ({ min, max, fuentes });

/** [ciudad A, ciudad B, km, minutos, precio de referencia | null, líneas]. Vale para ida y vuelta. */
const DATOS = [
  // Desde Caracas (las más buscadas)
  ['Caracas', 'Valencia', 165, 150, p(7, 10, 'eldiario'), [L.aero]],
  ['Caracas', 'Maracay', 110, 105, p(5, 10, 'eldiario'), [L.aero]],
  ['Caracas', 'Barquisimeto', 360, 330, p(12, 15, 'sitssa', 'temporada'), [L.sitssa, L.aero]],
  ['Caracas', 'Maracaibo', 700, 630, p(23, 35, 'sitssa', 'eldiario'), [L.sitssa, L.llanos, L.aero]],
  ['Caracas', 'San Cristóbal', 830, 810, p(29, 45, 'sitssa', 'rome2rio'), [L.sitssa, L.llanos, L.flamingo]],
  ['Caracas', 'San Antonio del Táchira', 870, 840, p(35, 55, 'rome2rio', 'elnacional'), [L.llanos, L.aero, L.busi]],
  ['Caracas', 'Mérida', 680, 690, p(27, 35, 'sitssa', 'temporada'), [L.sitssa]],
  ['Caracas', 'Barinas', 520, 510, p(21, 25, 'sitssa', 'elnacional'), [L.sitssa, L.aero]],
  ['Caracas', 'Valera', 540, 510, p(21, 21, 'sitssa'), [L.sitssa]],
  ['Caracas', 'Boconó', 520, 540, p(21, 21, 'sitssa'), [L.sitssa]],
  ['Caracas', 'Guanare', 430, 420, p(17, 17, 'sitssa'), [L.sitssa]],
  ['Caracas', 'Acarigua', 370, 360, null, [L.llanos]],
  ['Caracas', 'Coro', 450, 420, p(17, 17, 'sitssa'), [L.sitssa]],
  ['Caracas', 'Punto Fijo', 530, 480, p(21, 21, 'sitssa'), [L.sitssa]],
  ['Caracas', 'San Fernando de Apure', 400, 420, p(13, 13, 'sitssa'), [L.sitssa]],
  ['Caracas', 'San Juan de los Morros', 150, 150, null, []],
  ['Caracas', 'Puerto La Cruz', 320, 300, p(12, 26, 'sitssa', 'rome2rio'), [L.sitssa, L.llanos, L.aero, L.busi]],
  ['Caracas', 'Barcelona', 310, 300, null, []],
  ['Caracas', 'Cumaná', 400, 390, p(13, 13, 'sitssa'), [L.sitssa]],
  ['Caracas', 'Carúpano', 520, 510, p(16, 16, 'sitssa'), [L.sitssa]],
  ['Caracas', 'Maturín', 520, 480, p(17, 17, 'sitssa'), [L.sitssa, L.aero]],
  ['Caracas', 'El Tigre', 440, 420, p(18, 18, 'sitssa'), [L.sitssa]],
  ['Caracas', 'Anaco', 400, 390, p(16, 16, 'sitssa'), [L.sitssa]],
  ['Caracas', 'Tucupita', 750, 690, p(23, 23, 'sitssa'), [L.sitssa]],
  ['Caracas', 'Ciudad Guayana', 680, 600, null, []],
  ['Caracas', 'Ciudad Bolívar', 590, 540, null, []],
  // Desde San Cristóbal
  ['San Cristóbal', 'Mérida', 230, 330, null, []],
  ['San Cristóbal', 'Maracaibo', 440, 480, null, []],
  ['San Cristóbal', 'Valencia', 680, 660, null, [L.llanos]],
  ['San Cristóbal', 'Barquisimeto', 520, 540, null, []],
  ['San Cristóbal', 'Barinas', 300, 330, null, []],
  ['San Cristóbal', 'Maracay', 720, 720, null, []],
  // Desde Maracaibo
  ['Maracaibo', 'Valencia', 560, 510, null, []],
  ['Maracaibo', 'Barquisimeto', 340, 330, null, []],
  ['Maracaibo', 'Coro', 260, 240, null, []],
  ['Maracaibo', 'Maracay', 610, 570, null, []],
  ['Maracaibo', 'Mérida', 400, 420, null, []],
  ['Maracaibo', 'Punto Fijo', 330, 300, null, []],
  // Desde Valencia
  ['Valencia', 'Barquisimeto', 190, 180, null, []],
  ['Valencia', 'Maracay', 50, 60, null, []],
  ['Valencia', 'Puerto Cabello', 55, 60, null, []],
  ['Valencia', 'Puerto La Cruz', 470, 450, null, []],
  ['Valencia', 'Maturín', 660, 600, null, []],
  ['Valencia', 'Ciudad Guayana', 800, 720, null, []],
  ['Valencia', 'Mérida', 530, 540, null, []],
  ['Valencia', 'San Antonio del Táchira', 720, 690, null, []],
  // Desde Barquisimeto y Mérida
  ['Barquisimeto', 'Mérida', 400, 450, null, []],
  ['Barquisimeto', 'Barinas', 300, 300, null, []],
  ['Barquisimeto', 'Acarigua', 80, 75, null, []],
  ['Barquisimeto', 'Maracay', 240, 225, null, []],
  ['Barquisimeto', 'Coro', 300, 300, null, []],
  ['Mérida', 'Barinas', 160, 240, null, []],
  // Oriente y Guayana
  ['Puerto La Cruz', 'Maturín', 200, 210, null, []],
  ['Puerto La Cruz', 'Ciudad Guayana', 300, 300, null, []],
  ['Puerto La Cruz', 'Cumaná', 85, 90, null, []],
  ['Maturín', 'Ciudad Guayana', 190, 210, null, []],
  ['Ciudad Guayana', 'Ciudad Bolívar', 110, 90, null, []],
];

/** La guía de un sentido. `estados` da el estado de cada ciudad (para la terminal de Caracas). */
function guia(fila, sentido, estados) {
  const [a, b, km, minutos, precio, lineas] = fila;
  const [origen, destino] = sentido === 'ida' ? [a, b] : [b, a];
  return {
    origen,
    destino,
    km,
    minutos,
    precio,
    lineas,
    terminalSalida: terminalDe(origen, estados.get(destino)),
    terminalLlegada: terminalDe(destino, estados.get(origen)),
  };
}

/** Todas las guías, en los dos sentidos. Solo con ciudades del catálogo. */
export function todasLasGuias(ciudades) {
  const estados = new Map(ciudades.map((c) => [c.nombre, c.estado ?? null]));
  return DATOS.filter(([a, b]) => estados.has(a) && estados.has(b)).flatMap((f) => [guia(f, 'ida', estados), guia(f, 'vuelta', estados)]);
}

export function guiaDe(origen, destino, ciudades) {
  return todasLasGuias(ciudades).find((g) => g.origen === origen && g.destino === destino) ?? null;
}

/** Páginas de terminal: lo que más se busca después de las rutas («terminal la bandera precios de pasajes 2026»). */
export const TERMINALES = [
  {
    slug: 'la-bandera',
    nombre: 'Terminal La Bandera',
    ciudad: 'Caracas',
    direccion: 'Avenida Nueva Granada, sector La Bandera, Caracas',
    cubre: 'occidente, los Andes, los Llanos y el centro del país',
  },
  {
    slug: 'oriente',
    nombre: 'Terminal de Oriente',
    ciudad: 'Caracas',
    direccion: 'Autopista Gran Mariscal de Ayacucho (Petare–Guarenas), Caracas',
    cubre: 'el oriente del país y Guayana',
  },
];
export const rutaTerminal = (slugTerminal) => `/terminales/${slugTerminal}`;
