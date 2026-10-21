import { useEffect, useRef, useState } from 'react';
import { BuscadorSitios } from '../../components/ui/BuscadorSitios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { lugarEn, type Ciudad, type LugarMapa } from '../../lib/api/endpoints';
import type { LugarRuta } from '../../lib/api/types';
import { trazarPorCalles } from '../urbano/trazado';
import styles from './MapaTrayecto.module.css';

export type Punta = 'origen' | 'destino';
/** Lo que se eligió en el mapa: la ciudad del catálogo y, si se marcó un sitio, el sitio exacto. */
export interface Eleccion {
  ciudad: string;
  lugar: LugarRuta | null;
}
export interface TrazadoTrayecto {
  km: number;
  /** Tiempo estimado en bus (min), si el servicio lo dio. */
  minBus: number | null;
  sobreCalles: boolean;
}

/** Venezuela entera, para cuando aún no hay nada marcado. */
const VENEZUELA = L.latLngBounds([0.8, -73.4], [12.2, -59.8]);
/** El bus tarda más que el carro de OSRM: paradas, subidas, velocidad máxima. */
const FACTOR_BUS = 1.3;


function icono(letra: string, activo: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="${styles.pin} ${activo ? styles.pinActivo : ''}"><span>${letra}</span></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
  });
}

/**
 * El trayecto en el mapa: se busca un sitio (terminal, plaza o ciudad) o se
 * toca el mapa, y queda como salida (A) o llegada (B). Cada sitio pertenece a
 * una ciudad del catálogo común, que es lo que el pasajero busca; el sitio
 * exacto dice dónde se aborda. Las ciudades del catálogo se ven como puntos.
 */
export function MapaTrayecto({
  ciudades,
  origen,
  destino,
  origenLugar,
  destinoLugar,
  onElegir,
  onTrazado,
  marcando,
  onMarcando,
}: {
  ciudades: Ciudad[];
  origen: string | null;
  destino: string | null;
  origenLugar: LugarRuta | null;
  destinoLugar: LugarRuta | null;
  onElegir: (punta: Punta, e: Eleccion) => void;
  onTrazado?: (t: TrazadoTrayecto | null) => void;
  /** Qué punta marca el próximo toque o búsqueda (la controla el formulario). */
  marcando: Punta;
  onMarcando: (p: Punta) => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const capaCiudades = useRef<L.LayerGroup | null>(null);
  const capaPuntas = useRef<L.LayerGroup | null>(null);
  const linea = useRef<L.Polyline | null>(null);
  const setMarcando = onMarcando;
  const [aviso, setAviso] = useState<string | null>(null);
  const [ubicando, setUbicando] = useState(false);

  const centroDe = (nombre: string | null): [number, number] | null => {
    const c = nombre ? ciudades.find((x) => x.nombre === nombre) : null;
    return c?.lat != null && c.lng != null ? [c.lat, c.lng] : null;
  };
  const puntoA: [number, number] | null = origenLugar ? [origenLugar.lat, origenLugar.lng] : centroDe(origen);
  const puntoB: [number, number] | null = destinoLugar ? [destinoLugar.lat, destinoLugar.lng] : centroDe(destino);

  // Los callbacks cambian en cada render; el mapa se crea una sola vez
  const elegirRef = useRef<(l: LugarMapa, punta?: Punta) => void>(() => {});
  const tocarRef = useRef<(lat: number, lng: number, punta?: Punta) => void>(() => {});

  /** Un sitio elegido (de la búsqueda, un toque o un punto arrastrado) queda en la punta que se está marcando. */
  const elegir = (l: LugarMapa, punta: Punta = marcando) => {
    if (!l.ciudad) {
      setAviso(
        `Ese sitio no queda en ninguna ciudad de la lista${l.cercana ? ` (la más cercana es ${l.cercana})` : ''}. Si falta, pídele a Butaca En Línea que la agregue.`
      );
      return;
    }
    const otra = punta === 'origen' ? destino : origen;
    if (otra && l.ciudad === otra) {
      setAviso(`La ${punta === 'origen' ? 'llegada' : 'salida'} ya es ${otra}: la salida y la llegada deben ser ciudades distintas.`);
      return;
    }
    setAviso(null);
    // Una ciudad del catálogo sin sitio exacto: se usa su centro
    const esCiudad = l.nombre === l.ciudad && l.detalle.startsWith('Ciudad');
    onElegir(punta, { ciudad: l.ciudad, lugar: esCiudad ? null : { nombre: l.nombre, lat: l.lat, lng: l.lng } });
    if (punta === 'origen' && !destino) setMarcando('destino');
  };
  elegirRef.current = elegir;

  const tocar = async (lat: number, lng: number, punta: Punta = marcando) => {
    setUbicando(true);
    try {
      elegir(await lugarEn(Number(lat.toFixed(6)), Number(lng.toFixed(6))), punta);
    } catch {
      setAviso('No se pudo saber qué hay en ese punto. Revisa la conexión e intenta de nuevo.');
    } finally {
      setUbicando(false);
    }
  };
  tocarRef.current = tocar;

  // El mapa, una sola vez
  useEffect(() => {
    const mapa = L.map(divRef.current!, { zoomControl: false, attributionControl: true }).fitBounds(VENEZUELA);
    L.control.zoom({ position: 'bottomright' }).addTo(mapa);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
    capaCiudades.current = L.layerGroup().addTo(mapa);
    linea.current = L.polyline([], { color: '#2563EB', weight: 5, opacity: 0.85 }).addTo(mapa);
    capaPuntas.current = L.layerGroup().addTo(mapa);
    mapa.on('click', (e: L.LeafletMouseEvent) => void tocarRef.current(e.latlng.lat, e.latlng.lng));
    mapaRef.current = mapa;
    // El modal abre antes de que el div tenga su tamaño real
    const t = setTimeout(() => {
      mapa.invalidateSize();
      if (!capaPuntas.current?.getLayers().length) mapa.fitBounds(VENEZUELA);
    }, 120);
    return () => {
      clearTimeout(t);
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  // Las ciudades del catálogo: puntos que se pueden tocar
  useEffect(() => {
    const capa = capaCiudades.current;
    if (!capa) return;
    capa.clearLayers();
    for (const c of ciudades) {
      if (c.lat == null || c.lng == null) continue;
      const elegida = c.nombre === origen || c.nombre === destino;
      L.circleMarker([c.lat, c.lng], { radius: elegida ? 0 : 4, color: '#fff', weight: 1.5, fillColor: '#0B2A6B', fillOpacity: 0.55 })
        .bindTooltip(c.nombre, { direction: 'top', offset: [0, -4] })
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          elegirRef.current({ nombre: c.nombre, detalle: 'Ciudad', lat: c.lat!, lng: c.lng!, ciudad: c.nombre });
        })
        .addTo(capa);
    }
  }, [ciudades, origen, destino]);

  // Las dos puntas: A (salida) y B (llegada), que se pueden arrastrar
  const claveA = puntoA?.join(',');
  const claveB = puntoB?.join(',');
  useEffect(() => {
    const capa = capaPuntas.current;
    if (!capa) return;
    capa.clearLayers();
    const poner = (p: [number, number] | null, punta: Punta, nombre: string) => {
      if (!p) return;
      const m = L.marker(p, { icon: icono(punta === 'origen' ? 'A' : 'B', marcando === punta), draggable: true, autoPan: true, zIndexOffset: 1000 })
        .bindTooltip(nombre, { direction: 'top', offset: [0, -40] })
        .addTo(capa);
      m.on('dragend', () => {
        const ll = m.getLatLng();
        setMarcando(punta);
        void tocarRef.current(ll.lat, ll.lng, punta);
      });
      m.on('click', () => setMarcando(punta));
    };
    poner(puntoA, 'origen', origenLugar?.nombre ? `${origenLugar.nombre} · ${origen}` : (origen ?? 'Salida'));
    poner(puntoB, 'destino', destinoLugar?.nombre ? `${destinoLugar.nombre} · ${destino}` : (destino ?? 'Llegada'));
    const mapa = mapaRef.current;
    if (mapa) {
      if (puntoA && puntoB) mapa.fitBounds(L.latLngBounds([puntoA, puntoB]), { padding: [48, 48], maxZoom: 12 });
      else if (puntoA || puntoB) mapa.setView((puntoA ?? puntoB)!, Math.max(mapa.getZoom(), 11));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveA, claveB, marcando, origenLugar?.nombre, destinoLugar?.nombre]);

  // La carretera entre A y B: distancia y tiempo para sugerir
  const avisarTrazado = useRef(onTrazado);
  avisarTrazado.current = onTrazado;
  useEffect(() => {
    linea.current?.setLatLngs([]);
    if (!puntoA || !puntoB) {
      avisarTrazado.current?.(null);
      return;
    }
    let vigente = true;
    linea.current?.setStyle({ dashArray: '6 8', opacity: 0.5 });
    linea.current?.setLatLngs([puntoA, puntoB]);
    void trazarPorCalles([
      { lat: puntoA[0], lng: puntoA[1] },
      { lat: puntoB[0], lng: puntoB[1] },
    ]).then((t) => {
      if (!vigente) return;
      linea.current?.setStyle({ dashArray: t.sobreCalles ? undefined : '6 8', opacity: t.sobreCalles ? 0.85 : 0.6 });
      linea.current?.setLatLngs(t.recorrido);
      avisarTrazado.current?.({
        km: Math.round(t.distanciaKm),
        minBus: t.duracionMin ? Math.round((t.duracionMin * FACTOR_BUS) / 5) * 5 : null,
        sobreCalles: t.sobreCalles,
      });
    });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveA, claveB]);

  return (
    <div className={styles.marco}>
      <div ref={divRef} className={styles.mapa} />

      <div className={styles.arriba}>
        <BuscadorSitios
          modo="pais"
          ciudades={ciudades}
          etiqueta={`Buscar el sitio de ${marcando === 'origen' ? 'salida' : 'llegada'}`}
          placeholder={marcando === 'origen' ? 'Buscar la salida: terminal, plaza o ciudad' : 'Buscar la llegada: terminal, plaza o ciudad'}
          onElegir={(l) => elegir(l)}
        />

        <div className={styles.puntas} role="radiogroup" aria-label="Qué punta marcas">
          {(['origen', 'destino'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={marcando === p}
              className={`${styles.punta} ${marcando === p ? styles.puntaActiva : ''}`}
              onClick={() => setMarcando(p)}
            >
              <span className={styles.letra}>{p === 'origen' ? 'A' : 'B'}</span>
              {p === 'origen' ? 'Salida' : 'Llegada'}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.abajo} aria-live="polite">
        {aviso ? (
          <span className={styles.avisoMapa}>{aviso}</span>
        ) : ubicando ? (
          <span>Buscando qué hay en ese punto…</span>
        ) : (
          <span>
            Toca el mapa o busca un sitio para marcar la <strong>{marcando === 'origen' ? 'salida (A)' : 'llegada (B)'}</strong>. Arrastra la marca para moverla.
          </span>
        )}
      </div>
    </div>
  );
}
