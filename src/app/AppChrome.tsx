import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { LogoLockup } from '../components/brand/LogoMark';
import { PillTabs } from '../components/ui/PillTabs';
import { useSettings } from '../stores/settings';
import { useAuth } from '../stores/auth';
import { useTasasSync } from '../lib/useTasas';
import { formatearTasaBcv, type Moneda } from '../lib/money';
import {
  SECCIONES_ADMIN,
  SECCIONES_CHOFER,
  SECCIONES_CUENTA,
  SECCIONES_EMPRESA,
  SECCIONES_POS,
  seccionDe,
} from './navegacion';
import styles from './AppChrome.module.css';

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

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
  const moneda = useSettings((s) => s.moneda);
  const setMoneda = useSettings((s) => s.setMoneda);
  const tasas = useSettings((s) => s.tasas);
  const tasasFrescas = useSettings((s) => s.tasasFrescas);
  const tasaPropia = useSettings((s) => s.tasaPropia);
  const usuario = useAuth((s) => s.usuario);
  const cerrarSesion = useAuth((s) => s.cerrarSesion);
  const [menuAbierto, setMenuAbierto] = useState(false);
  // En las páginas de acceso el chrome es mínimo: solo la marca
  const esPaginaAcceso = ['/ingresar', '/registro', '/plataforma'].includes(location.pathname);
  // Un solo patrón para todos los roles: las secciones del módulo viven en esta barra
  const rol = usuario?.role?.type;
  const path = location.pathname;
  const nav =
    rol === 'superadmin' && path.startsWith('/admin')
      ? { secciones: SECCIONES_ADMIN, tagline: 'Plataforma', home: '/admin' }
      : rol === 'empresa' && (path.startsWith('/empresa') || path.startsWith('/flota'))
        ? { secciones: SECCIONES_EMPRESA, tagline: usuario?.linea?.nombre ?? 'Mi empresa', home: '/empresa' }
        : (rol === 'cajero' || rol === 'empresa') && path.startsWith('/pos')
          ? { secciones: SECCIONES_POS, tagline: usuario?.linea?.nombre ?? 'Punto de venta', home: '/pos' }
          : rol === 'chofer' && path.startsWith('/chofer')
            ? { secciones: SECCIONES_CHOFER, tagline: usuario?.linea?.nombre ?? 'Conductor', home: '/chofer' }
            : rol === 'cliente' && path.startsWith('/cuenta')
              ? { secciones: SECCIONES_CUENTA, tagline: 'Mi cuenta', home: '/' }
              : null;

  const iniciales = usuario?.nombreCorto
    ? usuario.nombreCorto
        .split(' ')
        .map((p) => p[0])
        .join('')
        .replace('.', '')
        .slice(0, 2)
        .toUpperCase()
    : 'BE';

  return (
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
        <nav className={styles.moduleNav}>
          <PillTabs
            variant="loose"
            items={nav.secciones.map((x) => ({ id: x.id, label: x.label }))}
            value={seccionDe(nav.secciones, location.pathname)}
            onChange={(id) => navigate(nav.secciones.find((x) => x.id === id)!.ruta)}
          />
        </nav>
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
        {tasas.bcv > 0 && tasasFrescas && (
          <span className={styles.bcv}>
            {tasaPropia ? 'Tasa' : 'BCV'} {formatearTasaBcv(tasas.bcv)}
          </span>
        )}
        <span className={styles.currencyGroup}>
          {(['Bs', 'USD', 'COP'] as Moneda[]).map((m) => (
            <button
              key={m}
              className={`${styles.currencyBtn} ${moneda === m ? styles.currencyActive : ''}`}
              onClick={() => setMoneda(m)}
            >
              {m}
            </button>
          ))}
        </span>
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
                  {usuario.role?.type === 'cliente' && (
                    <>
                      <button className={styles.menuItem} onClick={() => navigate('/cuenta')}>
                        Mis boletos
                      </button>
                      <button className={styles.menuItem} onClick={() => navigate('/cuenta/metodos')}>
                        Métodos de pago
                      </button>
                    </>
                  )}
                  {usuario.role?.type === 'superadmin' && (
                    <button className={styles.menuItem} onClick={() => navigate('/admin')}>
                      Panel de la plataforma
                    </button>
                  )}
                  {usuario.role?.type === 'empresa' && (
                    <>
                      <button className={styles.menuItem} onClick={() => navigate('/empresa')}>
                        Panel de mi empresa
                      </button>
                      <button className={styles.menuItem} onClick={() => navigate('/pos')}>
                        Punto de venta
                      </button>
                      <button className={styles.menuItem} onClick={() => navigate('/chofer')}>
                        Escáner de abordaje
                      </button>
                    </>
                  )}
                  {usuario.role?.type === 'cajero' && (
                    <button className={styles.menuItem} onClick={() => navigate('/pos')}>
                      Punto de venta
                    </button>
                  )}
                  {usuario.role?.type === 'chofer' && (
                    <button className={styles.menuItem} onClick={() => navigate('/chofer')}>
                      Escáner de abordaje
                    </button>
                  )}
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
  );
}
