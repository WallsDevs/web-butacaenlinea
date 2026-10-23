import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOcupacionSalidas, getRutas, getSalidas } from '../../lib/api/endpoints';
import { duracion, fechaCorta, hora, rangoDia, hoyISO } from '../../lib/time';
import { Money } from '../../components/ui/Money';
import { Isotipo } from '../../components/brand/LogoMark';
import { useBooking } from './useBooking';
import { Letras, casillas } from './inicio/Tablero';
import { PanelAsientos } from './inicio/PanelAsientos';
import css from './inicio/inicio.module.css';

// Número de atención por WhatsApp (solo dígitos, con código de país). VITE_WHATSAPP lo reemplaza.
const WHATSAPP = (import.meta.env.VITE_WHATSAPP as string | undefined)?.replace(/\D/g, '') || '584129647161';
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * Buscar y comprar pasajes: el buscador (desde, hasta, día, pasajeros) y el
 * tablero de salidas con el mapa de puestos de la que se abra. Es el mismo en
 * la página principal y en el panel del pasajero (`enPanel`: sin el
 * solapamiento con la portada y con márgenes de panel).
 */
/** Pantalla angosta: el tablero ancho se cambia por tarjetas (antes obligaba a deslizar de lado). */
function useAngosta(px = 720) {
  const [angosta, setAngosta] = useState(() => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${px}px)`).matches);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${px}px)`);
    const cambio = () => setAngosta(mq.matches);
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, [px]);
  return angosta;
}

export function BuscadorPasajes({ enPanel = false }: { enPanel?: boolean }) {
  const angosta = useAngosta();
  const { criterios, setCriterios } = useBooking();
  const [abierta, setAbierta] = useState<string | null>(null);

  const { data: rutas, isError: rutasError } = useQuery({ queryKey: ['rutas-publicas'], queryFn: () => getRutas() });
  const origenes = useMemo(() => [...new Set((rutas ?? []).map((r) => r.origen).filter(Boolean))].sort() as string[], [rutas]);
  // Mientras nadie elige, se parte de la primera ruta que existe (el diseño no tiene la opción «todos»)
  const origen = criterios.origen || origenes[0] || '';
  const destinos = useMemo(
    () => [...new Set((rutas ?? []).filter((r) => r.origen === origen).map((r) => r.destino).filter(Boolean))].sort() as string[],
    [rutas, origen]
  );
  const destino = criterios.destino && criterios.destino !== origen ? criterios.destino : destinos[0] || '';

  // Cuatro días desde hoy
  const dias = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 4 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      return { fecha: iso(d), dia: i === 0 ? 'Hoy' : DIAS[d.getDay()], num: d.getDate() };
    });
  }, []);
  const fecha = dias.some((d) => d.fecha === criterios.fecha) ? criterios.fecha : hoyISO();
  const pax = Math.max(1, Math.min(6, criterios.pasajeros));
  const diaTxt = fechaCorta(`${fecha}T12:00:00`);

  // Sin ninguna ruta publicada el buscador se queda en reposo y avisa por qué
  const sinRutas = Boolean(rutas) && !origenes.length;
  const distintas = Boolean(origen && destino && origen !== destino);
  const { data: salidas } = useQuery({
    queryKey: ['salidas-home', origen, destino, fecha],
    queryFn: () => getSalidas({ origen, destino, ...rangoDia(fecha) }),
    enabled: distintas,
    refetchInterval: 60_000,
  });
  const { data: ocupacion } = useQuery({
    queryKey: ['ocupacion', (salidas ?? []).map((s) => s.documentId).join(',')],
    queryFn: () => getOcupacionSalidas((salidas ?? []).map((s) => s.documentId)),
    enabled: Boolean(salidas?.length),
    refetchInterval: 30_000,
  });
  const libresDe = (s: NonNullable<typeof salidas>[number]) => {
    const total = s.unidad?.configuracionAsientos?.pisos?.reduce((acc, p) => acc + (p.filas.length * (p.layout.izquierda + p.layout.derecha) + (p.filaTrasera ?? 0)), 0) ?? 0;
    return Math.max(0, total - (ocupacion?.[s.documentId] ?? 0));
  };
  const precioMin = (s: { preciosUsd?: Record<string, number> }) => Math.min(...Object.values(s.preciosUsd ?? { x: 0 }));
  const lista = (salidas ?? []).filter((s) => !ocupacion || libresDe(s) >= pax);

  // Otra ruta o fecha: se cierra el mapa abierto
  useEffect(() => setAbierta(null), [origen, destino, fecha]);

  const sel = { appearance: 'none', WebkitAppearance: 'none', border: 'none', background: 'transparent', font: 'inherit', fontSize: enPanel ? 20 : 24, fontWeight: 700, color: '#0F172A', padding: 0, outline: 'none', cursor: 'pointer', width: '100%' } as const;
  const cajaCiudad = { display: 'flex', alignItems: 'center', gap: 12, padding: enPanel ? '12px 16px' : '16px 20px', border: '1.5px solid #E2E8F2', borderRadius: 16, cursor: 'pointer' } as const;
  const vacio = (txt: string) => <span style={{ fontSize: enPanel ? 20 : 24, fontWeight: 700, color: '#94A3B8', lineHeight: '31px' }}>{txt}</span>;

  return (
    <>
      {/* Buscador */}
      <div style={enPanel ? { position: 'relative', marginBottom: 18 } : { position: 'relative', maxWidth: 1440, margin: '-110px auto 0', padding: '0 28px 28px', boxSizing: 'border-box' }}>
        <div style={{ background: '#FFFFFF', borderRadius: 22, boxShadow: enPanel ? '0 1px 2px rgba(15,23,42,.06)' : '0 24px 60px rgba(11,42,107,.22)', overflow: 'hidden', border: '1px solid #E6EBF4' }}>
          <div className={enPanel ? css.buscadorPanel : undefined} style={{ padding: enPanel ? 20 : 28, display: 'flex', flexDirection: 'column', gap: enPanel ? 16 : 20 }}>
            <div className={css.ciudades} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 48px minmax(0,1fr)', alignItems: 'center', gap: 10 }}>
              <label style={cajaCiudad}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', border: `3px solid ${sinRutas ? '#C3CBD8' : '#2563EB'}`, boxSizing: 'border-box', flex: 'none' }} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 12, color: '#7C8AA5' }}>Desde</span>
                  {origenes.length ? (
                    <select value={origen} onChange={(e) => setCriterios({ origen: e.target.value, destino: '' })} style={sel}>
                      {origenes.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : vacio(rutasError ? 'Sin conexión' : rutas ? 'Elige tu ciudad' : 'Cargando…')}
                </span>
              </label>
              <button
                onClick={() => setCriterios({ origen: destino, destino: origen })}
                disabled={sinRutas}
                aria-label="Invertir"
                style={{ width: 44, height: 44, borderRadius: '50%', border: '1.5px solid #E2E8F2', background: '#FFFFFF', color: sinRutas ? '#C3CBD8' : '#2563EB', fontSize: 18, cursor: sinRutas ? 'default' : 'pointer', fontFamily: 'inherit' }}
              >⇄</button>
              <label style={cajaCiudad}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: sinRutas ? '#CBD5E1' : '#2563EB', flex: 'none' }} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 12, color: '#7C8AA5' }}>Hasta</span>
                  {destinos.length ? (
                    <select value={destino} onChange={(e) => setCriterios({ destino: e.target.value })} style={sel}>
                      {destinos.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  ) : vacio(rutasError ? 'Sin conexión' : rutas ? 'Sin destinos aún' : 'Cargando…')}
                </span>
              </label>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {dias.map((d) => {
                  const on = d.fecha === fecha;
                  return (
                    <button
                      key={d.fecha}
                      className={sinRutas ? undefined : css.chipDia}
                      disabled={sinRutas}
                      onClick={() => setCriterios({ fecha: d.fecha })}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 62, padding: '8px 12px', borderRadius: 12, border: sinRutas ? '1.5px dashed #D5DEEB' : `1.5px solid ${on ? '#2563EB' : '#E2E8F2'}`, background: sinRutas ? '#F9FBFE' : on ? '#2563EB' : '#FFFFFF', color: sinRutas ? '#A3B1C6' : on ? '#FFFFFF' : '#0F172A', fontFamily: 'inherit', cursor: sinRutas ? 'default' : 'pointer' }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{d.dia}</span>
                      <span style={{ fontSize: 18, fontWeight: 700 }}>{d.num}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 14, color: '#475569' }}>Pasajeros</span>
                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #E2E8F2', borderRadius: 12 }}>
                  <button onClick={() => setCriterios({ pasajeros: Math.max(1, pax - 1) })} disabled={sinRutas} aria-label="Menos" style={{ width: 44, height: 44, border: 'none', background: 'transparent', fontSize: 20, color: sinRutas ? '#C3CBD8' : '#2563EB', cursor: sinRutas ? 'default' : 'pointer', fontFamily: 'inherit' }}>−</button>
                  <span style={{ minWidth: 22, textAlign: 'center', fontSize: 18, fontWeight: 700, color: sinRutas ? '#A3B1C6' : undefined }}>{pax}</span>
                  <button onClick={() => setCriterios({ pasajeros: Math.min(6, pax + 1) })} disabled={sinRutas} aria-label="Más" style={{ width: 44, height: 44, border: 'none', background: 'transparent', fontSize: 20, color: sinRutas ? '#C3CBD8' : '#2563EB', cursor: sinRutas ? 'default' : 'pointer', fontFamily: 'inherit' }}>+</button>
                </div>
              </div>
            </div>
            {sinRutas && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 18px', padding: '18px 28px', background: '#F9FBFE', borderTop: '1px solid #EEF2F9', margin: '0 -28px -28px', fontSize: 15, color: '#475569' }}>
                <svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true" style={{ flex: 'none' }}>
                  <g fill="none" stroke="#C3CBD8" strokeWidth="5">
                    <rect x="6" y="6" width="22" height="22" rx="6" />
                    <rect x="6" y="36" width="22" height="22" rx="6" />
                    <rect x="36" y="36" width="22" height="22" rx="6" />
                  </g>
                  <rect x="34" y="4" width="26" height="26" rx="7" fill="none" stroke="#9FC0FF" strokeWidth="4" strokeDasharray="4 5" />
                </svg>
                <span style={{ flex: '1 1 320px', minWidth: 0 }}>
                  Aún no hay rutas publicadas. Las fechas y ciudades se activan apenas una línea afiliada cargue sus horarios.
                </span>
                <a href="#salidas" style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>Avísame →</a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Salidas: tablero de terminal */}
      <div style={enPanel ? { position: 'relative' } : { position: 'relative', maxWidth: 1440, margin: '0 auto', padding: '0 28px 80px' }}>
        <section id="salidas" style={{ background: '#081F52', borderRadius: angosta ? 20 : 24, boxShadow: '0 24px 60px rgba(11,42,107,.22)', padding: angosta ? '18px 12px 14px' : '26px 26px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 14px', paddingBottom: 8 }}>
            <Isotipo size={24} trazo={5} contorno="#FFFFFF" acento="#60A5FA" />
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '0.14em', color: '#FFFFFF' }}>SALIDAS</h2>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#C7D9FB' }}>{lista.length ? `${lista.length} salida${lista.length === 1 ? '' : 's'} · ${diaTxt}` : `Salidas · ${diaTxt}`}</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: '#9FC0FF' }}>Precio por pasajero</span>
          </div>
          {lista.length > 0 && angosta && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lista.map((s) => {
                const libres = libresDe(s);
                const pocas = ocupacion != null && libres <= 5;
                const elegida = abierta === s.documentId;
                const estado = elegida ? 'ELEGIDA' : pocas ? `QUEDAN ${libres}` : s.estado === 'abordando' ? 'ABORDANDO' : 'A TIEMPO';
                const colorEstado = elegida ? '#60A5FA' : pocas ? '#FBBF24' : s.estado === 'abordando' ? '#60A5FA' : '#9FC0FF';
                return (
                  <div key={s.documentId} style={{ border: `1.5px solid ${elegida ? '#60A5FA' : 'rgba(159,192,255,.14)'}`, borderRadius: 16, overflow: 'hidden', background: elegida ? 'rgba(37,99,235,.22)' : 'rgba(159,192,255,.04)' }}>
                    <button className={css.salidaTarjeta} aria-expanded={elegida} onClick={() => setAbierta(elegida ? null : s.documentId)}>
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{hora(s.fechaHoraSalida)}</span>
                        <span style={{ fontSize: 12, color: '#9FC0FF' }}>llega {hora(s.fechaHoraLlegada)}</span>
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.25 }}>{s.linea?.nombre}</span>
                        <span style={{ fontSize: 12, color: '#9FC0FF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.ruta ? duracion(s.ruta.duracionMin) : ''}{s.unidad?.numero ? ` · Unidad ${s.unidad.numero}` : ''}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: colorEstado }}>{estado}</span>
                      </span>
                      <Money usd={precioMin(s)} style={{ fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap', color: '#FFFFFF' }} />
                    </button>
                    {elegida && <PanelAsientos salidaId={s.documentId} pax={pax} />}
                  </div>
                );
              })}
            </div>
          )}
          {lista.length > 0 && !angosta && (
            <div style={{ overflowX: 'auto', margin: '0 -4px', padding: '0 4px' }}>
              <div style={{ minWidth: 900, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '118px 210px 44px minmax(180px,1fr) 120px 110px', gap: 16, padding: '0 16px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#7C8AA5' }}>
                  <span>HORA</span><span>DESTINO</span><span>LÍNEA</span><span>SERVICIO</span><span style={{ textAlign: 'right' }}>PRECIO</span><span style={{ textAlign: 'right' }}>ESTADO</span>
                </div>
                {lista.map((s) => {
                  const libres = libresDe(s);
                  const pocas = ocupacion != null && libres <= 5;
                  const elegida = abierta === s.documentId;
                  const estado = elegida ? 'ELEGIDA' : pocas ? `QUEDAN ${libres}` : s.estado === 'abordando' ? 'ABORDANDO' : 'A TIEMPO';
                  const colorEstado = elegida ? '#60A5FA' : pocas ? '#FBBF24' : s.estado === 'abordando' ? '#60A5FA' : '#9FC0FF';
                  const iniciales = (s.linea?.nombre ?? '').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
                  return (
                    <div key={s.documentId} style={{ border: `1.5px solid ${elegida ? '#60A5FA' : 'rgba(159,192,255,.14)'}`, borderRadius: 16, overflow: 'hidden', background: elegida ? 'rgba(37,99,235,.22)' : 'rgba(159,192,255,.04)' }}>
                      <button className={css.salidaFila} aria-expanded={elegida} onClick={() => setAbierta(elegida ? null : s.documentId)}>
                        <Letras texto={hora(s.fechaHoraSalida)} />
                        <Letras texto={casillas(s.ruta?.destino ?? '', 9)} />
                        <span style={{ width: 34, height: 30, borderRadius: 8, background: 'rgba(159,192,255,.14)', color: '#C7D9FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{iniciales}</span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.unidad?.marcaModelo ?? s.linea?.nombre}</span>
                          <span style={{ fontSize: 12, color: '#9FC0FF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Llega {hora(s.fechaHoraLlegada)}{s.ruta ? ` · ${duracion(s.ruta.duracionMin)}` : ''}{s.unidad?.numero ? ` · Unidad ${s.unidad.numero}` : ''}
                          </span>
                        </span>
                        <Money usd={precioMin(s)} style={{ fontSize: 18, fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap', color: '#FFFFFF' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textAlign: 'right', whiteSpace: 'nowrap', color: colorEstado }}>{estado}</span>
                      </button>
                      {elegida && <PanelAsientos salidaId={s.documentId} pax={pax} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {origen && destino && origen === destino && <div style={{ padding: '20px 4px', fontSize: 15, color: '#C7D9FB' }}>Elige ciudades distintas para ver las salidas.</div>}
          {!sinRutas && distintas && !salidas && <div style={{ padding: '20px 4px', fontSize: 15, color: '#C7D9FB' }}>{rutasError ? 'No se pudieron cargar las salidas. Revisa tu conexión e inténtalo de nuevo.' : 'Cargando salidas…'}</div>}
          {(sinRutas || (distintas && salidas && !lista.length)) && (
            <div style={{ border: '1.5px dashed #CBD5E1', borderRadius: 20, background: '#F9FBFE', padding: '44px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, textAlign: 'center' }}>
              <svg viewBox="0 0 64 64" width="84" height="84" aria-hidden="true">
                <g fill="none" stroke="#CBD5E1" strokeWidth="4">
                  <rect x="6" y="6" width="22" height="22" rx="6" />
                  <rect x="6" y="36" width="22" height="22" rx="6" />
                  <rect x="36" y="36" width="22" height="22" rx="6" />
                  <rect x="36" y="6" width="22" height="22" rx="6" strokeDasharray="4 4" stroke="#9FC0FF" />
                </g>
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 520 }}>
                <h3 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, textWrap: 'balance' }}>
                  {sinRutas ? 'Todavía no hay rutas publicadas' : salidas?.length ? `Ya no quedan ${pax} puestos libres ese día` : `Todavía no hay salidas de ${origen} a ${destino}`}
                </h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: '#475569', textWrap: 'pretty' }}>
                  {salidas?.length
                    ? 'Prueba otra fecha o con menos pasajeros.'
                    : 'Las líneas afiliadas publican sus horarios con anticipación. Escríbenos por WhatsApp y te avisamos apenas haya puestos.'}
                </p>
              </div>
              <a
                href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(sinRutas ? 'Hola, avísame cuando haya salidas disponibles' : `Hola, avísame cuando haya salidas de ${origen} a ${destino}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ height: 52, padding: '0 24px', borderRadius: 14, background: '#2563EB', color: '#FFFFFF', fontSize: 15, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}
              >
                Avísame por WhatsApp
              </a>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 18px', fontSize: 14, color: '#475569' }}>
                <span>¿Viajas pronto?</span>
                <a href={enPanel ? '/#lineas' : '#lineas'} style={{ fontWeight: 600 }}>Ver líneas afiliadas</a>
              </div>
            </div>
          )}
        </section>
      </div>

    </>
  );
}
