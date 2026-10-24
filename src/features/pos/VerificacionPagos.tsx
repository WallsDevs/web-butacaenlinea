import { urlMedia } from '../../lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBoletosPorVerificar, getReembolsos, marcarReembolsado } from '../../lib/api/endpoints';
import { useAuth } from '../../stores/auth';
import { hora, fechaCorta } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import { EncabezadoPantalla } from '../../components/ui/EncabezadoPantalla';

import ui from '../../components/ui/ui.module.css';
import marco from '../flota/flota.module.css';
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
 * Pagos de la línea. Toda la plata de lo vendido en línea entra a Butaca, que
 * verifica los pagos contra su banco: aquí la línea solo ve qué boletos están
 * en revisión. Al confirmarse, el neto le llega a su wallet. Lo que sí hace la
 * línea: devolver en su caja lo cobrado en taquilla de una salida cancelada.
 */
export default function VerificacionPagos() {
  const queryClient = useQueryClient();

  const { data: pendientes, isLoading } = useQuery({
    queryKey: ['por-verificar'],
    queryFn: getBoletosPorVerificar,
    refetchInterval: 30000,
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
    <div className={marco.contenido} style={{ maxWidth: 1100 }}>
      <EncabezadoPantalla
        titulo="Pagos"
        chip={!isLoading && <StatusChip tono={pendientes?.length ? 'warn' : 'ok'}>{pendientes?.length ?? 0} en revisión</StatusChip>}
        descripcion="Toda venta en línea se paga a Butaca, que confirma el pago contra su banco. Cuando lo confirma, el boleto queda pagado y el neto entra a tu wallet. Aquí ves lo que está en revisión."
      />

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
                {b.comprobanteUrl && (
                  <a href={urlMedia(b.comprobanteUrl) ?? undefined} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700 }}>
                    Ver captura del pago
                  </a>
                )}
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <StatusChip tono="warn">En revisión por Butaca</StatusChip>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && !pendientes?.length && (
          <div className={ui.card} style={{ padding: 32, textAlign: 'center', color: 'var(--text-soft)' }}>
            No hay pagos en revisión.
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
