import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { LogoLockup } from '../components/brand/LogoMark';
import { PillTabs } from '../components/ui/PillTabs';
import { NavPrincipal } from './NavPrincipal';
import { BarraInferior } from './BarraInferior';
import { useAuth } from '../stores/auth';
import { useTasasSync } from '../lib/useTasas';
import { useModulos } from '../lib/useModulos';
import {
  AREAS_EMPRESA,
  MENU_ADMIN,
  MENU_EMPRESA,
  SECCIONES_CHOFER,
  SECCIONES_COLECTOR,
  SECCIONES_CUENTA,
  SECCIONES_POS,
  menuVisible,
  type EntradaNav,
} from './navegacion';
import styles from './AppChrome.module.css';

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

/** A dónde lleva «Mi panel» desde las páginas públicas. */
const HOGAR_POR_ROL: Record<string, string> = {
  superadmin: '/admin',
  empresa: '/empresa',
  cajero: '/pos',
  chofer: '/chofer',
  colector: '/colector',
  cliente: '/cuenta',
};

type ModuloId = 'web' | 'pos' | 'chofer' | 'empresa';

const MODULOS: { id: ModuloId; label: string; ruta: string }[] = [
  { id: 'web', label: 'Comprador Web', ruta: '/' },
  { id: 'pos', label: 'Punto de Venta', ruta: '/pos' },
  { id: 'chofer', label: 'Conductor', ruta: '/chofer' },
  { id: 'empresa', label: 'Empresa', ruta: '/empresa' },
];

function moduloActual(pathname: string): ModuloId {
  if (pathname.startsWith('/pos')) return 'pos';
  if (pathname.startsWith('/chofer')) return 'chofer';
  if (pathname.startsWith('/empresa') || pathname.startsWith('/flota')) return 'empresa';
  return 'web';
}

/**
 * Barra superior global. El conmutador de módulos existe para la DEMO
 * comercial (VITE_DEMO_MODE); en producción los módulos operativos van tras
 * login y el conmutador desaparece.
 */
export function AppChrome() {
  useTasasSync();
  const location = useLocation();
  const navigate = useNavigate();
  const usuario = useAuth((s) => s.usuario);
  const cerrarSesion = useAuth((s) => s.cerrarSesion);
  const [menuAbierto, setMenuAbierto] = useState(false);
  // Las secciones de la empresa dependen de lo que contrató su línea
  const { modulos, contrato, vencido, sinContrato } = useModulos();
  // Aviso del contrato: vencido, o a punto de vencer (lo ve todo el personal de la línea)
  const avisoContrato = sinContrato
    ? 'Tu empresa todavía no tiene un contrato activo, así que ningún módulo está habilitado. Contacta a Butaca En Línea para activarlo.'
    : vencido
    ? `El contrato de la línea venció${contrato?.venceEn ? ` el ${new Date(`${contrato.venceEn}T12:00:00`).toLocaleDateString('es-VE')}` : ''}: los módulos y la venta de sus salidas están cerrados hasta renovarlo.`
    : contrato?.estado === 'por_vencer'
      ? `El contrato de la línea vence en ${contrato.diasRestantes} ${contrato.diasRestantes === 1 ? 'día' : 'días'}.`
      : null;
  // En las páginas de acceso el chrome es mínimo: solo la marca
  const esPaginaAcceso = ['/ingresar', '/registro', '/plataforma'].includes(location.pathname);
  // Un solo patrón para todos los roles: las secciones del módulo viven en esta barra
  const rol = usuario?.role?.type;
  const path = location.pathname;
  // Perfil es de todos los roles: conserva el menú del rol para poder volver
  const enPerfil = path === '/perfil';
  const enAreaEmpresa = enPerfil || AREAS_EMPRESA.some((a) => path === a || path.startsWith(a + '/'));
  const nav: { menu: EntradaNav[]; tagline: string; home: string } | null =
    rol === 'superadmin' && (enPerfil || path.startsWith('/admin'))
      ? { menu: MENU_ADMIN, tagline: 'Plataforma', home: '/admin' }
      : rol === 'empresa' && enAreaEmpresa
        ? { menu: menuVisible(MENU_EMPRESA, modulos), tagline: usuario?.linea?.nombre ?? 'Mi empresa', home: '/empresa' }
        : rol === 'cajero' && (enPerfil || path.startsWith('/pos'))
          ? { menu: SECCIONES_POS, tagline: usuario?.linea?.nombre ?? 'Punto de venta', home: '/pos' }
          : rol === 'chofer' && (enPerfil || path.startsWith('/chofer'))
            ? { menu: SECCIONES_CHOFER, tagline: usuario?.linea?.nombre ?? 'Conductor', home: '/chofer' }
            : rol === 'colector' && (enPerfil || path.startsWith('/colector'))
              ? { menu: SECCIONES_COLECTOR, tagline: usuario?.linea?.nombre ?? 'Colector', home: '/colector' }
              : rol === 'cliente' && (enPerfil || path.startsWith('/cuenta'))
                ? { menu: SECCIONES_CUENTA, tagline: 'Mi cuenta', home: '/' }
                : null;
  const hogarDelRol = rol ? HOGAR_POR_ROL[rol] : undefined;

  const iniciales = usuario?.nombreCorto
    ? usuario.nombreCorto
        .split(' ')
        .map((p) => p[0])
        .join('')
        .replace('.', '')
        .slice(0, 2)
        .toUpperCase()
    : 'BE';

  // La página principal trae su propia cabecera (diseño «Sitio Público v5»)
  // Las pantallas de acceso traen su propio diseño de pantalla completa
  if (['/', '/ingresar', '/registro', '/plataforma'].includes(location.pathname)) return null;

  return (
    <>
    <header className={`${styles.chrome} no-print`}>
      <button
        className={styles.brandZone}
        style={nav ? { marginRight: 0 } : undefined}
        onClick={() => navigate(nav?.home ?? '/')}
        aria-label="Ir al inicio"
      >
        <LogoLockup />
        <span className={styles.tagline}>{nav?.tagline ?? 'Boletería y flota'}</span>
      </button>

      {nav && (
        <div className={styles.moduleNav}>
          <NavPrincipal menu={nav.menu} pathname={location.pathname} />
        </div>
      )}

      {DEMO_MODE && (
        <PillTabs
          items={MODULOS.map((m) => ({ id: m.id, label: m.label }))}
          value={moduloActual(location.pathname)}
          onChange={(id) => navigate(MODULOS.find((m) => m.id === id)!.ruta)}
        />
      )}

      {!esPaginaAcceso && (
      <span className={styles.right}>
        <span style={{ position: 'relative' }}>
          {usuario ? (
            <button className={styles.avatar} onClick={() => setMenuAbierto((m) => !m)}>
              {iniciales}
            </button>
          ) : (
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', padding: '9px 10px' }}
                onClick={() => navigate('/ingresar')}
              >
                Ingresar
              </button>
              <button
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  background: 'var(--blue-600)',
                  padding: '9px 16px',
                  borderRadius: 'var(--r-10)',
                }}
                onClick={() => navigate('/registro')}
              >
                Crear cuenta
              </button>
            </span>
          )}
          {menuAbierto && usuario && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 44,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-14)',
                boxShadow: 'var(--shadow-panel)',
                padding: 8,
                minWidth: 190,
                display: 'flex',
                flexDirection: 'column',
                zIndex: 40,
              }}
              onClick={() => setMenuAbierto(false)}
            >
              {usuario ? (
                <>
                  <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-faint)' }}>
                    {usuario.nombreCorto ?? usuario.username} · {usuario.role?.name ?? ''}
                  </div>
                  {hogarDelRol && !nav && (
                    <button className={styles.menuItem} onClick={() => navigate(hogarDelRol)}>
                      {rol === 'cliente' ? 'Mi cuenta' : 'Ir a mi panel'}
                    </button>
                  )}
                  <button className={styles.menuItem} onClick={() => navigate('/perfil')}>Mi perfil</button>
                  {rol === 'cliente' && (
                    <button className={styles.menuItem} onClick={() => navigate('/busetas')}>¿Por dónde viene mi buseta?</button>
                  )}
                  <div className={styles.menuDivisor} />
                  <button
                    className={styles.menuItem}
                    onClick={() => {
                      cerrarSesion();
                      navigate('/');
                    }}
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <button className={styles.menuItem} onClick={() => navigate('/ingresar')}>
                    Ingresar
                  </button>
                  <button className={styles.menuItem} onClick={() => navigate('/registro')}>
                    Crear cuenta
                  </button>
                </>
              )}
            </div>
          )}
        </span>
      </span>
      )}
    </header>
    {nav && !esPaginaAcceso && <BarraInferior menu={nav.menu} pathname={location.pathname} />}
    {avisoContrato && !esPaginaAcceso && (
      <div
        className="no-print"
        role="status"
        style={{
          background: vencido ? 'var(--bad-bg, #FEF2F2)' : 'var(--warn-bg, #FFFBEB)',
          color: vencido ? 'var(--bad-text, #991B1B)' : 'var(--warn-text, #92400E)',
          fontSize: 13,
          fontWeight: 600,
          padding: '8px 16px',
          textAlign: 'center',
        }}
      >
        {avisoContrato}
      </div>
    )}
    </>
  );
}
