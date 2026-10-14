import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getLineas, getOcupacionSalidas, getRutas, getSalidas } from '../../lib/api/endpoints';
import { duracion, fechaCorta, hora, rangoDia, hoyISO } from '../../lib/time';
import { Money } from '../../components/ui/Money';
import { Isotipo } from '../../components/brand/LogoMark';
import { useAuth } from '../../stores/auth';
import { useBooking } from './useBooking';
import { useSeo } from '../../lib/seo';
import { Promociones } from './inicio/Promociones';
import { Kilometros } from './inicio/Kilometros';
import { Destinos } from './inicio/Destinos';
import { H2 } from './inicio/piezas';
import { useInstalar } from './inicio/useInstalar';
import css from './inicio/inicio.module.css';

// Número de atención (solo dígitos, con código de país). Sin él no se muestra WhatsApp.
const WHATSAPP = (import.meta.env.VITE_WHATSAPP as string | undefined)?.replace(/\D/g, '') || '';
const COLORES_LINEA = ['#0B2A6B', '#2563EB', '#1D4ED8', '#123B8F', '#3B82F6', '#0B2A6B'];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HOME_POR_ROL: Record<string, string> = { superadmin: '/admin', empresa: '/empresa', cajero: '/pos', chofer: '/chofer', colector: '/colector', cliente: '/cuenta' };

const pad2 = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Un patrón de QR de muestra (los tres localizadores y relleno fijo), como en el boleto del diseño. */
function patronQr(): string[] {
  let sd = 77;
  const r = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
  const finder = (fila: number, col: number) => {
    for (const [fr, fc] of [[0, 0], [0, 14], [14, 0]]) {
      const a = fila - fr, b = col - fc;
      if (a >= 0 && a < 7 && b >= 0 && b < 7) return a === 0 || a === 6 || b === 0 || b === 6 || (a >= 2 && a <= 4 && b >= 2 && b <= 4) ? 1 : 0;
    }
    return -1;
  };
  return Array.from({ length: 441 }, (_, i) => {
    const f = finder(Math.floor(i / 21), i % 21);
    return (f === -1 ? r() > 0.52 : f === 1) ? '#0F172A' : 'transparent';
  });
}
const QR = patronQr();

/**
 * PÁGINA PRINCIPAL de butacaenlinea.com (diseño «Sitio Público v5»): el
 * marketplace de la plataforma. Búsqueda y salidas son reales; promociones y
 * kilómetros son demostración hasta que exista el programa en el servidor.
 */
export default function MarketplaceHome() {
  useSeo(
    'Butaca En Línea — Pasajes de autobús en Venezuela',
    'Busca salidas de todas las líneas, escoge tu puesto en el mapa y compra tu pasaje en línea. Boleto electrónico con QR.'
  );
  const navigate = useNavigate();
  const usuario = useAuth((s) => s.usuario);
  const instalar = useInstalar();
  const { criterios, setCriterios } = useBooking();

  const { data: lineas } = useQuery({ queryKey: ['lineas'], queryFn: getLineas });
  const { data: rutas, isError: rutasError } = useQuery({ queryKey: ['rutas-publicas'], queryFn: () => getRutas() });
  const { data: proximas } = useQuery({
    queryKey: ['salidas-proximas', 'todas'],
    queryFn: () => getSalidas({ desde: new Date().toISOString() }),
    refetchInterval: 60_000,
  });

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
    const total = s.unidad?.configuracionAsientos?.pisos?.reduce((acc, p) => acc + p.filas.length * (p.layout.izquierda + p.layout.derecha), 0) ?? 0;
    return Math.max(0, total - (ocupacion?.[s.documentId] ?? 0));
  };
  const precioMin = (s: { preciosUsd?: Record<string, number> }) => Math.min(...Object.values(s.preciosUsd ?? { x: 0 }));
  const lista = (salidas ?? []).filter((s) => !ocupacion || libresDe(s) >= pax);

  // Desde el pie o los destinos se vuelve al buscador
  useEffect(() => {
    const h = window.location.hash;
    if (h) document.getElementById(h.slice(1))?.scrollIntoView();
  }, []);

  const proxima = proximas?.[0];
  const home = usuario?.role?.type ? HOME_POR_ROL[usuario.role.type] ?? '/cuenta' : '/cuenta';
  const sel = { appearance: 'none', WebkitAppearance: 'none', border: 'none', background: 'transparent', font: 'inherit', fontSize: 24, fontWeight: 700, color: '#0F172A', padding: 0, outline: 'none', cursor: 'pointer', width: '100%' } as const;
  const cajaCiudad = { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', border: '1.5px solid #E2E8F2', borderRadius: 16, cursor: 'pointer' } as const;
  const vacio = (txt: string) => <span style={{ fontSize: 24, fontWeight: 700, color: '#A3AEC2', lineHeight: '31px' }}>{txt}</span>;
  const enlacePie = (txt: string, href: string) => <a key={txt} className={css.pieLink} href={href}>{txt}</a>;

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflowX: 'clip' }}>
      {/* Hero */}
      <div style={{ position: 'relative', paddingBottom: 110 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(165deg,#0B2A6B 0%,#123B8F 55%,#1D4ED8 100%)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -140, top: -180, width: 560, height: 560, borderRadius: '50%', background: 'rgba(96,165,250,.14)' }} />
          <div style={{ position: 'absolute', right: 220, top: 300, width: 300, height: 300, borderRadius: '50%', background: 'rgba(96,165,250,.10)' }} />
        </div>

        <header style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', padding: '20px 20px', display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="/" aria-label="Butaca En Línea" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Isotipo size={34} trazo={5} contorno="#FFFFFF" acento="#60A5FA" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 0.85, color: '#FFFFFF' }}>Butaca</div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', color: '#9FC0FF', lineHeight: 1 }}>EN LÍNEA</div>
            </div>
          </a>
          <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 26, fontSize: 14, fontWeight: 500 }}>
            <span className={css.navHorizontal} style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
              <a className={css.navLink} href="#promos">Promociones</a>
              <a className={css.navLink} href="#kilometros">Kilómetros</a>
              <a className={css.navLink} href="#lineas">Líneas</a>
              <a className={css.navLink} href="#nosotros">Quiénes somos</a>
            </span>
            <a
              href={usuario ? home : '/ingresar'}
              onClick={(e) => { e.preventDefault(); navigate(usuario ? home : '/ingresar'); }}
              style={{ color: '#FFFFFF', fontWeight: 600, padding: '9px 16px', border: '1.5px solid rgba(255,255,255,.5)', borderRadius: 10 }}
            >
              {usuario ? 'Mi cuenta' : 'Ingresar'}
            </a>
          </nav>
        </header>

        <div style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', padding: '28px 20px 40px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 40 }}>
          <div style={{ flex: '1 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 620 }}>
              <h1 style={{ margin: 0, fontSize: 'clamp(40px,5.2vw,64px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: '#FFFFFF', textWrap: 'balance' }}>
                Escoge tu puesto y aborda con el teléfono
              </h1>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: '#C7D9FB', textWrap: 'pretty' }}>
                Elige la salida, toca tu asiento en el mapa y paga. Así se ve tu boleto: lo llevas en el teléfono y funciona sin señal.
              </p>
            </div>
          </div>

          {/* Boleto de muestra */}
          <aside style={{ flex: '1 0 300px', maxWidth: 340, minWidth: 280, marginTop: 8 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 22, boxShadow: '0 24px 60px rgba(11,42,107,.28)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #EEF2F9' }}>
                <Isotipo size={20} fondo="claro" />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Boleto electrónico</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: '#E7F6EC', color: '#166534' }}>Válido</span>
              </div>
              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>{proxima ? hora(proxima.fechaHoraSalida) : '20:30'}</span>
                    <span style={{ fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>{proxima?.ruta?.origen ?? 'San Cristóbal'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 14 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #2563EB', boxSizing: 'border-box', flex: 'none' }} />
                    <span style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg,#9FC0FF 0 5px,transparent 5px 10px)' }} />
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', flex: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>{proxima ? hora(proxima.fechaHoraLlegada) : '06:15'}</span>
                    <span style={{ fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>{proxima?.ruta?.destino ?? 'Caracas'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 13, color: '#7C8AA5', borderTop: '2px dashed #DCE3EE', paddingTop: 12 }}>
                  <span>Puesto <strong style={{ color: '#2563EB' }}>04</strong></span>
                  <span>{proxima ? fechaCorta(proxima.fechaHoraSalida) : 'Vie 21 ago'}</span>
                  <span>Piso 1 VIP</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 52, height: 52, flex: 'none', border: '1.5px solid #E2E8F2', borderRadius: 10, padding: 5, boxSizing: 'border-box' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(21,1fr)', width: '100%', height: '100%' }}>
                      {QR.map((c, i) => <span key={i} style={{ background: c }} />)}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                      {proxima ? <Money usd={precioMin(proxima)} /> : 'Bs 1.421,20'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#2563EB' }}>+820 km</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Buscador */}
      <div style={{ position: 'relative', maxWidth: 1440, margin: '-110px auto 0', padding: '0 20px 28px', boxSizing: 'border-box' }}>
        <div style={{ background: '#FFFFFF', borderRadius: 22, boxShadow: '0 24px 60px rgba(11,42,107,.22)', overflow: 'hidden', border: '1px solid #E6EBF4' }}>
          <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className={css.ciudades} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 48px minmax(0,1fr)', alignItems: 'center', gap: 10 }}>
              <label style={cajaCiudad}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', border: '3px solid #2563EB', boxSizing: 'border-box', flex: 'none' }} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 12, color: '#7C8AA5' }}>Desde</span>
                  {origenes.length ? (
                    <select value={origen} onChange={(e) => setCriterios({ origen: e.target.value, destino: '' })} style={sel}>
                      {origenes.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : vacio(rutasError ? 'Sin conexión' : rutas ? 'Sin rutas' : 'Cargando…')}
                </span>
              </label>
              <button
                onClick={() => setCriterios({ origen: destino, destino: origen })}
                aria-label="Invertir"
                style={{ width: 44, height: 44, borderRadius: '50%', border: '1.5px solid #E2E8F2', background: '#FFFFFF', color: '#2563EB', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}
              >⇄</button>
              <label style={cajaCiudad}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#2563EB', flex: 'none' }} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 12, color: '#7C8AA5' }}>Hasta</span>
                  {destinos.length ? (
                    <select value={destino} onChange={(e) => setCriterios({ destino: e.target.value })} style={sel}>
                      {destinos.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  ) : vacio(rutasError ? 'Sin conexión' : rutas ? 'Sin destinos' : 'Cargando…')}
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
                      className={css.chipDia}
                      onClick={() => setCriterios({ fecha: d.fecha })}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 62, padding: '8px 12px', borderRadius: 12, border: `1.5px solid ${on ? '#2563EB' : '#E2E8F2'}`, background: on ? '#2563EB' : '#FFFFFF', color: on ? '#FFFFFF' : '#0F172A', fontFamily: 'inherit', cursor: 'pointer' }}
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
                  <button onClick={() => setCriterios({ pasajeros: Math.max(1, pax - 1) })} aria-label="Menos" style={{ width: 44, height: 44, border: 'none', background: 'transparent', fontSize: 20, color: '#2563EB', cursor: 'pointer', fontFamily: 'inherit' }}>−</button>
                  <span style={{ minWidth: 22, textAlign: 'center', fontSize: 18, fontWeight: 700 }}>{pax}</span>
                  <button onClick={() => setCriterios({ pasajeros: Math.min(6, pax + 1) })} aria-label="Más" style={{ width: 44, height: 44, border: 'none', background: 'transparent', fontSize: 20, color: '#2563EB', cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Salidas */}
      <div style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', padding: '0 20px 80px' }}>
        <section id="salidas" style={{ background: '#FFFFFF', borderRadius: 22, boxShadow: '0 12px 40px rgba(11,42,107,.08)', border: '1px solid #E6EBF4', padding: '24px 24px 26px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>{lista.length} salida{lista.length === 1 ? '' : 's'} · {diaTxt}</h2>
            <span style={{ fontSize: 13, color: '#7C8AA5' }}>Precio por pasajero</span>
          </div>
          {lista.map((s) => {
            const libres = libresDe(s);
            const pocas = ocupacion != null && libres <= 5;
            return (
              <div key={s.documentId} style={{ border: '1.5px solid #E6EBF4', borderRadius: 16, overflow: 'hidden', background: '#FFFFFF' }}>
                <button
                  className={css.salidaFila}
                  onClick={() => navigate(`/salidas/${s.documentId}/asientos`)}
                >
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>{hora(s.fechaHoraSalida)}</span>
                    <span style={{ fontSize: 14, color: '#7C8AA5' }}>→ {hora(s.fechaHoraLlegada)}</span>
                  </span>
                  <span className={css.salidaMedio} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{s.unidad?.marcaModelo ?? s.linea?.nombre}</span>
                    <span style={{ fontSize: 13, color: '#7C8AA5' }}>
                      {s.ruta ? `${duracion(s.ruta.duracionMin)} · ` : ''}{s.linea?.nombre}{s.unidad?.numero ? ` · Unidad ${s.unidad.numero}` : ''}
                    </span>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <Money usd={precioMin(s)} style={{ fontSize: 19, fontWeight: 700, whiteSpace: 'nowrap' }} />
                    {ocupacion != null && (
                      <span style={{ fontSize: 13, fontWeight: 600, color: pocas ? '#B45309' : '#475569', whiteSpace: 'nowrap' }}>
                        {pocas ? `Quedan ${libres}` : `${libres} libres`}
                      </span>
                    )}
                  </span>
                </button>
              </div>
            );
          })}
          {!distintas && <div style={{ padding: '20px 4px', fontSize: 15, color: '#475569' }}>{rutas && !origenes.length ? 'Todavía no hay rutas con salidas a la venta.' : rutas ? 'Elige ciudades distintas para ver las salidas.' : rutasError ? 'No se pudieron cargar las salidas. Revisa tu conexión e inténtalo de nuevo.' : 'Cargando salidas…'}</div>}
          {distintas && salidas && !lista.length && (
            <div style={{ padding: '20px 4px', fontSize: 15, color: '#475569' }}>
              No hay salidas de {origen} a {destino} con {pax} puesto{pax === 1 ? '' : 's'} libres ese día. Prueba otra fecha o menos pasajeros.
            </div>
          )}
        </section>
      </div>

      {/* Secciones */}
      <div style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', padding: '0 20px 96px', display: 'flex', flexDirection: 'column', gap: 88 }}>
        <Promociones />
        <Kilometros destino={destino} pasajeros={pax} />
        <Destinos
          salidas={proximas ?? []}
          onElegir={(d) => {
            setCriterios({ destino: d });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        <section id="lineas" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <H2>Líneas afiliadas</H2>
            <span style={{ fontSize: 14, color: '#475569' }}>Un solo lugar para comprar en todas</span>
          </div>
          <div className={css.lineasMarco}><div className={css.lineas}>
            {(lineas ?? []).map((l, i) => (
              <div key={l.documentId} style={{ background: '#FFFFFF', padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <span style={{ width: 48, height: 48, borderRadius: 14, background: COLORES_LINEA[i % COLORES_LINEA.length], color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
                  {l.nombre.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{l.nombre}</span>
                  <span style={{ fontSize: 13, color: '#7C8AA5' }}>{l.terminalBase ?? 'Venta en línea y taquilla'}{l.telefono ? ` · ${l.telefono}` : ''}</span>
                </div>
              </div>
            ))}
            {!lineas?.length && <div style={{ background: '#FFFFFF', padding: 28, color: '#7C8AA5', gridColumn: '1 / -1', textAlign: 'center' }}>Aún no hay líneas afiliadas.</div>}
          </div></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '22px 26px', borderRadius: 20, background: '#EFF4FF' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#0B2A6B' }}>¿Tienes una línea de transporte? Vende tus puestos en Butaca En Línea.</span>
            <a href="mailto:hola@butacaenlinea.com?subject=Afiliar%20mi%20l%C3%ADnea" style={{ fontSize: 15, fontWeight: 700 }}>Afiliar mi línea →</a>
          </div>
        </section>

        <section id="nosotros" style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <H2>Quiénes somos</H2>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, color: '#334155', textWrap: 'pretty' }}>
              Butaca En Línea nació en San Cristóbal para resolver algo que todo viajero conoce: la cola en taquilla, el puesto apartado por WhatsApp que nadie respeta y el boleto de papel que se pierde.
            </p>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, color: '#334155', textWrap: 'pretty' }}>
              Hoy somos la plataforma que conecta a las líneas de transporte con sus pasajeros. El viajero escoge su puesto y paga desde el teléfono; la línea vende en web y taquilla desde un mismo sistema, y el chofer valida el abordaje aunque no haya señal en la vía.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginTop: 6 }}>
              {[['Para el viajero', 'Puesto, pago y boleto en un solo lugar.', '#2563EB'], ['Para la línea', 'Boletería, flota y cierre de caja.', '#0B2A6B'], ['Para el chofer', 'Manifiesto y abordaje con el teléfono.', '#60A5FA']].map(([t, d, c]) => (
                <div key={t} style={{ borderTop: `3px solid ${c}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{t}</span>
                  <span style={{ fontSize: 14, lineHeight: 1.5, color: '#475569' }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: '1 1 380px', minWidth: 0, minHeight: 340, borderRadius: 24, background: 'repeating-linear-gradient(135deg,#EAF0FA 0 12px,#F2F6FC 12px 24px)', border: '1px solid #E6EBF4', display: 'flex', alignItems: 'flex-end', padding: 18, boxSizing: 'border-box' }}>
            <span style={{ fontSize: 12, color: '#7C8AA5', fontFamily: 'ui-monospace,monospace' }}>foto · equipo Butaca En Línea en el terminal</span>
          </div>
        </section>
      </div>

      {/* Pie */}
      <footer style={{ position: 'relative', marginTop: 96, background: 'linear-gradient(165deg,#0B2A6B 0%,#123B8F 60%,#1D4ED8 100%)', color: '#C7D9FB', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -160, top: -120, width: 520, height: 520, borderRadius: '50%', background: 'rgba(96,165,250,.12)' }} />
        <div style={{ position: 'absolute', left: -120, bottom: -200, width: 420, height: 420, borderRadius: '50%', background: 'rgba(96,165,250,.08)' }} />
        <div style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ marginTop: 56, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(159,192,255,.25)', borderRadius: 24, padding: '28px 32px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px 32px' }}>
            <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: '#FFFFFF' }}>Lleva tus boletos en el teléfono</span>
              <span style={{ fontSize: 15, color: '#C7D9FB' }}>Instala Butaca En Línea desde el navegador. Sin tienda de apps y funciona sin señal.</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {instalar && (
                <button onClick={instalar} style={{ height: 52, padding: '0 24px', borderRadius: 14, background: '#2563EB', color: '#FFFFFF', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit', cursor: 'pointer', border: 'none' }}>
                  <Isotipo size={20} trazo={6} contorno="#FFFFFF" acento="#9FC0FF" />Instalar en mi teléfono
                </button>
              )}
              <a href="/cuenta" style={{ height: 52, padding: '0 22px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,.5)', color: '#FFFFFF', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center' }}>Ver mis boletos</a>
            </div>
          </div>

          <div style={{ padding: '56px 0 44px', display: 'flex', flexWrap: 'wrap', gap: '48px 64px' }}>
            <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 340 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Isotipo size={44} contorno="#FFFFFF" acento="#60A5FA" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 0.85, color: '#FFFFFF' }}>Butaca</div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: '#9FC0FF', lineHeight: 1 }}>EN LÍNEA</div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: '#C7D9FB', textWrap: 'pretty' }}>Escoge tu puesto y aborda con el teléfono, en todas las líneas afiliadas.</p>
            </div>
            <div style={{ flex: '2 1 560px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 32 }}>
              {[
                ['Viajar', [['Destinos', '#destinos'], ['Promociones', '#promos'], ['Mis boletos', '/cuenta'], ['Horarios', '#salidas'], ['Busetas en vivo', '/busetas']]],
                ['Kilómetros', [['Cómo funcionan', '#kilometros'], ['Niveles', '#kilometros'], ['Canjear premios', '#kilometros']]],
                ['Empresa', [['Quiénes somos', '#nosotros'], ['Líneas afiliadas', '#lineas'], ['Afiliar mi línea', 'mailto:hola@butacaenlinea.com?subject=Afiliar%20mi%20l%C3%ADnea']]],
              ].map(([titulo, links]) => (
                <div key={titulo as string} style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, minWidth: 0 }}>
                  <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 15 }}>{titulo as string}</span>
                  {(links as string[][]).map(([t, h]) => enlacePie(t, h))}
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, minWidth: 0 }}>
                <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 15 }}>Atención</span>
                <span>Todos los días · 6:00 a 22:00</span>
                {WHATSAPP && <a href={`https://wa.me/${WHATSAPP}`} style={{ color: '#FFFFFF', fontWeight: 600 }}>WhatsApp</a>}
                {enlacePie('hola@butacaenlinea.com', 'mailto:hola@butacaenlinea.com')}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 4 }} aria-hidden="true">
            <span style={{ width: 12, height: 12, borderRadius: '50%', border: '3px solid #60A5FA', boxSizing: 'border-box', flex: 'none' }} />
            <span style={{ flex: 1, height: 3, background: 'repeating-linear-gradient(90deg,#60A5FA 0 10px,transparent 10px 18px)' }} />
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#60A5FA', flex: 'none' }} />
          </div>
          <div style={{ padding: '18px 0 104px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13, color: '#9FC0FF' }}>
            <span>© {new Date().getFullYear()} Butaca En Línea · Boletería y gestión de flota</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              <a href="#terminos" style={{ color: '#9FC0FF' }}>Términos</a>
              <a href="#privacidad" style={{ color: '#9FC0FF' }}>Privacidad</a>
              <a href="#reembolsos" style={{ color: '#9FC0FF' }}>Cambios y reembolsos</a>
            </div>
          </div>
        </div>
      </footer>

      {WHATSAPP && (
        <a
          href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola, quiero comprar un boleto')}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Escríbenos por WhatsApp"
          style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: '50%', background: '#25D366', boxShadow: '0 10px 28px rgba(18,140,74,.35)' }}
        >
          <svg viewBox="0 0 32 32" width="32" height="32" fill="#FFFFFF"><path d="M16 3C9 3 3.3 8.6 3.3 15.6c0 2.4.7 4.7 1.9 6.7L3 29l6.9-2.1c1.9 1 4 1.6 6.1 1.6 7 0 12.7-5.7 12.7-12.6S23 3 16 3zm0 23.1c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-4.1 1.2 1.2-4-.3-.4c-1.1-1.7-1.7-3.6-1.7-5.6C5.3 9.8 10.1 5.1 16 5.1s10.7 4.7 10.7 10.5S21.9 26.1 16 26.1zm5.9-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1c-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2s0-.5.1-.6l.5-.6c.2-.2.2-.4.3-.6s0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.1-1.2 2.8 1.2 3.2 1.4 3.5c.2.2 2.4 3.6 5.8 5 .8.4 1.4.6 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5s.3-1.4.2-1.5c-.1-.2-.3-.3-.6-.4z" /></svg>
        </a>
      )}
    </div>
  );
}
