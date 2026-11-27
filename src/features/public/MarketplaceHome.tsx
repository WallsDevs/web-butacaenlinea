import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getSalidas } from '../../lib/api/endpoints';
import { BoletoMuestra } from '../../components/ticket/BoletoMuestra';
import { Isotipo } from '../../components/brand/LogoMark';
import { AvisoInstalar } from '../../components/AvisoInstalar';
import { useAuth } from '../../stores/auth';
import { useBooking } from './useBooking';
import { useSeo } from '../../lib/seo';
import { Kilometros } from './inicio/Kilometros';
import { CompraSinCuenta } from './inicio/CompraSinCuenta';
import { TarjetasNfc } from './inicio/TarjetasNfc';
import { Destinos } from './inicio/Destinos';
import { H2 } from './inicio/piezas';
import { TableroMuestra } from './inicio/Tablero';
import { BuscadorPasajes } from './BuscadorPasajes';
import type { Modalidad } from '../../lib/api/types';
import { useInstalar } from './inicio/useInstalar';
import css from './inicio/inicio.module.css';
import { rutaCiudad, rutaPar } from '../../seo/contenido.mjs';
import { CIUDADES_INICIO, RUTAS_INICIO, nombreVisible, rutaTerminal } from '../../seo/guias.mjs';

/** Las ciudades más buscadas: enlaces directos a su página de pasajes (los buscadores siguen estos enlaces). */

// Número de atención por WhatsApp (solo dígitos, con código de país). VITE_WHATSAPP lo reemplaza.
const WHATSAPP = (import.meta.env.VITE_WHATSAPP as string | undefined)?.replace(/\D/g, '') || '584129647161';
// Las líneas piden afiliarse por WhatsApp (antes era un correo a la vista, presa del spam)
const AFILIAR = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola, quiero afiliar mi línea de transporte a Butaca En Línea.')}`;
/** La única red social de Butaca, de momento. */
const INSTAGRAM = 'https://www.instagram.com/butacaenlinea/';
const HOME_POR_ROL: Record<string, string> = { superadmin: '/admin', empresa: '/empresa', cajero: '/pos', chofer: '/app-conductor', colector: '/colector', cliente: '/cuenta' };


/**
 * PÁGINA PRINCIPAL de butacaenlinea.com (diseño «Sitio Público v5»): el
 * marketplace de la plataforma. Las búsquedas muestran salidas reales. El programa
 * de kilómetros se presenta como demostración.
 */
export default function MarketplaceHome() {
  useSeo(
    'Pasajes de bus en Venezuela: compra en línea | Butaca En Línea',
    'Compra pasajes de bus o autobús en línea a Caracas, Maracaibo, Valencia, Mérida y toda Venezuela. Escoge tu puesto y recibe tu boleto al instante.',
    { ruta: '/' }
  );
  const navigate = useNavigate();
  const portada = useRef<HTMLDivElement>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const usuario = useAuth((s) => s.usuario);
  const [modalidad, setModalidad] = useState<Modalidad>('Urbano');
  const instalar = useInstalar();
  const { data: proximas } = useQuery({
    queryKey: ['salidas-proximas', 'todas'],
    queryFn: () => getSalidas({ desde: new Date().toISOString() }),
    refetchInterval: 60_000,
  });
  // Lo que eligió en el buscador (lo comparte el almacén de reserva)
  const { criterios, setCriterios } = useBooking();
  const destino = criterios.destino;
  const pax = Math.max(1, Math.min(6, criterios.pasajeros));

  // Desde el pie o los destinos se vuelve al buscador
  useEffect(() => {
    const h = window.location.hash;
    if (h) document.getElementById(h.slice(1))?.scrollIntoView();
  }, []);

  useEffect(() => {
    if (!portada.current || !('IntersectionObserver' in window)) return;
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)');
    const observador = new IntersectionObserver((entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        observador.unobserve(entrada.target);
        if (!reducir.matches) entrada.target.classList.add(css.enVista);
      }
    });
    portada.current.querySelectorAll('[data-entrada]').forEach(el => observador.observe(el));
    return () => observador.disconnect();
  }, []);

  const proxima = proximas?.[0];
  const home = usuario?.role?.type ? HOME_POR_ROL[usuario.role.type] ?? '/cuenta' : '/cuenta';
  const enlacePie = (txt: string, href: string) => <a key={txt} className={css.pieLink} href={href}>{txt}</a>;

  return (
    <div ref={portada} style={{ position: 'relative', minHeight: '100vh', overflowX: 'clip' }}>
      {/* Hero */}
      <div style={{ position: 'relative', paddingBottom: 110 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(165deg,#0B2A6B 0%,#123B8F 55%,#1D4ED8 100%)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -140, top: -180, width: 560, height: 560, borderRadius: '50%', background: 'rgba(96,165,250,.14)' }} />
          <div style={{ position: 'absolute', right: 220, top: 300, width: 300, height: 300, borderRadius: '50%', background: 'rgba(96,165,250,.10)' }} />
        </div>

        <header style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="/" aria-label="Butaca En Línea" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Isotipo size={34} trazo={5} contorno="#FFFFFF" acento="#60A5FA" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 0.85, color: '#FFFFFF' }}>Butaca</div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', color: '#9FC0FF', lineHeight: 1 }}>EN LÍNEA</div>
            </div>
          </a>
          <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 26, fontSize: 14, fontWeight: 500 }}>
            <span className={css.navHorizontal} style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
              <a className={css.navLink} href="/pasajes">Pasajes</a>
              <a className={css.navLink} href="/busetas">Busetas</a>
              <a className={css.navLink} href="#kilometros">Kilómetros</a>
              <a className={css.navLink} href="#nosotros">Quiénes somos</a>
            </span>
            <a
              href={usuario ? home : '/ingresar'}
              onClick={(e) => { e.preventDefault(); navigate(usuario ? home : '/ingresar'); }}
              style={{ color: '#FFFFFF', fontWeight: 600, padding: '9px 16px', border: '1.5px solid rgba(255,255,255,.5)', borderRadius: 10 }}
            >
              {usuario ? 'Mi cuenta' : 'Ingresar'}
            </a>
            <button
              type="button"
              className={css.botonMenu}
              aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuAbierto}
              onClick={() => setMenuAbierto((a) => !a)}
            >
              <span aria-hidden="true">{menuAbierto ? '✕' : '☰'}</span>
            </button>
          </nav>
          {menuAbierto && (
            <div className={css.menuMovil} onClick={() => setMenuAbierto(false)}>
              <a href="/pasajes" onClick={(e) => { e.preventDefault(); navigate('/pasajes'); }}>Pasajes por ciudad</a>
              <a href="#salidas">Salidas</a>
              <a href="/busetas">Busetas</a>
              <a href="#kilometros">Kilómetros</a>
              <a href="#nosotros">Quiénes somos</a>
              <a href="/ayuda" onClick={(e) => { e.preventDefault(); navigate('/ayuda'); }}>Ayuda</a>
            </div>
          )}
        </header>

        <AvisoInstalar />
        <div className={css.presentacion}>
          <div className={css.textoPresentacion}>
            {/* El H1 dice qué se busca («pasajes de bus en Venezuela») y promete lo que convierte */}
            <h1>
              <span>Pasajes de bus en Venezuela</span>
              Escoge tu puesto y aborda con el teléfono
            </h1>
            <p>
              Elige la salida, toca tu asiento en el mapa y paga. Así se ve tu boleto: lo llevas en el teléfono y funciona sin señal.
            </p>
          </div>

          {/* Boleto de muestra */}
          <aside className={css.boletoPortada} id="boleto-de-muestra" aria-label="Ejemplo de boleto">
            <BoletoMuestra salida={proxima} />
          </aside>
        </div>
      </div>

      {/* Buscador y salidas (el mismo que ve el pasajero en su panel) */}
      <BuscadorPasajes modalidad={modalidad} elegirModalidad={setModalidad} />
      <TarjetasNfc />
      <CompraSinCuenta conSesion={Boolean(usuario)} onBuscar={() => {
        setModalidad('Nacional');
        document.getElementById('buscar-pasajes')?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        });
      }} />
      <Kilometros destino={destino} pasajeros={pax} />

      {/* Secciones */}
      <div style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', padding: '0 28px 96px', display: 'flex', flexDirection: 'column', gap: 88 }}>
        <Destinos
          salidas={proximas ?? []}
          onElegir={(d) => {
            setModalidad('Nacional');
            const ruta = proximas?.find(s => s.ruta?.destino === d)?.ruta;
            setCriterios({ origen: ruta?.origen ?? criterios.origen, destino: d });
            window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
          }}
        />

        <section id="rutas" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div data-entrada="texto" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <H2>Rutas más buscadas</H2>
            <a href={rutaTerminal('la-bandera')} style={{ fontSize: 15, fontWeight: 700 }}>Precios del Terminal La Bandera →</a>
          </div>
          <ul className={css.enlacesViaje} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 8 }}>
            {RUTAS_INICIO.map(([o, d]) => (
              <li key={`${o}-${d}`}>
                <a href={rutaPar(o, d)} style={{ display: 'block', padding: '12px 14px', borderRadius: 12, background: '#FFFFFF', border: '1px solid #E6EBF4', fontSize: 15, fontWeight: 600, color: '#0F172A' }}>
                  Pasaje de {nombreVisible(o)} a {nombreVisible(d)}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section id="ciudades" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div data-entrada="texto" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <H2>Pasajes por ciudad</H2>
            <a href="/pasajes" style={{ fontSize: 15, fontWeight: 700 }}>Ver todas las ciudades →</a>
          </div>
          <ul className={css.enlacesViaje} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
            {CIUDADES_INICIO.map((c) => (
              <li key={c}>
                <a href={rutaCiudad(c)} style={{ display: 'block', padding: '12px 14px', borderRadius: 12, background: '#FFFFFF', border: '1px solid #E6EBF4', fontSize: 15, fontWeight: 600, color: '#0F172A' }}>
                  Pasajes en {c}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section id="nosotros" style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'stretch' }}>
          <div data-entrada="texto" style={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
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
          <TableroMuestra />
        </section>
      </div>

      {/* Pie */}
      <footer style={{ position: 'relative', marginTop: 96, background: 'linear-gradient(165deg,#0B2A6B 0%,#123B8F 60%,#1D4ED8 100%)', color: '#C7D9FB', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -160, top: -120, width: 520, height: 520, borderRadius: '50%', background: 'rgba(96,165,250,.12)' }} />
        <div style={{ position: 'absolute', left: -120, bottom: -200, width: 420, height: 420, borderRadius: '50%', background: 'rgba(96,165,250,.08)' }} />
        <div style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', padding: '0 28px' }}>
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
                ['Viajar', [['Pasajes por ciudad', '/pasajes'], ['Destinos', '#destinos'], ['Todas las salidas', '/salidas'], ['Mis boletos', '/cuenta/boletos'], ['Recuperar boletos', '/recuperar-boletos'], ['Ayuda', '/ayuda'], ['Horarios', '#salidas']]],
                ['Kilómetros', [['Cómo funcionan', '#kilometros'], ['Niveles', '#kilometros'], ['Canjear premios', '#kilometros']]],
                ['Empresa', [['Quiénes somos', '#nosotros'], ['Líneas afiliadas', '/pasajes'], ['Afiliar mi línea', AFILIAR]]],
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
                <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" className={css.pieLink} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} aria-label="Instagram de Butaca En Línea: @butacaenlinea">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
                  </svg>
                  @butacaenlinea
                </a>
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
