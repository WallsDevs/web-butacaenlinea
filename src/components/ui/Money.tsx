import { useSettings } from '../../stores/settings';
import { equivalencia, formatearMonto } from '../../lib/money';

/** Monto en la moneda global activa (lee las tasas sincronizadas del store). */
export function Money({ usd, className, style }: { usd: number; className?: string; style?: React.CSSProperties }) {
  const moneda = useSettings((s) => s.moneda);
  const tasas = useSettings((s) => s.tasas);
  return (
    <span className={className} style={style}>
      {formatearMonto(usd, moneda, tasas)}
    </span>
  );
}

/** Línea de equivalencia en la otra moneda (12px #7C8AA5, alineada a la derecha). */
export function MoneyAlt({ usd, style }: { usd: number; style?: React.CSSProperties }) {
  const moneda = useSettings((s) => s.moneda);
  const tasas = useSettings((s) => s.tasas);
  return (
    <span style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'right', display: 'block', ...style }}>
      {equivalencia(usd, moneda, tasas)}
    </span>
  );
}
