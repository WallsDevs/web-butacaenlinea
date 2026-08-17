import { useState } from 'react';
import { marcarEquipaje } from '../../lib/api/endpoints';

/**
 * Contador de piezas de bodega (− n +). Guarda en el servidor en cada toque;
 * si falla (p. ej. sin señal) revierte y avisa con un parpadeo.
 */
export function EquipajeStepper({
  qrId,
  piezas: piezasIniciales,
  size = 'md',
  onCambio,
}: {
  qrId: string;
  piezas: number;
  size?: 'md' | 'lg';
  onCambio?: (piezas: number) => void;
}) {
  const [piezas, setPiezas] = useState(piezasIniciales);
  const [error, setError] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const ajustar = async (delta: number) => {
    if (guardando) return;
    const anterior = piezas;
    setPiezas(Math.max(0, Math.min(10, piezas + delta)));
    setGuardando(true);
    setError(false);
    try {
      // el servidor suma sobre su valor guardado: dos pantallas nunca se pisan
      const r = await marcarEquipaje(qrId, delta);
      setPiezas(r.piezas);
      onCambio?.(r.piezas);
    } catch {
      setPiezas(anterior);
      setError(true);
      setTimeout(() => setError(false), 1600);
    } finally {
      setGuardando(false);
    }
  };

  const lado = size === 'lg' ? 40 : 28;
  const fuente = size === 'lg' ? 18 : 14;
  const btn: React.CSSProperties = {
    width: lado,
    height: lado,
    borderRadius: 10,
    border: '1.5px solid var(--border)',
    background: 'var(--surface)',
    fontSize: fuente + 2,
    fontWeight: 700,
    color: 'var(--text)',
    lineHeight: 1,
  };

  return (
    <span
      className="no-print"
      style={{ display: 'inline-flex', alignItems: 'center', gap: size === 'lg' ? 12 : 8 }}
    >
      <button style={btn} disabled={guardando || piezas <= 0} onClick={() => ajustar(-1)}>
        −
      </button>
      <span
        style={{
          minWidth: size === 'lg' ? 54 : 40,
          textAlign: 'center',
          fontWeight: 700,
          fontSize: fuente,
          color: error ? 'var(--bad-text)' : 'var(--text)',
        }}
      >
        {piezas} {size === 'lg' ? (piezas === 1 ? 'maleta' : 'maletas') : ''}
      </span>
      <button style={btn} disabled={guardando || piezas >= 10} onClick={() => ajustar(1)}>
        +
      </button>
    </span>
  );
}
