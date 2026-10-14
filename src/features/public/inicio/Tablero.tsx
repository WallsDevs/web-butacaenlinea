import { useEffect, useState } from 'react';
import { Isotipo } from '../../../components/brand/LogoMark';

/** Una letra de tablero de terminal: casilla oscura con la línea de la bisagra al medio. */
export function Letras({ texto, ancho = 20, alto = 30, tamano = 17, hueco = 3 }: { texto: string; ancho?: number; alto?: number; tamano?: number; hueco?: number }) {
  return (
    <span style={{ display: 'flex', gap: hueco, flex: 'none' }} aria-label={texto.trim()} role="img">
      {[...texto].map((c, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{ position: 'relative', width: ancho, height: alto, borderRadius: 4, background: '#0A1A3F', color: '#F4F7FC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: tamano, fontWeight: 700, overflow: 'hidden' }}
        >
          {c === ' ' ? ' ' : c}
          <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(0,0,0,.6)' }} />
        </span>
      ))}
    </span>
  );
}

/** Rellena o recorta a `n` caracteres, como una casilla fija de tablero. */
export const casillas = (t: string, n: number) => t.toUpperCase().padEnd(n, ' ').slice(0, n);

const MUESTRA = [
  { hora: '19:00', destino: 'Mérida', linea: 'ET', estado: 'A TIEMPO', color: '#9FC0FF' },
  { hora: '20:30', destino: 'Caracas', linea: 'ET', estado: 'ABORDANDO', color: '#60A5FA' },
  { hora: '21:00', destino: 'Valencia', linea: 'EA', estado: 'A TIEMPO', color: '#9FC0FF' },
  { hora: '21:40', destino: 'Maracaibo', linea: 'RL', estado: 'ÚLTIMOS', color: '#FBBF24' },
  { hora: '22:15', destino: 'Barinas', linea: 'TL', estado: 'A TIEMPO', color: '#9FC0FF' },
  { hora: '23:30', destino: 'Caracas', linea: 'EA', estado: 'A TIEMPO', color: '#9FC0FF' },
];

/**
 * Panel ilustrativo de «Quiénes somos» (diseño v5): un tablero de salidas de
 * terminal. Las filas son de muestra; solo el reloj es real.
 */
export function TableroMuestra() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const reloj = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
  return (
    <div style={{ position: 'relative', flex: '1 1 420px', minWidth: 0, borderRadius: 24, background: '#081F52', padding: '26px 26px 22px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: 'inset 0 0 0 1px rgba(159,192,255,.18)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Isotipo size={22} trazo={5} contorno="#FFFFFF" acento="#60A5FA" />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: '#FFFFFF' }}>SALIDAS</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: '#9FC0FF' }}>Terminal La Concordia · {reloj}</span>
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#7C8AA5', paddingTop: 4 }}>
        <span style={{ width: 107 }}>HORA</span>
        <span style={{ width: 195 }}>DESTINO</span>
        <span>LÍNEA</span>
        <span style={{ marginLeft: 'auto' }}>ESTADO</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 440 }}>
          {MUESTRA.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 0', borderTop: i ? '1px solid rgba(159,192,255,.12)' : undefined }}>
              <Letras texto={f.hora} ancho={19} alto={28} />
              <Letras texto={casillas(f.destino, 9)} ancho={19} alto={28} />
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(159,192,255,.14)', color: '#C7D9FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none' }}>{f.linea}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: f.color, whiteSpace: 'nowrap' }}>{f.estado}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }} aria-hidden="true">
        <span style={{ width: 12, height: 12, borderRadius: '50%', border: '3px solid #60A5FA', boxSizing: 'border-box', flex: 'none' }} />
        <span style={{ flex: 1, height: 3, background: 'repeating-linear-gradient(90deg,#60A5FA 0 10px,transparent 10px 18px)' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#60A5FA', flex: 'none' }} />
      </div>
    </div>
  );
}
