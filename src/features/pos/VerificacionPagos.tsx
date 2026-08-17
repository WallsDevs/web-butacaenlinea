import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBoletosPorVerificar, getReembolsos, marcarReembolsado, verificarPago } from '../../lib/api/endpoints';
import { useAuth } from '../../stores/auth';
import { hora, fechaCorta } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from './pos.module.css';

const NOMBRE_METODO: Record<string, string> = {
  pago_movil: 'Pago Móvil',
  transferencia: 'Transferencia',
  zelle: 'Zelle',
  tarjeta_cop: 'Tarjeta COP',
};

const fmt = (monto: number, moneda: string) =>
  moneda === 'USD'
    ? `$ ${monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
    : moneda === 'COP'
      ? `$ ${Math.round(monto).toLocaleString('es-CO')} COP`
      : `Bs ${monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

/**
 * Pago manual: la venta web emite el boleto con la referencia bancaria y la
 * LÍNEA la confirma aquí contra su banco. Cada confirmación o rechazo queda
 * auditado (usuario, hora, referencia) — la plataforma supervisa el proceso.
 */
export default function VerificacionPagos() {
  const queryClient = useQueryClient();
  const [nota, setNota] = useState<Record<string, string>>({});

  const { data: pendientes, isLoading } = useQuery({
    queryKey: ['por-verificar'],
    queryFn: getBoletosPorVerificar,
    refetchInterval: 15000,
  });

  const verificar = useMutation({
    mutationFn: ({ id, aprobar }: { id: string; aprobar: boolean }) =>
      verificarPago(id, aprobar, nota[id]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['por-verificar'] }),
  });

  const esEmpresa = useAuth((s) => s.usuario)?.role?.type === 'empresa';
  const { data: reembolsos } = useQuery({
    queryKey: ['reembolsos'],
    queryFn: getReembolsos,
    enabled: esEmpresa,
  });
  const reembolsar = useMutation({
    mutationFn: (id: string) => marcarReembolsado(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reembolsos'] }),
  });

  return (
    <div className={styles.cierreContenido} style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, margin: '12px 0 6px' }}>
        <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Pagos por verificar</h2>
        {!isLoading && <StatusChip tono={pendientes?.length ? 'warn' : 'ok'}>{pendientes?.length ?? 0} pendientes</StatusChip>}
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-soft)', marginBottom: 20 }}>
        Ventas web con referencia bancaria. Confirma cada pago contra el banco de la línea; todo queda
        con usuario y hora para la auditoría.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(pendientes ?? []).map((b) => (
          <div key={b.documentId} className={ui.card} style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span className={styles.apartadoCuadro}>{b.asientoId}</span>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{b.pasajeroNombre}</div>
                <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                  {b.folio} · {b.salida?.destino}
                  {b.salida ? ` · ${fechaCorta(b.salida.fechaHoraSalida)} ${hora(b.salida.fechaHoraSalida)}` : ''}
                </div>
              </div>
              <div style={{ minWidth: 150 }}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  {NOMBRE_METODO[b.metodoPago] ?? b.metodoPago}
                </div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{fmt(b.montoCobrado, b.monedaPago)}</div>
              </div>
              <div style={{ minWidth: 140 }}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Referencia</div>
                <div style={{ fontWeight: 700, letterSpacing: '0.06em' }}>{b.referenciaPago || '—'}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className={styles.apartadoInput}
                  style={{ width: 170 }}
                  placeholder="Nota (opcional)"
                  value={nota[b.documentId] ?? ''}
                  onChange={(e) => setNota((n) => ({ ...n, [b.documentId]: e.target.value }))}
                />
                <button
                  className={ui.btnSecondary}
                  style={{ color: 'var(--bad-text)', borderColor: '#f3c1c1' }}
                  disabled={verificar.isPending}
                  onClick={() => verificar.mutate({ id: b.documentId, aprobar: false })}
                >
                  Rechazar
                </button>
                <button
                  className={ui.btnPrimary}
                  style={{ padding: '12px 20px', fontSize: 14 }}
                  disabled={verificar.isPending}
                  onClick={() => verificar.mutate({ id: b.documentId, aprobar: true })}
                >
                  Confirmar pago
                </button>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && !pendientes?.length && (
          <div className={ui.card} style={{ padding: 32, textAlign: 'center', color: 'var(--text-soft)' }}>
            No hay pagos pendientes de verificación.
          </div>
        )}
      </div>

      {esEmpresa && (reembolsos?.length ?? 0) > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, margin: '34px 0 6px' }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Reembolsos pendientes</h2>
            <StatusChip tono="warn">{reembolsos!.length}</StatusChip>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-soft)', marginBottom: 16 }}>
            Boletos anulados por cancelación de salida con dinero cobrado. Contacta al pasajero,
            devuélvele el pago por tu canal y márcalo aquí — queda auditado.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {reembolsos!.map((b) => (
              <div key={b.documentId} className={ui.card} style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 190 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{b.pasajeroNombre}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                      {b.folio} · {b.salida?.destino}
                      {b.salida ? ` · ${fechaCorta(b.salida.fechaHoraSalida)} ${hora(b.salida.fechaHoraSalida)}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--blue-700)', fontWeight: 600 }}>
                      {b.pasajeroTelefono ? `Tel: ${b.pasajeroTelefono}` : 'Sin teléfono registrado'}
                    </div>
                  </div>
                  <div style={{ minWidth: 150 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                      {NOMBRE_METODO[b.metodoPago] ?? b.metodoPago}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{fmt(b.montoCobrado, b.monedaPago)}</div>
                  </div>
                  <div style={{ minWidth: 140 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Referencia</div>
                    <div style={{ fontWeight: 700, letterSpacing: '0.06em' }}>{b.referenciaPago || '—'}</div>
                  </div>
                  <button
                    className={ui.btnPrimary}
                    style={{ marginLeft: 'auto', padding: '12px 20px', fontSize: 14 }}
                    disabled={reembolsar.isPending}
                    onClick={() => {
                      if (confirm(`¿Confirmas que ya devolviste ${fmt(b.montoCobrado, b.monedaPago)} a ${b.pasajeroNombre}?`)) {
                        reembolsar.mutate(b.documentId);
                      }
                    }}
                  >
                    Marcar reembolsado
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
