/**
 * Textos de las páginas de pasajes (por ciudad y por ruta). Un solo origen
 * para la web (React) y para el HTML que se arma al publicar
 * (scripts/prerender-seo.mjs): lo que lee Google es lo mismo que ve la gente.
 * JavaScript plano (no TS) para que Node lo use sin compilar.
 */

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
export const rutaPar = (o, d) => `/pasajes/${slug(o)}/${slug(d)}`;

const horas = (min) => {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};
const dolares = (n) => `$${Number(n).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

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
  const conDestinos = destinos.length ? ` Viaja a ${destinos.slice(0, 4).join(', ')}${destinos.length > 4 ? ' y más' : ''}.` : '';
  return {
    titulo: `Pasajes de autobús a ${ciudad} y desde ${ciudad} | ${MARCA}`,
    descripcion: `Compra pasajes de bus en línea en ${donde}: horarios, precios y puestos de todas las líneas.${conDestinos} Escoge tu asiento y recibe tu boleto con QR.`,
    h1: `Pasajes de autobús en ${ciudad}`,
    intro: `Compra tu pasaje de bus desde o hacia ${donde} sin hacer cola en el terminal. En ${MARCA} ves las salidas de todas las líneas afiliadas, comparas horarios y precios, escoges tu puesto en el mapa del bus y pagas en línea. Tu boleto llega al teléfono con su código QR.`,
    preguntas: [
      { p: `¿Cómo compro un pasaje a ${ciudad}?`, r: `Busca tu salida en ${MARCA}: elige desde dónde sales, ${ciudad} como destino y el día. Toca la salida, escoge tu puesto y paga. El boleto queda en «Mis boletos».` },
      { p: `¿Qué rutas salen de ${ciudad}?`, r: destinos.length ? `Desde ${ciudad} hay salidas a ${destinos.join(', ')}. Los horarios y precios de cada línea están en su página.` : `Las líneas afiliadas publican sus salidas desde ${ciudad} con anticipación. Si no ves la tuya, escríbenos por WhatsApp y te avisamos.` },
      ...PREGUNTAS_COMPRA,
    ],
  };
}

/** Página de una ruta (A → B): precio desde, duración, líneas. */
export function textosPar(origen, destino, { precioDesde, duracionMin, distanciaKm, lineas = [] } = {}) {
  const dur = horas(duracionMin);
  const precio = precioDesde ? dolares(precioDesde) : null;
  const conLineas = lineas.length ? ` Viajan ${lineas.slice(0, 3).join(', ')}${lineas.length > 3 ? ' y más líneas' : ''}.` : '';
  return {
    titulo: `Pasajes de ${origen} a ${destino}: horarios y precios | ${MARCA}`,
    descripcion: `Pasajes de autobús de ${origen} a ${destino}${precio ? ` desde ${precio}` : ''}.${dur ? ` Unas ${dur} de viaje.` : ''}${conLineas} Compra en línea, escoge tu puesto y aborda con tu boleto QR.`,
    h1: `Pasajes de ${origen} a ${destino}`,
    intro: `Compra tu pasaje de bus de ${origen} a ${destino} en línea. Compara las salidas de todas las líneas, escoge tu puesto en el mapa del bus y paga desde el teléfono, sin hacer cola en el terminal.`,
    datos: [
      precio && { k: 'Precio desde', v: precio },
      dur && { k: 'Duración', v: `unas ${dur}` },
      distanciaKm && { k: 'Distancia', v: `${distanciaKm} km` },
      lineas.length && { k: 'Líneas', v: lineas.join(', ') },
    ].filter(Boolean),
    preguntas: [
      { p: `¿Cuánto cuesta el pasaje de ${origen} a ${destino}?`, r: precio ? `El pasaje de ${origen} a ${destino} cuesta desde ${precio}. El precio de cada salida depende de la línea y del tipo de puesto (normal, semicama o VIP).` : `El precio depende de la línea y del tipo de puesto. Lo ves en cada salida antes de pagar.` },
      { p: `¿Cuánto dura el viaje de ${origen} a ${destino}?`, r: dur ? `El viaje dura unas ${dur}${distanciaKm ? `, son ${distanciaKm} km` : ''}. La hora de llegada de cada salida aparece al abrirla.` : 'La hora de llegada de cada salida aparece al abrirla.' },
      { p: `¿Qué líneas viajan de ${origen} a ${destino}?`, r: lineas.length ? `${lineas.join(', ')}.` : 'Las líneas afiliadas publican sus salidas con anticipación; las verás aquí apenas estén.' },
      ...PREGUNTAS_COMPRA,
    ],
  };
}

/** Índice de todas las ciudades, por estado. */
export const textosIndice = () => ({
  titulo: `Pasajes de autobús en Venezuela por ciudad | ${MARCA}`,
  descripcion: `Compra pasajes de bus en línea a cualquier ciudad de Venezuela: Caracas, Maracaibo, Valencia, Barquisimeto, Mérida, San Cristóbal y más. Todas las líneas, puesto en el mapa y boleto con QR.`,
  h1: 'Pasajes de autobús en Venezuela',
  intro: `Escoge tu ciudad para ver las salidas, horarios y precios de todas las líneas afiliadas a ${MARCA}. Compras en línea, escoges tu puesto y abordas con el boleto en el teléfono.`,
});

/** Datos estructurados: migas de pan y preguntas frecuentes (Google las muestra en los resultados). */
export function datosEstructurados(ruta, migas, preguntas) {
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
  ];
}
