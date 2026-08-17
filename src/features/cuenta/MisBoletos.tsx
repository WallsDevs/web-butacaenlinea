import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getMisBoletos } from '../../lib/api/endpoints';
import { hora, fechaCorta } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import { CuentaLayout } from './CuentaLayout';
import ui from '../../components/ui/ui.module.css';

const CHIP: Record<string, { tono: 'ok' | 'warn' | 'bad' | 'neutral'; label: string }> = {
  abordado: { tono: 'ok', label: 'Abordado' },
  anulado: { tono: 'bad', label: 'Anulado' },
  no_show: { tono: 'neutral', label: 'No viajó' },
};

/** Mis boletos — historial del cliente. */
export default function MisBoletos() {
  const navigate = useNavigate();
  const { data: boletos, isLoading } = useQuery({ queryKey: ['mis-boletos'], queryFn: getMisBoletos });

  return (
    <CuentaLayout activa="boletos">
      {isLoading && <div style={{ padding: 24, color: 'var(--text-soft)' }}>Cargando…</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(boletos ?? []).map((b) => {
          const chip =
            b.estadoPago === 'por_verificar'
              ? { tono: 'warn' as const, label: 'Pago por verificar' }
              : CHIP[b.estado] ?? { tono: 'ok' as const, label: 'Pagado' };
          return (
            <button
              key={b.qrId}
              className={ui.card}
              style={{ padding: 18, display: 'flex', gap: 16, alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}
              onClick={() => navigate(`/boleto/${b.qrId}`)}
            >
              <div style={{ textAlign: 'center', minWidth: 54 }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {b.salida ? hora(b.salida.fechaHoraSalida) : '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  {b.salida ? fechaCorta(b.salida.fechaHoraSalida) : ''}
                </div>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {b.salida?.ruta?.origen} → {b.salida?.ruta?.destino}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 2 }}>
                  {b.linea?.nombre} · Puesto {b.asientoId} · {b.folio}
                </div>
              </div>
              <StatusChip tono={chip.tono} size="sm">
                {chip.label}
              </StatusChip>
            </button>
          );
        })}
        {!isLoading && !boletos?.length && (
          <div className={ui.card} style={{ padding: 32, textAlign: 'center', color: 'var(--text-soft)' }}>
            Aún no tienes boletos. <a href="/">Busca tu salida</a> y compra con tu cuenta para verlos aquí.
          </div>
        )}
      </div>
    </CuentaLayout>
  );
}
