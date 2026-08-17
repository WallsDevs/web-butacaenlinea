import { useLocation, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getBoletoPorCodigo } from '../../lib/api/endpoints';
import { hora, fechaCorta } from '../../lib/time';
import { TicketCard } from '../../components/ticket/TicketCard';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import { useSeo } from '../../lib/seo';

/**
 * "Mi boleto" — vista del pasajero (móvil primero). El QR es el token firmado
 * regenerado por el servidor; el boleto queda en caché para consultarse sin señal.
 */
export default function Boleto() {
  useSeo('Tu boleto — Butaca En Línea', undefined, { noindex: true });
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const grupo = (location.state as { grupo?: { qrId: string; asientoId: string }[] } | null)?.grupo;

  const { data: boleto, isLoading } = useQuery({
    queryKey: ['boleto', codigo],
    queryFn: () => getBoletoPorCodigo(codigo!),
    enabled: Boolean(codigo),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (isLoading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando boleto…</div>;
  }
  if (!boleto) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Boleto no encontrado.</div>;
  }

  const chip =
    boleto.estado === 'anulado'
      ? { tono: 'bad' as const, label: 'Anulado' }
      : boleto.estadoPago === 'por_verificar'
        ? { tono: 'warn' as const, label: 'Pago por verificar' }
        : boleto.estadoPago === 'rechazado'
          ? { tono: 'bad' as const, label: 'Pago rechazado' }
          : boleto.estado === 'abordado'
            ? { tono: 'ok' as const, label: 'Abordado' }
            : { tono: 'ok' as const, label: 'Pagado' };

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', padding: '24px 16px 56px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 20 }}>Tu boleto</span>
        <span style={{ marginLeft: 'auto' }}>
          <StatusChip tono={chip.tono} dot={chip.tono === 'ok'}>
            {chip.label}
          </StatusChip>
        </span>
      </div>

      <TicketCard
        variant="movil"
        data={{
          folio: boleto.folio,
          codigo: boleto.qrId.slice(0, 8).toUpperCase(),
          qrValue: boleto.qr,
          lineaNombre: boleto.linea?.nombre,
          origen: boleto.salida.ruta?.origen ?? '',
          destino: boleto.salida.ruta?.destino ?? '',
          fecha: fechaCorta(boleto.salida.fechaHoraSalida),
          salidaHora: hora(boleto.salida.fechaHoraSalida),
          llegadaHora: hora(boleto.salida.fechaHoraLlegada),
          puestos: boleto.asientoId,
          piso: `${boleto.piso}${boleto.claseServicio === 'vip' ? ' VIP' : ''}`,
          rampa: boleto.salida.rampa?.replace('Rampa ', ''),
          pasajeroNombre: boleto.pasajeroNombre,
          pasajeroDoc: boleto.pasajeroDocumento,
          totalUsd: boleto.totalUsd,
        }}
      />

      {grupo && grupo.length > 1 && (
        <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {grupo.map((g) => (
            <button
              key={g.qrId}
              className={ui.btnSecondary}
              style={g.qrId === codigo ? { borderColor: 'var(--blue-600)', color: 'var(--blue-700)' } : undefined}
              onClick={() => navigate(`/boleto/${g.qrId}`, { state: { grupo } })}
            >
              Puesto {g.asientoId}
            </button>
          ))}
        </div>
      )}

      <div className="no-print" style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className={`${ui.btnPrimary}`} style={{ flex: 1, padding: 13, borderRadius: 13, fontSize: 14 }}>
          Añadir a la pantalla de inicio
        </button>
        <button className={ui.btnSecondary} onClick={() => window.print()}>
          PDF
        </button>
      </div>

      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--tint-50)',
          border: '1px solid var(--tint-200)',
          borderRadius: 'var(--r-14)',
          padding: '12px 14px',
          marginTop: 12,
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 'var(--r-8)',
            background: 'var(--blue-600)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 13,
            flex: 'none',
          }}
        >
          ↓
        </span>
        <span style={{ fontSize: 12, color: 'var(--blue-700)', lineHeight: 1.45 }}>
          Funciona sin señal: el boleto queda guardado en el teléfono.
        </span>
      </div>
    </div>
  );
}
