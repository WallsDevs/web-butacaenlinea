import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';
import { GUIAS } from './guias';
import { useGuia } from './useGuia';
import styles from './guia.module.css';

type Rect = { top: number; left: number; width: number; height: number };
const MARGEN = 8;

/** El primer elemento visible con ese `data-guia` (el menú del teléfono y el de escritorio tienen el mismo). */
function buscar(objetivo: string): HTMLElement | null {
  const todos = [...document.querySelectorAll<HTMLElement>(`[data-guia="${objetivo}"]`)];
  return todos.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }) ?? null;
}

/**
 * La guía en curso, encima de la web real: oscurece la pantalla, deja a la
 * vista la parte de la que habla el paso y explica qué hacer. Navega sola a
 * la pantalla del paso. Si la parte no está (p. ej. no hay salidas), el paso
 * se explica igual, sin resaltar nada.
 */
export function GuiaActiva() {
  const { guia, paso, siguiente, anterior, salir } = useGuia();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const actual = guia ? GUIAS[guia] : null;
  const p = actual?.pasos[paso];
  const [rect, setRect] = useState<Rect | null>(null);

  // A la pantalla del paso
  useEffect(() => {
    if (p && pathname !== p.ruta) navigate(p.ruta);
  }, [p, pathname, navigate]);

  // Encontrar lo que se resalta (puede tardar en aparecer) y seguirlo al desplazar
  useLayoutEffect(() => {
    setRect(null);
    if (!p?.objetivo || pathname !== p.ruta) return;
    let el: HTMLElement | null = null;
    let intentos = 0;
    let marco = 0;
    const medir = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - MARGEN, left: r.left - MARGEN, width: r.width + MARGEN * 2, height: r.height + MARGEN * 2 });
    };
    const alMover = () => {
      cancelAnimationFrame(marco);
      marco = requestAnimationFrame(medir);
    };
    const espera = setInterval(() => {
      el = buscar(p.objetivo!);
      if (el || ++intentos > 25) {
        clearInterval(espera);
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(medir, 350);
        medir();
      }
    }, 150);
    window.addEventListener('scroll', alMover, true);
    window.addEventListener('resize', alMover);
    return () => {
      clearInterval(espera);
      cancelAnimationFrame(marco);
      window.removeEventListener('scroll', alMover, true);
      window.removeEventListener('resize', alMover);
    };
  }, [p, pathname]);

  useEffect(() => {
    if (!actual) return;
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') salir();
      if (e.key === 'ArrowRight') siguiente();
      if (e.key === 'ArrowLeft') anterior();
    };
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  }, [actual, salir, siguiente, anterior]);

  if (!actual || !p) return null;
  const ultimo = paso === actual.pasos.length - 1;
  // La tarjeta va del lado contrario a lo resaltado, para no taparlo
  const abajo = !rect || rect.top + rect.height / 2 < window.innerHeight / 2;

  return createPortal(
    <div className={styles.capa} role="dialog" aria-modal="true" aria-label={`Guía: ${actual.titulo}`}>
      {rect ? (
        <div className={styles.hueco} style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} aria-hidden />
      ) : (
        <div className={styles.velo} aria-hidden />
      )}
      <div className={`${styles.tarjeta} ${abajo ? styles.tarjetaAbajo : styles.tarjetaArriba}`} aria-live="polite">
        <div className={styles.cabeza}>
          <span className={styles.guia}>{actual.titulo}</span>
          <span className={styles.cuenta}>Paso {paso + 1} de {actual.pasos.length}</span>
        </div>
        <b className={styles.titulo}>{p.titulo}</b>
        <p className={styles.texto}>{p.texto}</p>
        <div className={styles.puntos} aria-hidden>
          {actual.pasos.map((_, i) => <i key={i} className={i === paso ? styles.puntoActivo : i < paso ? styles.puntoHecho : ''} />)}
        </div>
        <div className={styles.botones}>
          <button type="button" className={styles.salir} onClick={salir}>Salir</button>
          {paso > 0 && <button type="button" className={styles.atras} onClick={anterior}>Atrás</button>}
          <button type="button" className={styles.siguiente} onClick={siguiente} autoFocus>{ultimo ? 'Terminar' : 'Siguiente'}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
