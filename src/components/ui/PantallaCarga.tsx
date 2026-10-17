import { Isotipo } from '../brand/LogoMark';
import styles from './PantallaCarga.module.css';

/**
 * Lo que se ve mientras llega una pantalla (código diferido o sesión en
 * verificación): la marca respirando y una barra que avanza sola. Nada de
 * un «Cargando…» suelto en una esquina.
 */
export function PantallaCarga({ mensaje = 'Un momento…' }: { mensaje?: string }) {
  return (
    <div className={styles.pantalla} role="status" aria-live="polite" aria-label={mensaje}>
      <div className={styles.marca}>
        <span className={styles.iso}>
          <Isotipo size={44} />
        </span>
        <span className={styles.nombre}>
          Butaca
          <span className={styles.sub}>EN LÍNEA</span>
        </span>
      </div>
      <div className={styles.barra} aria-hidden>
        <span className={styles.progreso} />
      </div>
      <div className={styles.texto}>{mensaje}</div>
    </div>
  );
}

/** Versión chica para dentro de una tarjeta o una lista. */
export function Cargando({ mensaje = 'Cargando…' }: { mensaje?: string }) {
  return (
    <div className={styles.enLinea} role="status" aria-live="polite">
      <span className={styles.puntos} aria-hidden>
        <span />
        <span />
        <span />
      </span>
      {mensaje}
    </div>
  );
}
