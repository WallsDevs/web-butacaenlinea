import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cerrarTurno, getArqueo, getTurnoActual } from '../../lib/api/endpoints';
import { hora } from '../../lib/time';
import type { CierreTurno as CierreDto } from '../../lib/api/types';
import ui from '../../components/ui/ui.module.css';
import styles from './pos.module.css';

const NOMBRE_METODO: Record<string, string> = {
  efectivo_bs: 'Efectivo Bs',
  efectivo_usd: 'Efectivo USD',
  pago_movil: 'Pago Móvil',
  transferencia: 'Transferencia',
  punto_venta: 'Punto de venta',
  tarjeta_cop: 'Pesos COP',
  zelle: 'Zelle',
  wallet: 'Wallet Butaca',
};

const fmt = (monto: number, moneda: string) =>
  moneda === 'USD'
    ? `$ ${monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
    : moneda === 'COP'
      ? `$ ${Math.round(monto).toLocaleString('es-CO')} COP`
      : `Bs ${monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

/**
 * Cierre de turno: el arqueo SIEMPRE se calcula desde los boletos emitidos —
 * jamás se captura a mano. Cerrar lo persiste una sola vez y queda auditado.
 */
export default function CierreTurno() {
  const queryClient = useQueryClient();
  const [cerrado, setCerrado] = useState<CierreDto | null>(null);

  const { data: turno, isLoading } = useQuery({ queryKey: ['turno-actual'], queryFn: getTurnoActual });
  const { data: arqueo } = useQuery({
    queryKey: ['arqueo', turno?.documentId],
    queryFn: () => getArqueo(turno!.documentId),
    enabled: Boolean(turno),
    refetchInterval: cerrado ? false : 10000,
  });

  const cerrar = useMutation({
    mutationFn: () => cerrarTurno(turno!.documentId),
    onSuccess: (r) => {
      setCerrado(r.cierre);
      queryClient.invalidateQueries({ queryKey: ['turno-actual'] });
    },
  });

  if (isLoading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando…</div>;
  if (!turno && !cerrado) {
    return (
      <div className={styles.cierreContenido}>
        <div className={ui.card} style={{ padding: 32, textAlign: 'center', color: 'var(--text-soft)' }}>
          No hay un turno abierto.{' '}
        </div>
      </div>
    );
  }

  const datos = cerrado ?? arqueo;

  return (
    <div className={styles.cierreContenido}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, margin: '12px 0 20px' }}>
        <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {cerrado ? 'Turno cerrado' : 'Cierre de turno'}
        </h2>
        <span style={{ fontSize: 14, color: 'var(--text-soft)' }}>
          {turno?.taquilla?.nombre} · {turno?.cajero?.nombreCorto} · abierto {turno ? hora(turno.abiertoEn) : ''}
        </span>
      </div>

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Folios del turno</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {datos?.folios.desde ?? '—'} → {datos?.folios.hasta ?? '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Emitidos</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{datos?.folios.emitidos ?? 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Total del turno</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy-mid)' }}>
              $ {datos?.totalUsd?.toLocaleString('es-VE', { minimumFractionDigits: 2 }) ?? '0,00'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Anulaciones</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--bad-border)' }}>
              {datos?.anulaciones.cantidad ?? 0} · $ {datos?.anulaciones.montoUsd?.toFixed(2) ?? '0.00'}
            </div>
          </div>
        </div>
        <table className={styles.cierreTabla}>
          <thead>
            <tr>
              <th>Método de pago</th>
              <th>Moneda</th>
              <th>Boletos</th>
              <th style={{ textAlign: 'right' }}>Monto cobrado</th>
            </tr>
          </thead>
          <tbody>
            {(datos?.porMetodo ?? []).map((m) => (
              <tr key={`${m.metodoPago}-${m.moneda}`}>
                <td style={{ fontWeight: 600 }}>{NOMBRE_METODO[m.metodoPago] ?? m.metodoPago}</td>
                <td>{m.moneda}</td>
                <td>{m.boletos}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(m.monto, m.moneda)}</td>
              </tr>
            ))}
            {!datos?.porMetodo?.length && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-soft)' }}>
                  Sin emisiones en este turno.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div
          style={{
            padding: '16px 20px',
            background: 'var(--surface-alt)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>
            El arqueo se calcula solo — la caja debe cuadrar con estos montos.
          </span>
          {!cerrado && (
            <button
              className={ui.btnPrimary}
              style={{ marginLeft: 'auto' }}
              disabled={cerrar.isPending}
              onClick={() => cerrar.mutate()}
            >
              {cerrar.isPending ? 'Cerrando…' : 'Cerrar turno'}
            </button>
          )}
          {cerrado && (
            <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--ok-text)' }}>
              Cierre registrado y auditado ✓
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
