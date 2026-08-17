import { useEffect, useState } from 'react';

/**
 * Temporizador de reserva. SOLO refleja el `expiraEn` del servidor (con el
 * offset de reloj calculado al crear la reserva); jamás extiende localmente.
 */
export function ReservationTimer({
  expiraEn,
  serverOffsetMs = 0,
  totalMs = 5 * 60 * 1000,
  onExpire,
  variant = 'pos',
}: {
  expiraEn: string;
  serverOffsetMs?: number;
  totalMs?: number;
  onExpire?: () => void;
  variant?: 'pos' | 'web';
}) {
  const [restanteMs, setRestanteMs] = useState(() =>
    Math.max(0, new Date(expiraEn).getTime() - (Date.now() + serverOffsetMs))
  );

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, new Date(expiraEn).getTime() - (Date.now() + serverOffsetMs));
      setRestanteMs(r);
      if (r <= 0) onExpire?.();
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiraEn, serverOffsetMs]);

  const mm = String(Math.floor(restanteMs / 60000)).padStart(2, '0');
  const ss = String(Math.floor((restanteMs % 60000) / 1000)).padStart(2, '0');
  const progreso = Math.max(0, Math.min(1, restanteMs / totalMs));

  return (
    <div
      style={{
        background: 'var(--tint-50)',
        border: '1px solid var(--tint-200)',
        borderRadius: 'var(--r-16)',
        padding: 16,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue-700)' }}>Reserva temporal</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4 }}>
        <span
          style={{
            fontSize: variant === 'pos' ? 42 : 30,
            fontWeight: 700,
            lineHeight: 1.05,
            color: 'var(--navy-mid)',
          }}
        >
          {mm}:{ss}
        </span>
        <span style={{ fontSize: 12, color: '#4b6aae' }}>
          Los puestos se liberan al llegar a 00:00
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: 'var(--tint-200)',
          borderRadius: 'var(--r-pill)',
          marginTop: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progreso * 100}%`,
            height: '100%',
            background: 'var(--blue-600)',
            borderRadius: 'var(--r-pill)',
            transition: 'width 250ms linear',
          }}
        />
      </div>
    </div>
  );
}
