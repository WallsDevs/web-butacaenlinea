import { useState } from 'react';
import { H2, Demo } from './piezas';

/**
 * DEMOSTRACIÓN. Los descuentos todavía no existen en el servidor: estas
 * tarjetas muestran cómo se verán y no alteran ningún precio. Cuando haya
 * promociones reales, esta lista sale de la API.
 */
const PROMOS = [
  { code: 'MARTES20', big: '−20%', titulo: 'Martes de ruta', desc: 'Todas las salidas de los martes, en cualquier línea afiliada.', bg: '#2563EB', color: '#FFFFFF', blob: 'rgba(255,255,255,.12)', dash: 'rgba(255,255,255,.6)' },
  { code: 'ANDES', big: '−15%', titulo: 'Rumbo a los Andes', desc: 'Mérida, Táriba y La Grita durante la temporada.', bg: '#FFFFFF', color: '#0F172A', blob: '#EFF4FF', dash: '#9FC0FF' },
  { code: 'ESTUDIA', big: '−10%', titulo: 'Estudiantes', desc: 'Con carnet vigente. Acumula kilómetros igual.', bg: '#0B2A6B', color: '#FFFFFF', blob: 'rgba(96,165,250,.16)', dash: 'rgba(159,192,255,.7)' },
];

export function Promociones() {
  const [aplicada, setAplicada] = useState<string | null>(null);
  return (
    <section id="promos" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <H2>Promociones de la semana</H2>
          <Demo />
        </div>
        <span style={{ fontSize: 14, color: '#475569' }}>Toca una para aplicarla a tu boleto</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
        {PROMOS.map((p) => {
          const on = p.code === aplicada;
          return (
            <button
              key={p.code}
              onClick={() => setAplicada(on ? null : p.code)}
              style={{
                position: 'relative', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', borderRadius: 22, padding: 24, minHeight: 220,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20, overflow: 'hidden',
                background: p.bg, color: p.color, border: `2px solid ${on ? '#22A35A' : p.bg === '#FFFFFF' ? '#E6EBF4' : p.bg}`,
              }}
            >
              <span style={{ position: 'absolute', right: -50, bottom: -60, width: 180, height: 180, borderRadius: '50%', background: p.blob }} />
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 52, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 0.9 }}>{p.big}</span>
                <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>{p.titulo}</span>
                <span style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.85, textWrap: 'pretty' }}>{p.desc}</span>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', padding: '6px 10px', borderRadius: 8, border: `1.5px dashed ${p.dash}` }}>{p.code}</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{on ? 'Aplicada ✓' : 'Aplicar →'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
