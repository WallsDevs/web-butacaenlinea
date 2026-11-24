import { Isotipo } from '../brand/LogoMark';
import { IconoNav } from '../../app/iconos';
import styles from './PantallaCarga.module.css';

export function PantallaCarga({ mensaje = 'Cargando Butaca En Línea…', enLista = false }: {
  mensaje?: string;
  enLista?: boolean;
}) {
  return (
    <div className={enLista ? styles.enLista : styles.pantalla} role="status">
      <div className={styles.marca} aria-hidden="true">
        <Isotipo size={48} />
        <span className={styles.nombre}>Butaca<span className={styles.sub}>EN LÍNEA</span></span>
      </div>
      <div className={styles.recorrido} aria-hidden="true">
        <span className={styles.bus}><IconoNav id="flota" size={26} /></span>
      </div>
      <p className={styles.texto}>{mensaje}</p>
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
