import { useEffect, useRef, type ReactNode } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LugarMapa, ParadaUrbana } from '../../lib/api/endpoints';
import { BuscadorSitios } from '../../components/ui/BuscadorSitios';
import styles from '../../components/ui/MarcoMapa.module.css';

/** Centro si no hay nada que mostrar: San Cristóbal, Táchira. */
const CENTRO: [number, number] = [7.7669, -72.225];

/** Una parada de otra ruta de la línea: punto de referencia que se puede reusar. */
export interface Referencia {
  nombre: string;
  lat: number;
  lng: number;
  /** Las rutas que ya paran ahí. */
  rutas: string[];
  /** Arranca o termina alguna ruta ahí. */
  terminal?: boolean;
}

/** Con más paradas que esto, solo se muestran las principales (como las ciudades en el mapa de viaje). */
const MAX_REFERENCIAS = 25;

/** Las referencias que se dibujan: todas si son pocas; si no, donde arrancan o terminan rutas y donde paran varias. */
export function referenciasVisibles(refs: Referencia[]): Referencia[] {
  if (refs.length <= MAX_REFERENCIAS) return refs;
  return refs.filter((r) => r.terminal || r.rutas.length > 1);
}

/**
 * Mapa del editor de rutas urbanas: paradas con nombre en vez de puntos
 * sueltos. La primera es el ORIGEN (A) y la última el DESTINO (B), con la
 * misma marca que el mapa de las rutas de viaje; las del medio van
 * numeradas. Se arrastran para corregirlas sin borrar nada.
 *
 * Las paradas de las otras rutas de la línea se ven como puntos de
 * referencia (como las ciudades en el mapa de viaje): tocar una la agrega con
 * su nombre, así varias rutas comparten la misma parada.
 *
 * La línea que se dibuja es el recorrido ya calculado (sobre calles), no la
 * unión recta de las paradas: es lo que de verdad va a ver el pasajero.
 */
function iconoParada(etiqueta: string, papel: 'origen' | 'destino' | 'media') {
  if (papel === 'media') {
    return L.divIcon({ className: '', html: `<div class="${styles.pinMedio}">${etiqueta}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
  }
  return L.divIcon({
    className: '',
    html: `<div class="${styles.pin}"><span>${etiqueta}</span></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
  });
}

const escapar = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function MapaParadas({
  paradas,
  recorrido,
  onAgregar,
  onMover,
  onBuscar,
  referencias = [],
  pista,
  alto = 560,
}: {
  paradas: ParadaUrbana[];
  recorrido: [number, number][];
  onAgregar?: (lat: number, lng: number, nombre?: string) => void;
  onMover?: (indice: number, lat: number, lng: number) => void;
  /** Con esto, el mapa trae un buscador de sitios de la zona en pantalla (sectores, calles, plazas). */
  onBuscar?: (l: LugarMapa) => void;
  /** Paradas de las otras rutas de la línea, como puntos de referencia. */
  referencias?: Referencia[];
  /** La indicación de qué hacer ahora, dentro del mapa (como en el de viaje). */
  pista?: ReactNode;
  /** Alto fijo en px, o 0 para que ocupe todo el espacio disponible. */
  alto?: number;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const lineaRef = useRef<L.Polyline | null>(null);
  const capaParadas = useRef<L.LayerGroup | null>(null);
  const capaReferencias = useRef<L.LayerGroup | null>(null);
  const ajustado = useRef(false);

  // Los callbacks cambian en cada render; el mapa se crea una sola vez
  const agregarRef = useRef(onAgregar);
  agregarRef.current = onAgregar;
  const moverRef = useRef(onMover);
  moverRef.current = onMover;

  useEffect(() => {
    // El zoom abajo a la derecha: arriba va el buscador
    const mapa = L.map(divRef.current!, { zoomControl: false }).setView(CENTRO, 13);
    L.control.zoom({ position: 'bottomright' }).addTo(mapa);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(mapa);
    capaReferencias.current = L.layerGroup().addTo(mapa);
    lineaRef.current = L.polyline([], { color: '#2563EB', weight: 6, opacity: 0.85 }).addTo(mapa);
    capaParadas.current = L.layerGroup().addTo(mapa);
    mapa.on('click', (e: L.LeafletMouseEvent) => {
      agregarRef.current?.(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    });
    mapaRef.current = mapa;
    // El modal abre antes de que el div tenga tamaño real
    const t = setTimeout(() => mapa.invalidateSize(), 120);
    return () => {
      clearTimeout(t);
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  // Recalcular alto sin recrear el mapa
  useEffect(() => {
    const t = setTimeout(() => mapaRef.current?.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [alto]);

  // Línea del recorrido
  useEffect(() => {
    lineaRef.current?.setLatLngs(recorrido);
  }, [recorrido]);

  // Puntos de referencia: las paradas de las otras rutas (las que ya están en esta no se repiten)
  useEffect(() => {
    const capa = capaReferencias.current;
    if (!capa) return;
    capa.clearLayers();
    const usada = (r: Referencia) => paradas.some((p) => Math.abs(p.lat - r.lat) < 1e-5 && Math.abs(p.lng - r.lng) < 1e-5);
    for (const r of referenciasVisibles(referencias)) {
      if (usada(r)) continue;
      L.circleMarker([r.lat, r.lng], { radius: 5, color: '#fff', weight: 1.5, fillColor: '#0B2A6B', fillOpacity: 0.55 })
        .bindTooltip(`<strong>${escapar(r.nombre)}</strong><br><span style="opacity:.7">${escapar(r.rutas.join(' · '))}</span>`, { direction: 'top', offset: [0, -4] })
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          agregarRef.current?.(r.lat, r.lng, r.nombre);
        })
        .addTo(capa);
    }
  }, [referencias, paradas]);

  // Marcadores de paradas
  useEffect(() => {
    const capa = capaParadas.current;
    if (!capa) return;
    capa.clearLayers();
    paradas.forEach((p, i) => {
      const papel = i === 0 ? 'origen' : i === paradas.length - 1 ? 'destino' : 'media';
      const etiqueta = paradas.length === 1 ? 'A' : papel === 'origen' ? 'A' : papel === 'destino' ? 'B' : String(i + 1);
      const marcador = L.marker([p.lat, p.lng], {
        icon: iconoParada(etiqueta, papel),
        draggable: Boolean(moverRef.current),
        autoPan: true,
        zIndexOffset: papel === 'media' ? 0 : 1000,
      })
        .bindTooltip(p.nombre || etiqueta, { direction: 'top', offset: [0, papel === 'media' ? -14 : -40] })
        .addTo(capa);
      marcador.on('dragend', () => {
        const ll = marcador.getLatLng();
        moverRef.current?.(i, Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6)));
      });
    });

    // Encuadrar la primera vez: la ruta, o si es nueva, la zona donde la línea ya tiene paradas
    const mapa = mapaRef.current;
    if (ajustado.current || !mapa) return;
    const puntos = recorrido.length ? recorrido : paradas.map((p) => [p.lat, p.lng] as [number, number]);
    // Tras el primer `invalidateSize`: antes el modal aún no tiene su tamaño y el encuadre sale corrido
    const encuadrar = (b: L.LatLngBounds, opciones: L.FitBoundsOptions) => {
      ajustado.current = true;
      setTimeout(() => {
        // El modal pudo cerrarse (o cambiar a ruta de viaje) en el medio
        if (mapaRef.current !== mapa) return;
        mapa.invalidateSize();
        mapa.fitBounds(b, opciones);
      }, 160);
    };
    if (puntos.length > 1) encuadrar(L.latLngBounds(puntos), { padding: [40, 40] });
    else if (!paradas.length && referencias.length) encuadrar(L.latLngBounds(referencias.map((r) => [r.lat, r.lng] as [number, number])), { padding: [60, 60], maxZoom: 15 });
  }, [paradas, recorrido, referencias]);

  /** Lo que está en pantalla como zona de búsqueda: la ciudad, no el país. */
  const zona = (): [number, number, number, number] | null => {
    const b = mapaRef.current?.getBounds();
    return b ? [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] : null;
  };

  return (
    <div className={styles.marco} style={alto ? { height: alto, minHeight: 0 } : { flex: 1, height: 'auto', minHeight: 0 }}>
      <div ref={divRef} className={styles.mapa} style={{ cursor: onAgregar ? 'crosshair' : 'grab' }} />
      {onBuscar && (
        <div className={styles.arriba}>
          <BuscadorSitios
            modo="ciudad"
            zona={zona}
            etiqueta="Buscar un sitio en esta zona"
            placeholder="Buscar parada: plaza, calle, sector…"
            onElegir={(l) => {
              mapaRef.current?.setView([l.lat, l.lng], Math.max(mapaRef.current.getZoom(), 16));
              onBuscar(l);
            }}
          />
        </div>
      )}
      {(pista || referencias.length > 0) && (
        <div className={styles.abajo} aria-live="polite">
          {referencias.length > 0 && (
            <span className={styles.leyenda}>
              <i aria-hidden /> {referencias.length > MAX_REFERENCIAS ? 'Paradas principales de tus otras rutas' : 'Paradas de tus otras rutas'}
            </span>
          )}
          {pista && <span>{pista}</span>}
        </div>
      )}
    </div>
  );
}
