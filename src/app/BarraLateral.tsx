import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Isotipo, LogoLockup } from '../components/brand/LogoMark';
import { IconoNav } from './iconos';
import { useAuth } from '../stores/auth';
import { getBoletosPorVerificar, getRecargasPendientes } from '../lib/api/endpoints';
import { activoLateral, type SeccionLateral } from './navegacion';
import styles from './BarraLateral.module.css';

const CLAVE_PLEGADA = 'bel-lateral-plegada';

/** Lo que cada rol es en su línea (o en la plataforma). */
const NOMBRE_ROL: Record<string, string> = {
  superadmin: 'Superadmin',
  empresa: 'Administrador',
  cajero: 'Taquilla',
  chofer: 'Conductor',
  colector: 'Colector',
};

/** Pendientes que merecen un número al lado del ítem: pagos por verificar, recargas por verificar. */
function useInsignias(rol: string | undefined, conBoleteria: boolean): Record<string, number> {
  const { data: pagos } = useQuery({ queryKey: ['boletos-por-verificar'], queryFn: getBoletosPorVerificar, refetchInterval: 60_000, enabled: rol === 'empresa' && conBoleteria });
  const { data: recargas } = useQuery({ queryKey: ['admin-recargas'], queryFn: getRecargasPendientes, refetchInterval: 60_000, enabled: rol === 'superadmin' });
  const insignias: Record<string, number> = {};
  if (pagos?.length) insignias['/empresa/pagos'] = pagos.length;
  if (recargas?.length) insignias['/admin/wallet'] = recargas.length;
  return insignias;
}

const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .replace('.', '')
    .slice(0, 2)
    .toUpperCase() || 'BE';

/**
 * El menú del rol en escritorio: una barra lateral con secciones y los ítems
 * planos, sin desplegables que tapen la página. Se pliega a un carril de
 * iconos (y se abre sola al pasar el ratón) para dejarle sitio a mapas y
 * tablas. En celular no existe: ahí manda la barra inferior.
 */
export function BarraLateral({ secciones, titulo, home, pathname, conBoleteria }: { secciones: SeccionLateral[]; titulo: string; home: string; pathname: string; conBoleteria: boolean }) {
  const navigate = useNavigate();
  const usuario = useAuth((s) => s.usuario);
  const rol = usuario?.role?.type;
  const insignias = useInsignias(rol, conBoleteria);
  const [plegada, setPlegada] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_PLEGADA) === '1';
    } catch {
      return false;
    }
  });
  const [encima, setEncima] = useState(false);
  // Un ítem con hijos abierto a mano, además del que esté activo
  const [abiertos, setAbiertos] = useState<string[]>([]);
  const activo = activoLateral(secciones, pathname);

  useEffect(() => {
    document.body.classList.toggle('barra-lateral-plegada', plegada);
    try {
      localStorage.setItem(CLAVE_PLEGADA, plegada ? '1' : '0');
    } catch {
      /* sin almacenamiento, sin memoria del pliegue */
    }
    return () => document.body.classList.remove('barra-lateral-plegada');
  }, [plegada]);

  const flotante = plegada && encima;
  const ir = (ruta: string) => {
    navigate(ruta);
    setEncima(false);
  };

  return (
    <aside
      className={`${styles.lateral} ${plegada ? styles.plegada : ''} ${flotante ? styles.flotante : ''} no-print`}
      onMouseEnter={() => setEncima(true)}
      onMouseLeave={() => setEncima(false)}
      aria-label="Menú principal"
    >
      <div className={styles.cabecera}>
        <button className={styles.marca} onClick={() => ir(home)} aria-label="Ir al inicio">
          {!plegada || flotante ? <LogoLockup fondo="navy" /> : <Isotipo size={30} trazo={5} fondo="navy" contorno="#FFFFFF" />}
        </button>
        {(!plegada || flotante) && (
          <button
            type="button"
            className={styles.plegar}
            onClick={() => setPlegada((p) => !p)}
            aria-label={plegada ? 'Dejar el menú abierto' : 'Plegar el menú'}
            title={plegada ? 'Dejar abierto' : 'Plegar'}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {plegada ? <path d="M9 6l6 6-6 6M4 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6M20 6l-6 6 6 6" />}
            </svg>
          </button>
        )}
      </div>

      <div className={styles.tarjeta} title={titulo}>
        <span className={styles.iniciales}>{iniciales(titulo)}</span>
        {(!plegada || flotante) && (
          <span style={{ minWidth: 0 }}>
            <span className={styles.tarjetaNombre} style={{ display: 'block' }}>{titulo}</span>
            <span className={styles.tarjetaRol} style={{ display: 'block' }}>{NOMBRE_ROL[rol ?? ''] ?? ''}</span>
          </span>
        )}
      </div>

      <nav className={styles.cuerpo}>
        {secciones.map((s) => (
          <div key={s.id}>
            <div className={styles.seccionTitulo}>{s.label}</div>
            {s.items.map((i) => {
              const esActivo = activo.item === i.id;
              const abierto = Boolean(i.hijos?.length) && (esActivo || abiertos.includes(i.id));
              const n = insignias[i.ruta];
              return (
                <div key={i.id}>
                  <button
                    type="button"
                    className={`${styles.item} ${esActivo ? styles.itemActivo : ''}`}
                    aria-current={esActivo ? 'page' : undefined}
                    title={plegada && !flotante ? i.label : undefined}
                    onClick={() => {
                      if (i.hijos?.length) setAbiertos((xs) => (xs.includes(i.id) ? xs.filter((x) => x !== i.id) : [...xs, i.id]));
                      if (!esActivo || !i.hijos?.length) ir(i.ruta);
                    }}
                  >
                    <span className={styles.itemIcono}>
                      <IconoNav id={i.icono ?? i.id} label={i.label} size={20} />
                    </span>
                    <span className={styles.itemTexto}>{i.label}</span>
                    {n ? <span className={styles.insignia}>{n}</span> : null}
                    {i.hijos?.length ? (
                      <svg className={`${styles.flecha} ${abierto ? styles.flechaAbierta : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    ) : null}
                  </button>
                  {abierto && (
                    <div className={styles.hijos}>
                      {i.hijos!.map((h) => (
                        <button key={h.id} type="button" className={`${styles.hijo} ${activo.hijo === h.id ? styles.hijoActivo : ''}`} aria-current={activo.hijo === h.id ? 'page' : undefined} onClick={() => ir(h.ruta)}>
                          {h.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={styles.pie}>
        {/* Mi perfil: ahí están los datos y el único «Cerrar sesión» */}
        <button
          type="button"
          className={`${styles.yo} ${pathname === '/perfil' ? styles.yoActivo : ''}`}
          onClick={() => ir('/perfil')}
          aria-current={pathname === '/perfil' ? 'page' : undefined}
          title={plegada && !flotante ? 'Mi perfil' : undefined}
        >
          <span className={styles.avatar}>{iniciales(usuario?.nombreCorto ?? usuario?.username ?? 'BE')}</span>
          <span className={`${styles.yoTexto} ${styles.itemTexto}`}>
            <span style={{ display: 'block' }}>{usuario?.nombreCorto ?? usuario?.username}</span>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--lat-suave)' }}>Mi perfil</span>
          </span>
          {(!plegada || flotante) && (
            <svg className={styles.flecha} style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </button>
      </div>
    </aside>
  );
}
