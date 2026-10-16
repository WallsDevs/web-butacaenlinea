import { useState } from 'react';
import { EncabezadoPantalla } from '../../components/ui/EncabezadoPantalla';
import { useQuery } from '@tanstack/react-query';
import { getMisTurnos } from '../../lib/api/endpoints';
import { hora, fechaCorta } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import type { TurnoMio } from '../../lib/api/types';
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
};

const fmt = (monto: number, moneda: string) =>
  moneda === 'USD'
    ? `$ ${monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
    : moneda === 'COP'
      ? `$ ${Math.round(monto).toLocaleString('es-CO')} COP`
      : `Bs ${monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

/** Reportes del cajero: historial de sus turnos con el cierre calculado. */
export default function ReportesTurnos() {
  const [abierto, setAbierto] = useState<string | null>(null);
  const { data: turnos, isLoading } = useQuery({ queryKey: ['mis-turnos'], queryFn: getMisTurnos });

  const detalle = (t: TurnoMio) => t.cierre;

  return (
    <div className={styles.cierreContenido}>
      <EncabezadoPantalla titulo="Reportes de turno" descripcion="Cada turno que abriste en tu caja: horario, boletos vendidos y lo cobrado." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(turnos ?? []).map((t) => (
          <div key={t.documentId} className={ui.card} style={{ overflow: 'hidden' }}>
            <button
              style={{ width: '100%', padding: 18, display: 'flex', gap: 16, alignItems: 'center', textAlign: 'left' }}
              onClick={() => setAbierto(abierto === t.documentId ? null : t.documentId)}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {fechaCorta(t.abiertoEn)} · {t.taquilla?.nombre}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
                  {hora(t.abiertoEn)} — {t.cerradoEn ? hora(t.cerradoEn) : 'en curso'}
                  {t.cierre ? ` · ${t.cierre.folios.emitidos} boletos` : ''}
                </div>
              </div>
              <span style={{ marginLeft: 'auto' }}>
                {t.estado === 'abierto' ? (
                  <StatusChip tono="info" size="sm">Abierto</StatusChip>
                ) : (
                  <StatusChip tono="ok" size="sm">Cerrado</StatusChip>
                )}
              </span>
              {t.cierre && (
                <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--navy-mid)' }}>
                  $ {t.cierre.totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
              )}
            </button>
            {abierto === t.documentId && detalle(t) && (
              <div style={{ borderTop: '1px solid var(--divider)' }}>
                <table className={styles.cierreTabla}>
                  <tbody>
                    <tr>
                      <td style={{ color: 'var(--text-soft)' }}>Folios</td>
                      <td style={{ fontWeight: 600 }}>
                        {detalle(t)!.folios.desde} → {detalle(t)!.folios.hasta}
                      </td>
                    </tr>
                    {detalle(t)!.porMetodo.map((m) => (
                      <tr key={`${m.metodoPago}-${m.moneda}`}>
                        <td style={{ color: 'var(--text-soft)' }}>{NOMBRE_METODO[m.metodoPago] ?? m.metodoPago}</td>
                        <td style={{ fontWeight: 700 }}>
                          {fmt(m.monto, m.moneda)} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>· {m.boletos} boletos</span>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ color: 'var(--text-soft)' }}>Anulaciones</td>
                      <td style={{ color: 'var(--bad-text)', fontWeight: 600 }}>
                        {detalle(t)!.anulaciones.cantidad} · $ {detalle(t)!.anulaciones.montoUsd.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
        {!isLoading && !turnos?.length && (
          <div className={ui.card} style={{ padding: 32, textAlign: 'center', color: 'var(--text-soft)' }}>
            Aún no tienes turnos registrados.
          </div>
        )}
      </div>
    </div>
  );
}
