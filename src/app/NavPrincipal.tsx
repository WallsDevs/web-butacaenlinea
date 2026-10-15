import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { esGrupo, planoDe, seccionDe, type EntradaNav, type GrupoNav } from './navegacion';
import styles from './AppChrome.module.css';

/**
 * El menú único de un rol: secciones sueltas y grupos con submenú. El submenú
 * es `position: fixed` porque la barra hace scroll horizontal en pantallas
 * chicas y un menú absoluto quedaría recortado.
 */
export function NavPrincipal({ menu, pathname }: { menu: EntradaNav[]; pathname: string }) {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState<{ id: string; x: number; y: number } | null>(null);
  const raiz = useRef<HTMLElement>(null);
  const activa = seccionDe(planoDe(menu), pathname);

  // Cierra al navegar, con Escape, al hacer clic fuera o al mover la pantalla
  useEffect(() => setAbierto(null), [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setAbierto(null);
    const fuera = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-nav-menu]')) cerrar();
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', cerrar);
    window.addEventListener('scroll', cerrar, true);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('scroll', cerrar, true);
    };
  }, [abierto]);

  const abrir = (g: GrupoNav, el: HTMLElement) => {
    if (abierto?.id === g.id) return setAbierto(null);
    const r = el.getBoundingClientRect();
    setAbierto({ id: g.id, x: Math.max(8, Math.min(r.left, window.innerWidth - 226)), y: r.bottom + 6 });
  };

  const grupoAbierto = menu.find((e): e is GrupoNav => esGrupo(e) && e.id === abierto?.id);

  return (
    <nav ref={raiz} className={styles.menuBar} aria-label="Menú principal" data-nav-menu>
      {menu.map((e) => {
        if (!esGrupo(e)) {
          return (
            <button key={e.id} className={`${styles.menuBtn} ${activa === e.id ? styles.menuBtnActive : ''}`} aria-current={activa === e.id ? 'page' : undefined} onClick={() => navigate(e.ruta)}>
              {e.label}
            </button>
          );
        }
        const contiene = e.items.some((i) => i.id === activa);
        const estaAbierto = abierto?.id === e.id;
        return (
          <button
            key={e.id}
            className={`${styles.menuBtn} ${contiene || estaAbierto ? styles.menuBtnActive : ''}`}
            aria-haspopup="menu"
            aria-expanded={estaAbierto}
            onClick={(ev) => abrir(e, ev.currentTarget)}
          >
            {e.label}
            <svg className={`${styles.chevron} ${estaAbierto ? styles.chevronAbierto : ''}`} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2 3.5 5 6.5 8 3.5" />
            </svg>
          </button>
        );
      })}
      {abierto && grupoAbierto && (
        <div className={styles.submenu} role="menu" style={{ left: abierto.x, top: abierto.y }} data-nav-menu>
          {grupoAbierto.items.map((i) => (
            <button key={i.id} role="menuitem" className={`${styles.submenuItem} ${activa === i.id ? styles.submenuItemActivo : ''}`} onClick={() => navigate(i.ruta)}>
              {i.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
