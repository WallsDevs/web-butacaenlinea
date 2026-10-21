import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LugarMapa, ParadaUrbana } from '../../lib/api/endpoints';
import { BuscadorSitios } from '../../components/ui/BuscadorSitios';

/** Centro por defecto: San Cristóbal, Táchira. */
const CENTRO: [number, number] = [7.7669, -72.225];

/**
 * Mapa del editor de rutas urbanas: paradas con nombre en vez de puntos
 * sueltos. La primera es el ORIGEN (A) y la última el DESTINO (B); las del
 * medio van numeradas. Se arrastran para corregirlas sin borrar nada.
 *
 * La línea que se dibuja es el recorrido ya calculado (sobre calles), no la
 * unión recta de las paradas: es lo que de verdad va a ver el pasajero.
 */
function iconoParada(etiqueta: string, papel: 'origen' | 'destino' | 'media') {
  const fondo = papel === 'media' ? 'var(--blue-600, #2563EB)' : 'var(--navy, #0B2A6B)';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:30px;height:30px;border-radius:50%;
      background:${fondo};color:#fff;
      display:grid;place-items:center;
      font:700 13px/1 'Space Grotesk',system-ui,sans-serif;
      border:3px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.35);
    ">${etiqueta}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export function MapaParadas({
  paradas,
  recorrido,
  onAgregar,
  onMover,
  onBuscar,
  alto = 560,
}: {
  paradas: ParadaUrbana[];
  recorrido: [number, number][];
  onAgregar?: (lat: number, lng: number) => void;
  onMover?: (indice: number, lat: number, lng: number) => void;
  /** Con esto, el mapa trae un buscador de sitios de la zona en pantalla (sectores, calles, plazas). */
  onBuscar?: (l: LugarMapa) => void;
  /** Alto fijo en px, o 0 para que ocupe todo el espacio disponible. */
  alto?: number;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const lineaRef = useRef<L.Polyline | null>(null);
  const capaParadas = useRef<L.LayerGroup | null>(null);
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
    lineaRef.current = L.polyline([], { color: '#2563EB', weight: 6, opacity: 0.85 }).addTo(mapa);
    capaParadas.current = L.layerGroup().addTo(mapa);
    mapa.on('click', (e: L.LeafletMouseEvent) => {
      agregarRef.current?.(
        Number(e.latlng.lat.toFixed(6)),
        Number(e.latlng.lng.toFixed(6))
      );
    });
    mapaRef.current = mapa;
    // El modal abre antes de que el div tenga tamaño real
    setTimeout(() => mapa.invalidateSize(), 120);
    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  // Recalcular alto sin recrear el mapa
  useEffect(() => {
    setTimeout(() => mapaRef.current?.invalidateSize(), 60);
  }, [alto]);

  // Línea del recorrido
  useEffect(() => {
    lineaRef.current?.setLatLngs(recorrido);
  }, [recorrido]);

  // Marcadores de paradas
  useEffect(() => {
    const capa = capaParadas.current;
    if (!capa) return;
    capa.clearLayers();
    paradas.forEach((p, i) => {
      const papel = i === 0 ? 'origen' : i === paradas.length - 1 ? 'destino' : 'media';
      const etiqueta =
        paradas.length === 1 ? 'A' : papel === 'origen' ? 'A' : papel === 'destino' ? 'B' : String(i + 1);
      const marcador = L.marker([p.lat, p.lng], {
        icon: iconoParada(etiqueta, papel as 'origen' | 'destino' | 'media'),
        draggable: Boolean(moverRef.current),
        autoPan: true,
      })
        .bindTooltip(p.nombre || etiqueta, { direction: 'top', offset: [0, -16] })
        .addTo(capa);
      marcador.on('dragend', () => {
        const ll = marcador.getLatLng();
        moverRef.current?.(i, Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6)));
      });
    });

    // Encuadrar la primera vez que hay algo que mostrar
    const puntos = recorrido.length ? recorrido : paradas.map((p) => [p.lat, p.lng] as [number, number]);
    if (!ajustado.current && puntos.length > 1 && mapaRef.current) {
      mapaRef.current.fitBounds(L.latLngBounds(puntos), { padding: [40, 40] });
      ajustado.current = true;
    }
  }, [paradas, recorrido]);

  /** Lo que está en pantalla como zona de búsqueda: la ciudad, no el país. */
  const zona = (): [number, number, number, number] | null => {
    const b = mapaRef.current?.getBounds();
    return b ? [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] : null;
  };

  return (
    <div
      style={{
        // alto 0 = el editor grande, donde el mapa llena la columna
        ...(alto ? { height: alto } : { flex: 1, minHeight: 0 }),
        position: 'relative',
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        // Encierra los z-index de Leaflet para que no tape menús del resto de la página
        isolation: 'isolate',
        zIndex: 0,
      }}
    >
      <div ref={divRef} style={{ position: 'absolute', inset: 0, cursor: onAgregar ? 'crosshair' : 'grab' }} />
      {onBuscar && (
        <div style={{ position: 'absolute', top: 12, left: 12, width: 'min(420px, calc(100% - 24px))', zIndex: 1100 }}>
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
    </div>
  );
}
