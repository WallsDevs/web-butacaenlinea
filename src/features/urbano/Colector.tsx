import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCobrosUrbanos, getUnidades } from '../../lib/api/endpoints';
import { hora } from '../../lib/time';
import { useAuth } from '../../stores/auth';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

/**
 * Pantalla del colector (móvil primero; será la pantalla principal de la app):
 * pagos de la unidad entrando EN VIVO (polling 5 s + sonido), total del día.
 * Solo monitoreo — el reparto no lo toca (regla de producto). Sin equipaje.
 */
export default function Colector() {
  const usuario = useAuth((s) => s.usuario);
  const [unidadId, setUnidadId] = useState<string>('');
  const ultimoTotal = useRef<number | null>(null);
  const [nuevoPago, setNuevoPago] = useState(false);

  const { data: unidades } = useQuery({
    queryKey: ['unidades', usuario?.linea?.slug],
    queryFn: () => getUnidades(usuario?.linea?.slug),
    enabled: Boolean(usuario?.linea?.slug),
  });
  useEffect(() => {
    if (!unidadId && unidades?.length === 1) setUnidadId(unidades[0].documentId);
  }, [unidades, unidadId]);

  const { data: cobros } = useQuery({
    queryKey: ['cobros-urbanos', unidadId],
    queryFn: () => getCobrosUrbanos(unidadId),
    enabled: Boolean(unidadId),
    refetchInterval: 5000,
  });

  // Sonido + destello cuando entra un pago nuevo
  useEffect(() => {
    if (!cobros) return;
    if (ultimoTotal.current !== null && cobros.totalHoy > ultimoTotal.current) {
      setNuevoPago(true);
      setTimeout(() => setNuevoPago(false), 1800);
      try {
        const actx = new AudioContext();
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.25, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.5);
        osc.start();
        osc.stop(actx.currentTime + 0.5);
      } catch {
        /* sin audio disponible */
      }
    }
    ultimoTotal.current = cobros.totalHoy;
  }, [cobros]);

  return (
    <div className={styles.contenido} style={{ maxWidth: 520 }}>
      {(unidades?.length ?? 0) > 1 && (
        <label className={ui.field} style={{ marginBottom: 14 }}>
          <span className={ui.fieldLabel}>Unidad</span>
          <select className={ui.fieldInput} value={unidadId} onChange={(e) => setUnidadId(e.target.value)}>
            <option value="">Escoge tu unidad…</option>
            {(unidades ?? []).map((u) => (
              <option key={u.documentId} value={u.documentId}>
                {u.numero} · {u.marcaModelo}
              </option>
            ))}
          </select>
        </label>
      )}

      {!unidadId ? (
        <div className={ui.card} style={{ padding: 28, textAlign: 'center', color: 'var(--text-soft)' }}>
          Escoge la unidad donde estás trabajando.
        </div>
      ) : !cobros ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-soft)' }}>Conectando…</div>
      ) : (
        <>
          <div
            className={ui.card}
            style={{
              padding: 22,
              textAlign: 'center',
              marginBottom: 14,
              transition: 'box-shadow 200ms',
              boxShadow: nuevoPago ? '0 0 0 4px var(--ok-dot)' : undefined,
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
              Unidad {cobros.unidad} · {cobros.ruta ?? 'sin ruta'} · pasaje {bs(cobros.tarifaBs)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 36, marginTop: 10 }}>
              <div>
                <div style={{ fontSize: 38, fontWeight: 700 }}>{cobros.totalHoy}</div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>pasajes hoy</div>
              </div>
              <div>
                <div style={{ fontSize: 38, fontWeight: 700 }}>{bs(cobros.recaudoHoyBs)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>recaudo del día</div>
              </div>
            </div>
          </div>

          <div className={ui.card} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 15 }}>Pagos en vivo</div>
            {cobros.pagos.map((p, i) => (
              <div
                key={p.documentId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderTop: '1px solid var(--border)',
                  background: i === 0 && nuevoPago ? 'var(--ok-bg)' : undefined,
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: 'var(--ok-bg)',
                    color: 'var(--ok-text)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                  }}
                >
                  ✓
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.pasajero}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{hora(p.hora)}</div>
                </div>
                <div style={{ fontWeight: 700 }}>{bs(p.montoBs)}</div>
              </div>
            ))}
            {!cobros.pagos.length && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-soft)', fontSize: 13 }}>
                Aún no hay pagos hoy. Cuando un pasajero escanee el QR de la unidad, sonará aquí.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
