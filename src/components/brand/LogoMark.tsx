/**
 * Isotipo de Butaca En Línea (manual de marca, §2): el puesto elegido. Tres
 * puestos libres en contorno y uno elegido, relleno, SIEMPRE arriba a la
 * derecha. Retícula de 64.
 *
 * Colores por fondo (BRAND §2.1):
 *   claro → contornos navy, elegido azul de acción
 *   navy  → contornos #9FC0FF, elegido #60A5FA
 *   azul  → contornos #DBE7FE, elegido blanco
 *   una   → todo `currentColor`
 * Tamaños: ≥32 px trazo 4; 20–31 px la versión de trazo 6 (los puestos no se
 * cierran). Por debajo de 20 solo existe como favicon (public/favicon.svg).
 */
export type FondoLogo = 'claro' | 'navy' | 'azul' | 'una';

const PALETA: Record<FondoLogo, { contorno: string; elegido: string }> = {
  claro: { contorno: '#0B2A6B', elegido: '#2563EB' },
  navy: { contorno: '#9FC0FF', elegido: '#60A5FA' },
  azul: { contorno: '#DBE7FE', elegido: '#FFFFFF' },
  una: { contorno: 'currentColor', elegido: 'currentColor' },
};

export function Isotipo({
  size = 32,
  fondo = 'claro',
  contorno,
  acento,
  trazo,
}: {
  size?: number;
  fondo?: FondoLogo;
  /** Sobrescribe el color de los contornos (p. ej. blanco sobre el degradado del hero). */
  contorno?: string;
  /** Sobrescribe el color del puesto elegido. */
  acento?: string;
  /** Sobrescribe el grosor del trazo (la barra de aplicación usa 5). */
  trazo?: number;
}) {
  const c = contorno ?? PALETA[fondo].contorno;
  const e = acento ?? PALETA[fondo].elegido;
  const chico = size < 32;
  const w = trazo ?? (chico ? 6 : 4);
  // Versión pequeña: puestos de 20 con trazo 6; grande: de 22 con trazo 4
  const [a, b, lado] = chico && trazo === undefined ? [7, 37, 20] : [6, 36, 22];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Butaca En Línea" style={{ display: 'block', flex: 'none' }}>
      <g fill="none" stroke={c} strokeWidth={w}>
        <rect x={a} y={a} width={lado} height={lado} rx={6} />
        <rect x={a} y={b} width={lado} height={lado} rx={6} />
        <rect x={b} y={b} width={lado} height={lado} rx={6} />
      </g>
      <rect x={34} y={4} width={26} height={26} rx={7} fill={e} />
    </svg>
  );
}

/**
 * Versión compacta de las barras de aplicación (§2.3): isotipo de 30 px con
 * trazo 5 y el nombre en dos renglones, sin cuadro contenedor.
 */
export function LogoLockup({ fondo = 'claro' }: { fondo?: 'claro' | 'navy' }) {
  const oscuro = fondo === 'navy';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Isotipo size={30} trazo={5} fondo={oscuro ? 'navy' : 'claro'} contorno={oscuro ? '#FFFFFF' : undefined} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 0.85, color: oscuro ? '#FFFFFF' : 'var(--text)' }}>Butaca</span>
        <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', lineHeight: 1, color: oscuro ? 'var(--blue-200)' : 'var(--blue-600)', whiteSpace: 'nowrap' }}>EN LÍNEA</span>
      </span>
    </span>
  );
}
