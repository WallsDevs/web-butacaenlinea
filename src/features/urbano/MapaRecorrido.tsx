import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Centro por defecto: San Cristóbal, Táchira. */
const CENTRO: [number, number] = [7.7669, -72.225];

export interface ParadaEnMapa {
  nombre: string;
  lat: number;
  lng: number;
}

export interface BusEnMapa {
  documentId: string;
  numero: string;
  lat: number;
  lng: number;
}

/**
 * Mapa Leaflet + OpenStreetMap (gratis, sin API keys) con doble uso:
 * - editable: la empresa DIBUJA el recorrido tocando el mapa (cada toque
 *   agrega un punto a la línea).
 * - visor: el pasajero ve el recorrido y los buses en vivo (marcadores 🚌).
 */
export function MapaRecorrido({
  puntos,
  onChange,
  buses = [],
  paradas = [],
  miUbicacion = null,
  centrarEnMi = 0,
  alto = 320,
}: {
  puntos: [number, number][];
  onChange?: (puntos: [number, number][]) => void;
  buses?: BusEnMapa[];
  /** Paradas con nombre; el pasajero necesita saber DÓNDE para, no solo por dónde pasa. */
  paradas?: ParadaEnMapa[];
  /** Dónde está QUIEN MIRA. Lo que le importa es la distancia entre él y la buseta. */
  miUbicacion?: { lat: number; lng: number; precision?: number } | null;
  /** Cambia este número para pedirle al mapa que centre en el usuario. */
  centrarEnMi?: number;
  alto?: number;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const lineaRef = useRef<L.Polyline | null>(null);
  const capaBusesRef = useRef<L.LayerGroup | null>(null);
  const capaParadasRef = useRef<L.LayerGroup | null>(null);
  const capaYoRef = useRef<L.LayerGroup | null>(null);
  const ajustado = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const puntosRef = useRef(puntos);
  puntosRef.current = puntos;

  // Crear el mapa una sola vez
  useEffect(() => {
    const mapa = L.map(divRef.current!, { zoomControl: true }).setView(
      puntosRef.current[0] ?? CENTRO,
      13
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(mapa);
    lineaRef.current = L.polyline(puntosRef.current, {
      color: '#1d4ed8',
      weight: 5,
      opacity: 0.85,
    }).addTo(mapa);
    capaBusesRef.current = L.layerGroup().addTo(mapa);
    capaParadasRef.current = L.layerGroup().addTo(mapa);
    capaYoRef.current = L.layerGroup().addTo(mapa);
    if (onChangeRef.current) {
      mapa.on('click', (e: L.LeafletMouseEvent) => {
        onChangeRef.current?.([
          ...puntosRef.current,
          [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))],
        ]);
      });
    }
    mapaRef.current = mapa;
    // El modal se abre antes de que el div tenga tamaño real
    setTimeout(() => mapa.invalidateSize(), 120);
    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  /**
   * Dónde estoy yo. Punto azul con anillo blanco y su círculo de precisión —
   * el lenguaje que todo el mundo ya entiende de cualquier mapa. No se
   * confunde con las busetas (🚌) ni con las paradas (A/B/números).
   */
  useEffect(() => {
    const capa = capaYoRef.current;
    if (!capa) return;
    capa.clearLayers();
    if (!miUbicacion) return;
    const { lat, lng, precision } = miUbicacion;
    if (precision && precision > 20) {
      L.circle([lat, lng], {
        radius: precision,
        color: '#2563EB',
        weight: 1,
        opacity: 0.35,
        fillColor: '#2563EB',
        fillOpacity: 0.1,
      }).addTo(capa);
    }
    L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="
          width:18px;height:18px;border-radius:50%;
          background:#2563EB;border:3px solid #fff;
          box-shadow:0 0 0 1px rgba(37,99,235,.5), 0 2px 6px rgba(15,23,42,.35);
        "></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
      interactive: true,
      zIndexOffset: 500,
    })
      .bindTooltip('Estás aquí', { direction: 'top', offset: [0, -12] })
      .addTo(capa);
  }, [miUbicacion]);

  // Centrar en el usuario cuando lo pide (botón de la pantalla)
  useEffect(() => {
    if (!centrarEnMi || !miUbicacion || !mapaRef.current) return;
    mapaRef.current.setView([miUbicacion.lat, miUbicacion.lng], 16, { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centrarEnMi]);

  // Paradas con nombre: puntos blancos numerados sobre la línea
  useEffect(() => {
    const capa = capaParadasRef.current;
    if (!capa) return;
    capa.clearLayers();
    paradas.forEach((p, i) => {
      const extremo = i === 0 || i === paradas.length - 1;
      const etiqueta = i === 0 ? 'A' : i === paradas.length - 1 ? 'B' : String(i + 1);
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            width:${extremo ? 26 : 20}px;height:${extremo ? 26 : 20}px;border-radius:50%;
            background:${extremo ? '#0B2A6B' : '#fff'};color:${extremo ? '#fff' : '#0B2A6B'};
            display:grid;place-items:center;
            font:700 ${extremo ? 11 : 10}px/1 system-ui,sans-serif;
            border:2px solid ${extremo ? '#fff' : '#0B2A6B'};
            box-shadow:0 1px 5px rgba(15,23,42,.3);
          ">${etiqueta}</div>`,
          iconSize: [extremo ? 26 : 20, extremo ? 26 : 20],
          iconAnchor: [extremo ? 13 : 10, extremo ? 13 : 10],
        }),
        interactive: true,
      })
        .bindTooltip(p.nombre, { direction: 'top', offset: [0, -12] })
        .addTo(capa);
    });
  }, [paradas]);

  // Redibujar la línea cuando cambian los puntos
  useEffect(() => {
    lineaRef.current?.setLatLngs(puntos);
    if (!ajustado.current && puntos.length > 1 && mapaRef.current) {
      mapaRef.current.fitBounds(L.latLngBounds(puntos), { padding: [30, 30] });
      ajustado.current = true;
    }
  }, [puntos]);

  // Buses en vivo
  useEffect(() => {
    const capa = capaBusesRef.current;
    if (!capa) return;
    capa.clearLayers();
    for (const b of buses) {
      L.marker([b.lat, b.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:#0f2557;color:#fff;border-radius:12px;padding:3px 8px;font:700 12px system-ui;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.35)">🚌 ${b.numero}</div>`,
          iconSize: [0, 0],
          iconAnchor: [24, 12],
        }),
      }).addTo(capa);
    }
  }, [buses]);

  return <div ref={divRef} style={{ height: alto, borderRadius: 16, overflow: 'hidden' }} />;
}
