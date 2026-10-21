import type { AsientoMapa, PisoMapa } from '../../lib/api/types';
import styles from './SeatMap.module.css';

export type TamanoMapa = 'web' | 'pos' | 'movil';

/**
 * Mapa de asientos generado desde la configuración de la unidad (llega del
 * servidor ya expandido en filas). La ocupación es autoritativa del servidor;
 * aquí solo se pinta y se alterna la selección local sobre asientos libres.
 * Mismo componente en Comprador Web (46–48px), POS (58–60px) y móvil (44px).
 */
export function SeatMap({
  piso,
  seleccionados,
  onToggle,
  size = 'web',
  readOnly = false,
  marcas,
  titulos,
  onVer,
}: {
  piso: PisoMapa;
  seleccionados: string[];
  onToggle?: (id: string) => void;
  size?: TamanoMapa;
  readOnly?: boolean;
  /** Vista de la línea: cada puesto vendido o comprándose ahora (los demás, libres). */
  marcas?: Record<string, 'vendido' | 'apartado'>;
  /** Vista de la línea: lo que dice cada puesto al pasar encima (el pasajero). */
  titulos?: Record<string, string>;
  /** Vista de la línea: tocar un puesto (p. ej. para ir a su boleto). */
  onVer?: (id: string) => void;
}) {
  const busClass = [
    styles.bus,
    size === 'pos' ? styles.busPos : '',
    size === 'movil' ? styles.busMovil : '',
  ].join(' ');

  const renderAsiento = (a: AsientoMapa) => {
    // Vista de la línea: vendido / comprándose / libre, con el pasajero al pasar encima
    if (marcas) {
      const m = marcas[a.id] ?? (a.estado === 'ocupado' ? 'vendido' : a.estado !== 'libre' ? 'apartado' : undefined);
      const clase = m === 'vendido' ? styles.vendido : m === 'apartado' ? styles.apartado : styles.libreQuieto;
      const sizeClass = size === 'pos' ? styles.asientoPos : size === 'movil' ? styles.asientoMovil : '';
      const titulo = titulos?.[a.id] ?? (m === 'vendido' ? 'Vendido' : m === 'apartado' ? 'Comprándose ahora' : 'Libre');
      return (
        <button key={a.id} type="button" className={`${styles.asiento} ${sizeClass} ${clase}`} title={`Puesto ${a.id} · ${titulo}`} aria-label={`Puesto ${a.id}: ${titulo}`} onClick={() => onVer?.(a.id)}>
          <span className={`${styles.brazo} ${styles.brazoIzq}`} />
          <span className={`${styles.brazo} ${styles.brazoDer}`} />
          <span className={styles.respaldo} />
          <span className={styles.asientoNum}>{a.id}</span>
        </button>
      );
    }
    const seleccionado = seleccionados.includes(a.id);
    const ocupado = a.estado !== 'libre' && !seleccionado;
    const estadoClass = seleccionado ? styles.seleccionado : ocupado ? styles.ocupado : styles.libre;
    const sizeClass = size === 'pos' ? styles.asientoPos : size === 'movil' ? styles.asientoMovil : '';
    return (
      <button
        key={a.id}
        className={`${styles.asiento} ${sizeClass} ${estadoClass}`}
        disabled={ocupado || readOnly}
        aria-label={`Puesto ${a.id}${ocupado ? ' (ocupado)' : seleccionado ? ' (seleccionado)' : ''}`}
        onClick={() => {
          if (!ocupado && !readOnly) onToggle?.(a.id);
        }}
      >
        <span className={`${styles.brazo} ${styles.brazoIzq}`} />
        <span className={`${styles.brazo} ${styles.brazoDer}`} />
        <span className={styles.respaldo} />
        <span className={styles.asientoNum}>{a.id}</span>
      </button>
    );
  };

  return (
    <div className={busClass}>
      <div className={styles.cabina}>
        <span className={styles.volante}>
          <span className={styles.volanteH} />
          <span className={styles.volanteV} />
          <span className={styles.volanteCentro} />
        </span>
        <span className={styles.conductorLabel}>Conductor</span>
        <span className={styles.pisoNombre}>
          Piso {piso.numero} · {piso.nombre}
        </span>
      </div>
      <div className={styles.filas}>
        {piso.filas.map((fila) => (
          <div key={fila.fila} className={styles.fila}>
            <span className={styles.filaLabel}>{fila.fila}</span>
            {fila.completa ? (
              // Fila trasera corrida: todos los puestos seguidos, sin pasillo
              <div className={styles.lado}>{[...fila.izquierda, ...fila.derecha].map(renderAsiento)}</div>
            ) : (
              <>
                <div className={styles.lado}>{fila.izquierda.map(renderAsiento)}</div>
                <div className={`${styles.pasillo} ${size === 'pos' ? styles.pasilloPos : ''}`}>
                  <span className={styles.pasilloBarra} />
                </div>
                <div className={styles.lado}>{fila.derecha.map(renderAsiento)}</div>
              </>
            )}
          </div>
        ))}
      </div>
      {size === 'web' && (
        <div className={styles.pieBus}>
          <span>Puerta trasera</span>
          <span>Sanitario</span>
        </div>
      )}
    </div>
  );
}

/** Leyenda Disponible / Seleccionado / Ocupado. */
export function SeatLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className={styles.leyenda} style={compact ? { fontSize: 11, gap: 10 } : undefined}>
      <span className={styles.leyendaItem}>
        <span className={`${styles.muestra} ${styles.muestraLibre}`} /> Disponible
      </span>
      <span className={styles.leyendaItem}>
        <span className={`${styles.muestra} ${styles.muestraSel}`} /> Seleccionado
      </span>
      <span className={styles.leyendaItem}>
        <span className={`${styles.muestra} ${styles.muestraOcupado}`} /> Ocupado
      </span>
    </div>
  );
}
