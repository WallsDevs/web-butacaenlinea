/**
 * Textos de las páginas de pasajes (por ciudad y por ruta). Un solo origen
 * para la web (React) y para el HTML que se arma al publicar
 * (scripts/prerender-seo.mjs): lo que lee Google es lo mismo que ve la gente.
 * JavaScript plano (no TS) para que Node lo use sin compilar.
 */

import { ALIAS, FUENTES, nombreVisible, rutaTerminal } from './guias.mjs';

export const DOMINIO = 'https://butacaenlinea.com';
export const MARCA = 'Butaca En Línea';

export const slug = (t) =>
  String(t)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const rutaCiudad = (c) => `/pasajes/${slug(c)}`;
/** «/pasajes/maracaibo-a-caracas»: las palabras que la gente escribe en Google, en la dirección. */
export const rutaPar = (o, d) => `/pasajes/${slug(o)}-a-${slug(d)}`;

/**
 * Lee «maracaibo-a-caracas» como [origen, destino] probando cada «-a-» contra
 * las ciudades conocidas: así no se confunde aunque una ciudad lo lleve en el nombre.
 */
export function separarPar(texto, slugs) {
  for (let i = texto.indexOf('-a-'); i > 0; i = texto.indexOf('-a-', i + 1)) {
    const o = texto.slice(0, i);
    const d = texto.slice(i + 3);
    if (slugs.has(o) && slugs.has(d) && o !== d) return [o, d];
  }
  return null;
}

const horas = (min) => {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};
const dolares = (n) => `$${Number(n).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
/** Cierra la frase sin doble punto: «7:00 a. m.» ya termina en punto. */
const cerrar = (t) => (t.endsWith('.') ? t : `${t}.`);

/** Lo que Google muestra de la descripción antes de cortarla. */
export const MAX_DESCRIPCION = 155;
/**
 * Arma una descripción de hasta 155 caracteres: la primera frase siempre y
 * las siguientes, en orden, solo si caben enteras. Si la primera sola ya se
 * pasa, se corta en la última palabra que cabe (nunca a mitad de palabra).
 */
export function descripcionDe(...partes) {
  const [primera = '', ...resto] = partes.filter(Boolean);
  let texto = primera;
  for (const p of resto) if (`${texto} ${p}`.length <= MAX_DESCRIPCION) texto = `${texto} ${p}`;
  if (texto.length <= MAX_DESCRIPCION) return texto;
  const corte = texto.slice(0, MAX_DESCRIPCION - 1);
  return `${corte.slice(0, corte.lastIndexOf(' ')).replace(/[,:;·\s]+$/, '')}…`;
}
/** «Caracas, Valencia y Maracaibo» (sin pasarse de `max` nombres). */
const lista = (nombres, max) => {
  const n = nombres.slice(0, max);
  if (nombres.length > max) return `${n.join(', ')} y más`;
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n[0] ?? '';
};
const bolivares = (n) => `Bs ${Math.round(Number(n)).toLocaleString('es-VE')}`;

/** Las horas se dicen en hora de Venezuela, aunque la página se arme en un servidor de otro país. */
export const ZONA = 'America/Caracas';
export const horaVe = (iso) => new Date(iso).toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: ZONA });
export const fechaVe = (iso) => new Date(iso).toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: ZONA });
const minutosDelDia = (iso) => {
  const [h, m] = new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA }).split(':').map(Number);
  return h * 60 + m;
};
const precioMinimo = (s) => {
  const v = Object.values(s.preciosUsd ?? {}).map(Number).filter((n) => n > 0);
  return v.length ? Math.min(...v) : null;
};

/**
 * Las próximas salidas de un par, como filas de la tabla de horarios. Recibe
 * salidas del API público (fechaHoraSalida, fechaHoraLlegada, preciosUsd, linea).
 */
export function filasSalidas(salidas, tasaBcv) {
  return [...(salidas ?? [])]
    .filter((s) => s?.fechaHoraSalida)
    .sort((a, b) => a.fechaHoraSalida.localeCompare(b.fechaHoraSalida))
    .map((s) => {
      const desde = precioMinimo(s);
      return {
        id: s.documentId,
        salida: s.fechaHoraSalida,
        llegada: s.fechaHoraLlegada ?? null,
        fecha: fechaVe(s.fechaHoraSalida),
        hora: horaVe(s.fechaHoraSalida),
        horaLlegada: s.fechaHoraLlegada ? horaVe(s.fechaHoraLlegada) : null,
        linea: s.linea?.nombre ?? null,
        lineaSlug: s.linea?.slug ?? null,
        clases: Object.keys(s.preciosUsd ?? {}),
        desdeUsd: desde,
        desdeBs: desde != null && tasaBcv ? Math.round(desde * tasaBcv) : null,
      };
    });
}

/** Lo que solo esta ruta tiene: frecuencia, primera y última salida del día, la línea más económica. */
export function resumenPar(filas, { precioDesde = null, tasaBcv = null } = {}) {
  const en7dias = Date.now() + 7 * 24 * 3600_000;
  const semana = filas.filter((f) => new Date(f.salida).getTime() <= en7dias);
  const porMinuto = [...filas].sort((a, b) => minutosDelDia(a.salida) - minutosDelDia(b.salida));
  const porLinea = new Map();
  for (const f of filas) if (f.linea && f.desdeUsd != null) porLinea.set(f.linea, Math.min(porLinea.get(f.linea) ?? Infinity, f.desdeUsd));
  const barata = [...porLinea.entries()].sort((a, b) => a[1] - b[1])[0] ?? null;
  const desdeUsd = [precioDesde, ...filas.map((f) => f.desdeUsd)].filter((n) => n != null && n > 0).reduce((m, n) => Math.min(m, n), Infinity);
  const usd = Number.isFinite(desdeUsd) ? desdeUsd : null;
  return {
    desdeUsd: usd,
    desdeBs: usd != null && tasaBcv ? Math.round(usd * tasaBcv) : null,
    salidasSemana: semana.length,
    primera: porMinuto[0]?.hora ?? null,
    ultima: porMinuto.length > 1 ? porMinuto[porMinuto.length - 1].hora : null,
    lineaBarata: porLinea.size > 1 && barata ? { nombre: barata[0], desdeUsd: barata[1] } : null,
    lineas: [...new Set(filas.map((f) => f.linea).filter(Boolean))],
  };
}

/** Lo común a cualquier compra: va en las preguntas de todas las páginas. */
const PREGUNTAS_COMPRA = [
  { p: '¿Puedo escoger mi puesto?', r: 'Sí. Al abrir la salida ves el mapa del bus con los puestos libres y escoges el tuyo, igual que en la taquilla.' },
  { p: '¿Cómo pago?', r: 'Con Pago Móvil, Zelle o el saldo de tu wallet de Butaca. El boleto llega al momento con su código QR.' },
  { p: '¿Necesito imprimir el boleto?', r: 'No. Lo muestras en el teléfono al abordar, y funciona aunque no tengas señal.' },
];

/** Página de una ciudad: viajes desde y hacia ella, y otras ciudades de su estado. */
export function textosCiudad(ciudad, estado, { desde = [], hacia = [] } = {}) {
  const donde = estado && estado !== ciudad ? `${ciudad}, ${estado}` : ciudad;
  const destinos = desde.map((r) => r.destino);
  return {
    titulo: `Pasajes de bus en ${ciudad}: horarios y precios | ${MARCA}`,
    descripcion: descripcionDe(
      `Compra tu pasaje de bus o autobús en línea en ${donde}: horarios, precios y puestos de todas las líneas.`,
      destinos.length && `Viaja a ${lista(destinos, 3)}.`,
      'Recibe tu boleto al instante.'
    ),
    h1: `Pasajes de bus en ${ciudad}`,
    intro: desde.length || hacia.length
      ? `Compra tu pasaje de bus desde o hacia ${donde} sin hacer cola en el terminal. En ${MARCA} ves las salidas de autobuses de todas las líneas afiliadas, comparas horarios y precios, escoges tu puesto en el mapa del bus y pagas en línea. Tu boleto llega al teléfono al instante.`
      : `Todavía ninguna línea afiliada a ${MARCA} vende pasajes de autobús desde o hacia ${donde}. Cuando alguna publique su ruta, aparecerá aquí con sus horarios y precios.`,
    preguntas: [
      ...(desde.length || hacia.length
        ? [{ p: `¿Cómo compro un pasaje a ${ciudad}?`, r: `Busca tu salida en ${MARCA}: elige desde dónde sales, ${ciudad} como destino y el día. Toca la salida, escoge tu puesto y paga. El boleto queda en «Mis boletos».` }]
        : []),
      { p: `¿Qué rutas salen de ${ciudad}?`, r: destinos.length ? `Desde ${ciudad} hay salidas a ${destinos.join(', ')}. Los horarios y precios de cada línea están en su página.` : `Las líneas afiliadas publican sus salidas desde ${ciudad} con anticipación. Si no ves la tuya, escríbenos por WhatsApp y te avisamos.` },
      ...PREGUNTAS_COMPRA,
    ],
  };
}

/**
 * Página de una ruta (A → B). Con `resumen` (de resumenPar) responde arriba lo
 * que se busca: cuánto cuesta, a qué hora sale, cuánto dura y con quién.
 */
export function textosPar(origen, destino, { precioDesde, duracionMin, distanciaKm, lineas = [], resumen = null, terminalSalida = null, terminalLlegada = null } = {}) {
  const dur = horas(duracionMin);
  const usd = resumen?.desdeUsd ?? precioDesde ?? null;
  const precio = usd ? dolares(usd) : null;
  const precioBs = resumen?.desdeBs ? bolivares(resumen.desdeBs) : null;
  const todas = [...new Set([...(resumen?.lineas ?? []), ...lineas])];
  const frecuencia = resumen?.salidasSemana ? `${resumen.salidasSemana} ${resumen.salidasSemana === 1 ? 'salida' : 'salidas'} en los próximos 7 días` : null;
  const horario = resumen?.primera ? (resumen.ultima && resumen.ultima !== resumen.primera ? `entre las ${resumen.primera} y las ${resumen.ultima}` : `a las ${resumen.primera}`) : null;
  const respuesta = [precio && `Desde ${precio}${precioBs ? ` (${precioBs})` : ''}`, frecuencia, dur && `unas ${dur} de viaje`].filter(Boolean).join(' · ');
  return {
    titulo: `Pasajes en bus de ${origen} a ${destino}: precio y horarios | ${MARCA}`,
    descripcion: descripcionDe(
      `Pasajes de autobús de ${origen} a ${destino}${precio ? ` desde ${precio}` : ''}.`,
      horario && cerrar(`Salidas ${horario}`),
      dur && `Unas ${dur} de viaje.`,
      todas.length && `Viajan ${lista(todas, 2)}.`,
      'Compra tu boleto en línea.'
    ),
    h1: `Pasajes en bus de ${origen} a ${destino}`,
    respuesta: respuesta || null,
    intro: `Compra tu pasaje de bus (autobús) de ${origen} a ${destino} en línea.${horario ? ` ${cerrar(`Hay salidas ${horario}${terminalSalida ? ` desde ${terminalSalida}` : ''}`)}` : ''}${resumen?.lineaBarata ? ` La opción más económica hoy es ${resumen.lineaBarata.nombre}, desde ${dolares(resumen.lineaBarata.desdeUsd)}.` : ''} Compara las salidas de todas las líneas, escoge tu puesto en el mapa del bus y paga desde el teléfono, sin hacer cola en el terminal.`,
    datos: [
      precio && { k: 'Precio desde', v: precioBs ? `${precio} · ${precioBs}` : precio },
      frecuencia && { k: 'Próximos 7 días', v: frecuencia.replace(' en los próximos 7 días', '') },
      resumen?.primera && { k: 'Primera salida', v: resumen.primera },
      resumen?.ultima && resumen.ultima !== resumen.primera && { k: 'Última salida', v: resumen.ultima },
      dur && { k: 'Duración', v: `unas ${dur}` },
      distanciaKm && { k: 'Distancia', v: `${distanciaKm} km` },
      terminalSalida && { k: 'Sale desde', v: terminalSalida },
      todas.length && { k: 'Líneas', v: todas.join(', ') },
    ].filter(Boolean),
    preguntas: [
      { p: `¿Cuánto cuesta el pasaje de bus de ${origen} a ${destino}?`, r: precio ? `El pasaje de ${origen} a ${destino} cuesta desde ${precio}${precioBs ? ` (${precioBs} a la tasa BCV de hoy)` : ''}. El precio de cada salida depende de la línea y del tipo de puesto (normal, semicama o VIP).` : `El precio depende de la línea y del tipo de puesto. Lo ves en cada salida antes de pagar.` },
      { p: `¿A qué hora sale el autobús de ${origen} a ${destino}?`, r: horario ? `Las próximas salidas son ${horario}${frecuencia ? `, con ${frecuencia}` : ''}. Los horarios exactos de cada día están en la tabla de salidas.` : `Las líneas publican sus salidas con anticipación; apenas haya una la verás aquí con su hora.` },
      { p: `¿Cuánto dura el viaje de ${origen} a ${destino}?`, r: dur ? `El viaje dura unas ${dur}${distanciaKm ? `, son ${distanciaKm} km` : ''}. La hora de llegada de cada salida aparece al abrirla.` : 'La hora de llegada de cada salida aparece al abrirla.' },
      ...(terminalSalida ? [{ p: `¿Desde dónde sale el autobús de ${origen} a ${destino}?`, r: `Sale desde ${terminalSalida}${terminalLlegada ? ` y llega a ${terminalLlegada}` : ''}. Llega 30 minutos antes con tu boleto en el teléfono.` }] : []),
      { p: `¿Qué líneas viajan de ${origen} a ${destino}?`, r: todas.length ? `${todas.join(', ')}.` : 'Las líneas afiliadas publican sus salidas con anticipación; las verás aquí apenas estén.' },
      ...PREGUNTAS_COMPRA,
    ],
  };
}

export const rutaLinea = (slugLinea) => `/lineas/${slugLinea}`;
export const RUTA_PRECIOS = '/pasajes/precios';

/** Página de una línea: sus rutas con precio desde, sus próximas salidas y cómo comprar. */
export function textosLinea(nombre, { rutas = [], salidasSemana = 0, terminalBase = null } = {}) {
  const destinos = [...new Set(rutas.map((r) => r.destino))];
  const desde = rutas.map((r) => r.precio).filter((n) => n > 0);
  const precio = desde.length ? dolares(Math.min(...desde)) : null;
  return {
    titulo: `Pasajes de ${nombre}: rutas, horarios y precios | ${MARCA}`,
    descripcion: descripcionDe(
      `Compra en línea tus pasajes de ${nombre}${precio ? ` desde ${precio}` : ''}.`,
      destinos.length && `Viaja a ${lista(destinos, 4)}.`,
      'Escoge tu puesto y recibe tu boleto al instante.'
    ),
    h1: `Pasajes de ${nombre}`,
    respuesta: [precio && `Desde ${precio}`, rutas.length && `${rutas.length} ${rutas.length === 1 ? 'ruta' : 'rutas'}`, salidasSemana && `${salidasSemana} ${salidasSemana === 1 ? 'salida' : 'salidas'} en los próximos 7 días`].filter(Boolean).join(' · ') || null,
    intro: `${nombre}${terminalBase ? `, con base en ${terminalBase},` : ''} vende sus pasajes en ${MARCA}: ves sus salidas, escoges tu puesto en el mapa del bus y pagas desde el teléfono, sin hacer cola en el terminal.`,
    preguntas: [
      { p: `¿A dónde viaja ${nombre}?`, r: destinos.length ? `${nombre} tiene salidas hacia ${destinos.join(', ')}.` : `${nombre} publica sus rutas y salidas en ${MARCA}; las verás aquí apenas estén.` },
      { p: `¿Cómo compro un pasaje de ${nombre}?`, r: `Escoge la ruta, la salida y tu puesto, y paga con tu wallet de ${MARCA}, Pago Móvil, transferencia o Zelle. El boleto llega al momento con su código QR.` },
      ...PREGUNTAS_COMPRA,
    ],
  };
}

/** Precios de hoy: todas las rutas con su precio desde, en dólares y en bolívares. */
export function textosPrecios(fecha, cantidad) {
  return {
    titulo: `Precios de pasajes de bus en Venezuela hoy | ${MARCA}`,
    descripcion: descripcionDe(
      `Cuánto cuesta viajar en bus o autobús en Venezuela hoy: ${cantidad} rutas con su precio en dólares y en bolívares (tasa BCV).`,
      `Actualizado ${fecha}.`,
      'Compra en línea.'
    ),
    h1: 'Precios de pasajes de bus hoy',
    intro: `Lo que cuesta cada ruta de autobús hoy en las líneas que venden en ${MARCA}, en dólares y en bolívares a la tasa del BCV. El precio exacto de cada salida (según la línea y el tipo de puesto) lo ves antes de pagar. Actualizado ${fecha}.`,
    preguntas: [
      { p: '¿Los precios están en dólares o en bolívares?', r: 'Las líneas fijan el precio en dólares; lo pagas en bolívares a la tasa del BCV del día, o en dólares por Zelle.' },
      { p: '¿El precio puede cambiar?', r: 'Sí: la línea puede ajustarlo y el monto en bolívares cambia con la tasa. El precio de tu salida queda fijo al comprar.' },
      ...PREGUNTAS_COMPRA,
    ],
  };
}

/**
 * Temporadas: una página propia que se publica semanas antes, para que Google
 * la conozca cuando la gente empiece a buscar. Se agregan aquí año tras año.
 */
export const TEMPORADAS = [
  { slug: 'diciembre-2026', nombre: 'diciembre', titulo: 'Navidad y fin de año', desde: '2026-12-15', hasta: '2027-01-10', anio: 2026 },
];
export const rutaTemporada = (slugTemporada) => `/temporada/${slugTemporada}`;

/** Página de temporada: las salidas publicadas en esas fechas y las rutas con su precio desde. */
export function textosTemporada(t, { salidas = 0, rutas = [] } = {}) {
  const desde = rutas.map((r) => r.precio).filter((n) => n > 0);
  const precio = desde.length ? dolares(Math.min(...desde)) : null;
  const fechas = `del ${new Date(`${t.desde}T12:00:00-04:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'long' })} al ${new Date(`${t.hasta}T12:00:00-04:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'long' })}`;
  return {
    titulo: `Pasajes de bus para ${t.nombre} ${t.anio}: salidas y precios | ${MARCA}`,
    descripcion: descripcionDe(
      `Pasajes de bus o autobús para ${t.nombre} ${t.anio} en Venezuela${precio ? ` desde ${precio}` : ''}: ${salidas ? `${salidas} salidas publicadas ${fechas}` : `salidas ${fechas}`}.`,
      'Aparta tu puesto en línea antes de que se agoten.'
    ),
    h1: `Pasajes de bus para ${t.nombre} ${t.anio}`,
    respuesta: [precio && `Desde ${precio}`, salidas ? `${salidas} ${salidas === 1 ? 'salida publicada' : 'salidas publicadas'}` : 'Salidas publicándose', fechas].filter(Boolean).join(' · '),
    intro: `En ${t.titulo.toLowerCase()} los puestos de bus se agotan semanas antes. En ${MARCA} ves las salidas de autobús de todas las líneas ${fechas}, escoges tu puesto en el mapa del bus y pagas desde el teléfono, sin hacer cola en el terminal.`,
    preguntas: [
      { p: `¿Cuándo compro mis pasajes para ${t.nombre}?`, r: `Lo antes posible: las salidas cercanas al 24 y al 31 son las primeras en llenarse. Apenas una línea publica sus salidas de ${t.nombre}, aparecen aquí y en el buscador.` },
      { p: `¿Suben los pasajes en ${t.nombre}?`, r: 'Cada línea fija sus precios en dólares; en temporada alta algunas los ajustan. El precio de tu salida queda fijo al comprar, aunque después cambie.' },
      { p: '¿Qué pasa si se cancela mi salida?', r: `Si la línea cancela, el dinero se te devuelve: a tu wallet de ${MARCA} al instante si compraste con cuenta, o por el mismo medio si compraste sin cuenta.` },
      ...PREGUNTAS_COMPRA,
    ],
  };
}

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** «agosto de 2025» de «2025-08». */
const mesAnio = (aaaamm) => `${MESES_LARGOS[Number(aaaamm.slice(5, 7)) - 1]} de ${aaaamm.slice(0, 4)}`;
const rango = (pr) => (pr.min === pr.max ? dolares(pr.min) : `entre ${dolares(pr.min)} y ${dolares(pr.max)}`);
/** «según la tarifa referencial de SITSSA (agosto de 2025) y el sondeo de El Diario (marzo de 2026)». */
const segun = (pr) => {
  const f = pr.fuentes.map((k) => FUENTES[k]).filter(Boolean).map((x) => `${x.nombre} de ${mesAnio(x.fecha)}`);
  return f.length ? `según ${f.length > 1 ? `${f.slice(0, -1).join(', ')} y ${f[f.length - 1]}` : f[0]}` : '';
};

/**
 * Guía de una ruta que todavía no se vende en Butaca: responde lo que se
 * busca (precio, horas, terminal, líneas) con datos reales y dice sin rodeos
 * que la compra en línea llega cuando una línea la publique.
 */
export function textosGuia(g, anio = new Date().getFullYear()) {
  const o = nombreVisible(g.origen);
  const d = nombreVisible(g.destino);
  // En el título, el nombre con que se busca («Puerto Ordaz»), que además lo acorta
  const oCorto = ALIAS[g.origen] ?? g.origen;
  const dCorto = ALIAS[g.destino] ?? g.destino;
  const dur = horas(g.minutos);
  const unas = dur.startsWith('1 h') ? `alrededor de ${dur}` : `unas ${dur}`;
  const precio = g.precio ? rango(g.precio) : null;
  const base = `Pasaje de ${oCorto} a ${dCorto} en bus ${anio}: precio y horas`;
  const corto = `Pasaje de ${oCorto} a ${dCorto} en bus ${anio}`;
  return {
    titulo: base.length <= 42 ? `${base} | ${MARCA}` : base.length <= 62 ? base : corto,
    descripcion: descripcionDe(
      `Pasaje en bus de ${o} a ${d}: ${precio ? `${precio}, ` : ''}${unas} de viaje (${g.km} km).`,
      `Sale del ${g.terminalSalida}.`,
      'Te avisamos cuando se venda en línea.'
    ),
    h1: `Pasaje de ${o} a ${d} en bus`,
    respuesta: ((r) => r[0].toUpperCase() + r.slice(1))([precio, `${unas} de viaje`, `${g.km} km`].filter(Boolean).join(' · ')),
    intro: `Lo que necesitas saber para viajar en autobús de ${o} a ${d}: cuánto cuesta el pasaje, cuántas horas dura el viaje y de qué terminal sale. Todavía no vendemos esta ruta en línea en ${MARCA}; déjanos tu WhatsApp y te escribimos apenas una línea la publique.`,
    datos: [
      precio && { k: 'Precio de referencia', v: precio },
      { k: 'Duración', v: unas },
      { k: 'Distancia', v: `${g.km} km` },
      { k: 'Sale desde', v: g.terminalSalida },
      { k: 'Llega a', v: g.terminalLlegada },
    ].filter(Boolean),
    notaPrecio: g.precio ? `Precio de referencia ${segun(g.precio)}. Se paga en bolívares a la tasa BCV del día; confírmalo en la taquilla.` : null,
    preguntas: [
      {
        p: `¿Cuánto cuesta el pasaje de ${o} a ${d} en bus?`,
        r: precio
          ? `El pasaje de ${o} a ${d} cuesta ${precio}, ${segun(g.precio)}. El precio cambia según la línea, el tipo de puesto y la temporada, y se paga en bolívares a la tasa BCV del día. Confírmalo en la taquilla antes de viajar.`
          : `Depende de la línea y del tipo de puesto; todavía no tenemos un precio de referencia publicado para esta ruta. Pregúntalo en la taquilla del ${g.terminalSalida}. Cuando una línea venda la ruta en ${MARCA}, verás el precio exacto de cada salida.`,
      },
      { p: `¿Cuántas horas son de ${o} a ${d} en bus?`, r: `El viaje dura ${unas}: son unos ${g.km} km por carretera. Puede tardar más en temporada alta o si el bus hace paradas en el camino.` },
      { p: `¿De qué terminal sale el autobús de ${o} a ${d}?`, r: `Sale del ${g.terminalSalida} y llega al ${g.terminalLlegada}. Llega al menos 30 minutos antes de la salida con tu cédula.` },
      { p: `¿Cuándo conviene comprar el pasaje de ${o} a ${d}?`, r: `Con anticipación en temporada alta (diciembre, Carnaval, Semana Santa y agosto), cuando los puestos se agotan días antes. El resto del año suele haber puestos el mismo día, pero comprar antes te asegura el horario y el puesto que quieres.` },
      { p: `¿Puedo comprar el pasaje de ${o} a ${d} en línea?`, r: `Todavía no en ${MARCA}. Deja tu WhatsApp en esta página y te avisamos apenas una línea publique la ruta, para que compres desde el teléfono, escojas tu puesto y recibas tu boleto al instante.` },
    ],
  };
}

/** Página de una terminal: a dónde sale y cuánto cuesta cada destino. */
export function textosTerminal(t, destinos, anio = new Date().getFullYear()) {
  const conPrecio = destinos.filter((g) => g.precio);
  const barato = conPrecio.length ? Math.min(...conPrecio.map((g) => g.precio.min)) : null;
  return {
    titulo: `${t.nombre}: precios de pasajes ${anio} y destinos | ${MARCA}`,
    descripcion: descripcionDe(
      `${t.nombre} (${t.ciudad}): precios de pasajes de bus ${anio}${barato ? ` desde ${dolares(barato)}` : ''} a ${lista(destinos.map((g) => nombreVisible(g.destino)), 4)}.`,
      'Horas de viaje por destino.'
    ),
    h1: `${t.nombre}: precios de pasajes ${anio}`,
    respuesta: `${destinos.length} destinos${barato ? ` · pasajes desde ${dolares(barato)}` : ''}`,
    intro: `Desde el ${t.nombre}, en ${t.direccion}, salen los autobuses hacia ${t.cubre}. Aquí tienes los destinos con su precio de referencia y la duración del viaje. Los precios son referenciales (con su fuente y fecha) y se pagan en bolívares a la tasa BCV del día: confírmalos en la taquilla.`,
    preguntas: [
      { p: `¿Dónde queda el ${t.nombre}?`, r: `En ${t.direccion}.` },
      { p: `¿A dónde salen los autobuses del ${t.nombre}?`, r: `Hacia ${t.cubre}: ${lista(destinos.map((g) => nombreVisible(g.destino)), 12)}.` },
      { p: `¿Cuánto cuesta un pasaje en el ${t.nombre}?`, r: barato ? `Los pasajes van desde ${dolares(barato)} según el destino y la línea. Los precios de cada destino están en la tabla, con su fuente y fecha.` : 'Depende del destino y de la línea; pregúntalo en la taquilla.' },
    ],
    ruta: rutaTerminal(t.slug),
  };
}

/** Índice de todas las ciudades, por estado. */
export const textosIndice = () => ({
  titulo: `Pasajes de bus en Venezuela por ciudad | ${MARCA}`,
  descripcion: 'Compra pasajes de bus o autobús en línea a cualquier ciudad de Venezuela: Caracas, Maracaibo, Valencia, Mérida y más. Recibe tu boleto al instante.',
  h1: 'Pasajes de bus en Venezuela',
  intro: `Escoge tu ciudad para ver las salidas de autobús, horarios y precios de todas las líneas afiliadas a ${MARCA}. Compras en línea, escoges tu puesto y abordas con el boleto en el teléfono.`,
});

/** Datos estructurados: migas de pan y preguntas frecuentes (Google las muestra en los resultados). */
export function datosEstructurados(ruta, migas, preguntas, viajes = []) {
  const url = `${DOMINIO}${ruta}`;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: migas.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.nombre, item: `${DOMINIO}${m.ruta}` })),
    },
    ...(preguntas?.length
      ? [{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: preguntas.map((q) => ({ '@type': 'Question', name: q.p, acceptedAnswer: { '@type': 'Answer', text: q.r } })),
        }]
      : []),
    // Cada salida próxima como viaje de bus con su precio (la oferta enlaza a esta página, donde se compra)
    ...viajes.slice(0, 10).map((v) => ({
      '@context': 'https://schema.org',
      '@type': 'BusTrip',
      name: `${v.origen} a ${v.destino}`,
      departureTime: v.salida,
      ...(v.llegada ? { arrivalTime: v.llegada } : {}),
      departureBusStop: { '@type': 'BusStation', name: v.terminalSalida ?? v.origen },
      arrivalBusStop: { '@type': 'BusStation', name: v.terminalLlegada ?? v.destino },
      ...(v.linea ? { provider: { '@type': 'Organization', name: v.linea } } : {}),
      ...(v.desdeUsd != null ? { offers: { '@type': 'Offer', price: v.desdeUsd, priceCurrency: 'USD', url, availability: 'https://schema.org/InStock' } } : {}),
    })),
  ];
}
