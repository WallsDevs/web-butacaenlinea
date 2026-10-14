import type { ReactNode } from 'react';

/** Titular de sección del diseño v5. */
export function H2({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <h2 style={{ margin: 0, fontSize: 'clamp(30px,3.6vw,44px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color }}>
      {children}
    </h2>
  );
}

/** Rótulo de lo que todavía es demostración (programa de kilómetros y descuentos). */
export function Demo({ oscuro }: { oscuro?: boolean }) {
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 6,
        background: oscuro ? 'rgba(159,192,255,.14)' : '#EFF4FF', color: oscuro ? '#9FC0FF' : '#1D4ED8',
        border: `1px solid ${oscuro ? 'rgba(159,192,255,.35)' : '#BBD0FA'}`,
      }}
    >
      Demostración
    </span>
  );
}
