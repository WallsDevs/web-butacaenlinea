import styles from './ui.module.css';

/** Tramo punteado del viaje (recurso de marca). Opcional: duración centrada encima. */
export function RouteDash({
  duracion,
  width,
  style,
}: {
  duracion?: string;
  width?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div className={styles.routeDash} style={{ ...(width ? { flex: 'none', width } : {}), ...style }}>
      {duracion && <div className={styles.routeDashLabel}>{duracion}</div>}
    </div>
  );
}
