import type { ReactNode } from 'react';

/** Titular de sección del diseño v5. */
export function H2({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <h2 style={{ margin: 0, fontSize: 'clamp(30px,3.6vw,44px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color }}>
      {children}
    </h2>
  );
}
