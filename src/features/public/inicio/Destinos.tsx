import { useMemo } from 'react';
import { Money } from '../../../components/ui/Money';
import type { SalidaDto } from '../../../lib/api/types';
import styles from './inicio.module.css';

/** Los destinos con más salidas próximas, con el precio más bajo de cada uno (datos reales). */
export function Destinos({ salidas, onElegir }: { salidas: SalidaDto[]; onElegir: (destino: string) => void }) {
  const top = useMemo(() => {
    const por = new Map<string, { salidas: number; desde: number; empresas: Set<string> }>();
    for (const s of salidas) {
      const destino = s.ruta?.destino;
      if (!destino) continue;
      const minimo = Math.min(...Object.values(s.preciosUsd ?? { x: 0 }));
      const g = por.get(destino) ?? { salidas: 0, desde: Infinity, empresas: new Set<string>() };
      g.salidas++;
      g.desde = Math.min(g.desde, minimo);
      if (s.linea?.nombre) g.empresas.add(s.linea.nombre);
      por.set(destino, g);
    }
    return [...por.entries()].sort((a, b) => b[1].salidas - a[1].salidas).slice(0, 4);
  }, [salidas]);

  if (!top.length) return null;
  return (
    <section id="destinos" className={styles.seccion}>
      <div className={styles.seccionCab}>
        <h2 className={styles.h2}>Destinos más buscados</h2>
        <span className={styles.nota}>Según las salidas que vienen</span>
      </div>
      <div className={styles.destinos}>
        {top.map(([nombre, g]) => (
          <button key={nombre} className={styles.destino} onClick={() => onElegir(nombre)}>
            <div className={styles.destinoFoto}><span>foto · {nombre}</span></div>
            <div className={styles.destinoCuerpo}>
              <span className={styles.destinoNombre}>{nombre}</span>
              <span className={styles.destinoInfo}>
                {g.salidas} salida{g.salidas === 1 ? '' : 's'} próxima{g.salidas === 1 ? '' : 's'} · {g.empresas.size} línea{g.empresas.size === 1 ? '' : 's'}
              </span>
              <span className={styles.destinoDesde}>desde <Money usd={g.desde} /></span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
