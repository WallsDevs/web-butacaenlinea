import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { esGrupo, planoDe, seccionDe, type EntradaNav, type GrupoNav } from './navegacion';
import { IconoNav } from './iconos';
import styles from './AppChrome.module.css';

/**
 * El menú del rol en celular y tablet: pestañas abajo con icono, como una
 * app. Los grupos (Flota, Ventas…) abren su submenú hacia arriba. La última
 * pestaña es siempre Perfil (datos y cerrar sesión). En escritorio no se
 * muestra: ahí manda la barra superior.
 */
/** Etiquetas que no caben bajo un icono. */
const CORTA: Record<string, string> = { Administración: 'Admin', 'Métodos de pago': 'Métodos', 'Cierre de turno': 'Cierre', 'Reportes de turno': 'Reportes', 'Cobros en vivo': 'Cobros', 'Flota en vivo': 'En vivo' };

export function BarraInferior({ menu, pathname }: { menu: EntradaNav[]; pathname: string }) {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState<string | null>(null);
  const activa = seccionDe(planoDe(menu), pathname);
  const grupo = menu.find((e): e is GrupoNav => esGrupo(e) && e.id === abierto) ?? null;

  useEffect(() => setAbierto(null), [pathname]);
  // La barra tapa el final de la página: el cuerpo deja sitio mientras exista
  useEffect(() => {
    document.body.classList.add('con-barra-inferior');
    return () => document.body.classList.remove('con-barra-inferior');
  }, []);

  const ir = (ruta: string) => {
    setAbierto(null);
    navigate(ruta);
  };

  return (
    <>
      {grupo && <div className={styles.barraVelo} onClick={() => setAbierto(null)} />}
      {grupo && (
        <div className={styles.barraHoja} role="menu" aria-label={grupo.label}>
          <div className={styles.barraHojaTitulo}>{grupo.label}</div>
          {grupo.items.map((i) => (
            <button key={i.id} role="menuitem" className={`${styles.submenuItem} ${activa === i.id ? styles.submenuItemActivo : ''}`} onClick={() => ir(i.ruta)}>
              {i.label}
            </button>
          ))}
        </div>
      )}
      <nav className={styles.barraInferior} aria-label="Menú principal">
        {menu.filter((e) => esGrupo(e) || !e.soloEscritorio).map((e) => {
          const esG = esGrupo(e);
          const on = esG ? e.items.some((i) => i.id === activa) || abierto === e.id : activa === e.id;
          return (
            <button
              key={e.id}
              data-guia={`nav-${e.id}`}
              className={`${styles.barraTab} ${on ? styles.barraTabActiva : ''}`}
              aria-current={!esG && on ? 'page' : undefined}
              aria-haspopup={esG ? 'menu' : undefined}
              aria-expanded={esG ? abierto === e.id : undefined}
              onClick={() => (esG ? setAbierto(abierto === e.id ? null : e.id) : ir(e.ruta))}
            >
              <IconoNav id={e.id} label={e.label} />
              <span className={styles.barraTabTexto}>{CORTA[e.label] ?? e.label}</span>
            </button>
          );
        })}
        <button className={`${styles.barraTab} ${pathname === '/perfil' ? styles.barraTabActiva : ''}`} onClick={() => ir('/perfil')}>
          <IconoNav id="perfil" />
          <span className={styles.barraTabTexto}>Perfil</span>
        </button>
      </nav>
    </>
  );
}
