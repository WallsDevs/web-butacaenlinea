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
  /** Sin señal reciente: se pinta en gris, en su última posición conocida. */
  apagado?: boolean;
  /** La que el usuario eligió: más grande y por encima de las demás. */
  resaltado?: boolean;
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
  radio = 16,
  zoomEn = 'topleft',
  rutaFondo = [],
  enfocar = null,
  ajustarCada = '',
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
  /** Alto en px o cualquier valor CSS («100%» para llenar al padre). */
  alto?: number | string;
  /** Radio de las esquinas; 0 para un mapa a sangre. */
  radio?: number;
  /** Esquina del control de zoom (a la derecha cuando algo flota a la izquierda). */
  zoomEn?: 'topleft' | 'topright';
  /** Otra línea, más clara y debajo: la ruta planificada cuando `puntos` es lo recorrido de verdad. */
  rutaFondo?: [number, number][];
  /** Centrar aquí (zoom 15) cada vez que cambie `clave`. */
  enfocar?: { lat: number; lng: number; clave: string } | null;
  /** Cuando cambie, encuadra todo lo dibujado (ruta, trazo, buses). Para cambiar de unidad o de ruta. */
  ajustarCada?: string;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const lineaRef = useRef<L.Polyline | null>(null);
  const fondoRef = useRef<L.Polyline | null>(null);
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
    const mapa = L.map(divRef.current!, { zoomControl: false }).setView(
      puntosRef.current[0] ?? CENTRO,
      13
    );
    L.control.zoom({ position: zoomEn }).addTo(mapa);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(mapa);
    fondoRef.current = L.polyline([], { color: '#9fc0ff', weight: 7, opacity: 0.9 }).addTo(mapa);
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
    // El modal se abre antes de que el div tenga tamaño real, y un mapa a
    // pantalla completa cambia de alto después de montarse: Leaflet necesita
    // enterarse o anima sobre un tamaño viejo
    // (y ninguna de esas llamadas puede caer sobre un mapa ya destruido)
    const vivo = () => mapaRef.current === mapa;
    const temporizador = setTimeout(() => vivo() && mapa.invalidateSize(), 120);
    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => vivo() && mapa.invalidateSize()) : null;
    observador?.observe(divRef.current!);
    return () => {
      clearTimeout(temporizador);
      observador?.disconnect();
      mapaRef.current = null;
      mapa.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // La ruta planificada, debajo de todo
  useEffect(() => {
    fondoRef.current?.setLatLngs(rutaFondo);
  }, [rutaFondo]);

  // Centrar en un punto cuando lo piden (la unidad elegida)
  useEffect(() => {
    if (!enfocar || !mapaRef.current) return;
    mapaRef.current.invalidateSize();
    mapaRef.current.setView([enfocar.lat, enfocar.lng], Math.max(mapaRef.current.getZoom(), 15), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enfocar?.clave]);

  // Encuadrar todo lo que hay cuando cambia de qué se trata (otra unidad, otra ruta)
  useEffect(() => {
    if (!ajustarCada || !mapaRef.current) return;
    const todo: [number, number][] = [...puntos, ...rutaFondo, ...buses.filter((b) => b.resaltado).map((b) => [b.lat, b.lng] as [number, number])];
    if (todo.length > 1) mapaRef.current.fitBounds(L.latLngBounds(todo), { padding: [30, 30] });
    else if (todo.length === 1) mapaRef.current.setView(todo[0], 15);
    ajustado.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ajustarCada, puntos.length, rutaFondo.length]);

  // Buses: azul con señal, gris en su última posición conocida; la elegida resaltada
  useEffect(() => {
    const capa = capaBusesRef.current;
    if (!capa) return;
    capa.clearLayers();
    for (const b of buses) {
      const fondo = b.apagado ? '#94a3b8' : '#0f2557';
      const borde = b.resaltado ? 'border:2px solid #fff;box-shadow:0 0 0 3px #2563EB,0 2px 8px rgba(0,0,0,.35)' : 'box-shadow:0 2px 8px rgba(0,0,0,.35)';
      L.marker([b.lat, b.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:${fondo};color:#fff;border-radius:12px;padding:3px 8px;font:700 ${b.resaltado ? 13 : 12}px system-ui;white-space:nowrap;${borde}">🚌 ${b.numero}</div>`,
          iconSize: [0, 0],
          iconAnchor: [24, 12],
        }),
        zIndexOffset: b.resaltado ? 1000 : b.apagado ? 0 : 100,
      })
        .bindTooltip(b.apagado ? `Unidad ${b.numero} · última posición conocida` : `Unidad ${b.numero}`, { direction: 'top', offset: [0, -14] })
        .addTo(capa);
    }
  }, [buses]);

  // `isolation` encierra los z-index de Leaflet (400 capas, 1000 controles)
  // dentro del mapa: sin eso se comían el menú de la barra superior
  return <div ref={divRef} style={{ height: alto, borderRadius: radio, overflow: 'hidden', position: 'relative', zIndex: 0, isolation: 'isolate' }} />;
}
