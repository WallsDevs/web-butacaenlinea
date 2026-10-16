import { TasasLinea } from '../empresa/TasasLinea';
import { EncabezadoPantalla } from '../../components/ui/EncabezadoPantalla';
import styles from '../flota/flota.module.css';

/** El cajero también puede ajustar la tasa del día de su empresa. */
export default function TasasPos() {
  return (
    <div className={styles.contenido} style={{ maxWidth: 1100 }}>
      <EncabezadoPantalla titulo="Tasas del día" descripcion="La tasa con la que se calculan los precios en bolívares y pesos en tu caja." />
      <div style={{ maxWidth: 560 }}>
        <TasasLinea />
      </div>
    </div>
  );
}
