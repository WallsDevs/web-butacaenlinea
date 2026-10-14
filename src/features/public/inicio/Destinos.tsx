import { useMemo } from 'react';
import { Money } from '../../../components/ui/Money';
import type { SalidaDto } from '../../../lib/api/types';
import { H2 } from './piezas';

/** Los destinos con más salidas próximas, con el precio más bajo de cada uno (datos reales). */
export function Destinos({ salidas, onElegir }: { salidas: SalidaDto[]; onElegir: (destino: string) => void }) {
  const top = useMemo(() => {
    const por = new Map<string, { salidas: number; desde: number; lineas: Set<string> }>();
    for (const s of salidas) {
      const destino = s.ruta?.destino;
      if (!destino) continue;
      const minimo = Math.min(...Object.values(s.preciosUsd ?? { x: 0 }));
      const g = por.get(destino) ?? { salidas: 0, desde: Infinity, lineas: new Set<string>() };
      g.salidas++;
      g.desde = Math.min(g.desde, minimo);
      if (s.linea?.nombre) g.lineas.add(s.linea.nombre);
      por.set(destino, g);
    }
    return [...por.entries()].sort((a, b) => b[1].salidas - a[1].salidas).slice(0, 4);
  }, [salidas]);

  if (!top.length) return null;
  return (
    <section id="destinos" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <H2>Destinos más buscados</H2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
        {top.map(([nombre, g]) => (
          <button
            key={nombre}
            onClick={() => onElegir(nombre)}
            style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: '#FFFFFF', border: '1.5px solid #E6EBF4', borderRadius: 20, overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column', color: '#0F172A' }}
          >
            <div style={{ height: 120, background: 'repeating-linear-gradient(135deg,#EAF0FA 0 10px,#F2F6FC 10px 20px)', display: 'flex', alignItems: 'flex-end', padding: 12, boxSizing: 'border-box' }}>
              <span style={{ fontSize: 11, color: '#7C8AA5', fontFamily: 'ui-monospace,monospace' }}>foto · {nombre}</span>
            </div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{nombre}</span>
              <span style={{ fontSize: 13, color: '#7C8AA5' }}>
                {g.salidas} salida{g.salidas === 1 ? '' : 's'} próxima{g.salidas === 1 ? '' : 's'} · {g.lineas.size} línea{g.lineas.size === 1 ? '' : 's'}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#2563EB', marginTop: 4 }}>desde <Money usd={g.desde} /></span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
