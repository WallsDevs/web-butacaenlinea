/**
 * Isotipo de BRAND.md — se dibuja con `currentColor` (el contexto define el color).
 * `conParadas`: versión completa (≥40px). Simplificada por debajo (barra plena).
 */
export function LogoMark({ size = 22, conParadas = false }: { size?: number; conParadas?: boolean }) {
  if (conParadas) {
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Butaca En Línea">
        <g fill="currentColor">
          <rect x="20" y="10" width="24" height="8" rx="4" />
          <rect x="17" y="17" width="30" height="24" rx="9" />
          <rect x="8" y="23" width="8" height="18" rx="4" />
          <rect x="48" y="23" width="8" height="18" rx="4" />
        </g>
        <line x1="10" y1="53" x2="54" y2="53" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <circle cx="10" cy="53" r="6" fill="#fff" stroke="currentColor" strokeWidth="5" />
        <circle cx="54" cy="53" r="6" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Butaca En Línea">
      <g fill="currentColor">
        <rect x="20" y="10" width="24" height="8" rx="4" />
        <rect x="17" y="17" width="30" height="24" rx="9" />
        <rect x="8" y="23" width="8" height="18" rx="4" />
        <rect x="48" y="23" width="8" height="18" rx="4" />
        <rect x="10" y="50" width="44" height="5" rx="2.5" />
      </g>
    </svg>
  );
}

/** Versión compacta de barras de aplicación: cuadrado navy + nombre en dos renglones. */
export function LogoLockup() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 'var(--r-10)',
          background: 'var(--navy)',
          display: 'grid',
          placeItems: 'center',
          flex: 'none',
          color: '#fff',
        }}
      >
        <LogoMark size={22} />
      </span>
      <span style={{ lineHeight: 1 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 17, letterSpacing: '-0.03em', color: 'var(--text)' }}>
          Butaca
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 9,
            fontWeight: 500,
            color: 'var(--blue-600)',
            letterSpacing: '0.16em',
            whiteSpace: 'nowrap',
            marginTop: 2,
          }}
        >
          EN LÍNEA
        </span>
      </span>
    </span>
  );
}
