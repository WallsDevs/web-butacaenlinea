import styles from './comprobante.module.css';

/** Los cuatro datos que recuperan el boleto, en el orden en que salen en el comprobante. */
export const DATOS_COMPROBANTE = [
  { n: 1, clave: 'referencia', label: 'Referencia', ejemplo: '0004 8812 3371' },
  { n: 2, clave: 'banco', label: 'Banco emisor', ejemplo: 'Banesco' },
  { n: 3, clave: 'telefono', label: 'Teléfono emisor', ejemplo: '0414-555.12.34' },
  { n: 4, clave: 'documento', label: 'Cédula del titular', ejemplo: 'V-12.345.678' },
] as const;
export type DatoComprobante = (typeof DATOS_COMPROBANTE)[number]['clave'];

/**
 * Un comprobante de Pago Móvil de muestra, como lo enseña el banco en el
 * teléfono. Los cuatro datos que recuperan el boleto van marcados ①–④ (los
 * mismos números que los campos del formulario); monto y fecha, apagados,
 * porque no se piden. `activo` ilumina el dato del campo donde está el cursor.
 */
export function ComprobanteMuestra({ activo, compacto = false }: { activo?: DatoComprobante | null; compacto?: boolean }) {
  return (
    <figure className={`${styles.comprobante} ${compacto ? styles.compacto : ''}`} aria-label="Ejemplo de comprobante de Pago Móvil con los cuatro datos que se piden marcados">
      <div className={styles.papel}>
      <div className={styles.cabecera}>
        <span className={styles.check} aria-hidden>✓</span>
        <div>
          <div className={styles.titulo}>Pago Móvil exitoso</div>
          <div className={styles.sub}>Comprobante de tu banco</div>
        </div>
      </div>
      <dl className={styles.filas}>
        {DATOS_COMPROBANTE.map((d) => (
          <div key={d.clave} className={`${styles.fila} ${styles.clave} ${activo === d.clave ? styles.activa : ''}`}>
            <span className={styles.marca} aria-hidden>{d.n}</span>
            <dt>{d.label}</dt>
            <dd>{d.ejemplo}</dd>
          </div>
        ))}
        <div className={`${styles.fila} ${styles.apagada}`}>
          <dt>Monto</dt>
          <dd>Bs 1.421,20</dd>
        </div>
        <div className={`${styles.fila} ${styles.apagada}`}>
          <dt>Fecha</dt>
          <dd>21/08 · 3:42 p. m.</dd>
        </div>
      </dl>
      <figcaption className={styles.pie}>Los datos <strong>1 a 4</strong> recuperan tu boleto</figcaption>
      </div>
    </figure>
  );
}
