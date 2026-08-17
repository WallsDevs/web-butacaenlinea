import { TasasLinea } from '../empresa/TasasLinea';
import styles from '../flota/flota.module.css';

/** El cajero también puede ajustar la tasa del día de su empresa. */
export default function TasasPos() {
  return (
    <div className={styles.contenido} style={{ maxWidth: 760 }}>
      <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>
        Tasas del día
      </h2>
      <TasasLinea />
    </div>
  );
}
