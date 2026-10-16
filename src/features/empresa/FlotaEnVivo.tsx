import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFlotaEnVivo, getMapaRutaUrbana, getRecorrido, type UnidadEnVivo } from '../../lib/api/endpoints';
import { MapaRecorrido } from '../urbano/MapaRecorrido';
import { StatusChip } from '../../components/ui/StatusChip';
import styles from './flotaEnVivo.module.css';

const MODO: Record<string, string> = { urbano: 'Ruta urbana', largo: 'Viaje', jornada: 'Jornada' };

function haceCuanto(seg: number | null): string {
  if (seg === null) return 'sin señal';
  if (seg < 90) return 'ahora';
  if (seg < 3600) return `hace ${Math.round(seg / 60)} min`;
  if (seg < 48 * 3600) return `hace ${Math.round(seg / 3600)} h`;
  return `hace ${Math.round(seg / 86400)} días`;
}

/** Alto disponible desde el borde superior del elemento hasta el final de la ventana (menos la barra inferior en celular). */
function useAltoRestante(ref: React.RefObject<HTMLElement | null>): number {
  const [alto, setAlto] = useState(520);
  useLayoutEffect(() => {
    const medir = () => {
      if (!ref.current) return;
      const top = ref.current.getBoundingClientRect().top + window.scrollY;
      const barra = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
      setAlto(Math.max(360, window.innerHeight - top - barra));
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [ref]);
  return alto;
}

/**
 * Dónde está cada unidad de la empresa, en vivo. La app del conductor reporta
 * mientras tiene un turno abierto; aquí se refresca cada 15 s. El mapa llena
 * la pantalla y la lista flota encima: se arrastra por su cabecera y se pliega
 * a una píldora. Al elegir una unidad el mapa centra en ella y dibuja su ruta
 * urbana de fondo y por dónde fue de verdad en las últimas 12 horas.
 */
export default function FlotaEnVivo() {
  const [elegida, setElegida] = useState<string | null>(null);
  // Cada clic sobre la misma unidad vuelve a centrar el mapa en ella
  const [enfoques, setEnfoques] = useState(0);
  const [plegado, setPlegado] = useState(false);
  // Pantalla completa con la API del navegador sobre el escenario (mapa + tablero)
  const [completa, setCompleta] = useState(false);
  useEffect(() => {
    const al = () => setCompleta(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', al);
    return () => document.removeEventListener('fullscreenchange', al);
  }, []);
  const alternarCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void escenarioRef.current?.requestFullscreen?.();
  };
  const escenarioRef = useRef<HTMLDivElement>(null);
  const alto = useAltoRestante(escenarioRef);

  const { data: flota, isLoading } = useQuery({ queryKey: ['flota-en-vivo'], queryFn: getFlotaEnVivo, refetchInterval: 15_000 });
  const unidad = (flota ?? []).find((u) => u.documentId === elegida) ?? null;
  const { data: recorrido } = useQuery({
    queryKey: ['recorrido', elegida],
    queryFn: () => getRecorrido(elegida!, new Date(Date.now() - 12 * 3600_000).toISOString()),
    enabled: Boolean(elegida),
    refetchInterval: 30_000,
  });
  const { data: ruta } = useQuery({
    queryKey: ['mapa-ruta-urbana', unidad?.ruta?.documentId],
    queryFn: () => getMapaRutaUrbana(unidad!.ruta!.documentId),
    enabled: Boolean(unidad?.ruta?.documentId),
    staleTime: 300_000,
  });

  const conPosicion = (flota ?? []).filter((u): u is UnidadEnVivo & { posicion: NonNullable<UnidadEnVivo['posicion']> } => Boolean(u.posicion));
  const enCamino = (flota ?? []).filter((u) => u.jornada && u.posicion?.viva).length;
  const buses = conPosicion.map((u) => ({ documentId: u.documentId, numero: u.numero, lat: u.posicion.lat, lng: u.posicion.lng, apagado: !u.posicion.viva, resaltado: u.documentId === elegida }));
  const trazo: [number, number][] = (recorrido?.puntos ?? []).map((p) => [p.lat, p.lng]);
  const rutaFondo = unidad?.ruta ? (ruta?.recorrido ?? []) : [];
  const paradas = unidad?.ruta ? (ruta?.paradas ?? []) : [];
  const enfocar = unidad?.posicion ? { lat: unidad.posicion.lat, lng: unidad.posicion.lng, clave: `${unidad.documentId}:${enfoques}` } : null;

  const elegir = (id: string) => {
    setElegida(id);
    setEnfoques((n) => n + 1);
  };

  const explicacion = !unidad
    ? null
    : !unidad.posicion
      ? unidad.jornada
        ? 'Jornada abierta, pero el teléfono todavía no mandó ninguna posición. Revisa que la app tenga el permiso de ubicación «Siempre» y señal; lo guardado sin señal llega cuando la recupere.'
        : 'Nunca reportó posición: aparece en el mapa cuando el conductor abra una jornada o un turno en la app.'
      : !unidad.posicion.viva
        ? `Sin señal ${haceCuanto(unidad.posicion.haceSeg)}: se muestra su última posición conocida.`
        : `Con señal (${haceCuanto(unidad.posicion.haceSeg)}). Línea clara: su ruta urbana. Línea azul: por dónde fue en las últimas 12 h (${recorrido?.total ?? 0} posiciones).`;

  // ── Arrastre del tablero por su cabecera ────────────────────────────────
  const tableroRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const arrastre = useRef<{ dx: number; dy: number } | null>(null);
  const empezar = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (window.matchMedia('(max-width: 640px)').matches) return; // en celular va pegado abajo
    arrastre.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const mover = (e: React.PointerEvent) => {
    if (!arrastre.current || !escenarioRef.current || !tableroRef.current) return;
    const esc = escenarioRef.current.getBoundingClientRect();
    const tab = tableroRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(8, e.clientX - arrastre.current.dx), esc.width - tab.width - 8);
    const y = Math.min(Math.max(8, e.clientY - arrastre.current.dy), esc.height - tab.height - 8);
    setPos({ x, y });
  };
  const soltar = () => {
    arrastre.current = null;
  };
  // Si el escenario encoge (ventana más chica), el tablero vuelve a quedar dentro
  useEffect(() => {
    if (!escenarioRef.current || !tableroRef.current) return;
    const esc = escenarioRef.current.getBoundingClientRect();
    const tab = tableroRef.current.getBoundingClientRect();
    setPos((p) => ({ x: Math.min(p.x, Math.max(8, esc.width - tab.width - 8)), y: Math.min(p.y, Math.max(8, esc.height - tab.height - 8)) }));
  }, [alto, plegado]);

  return (
    <div ref={escenarioRef} className={styles.escenario} style={{ height: alto }}>
      <MapaRecorrido
        puntos={trazo}
        rutaFondo={rutaFondo}
        paradas={paradas}
        buses={buses}
        enfocar={enfocar}
        ajustarCada={elegida ? `${elegida}:${ruta?.recorrido?.length ?? 0}:${trazo.length ? 1 : 0}` : ''}
        alto="100%"
        radio={0}
        zoomEn="topright"
      />
      {typeof document !== 'undefined' && document.fullscreenEnabled && (
        <button
          type="button"
          className={styles.pantallaCompleta}
          onClick={alternarCompleta}
          aria-label={completa ? 'Salir de pantalla completa' : 'Ver a pantalla completa'}
          title={completa ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {completa ? (
              <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
            ) : (
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            )}
          </svg>
        </button>
      )}

      <div
        ref={tableroRef}
        className={`${styles.tablero} ${plegado ? styles.plegado : ''}`}
        style={{ left: pos.x, top: pos.y }}
        role="region"
        aria-label="Unidades de la flota"
      >
        <div className={styles.cabecera} onPointerDown={empezar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
          <span className={styles.asidero} aria-hidden />
          <span className={`${styles.punto} ${enCamino ? '' : styles.apagado}`} aria-hidden />
          <span className={styles.titulo}>Unidades</span>
          <span className={styles.resumen}>
            {isLoading ? 'cargando…' : `${enCamino} con señal · ${flota?.length ?? 0} en total`}
          </span>
          <button
            type="button"
            className={styles.botonPlegar}
            onClick={() => setPlegado((p) => !p)}
            aria-expanded={!plegado}
            aria-label={plegado ? 'Mostrar la lista de unidades' : 'Ocultar la lista de unidades'}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: plegado ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        {!plegado && (
          <>
            <div className={styles.lista}>
              {(flota ?? []).map((u) => (
                <button key={u.documentId} type="button" className={`${styles.fila} ${elegida === u.documentId ? styles.filaElegida : ''}`} onClick={() => elegir(u.documentId)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`${styles.punto} ${u.jornada && u.posicion?.viva ? '' : styles.apagado}`} aria-hidden />
                    <strong>Unidad {u.numero}</strong>
                    {u.jornada ? <StatusChip tono="ok" size="sm">{MODO[u.jornada.modo] ?? u.jornada.modo}</StatusChip> : <StatusChip tono="neutral" size="sm">Sin jornada</StatusChip>}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-soft)', marginTop: 2, paddingLeft: 16 }}>
                    {u.chofer ?? 'Sin conductor'} · {u.posicion ? haceCuanto(u.posicion.haceSeg) : 'nunca reportó'}
                    {u.posicion && !u.posicion.viva ? ' (última conocida)' : ''}
                  </span>
                  {u.ruta && <span style={{ display: 'block', fontSize: 12, color: 'var(--blue-700)', marginTop: 2, paddingLeft: 16 }}>{u.ruta.nombre}</span>}
                </button>
              ))}
              {!isLoading && !flota?.length && <div style={{ padding: 14, fontSize: 13, color: 'var(--text-soft)' }}>Todavía no hay unidades. Créalas en la pestaña Unidades.</div>}
            </div>
            <div className={styles.pie}>
              {unidad ? (
                <>
                  <strong style={{ color: 'var(--text)' }}>Unidad {unidad.numero}</strong>
                  {unidad.ruta ? <span style={{ color: 'var(--blue-700)' }}> · {unidad.ruta.nombre}</span> : <span style={{ color: 'var(--text-faint)' }}> · sin ruta urbana</span>}
                  <div style={{ marginTop: 2, color: unidad.posicion?.viva ? 'var(--ok-text)' : undefined }}>{explicacion}</div>
                  <button type="button" onClick={() => setElegida(null)} style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: 'var(--blue-600)', cursor: 'pointer' }}>
                    Quitar selección
                  </button>
                </>
              ) : (
                <>Toca una unidad para centrar el mapa en ella. En gris: más de 10 min sin señal, en su última posición conocida.</>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
