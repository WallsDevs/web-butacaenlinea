import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMisVentas } from '../../lib/api/endpoints';
import { hora, hoyISO } from '../../lib/time';
import { Field } from '../../components/ui/Field';
import { StatusChip } from '../../components/ui/StatusChip';
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

/** Mis ventas — los boletos vendidos por el cajero autenticado. */
export default function MisVentas() {
  const [fecha, setFecha] = useState(hoyISO());
  const { data, isLoading } = useQuery({
    queryKey: ['mis-ventas', fecha],
    queryFn: () => getMisVentas(fecha),
  });

  return (
    <div className={styles.cierreContenido} style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, margin: '12px 0 20px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Mis ventas</h2>
          <div style={{ fontSize: 14, color: 'var(--text-soft)' }}>
            {data ? `${data.resumen.emitidos} boletos · $ ${data.resumen.totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : '—'}
            {data?.resumen.anulados ? ` · ${data.resumen.anulados} anulado${data.resumen.anulados === 1 ? '' : 's'}` : ''}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', width: 180 }}>
          <Field label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.cierreTabla}>
          <thead>
            <tr>
              <th>Hora</th>
              <th>Folio</th>
              <th>Pasajero</th>
              <th>Destino</th>
              <th>Método</th>
              <th style={{ textAlign: 'right' }}>Cobrado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {(data?.boletos ?? []).map((b) => (
              <tr key={b.documentId}>
                <td>{hora(b.hora)}</td>
                <td style={{ fontWeight: 600 }}>{b.folio}</td>
                <td>
                  {b.pasajeroNombre}
                  <span style={{ color: 'var(--text-faint)' }}> · {b.asientoId}</span>
                </td>
                <td style={{ color: 'var(--text-soft)' }}>{b.destino}</td>
                <td style={{ color: 'var(--text-soft)' }}>{NOMBRE_METODO[b.metodoPago] ?? b.metodoPago}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(b.montoCobrado, b.monedaPago)}</td>
                <td>
                  {b.estado === 'anulado' ? (
                    <StatusChip tono="bad" size="sm">Anulado</StatusChip>
                  ) : b.estadoPago === 'por_verificar' ? (
                    <StatusChip tono="warn" size="sm">Por verificar</StatusChip>
                  ) : (
                    <StatusChip tono="ok" size="sm">Cobrado</StatusChip>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && !data?.boletos.length && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 28 }}>
                  Sin ventas ese día.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
