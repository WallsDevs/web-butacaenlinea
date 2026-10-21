/**
 * Trazado del recorrido entre paradas.
 *
 * La empresa marca el origen, las paradas y el destino; esto calcula por dónde
 * va la buseta SOBRE LAS CALLES, no en línea recta. Usa OSRM público (mismo
 * espíritu que las teselas de OpenStreetMap: gratis y sin API key).
 *
 * OJO — `router.project-osrm.org` es un servidor de DEMOSTRACIÓN: no promete
 * disponibilidad ni aguanta volumen. Por eso:
 *   · timeout corto y un solo intento,
 *   · si falla, se traza en línea recta entre paradas y se avisa en pantalla.
 * Si el trazado sobre calles se vuelve crítico, hay que levantar un OSRM
 * propio (o contratar uno) y cambiar solo la constante de abajo.
 */
const OSRM = 'https://router.project-osrm.org/route/v1/driving';
const MS_TIMEOUT = 12_000;
/** El servidor público se queja con demasiados puntos intermedios. */
export const MAX_PARADAS = 24;

export interface PuntoParada {
  lat: number;
  lng: number;
}

export interface Trazado {
  /** La línea a dibujar: sigue las calles si se pudo calcular. */
  recorrido: [number, number][];
  distanciaKm: number;
  /** false = no se pudo consultar el servicio y va en línea recta. */
  sobreCalles: boolean;
  /** Tiempo en carro según el servicio (min); no viene en línea recta. */
  duracionMin?: number;
}

const R_TIERRA = 6371;

/** Distancia en km entre dos coordenadas. */
export function haversine(a: PuntoParada, b: PuntoParada): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA * Math.asin(Math.min(1, Math.sqrt(s)));
}

function enLineaRecta(paradas: PuntoParada[]): Trazado {
  const recorrido = paradas.map((p) => [p.lat, p.lng] as [number, number]);
  let km = 0;
  for (let i = 1; i < paradas.length; i++) km += haversine(paradas[i - 1], paradas[i]);
  return { recorrido, distanciaKm: Math.round(km * 10) / 10, sobreCalles: false };
}

/**
 * Calcula el recorrido que une las paradas en orden. Nunca lanza: si el
 * servicio no responde devuelve el trazo recto, que es peor pero sirve.
 */
export async function trazarPorCalles(paradas: PuntoParada[]): Promise<Trazado> {
  if (paradas.length < 2) {
    return {
      recorrido: paradas.map((p) => [p.lat, p.lng] as [number, number]),
      distanciaKm: 0,
      sobreCalles: true,
    };
  }
  const usadas = paradas.slice(0, MAX_PARADAS);
  const coords = usadas.map((p) => `${p.lng},${p.lat}`).join(';');

  const control = new AbortController();
  const alarma = setTimeout(() => control.abort(), MS_TIMEOUT);
  try {
    const res = await fetch(`${OSRM}/${coords}?overview=full&geometries=geojson`, {
      signal: control.signal,
    });
    if (!res.ok) return enLineaRecta(usadas);
    const json = (await res.json()) as {
      code?: string;
      routes?: { distance: number; duration?: number; geometry: { coordinates: [number, number][] } }[];
    };
    const ruta = json.code === 'Ok' ? json.routes?.[0] : null;
    if (!ruta?.geometry?.coordinates?.length) return enLineaRecta(usadas);
    return {
      // OSRM devuelve [lng, lat]; Leaflet quiere [lat, lng]
      recorrido: ruta.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
      distanciaKm: Math.round((ruta.distance / 1000) * 10) / 10,
      sobreCalles: true,
      ...(ruta.duration ? { duracionMin: Math.round(ruta.duration / 60) } : {}),
    };
  } catch {
    return enLineaRecta(usadas);
  } finally {
    clearTimeout(alarma);
  }
}

// ── Recorrido por tramos ────────────────────────────────────────────────────
//
// Cada tramo va de una parada a la siguiente (y, en un circuito, de la última
// al origen). Por defecto sigue las calles por el camino más corto; si ese no
// es el que hace la buseta, se le ponen PUNTOS DE PASO (no son paradas) o se
// dibuja A MANO, en línea recta entre los puntos que se toquen.

export interface TramoEntrada {
  modo: 'calles' | 'mano';
  puntos: [number, number][];
}
export interface ParadaConTramo extends PuntoParada {
  tramo?: TramoEntrada;
}
export interface RecorridoPorTramos {
  /** La línea de cada tramo, en orden: tramo i = de la parada i a la siguiente. */
  segmentos: [number, number][][];
  recorrido: [number, number][];
  distanciaKm: number;
  /** false = algún tramo por calles no se pudo calcular y va derecho. */
  sobreCalles: boolean;
}

/** Lo ya calculado por tramo: mover un punto de paso solo recalcula su tramo. */
const memoria = new Map<string, Trazado>();
const MAX_MEMORIA = 300;
const SIMULTANEOS = 3;

async function porCallesRecordado(puntos: PuntoParada[]): Promise<Trazado> {
  const clave = puntos.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join(';');
  const guardado = memoria.get(clave);
  if (guardado) return guardado;
  const t = await trazarPorCalles(puntos);
  // Lo que salió en línea recta por un fallo no se recuerda: se reintenta la próxima vez
  if (t.sobreCalles) {
    if (memoria.size >= MAX_MEMORIA) memoria.delete(memoria.keys().next().value!);
    memoria.set(clave, t);
  }
  return t;
}

export async function trazarRecorrido(paradas: ParadaConTramo[], circuito: boolean): Promise<RecorridoPorTramos> {
  if (paradas.length < 2) {
    return { segmentos: [], recorrido: paradas.map((p) => [p.lat, p.lng]), distanciaKm: 0, sobreCalles: true };
  }
  const n = paradas.length;
  const cuantos = circuito ? n : n - 1;
  const piezas = Array.from({ length: cuantos }, (_, i) => {
    const a = paradas[i];
    const b = paradas[(i + 1) % n];
    const t = a.tramo;
    const medio = (t?.puntos ?? []).map(([lat, lng]) => ({ lat, lng }));
    // El servidor de calles se queja con muchos puntos: los de paso se recortan
    return { modo: t?.modo ?? 'calles', puntos: [a, ...(t?.modo === 'mano' ? medio : medio.slice(0, MAX_PARADAS - 2)), b] };
  });

  const resultados: Trazado[] = new Array(cuantos);
  let siguiente = 0;
  const trabajar = async () => {
    while (siguiente < cuantos) {
      const i = siguiente++;
      const p = piezas[i];
      resultados[i] = p.modo === 'mano' ? enLineaRecta(p.puntos) : await porCallesRecordado(p.puntos);
    }
  };
  await Promise.all(Array.from({ length: Math.min(SIMULTANEOS, cuantos) }, trabajar));

  const segmentos = resultados.map((r) => r.recorrido);
  const recorrido: [number, number][] = [];
  for (const s of segmentos) recorrido.push(...(recorrido.length ? s.slice(1) : s));
  return {
    segmentos,
    recorrido,
    distanciaKm: Math.round(resultados.reduce((t, r) => t + r.distanciaKm, 0) * 10) / 10,
    sobreCalles: resultados.every((r, i) => piezas[i].modo === 'mano' || r.sobreCalles),
  };
}

/** Dónde meter un punto nuevo entre los de un tramo para que no haga zigzag: donde menos alarga. */
export function indiceParaInsertar(inicio: PuntoParada, puntos: [number, number][], fin: PuntoParada, nuevo: PuntoParada): number {
  const lista: PuntoParada[] = [inicio, ...puntos.map(([lat, lng]) => ({ lat, lng })), fin];
  let mejor = 0;
  let menor = Infinity;
  for (let i = 0; i < lista.length - 1; i++) {
    const extra = haversine(lista[i], nuevo) + haversine(nuevo, lista[i + 1]) - haversine(lista[i], lista[i + 1]);
    if (extra < menor) [menor, mejor] = [extra, i];
  }
  return mejor;
}
