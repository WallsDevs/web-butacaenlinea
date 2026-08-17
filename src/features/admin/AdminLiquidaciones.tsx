import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cobrarLiquidacion, getAdminLiquidaciones } from '../../lib/api/endpoints';
import { fechaCorta } from '../../lib/time';
import { PillTabs } from '../../components/ui/PillTabs';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const usd = (n: number) => `$ ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

/**
 * Liquidaciones diarias de comisión por empresa. La empresa paga por su canal
 * (el cobro es manual, igual que todo el dinero en la plataforma) y aquí se
 * marca cobrada — con nota y auditoría.
 */
export default function AdminLiquidaciones() {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<'pendiente' | 'cobrada' | 'todas'>('pendiente');
  const [nota, setNota] = useState<Record<string, string>>({});

  const { data: liquidaciones, isLoading } = useQuery({
    queryKey: ['admin-liquidaciones', estado],
    queryFn: () => getAdminLiquidaciones(estado),
  });

  const cobrar = useMutation({
    mutationFn: ({ id }: { id: string }) => cobrarLiquidacion(id, nota[id] || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-liquidaciones'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const totalPendiente = (liquidaciones ?? [])
    .filter((l) => l.estado === 'pendiente')
    .reduce((s, l) => s + l.comisionUsd, 0);

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Liquidaciones</h2>
        {totalPendiente > 0 && <StatusChip tono="warn">{usd(totalPendiente)} por cobrar</StatusChip>}
        <span style={{ marginLeft: 'auto' }}>
          <PillTabs
            variant="loose"
            items={[
              { id: 'pendiente', label: 'Pendientes' },
              { id: 'cobrada', label: 'Cobradas' },
              { id: 'todas', label: 'Todas' },
            ]}
            value={estado}
            onChange={setEstado}
          />
        </span>
      </div>

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Empresa</th>
              <th>Boletos</th>
              <th>Ventas</th>
              <th>Comisión</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(liquidaciones ?? []).map((l) => (
              <tr key={l.documentId}>
                <td style={{ fontWeight: 600 }}>{fechaCorta(`${l.fecha}T12:00:00`)}</td>
                <td>{l.linea?.nombre ?? '—'}</td>
                <td style={{ color: 'var(--text-soft)' }}>
                  {l.boletos}
                  {l.anulados ? ` (+${l.anulados} anul.)` : ''}
                </td>
                <td>{usd(l.ventasUsd)}</td>
                <td style={{ fontWeight: 700 }}>
                  {usd(l.comisionUsd)} <span style={{ fontWeight: 400, color: 'var(--text-faint)', fontSize: 12 }}>({l.comisionPct}%)</span>
                </td>
                <td>
                  {l.estado === 'cobrada' ? (
                    <StatusChip tono="ok" size="sm">Cobrada</StatusChip>
                  ) : (
                    <StatusChip tono="warn" size="sm">Pendiente</StatusChip>
                  )}
                  {l.estado === 'cobrada' && l.notaCobro && (
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{l.notaCobro}</div>
                  )}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {l.estado === 'pendiente' && (
                    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <input
                        className={ui.fieldInput}
                        style={{ width: 150, fontSize: 13 }}
                        placeholder="Ref. del pago"
                        value={nota[l.documentId] ?? ''}
                        onChange={(e) => setNota((n) => ({ ...n, [l.documentId]: e.target.value }))}
                      />
                      <button
                        className={ui.btnPrimary}
                        style={{ fontSize: 13, padding: '10px 16px' }}
                        disabled={cobrar.isPending}
                        onClick={() => {
                          if (confirm(`¿Confirmas el cobro de ${usd(l.comisionUsd)} a ${l.linea?.nombre}?`)) {
                            cobrar.mutate({ id: l.documentId });
                          }
                        }}
                      >
                        Marcar cobrada
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && !liquidaciones?.length && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 24 }}>
                  {estado === 'pendiente'
                    ? 'Nada por cobrar. Las liquidaciones se generan cada madrugada con las ventas del día anterior.'
                    : 'Sin liquidaciones en esta vista.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
