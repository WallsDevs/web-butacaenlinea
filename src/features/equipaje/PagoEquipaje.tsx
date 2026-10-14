import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCobroEquipaje, getWallet, pagarCobroEquipaje } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { useAuth } from '../../stores/auth';
import { useSeo } from '../../lib/seo';
import ui from '../../components/ui/ui.module.css';

const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

/**
 * Pieza de equipaje extra: el conductor muestra el QR en su teléfono, el
 * pasajero lo escanea y paga con su wallet. Mismo mecanismo que el QR de la
 * taquilla — el dinero va a la línea y la comisión a la plataforma.
 *
 * La decisión del dueño (2026-08-30) es que la pieza extra se cobra SOLO por
 * wallet: no hay efectivo en este flujo. Si el pasajero no tiene saldo, la
 * pieza se queda pendiente y la empresa la ve así.
 */
export default function PagoEquipaje() {
  useSeo('Pagar equipaje — Butaca En Línea', undefined, { noindex: true });
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usuario = useAuth((s) => s.usuario);
  const [error, setError] = useState<string | null>(null);

  const { data: cobro, isLoading, isError } = useQuery({
    queryKey: ['cobro-equipaje', token],
    queryFn: () => getCobroEquipaje(token!),
    enabled: Boolean(token),
    retry: false,
    refetchInterval: 10_000,
  });
  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: getWallet,
    enabled: Boolean(usuario),
  });

  const pagar = useMutation({
    mutationFn: () => pagarCobroEquipaje(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['cobro-equipaje', token] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'saldo_insuficiente') {
        const d = e.details as { saldoBs?: number; requeridoBs?: number };
        setError(
          `Saldo insuficiente: tienes ${bs(d.saldoBs ?? 0)} y la pieza cuesta ${bs(d.requeridoBs ?? 0)}. Recarga tu wallet.`
        );
      } else if (e instanceof ApiError && e.code === 'cobro_vencido') {
        setError('Este cobro ya venció. Pídele al conductor que lo genere otra vez.');
      } else if (e instanceof ApiError && e.code === 'cobro_tomado') {
        setError('Ese cobro se está pagando desde otro teléfono.');
      } else {
        setError('No se pudo procesar el pago. Intenta de nuevo.');
      }
    },
  });

  if (isLoading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando…</div>;
  }
  if (isError || !cobro) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>
        Este código no corresponde a ningún cobro. Pídele ayuda al conductor.
      </div>
    );
  }

  if (cobro.estado === 'pagada' || pagar.isSuccess) {
    return (
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '32px 16px' }}>
        <div
          style={{
            background: 'var(--ok-bg)',
            border: '2px solid var(--ok-dot)',
            borderRadius: 20,
            padding: '36px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'var(--ok-dot)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 40,
              margin: '0 auto 14px',
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ok-text)' }}>Equipaje pagado</div>
          <div style={{ fontSize: 40, fontWeight: 700, margin: '10px 0 2px' }}>{bs(cobro.montoBs)}</div>
          <div style={{ fontSize: 15, color: 'var(--text-soft)' }}>Pieza {cobro.codigo}</div>
          {cobro.viaje && <div style={{ fontSize: 14, color: 'var(--text-soft)' }}>{cobro.viaje}</div>}
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 12, lineHeight: 1.5 }}>
            El conductor lo ve en su pantalla al instante. Guarda tu talón hasta que te
            entreguen la maleta.
          </div>
        </div>
        {pagar.data && (
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: 'var(--text-soft)' }}>
            Saldo restante: <strong>{bs(pagar.data.saldoBs)}</strong>
          </div>
        )}
        <button
          className={ui.btnSecondary}
          style={{ width: '100%', marginTop: 14 }}
          onClick={() => navigate('/cuenta/wallet')}
        >
          Ir a mi wallet
        </button>
      </div>
    );
  }

  if (cobro.estado === 'vencido') {
    return (
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '32px 16px' }}>
        <div className={ui.card} style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Este cobro venció</div>
          <div style={{ fontSize: 14, color: 'var(--text-soft)', marginTop: 8, lineHeight: 1.5 }}>
            Pídele al conductor que vuelva a generarlo desde su app.
          </div>
        </div>
      </div>
    );
  }

  const saldo = wallet?.saldoBs ?? 0;
  const alcanza = saldo >= cobro.montoBs;

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', padding: '32px 16px' }}>
      <div className={ui.card} style={{ padding: 26, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>{cobro.linea}</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>Pieza de equipaje extra</div>
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', margin: '12px 0 4px' }}>
          {bs(cobro.montoBs)}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-soft)' }}>
          Pieza {cobro.codigo}
          {cobro.asientoId ? ` · puesto ${cobro.asientoId}` : ''}
        </div>
        {cobro.viaje && (
          <div style={{ fontSize: 14, color: 'var(--text-soft)' }}>
            {cobro.viaje}
            {cobro.unidad ? ` · unidad ${cobro.unidad}` : ''}
          </div>
        )}
        {cobro.pasajero && (
          <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 6 }}>{cobro.pasajero}</div>
        )}

        {!usuario ? (
          <>
            <div style={{ fontSize: 14, color: 'var(--text-soft)', margin: '18px 0 12px', lineHeight: 1.5 }}>
              Entra con tu cuenta para pagar con tu wallet.
            </div>
            <button
              className={ui.btnPrimary}
              style={{ width: '100%' }}
              onClick={() => navigate(`/ingresar?next=/equipaje/${token}`)}
            >
              Entrar y pagar
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: 'var(--text-soft)', margin: '18px 0 10px' }}>
              Tu saldo: <strong>{bs(saldo)}</strong>
            </div>
            {error && (
              <div style={{ fontSize: 13, color: 'var(--bad-text)', marginBottom: 10, lineHeight: 1.5 }}>
                {error}
              </div>
            )}
            <button
              className={ui.btnPrimary}
              style={{ width: '100%' }}
              disabled={!alcanza || pagar.isPending}
              onClick={() => {
                setError(null);
                pagar.mutate();
              }}
            >
              {pagar.isPending ? 'Pagando…' : `Pagar ${bs(cobro.montoBs)}`}
            </button>
            {!alcanza && (
              <button
                className={ui.btnSecondary}
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => navigate('/cuenta/wallet')}
              >
                Recargar mi wallet
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
