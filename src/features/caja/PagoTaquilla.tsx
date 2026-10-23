import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCobroDeTaquilla,
  getWallet,
  pagarCobroTaquilla,
} from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { fechaCorta, hora } from '../../lib/time';
import { useAuth } from '../../stores/auth';
import { useSeo } from '../../lib/seo';
import ui from '../../components/ui/ui.module.css';

const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

/**
 * Pantalla del QR FIJO de la taquilla (PWA del pasajero): el cajero publica
 * el cobro de la venta en curso y esta página lo muestra en vivo (polling
 * 3 s) — ruta, puestos, total en Bs — para pagarlo con la wallet. Los
 * boletos se emiten al instante (verificado) y el POS los imprime.
 */
export default function PagoTaquilla() {
  useSeo('Pagar en taquilla — Butaca En Línea', undefined, { noindex: true });
  const { taquillaId } = useParams<{ taquillaId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usuario = useAuth((s) => s.usuario);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cobro-taquilla', taquillaId],
    queryFn: () => getCobroDeTaquilla(taquillaId!),
    enabled: Boolean(taquillaId),
    retry: false,
    refetchInterval: 3000,
  });
  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: getWallet,
    enabled: Boolean(usuario),
  });

  const pagar = useMutation({
    mutationFn: (cobroId: string) => pagarCobroTaquilla(cobroId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['mis-boletos'] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'saldo_insuficiente') {
        const d = e.details as { saldoBs?: number; requeridoBs?: number };
        setError(
          `Saldo insuficiente: tienes ${bs(d.saldoBs ?? 0)} y el total es ${bs(d.requeridoBs ?? 0)}. Recarga tu wallet y vuelve a intentar.`
        );
      } else if (e instanceof ApiError && (e.code === 'cobro_expirado' || e.code === 'cobro_no_disponible')) {
        setError('Este cobro ya no está disponible. Pídele al cajero que lo publique de nuevo.');
        queryClient.invalidateQueries({ queryKey: ['cobro-taquilla', taquillaId] });
      } else {
        setError('No se pudo procesar el pago. Intenta de nuevo.');
      }
    },
  });

  if (isLoading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando…</div>;
  }
  if (isError || !data) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>
        Este código no corresponde a una taquilla activa.
      </div>
    );
  }

  // Éxito: la pantalla verde con los folios (el POS imprime los boletos)
  if (pagar.isSuccess) {
    const r = pagar.data;
    return (
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '32px 16px' }}>
        <div
          style={{
            background: 'var(--ok-bg)',
            border: '2px solid var(--ok-dot)',
            borderRadius: 20,
            padding: '34px 24px',
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
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ok-text)' }}>Pago realizado</div>
          <div style={{ fontSize: 38, fontWeight: 700, margin: '10px 0 4px' }}>{bs(r.totalBs)}</div>
          <div style={{ fontSize: 14, color: 'var(--text-soft)', marginBottom: 14 }}>
            {data.taquilla.linea} · {data.taquilla.nombre}
          </div>
          {r.boletos.map((b) => (
            <button
              key={b.qrId}
              onClick={() => navigate(`/boleto/${b.qrId}`)}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: 10,
                background: '#fff',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '10px 14px',
                marginTop: 8,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontWeight: 700 }}>{b.folio}</span>
              <span style={{ color: 'var(--text-soft)' }}>
                Puesto {b.asientoId} · {b.pasajeroNombre}
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--blue-700, #1d4ed8)', fontWeight: 700 }}>Ver ›</span>
            </button>
          ))}
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 12 }}>
            El cajero ya ve tu pago y te entrega los boletos impresos.
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 14, color: 'var(--text-soft)' }}>
          Saldo restante: <strong>{bs(r.saldoBs)}</strong>
        </div>
        <button className={ui.btnSecondary} style={{ width: '100%', marginTop: 12 }} onClick={() => navigate('/cuenta/boletos')}>
          Ver mis boletos
        </button>
      </div>
    );
  }

  const cobro = data.cobro;

  // Sin cobro publicado todavía: el polling lo trae solo
  if (!cobro) {
    return (
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '32px 16px' }}>
        <div className={ui.card} style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>{data.taquilla.linea}</div>
          <div style={{ fontSize: 20, fontWeight: 700, margin: '4px 0' }}>{data.taquilla.nombre}</div>
          {data.taquilla.terminal && (
            <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>{data.taquilla.terminal}</div>
          )}
          <div style={{ margin: '22px 0 6px', fontSize: 34 }}>🎫</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Esperando que el cajero prepare tu cobro…</div>
          <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 8, lineHeight: 1.5 }}>
            Dile al cajero qué viaje quieres. Cuando publique el cobro, aparecerá aquí para que
            lo pagues con tu wallet. Esta pantalla se actualiza sola.
          </div>
        </div>
      </div>
    );
  }

  const res = cobro.resumen;
  return (
    <div style={{ maxWidth: 430, margin: '0 auto', padding: '32px 16px' }}>
      <div className={ui.card} style={{ padding: 26 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>
            {res.lineaNombre} · {res.taquillaNombre}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, margin: '4px 0' }}>
            {res.origen} → {res.destino}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-soft)' }}>
            {fechaCorta(res.fechaHoraSalida)} · {hora(res.fechaHoraSalida)}
            {res.unidadNumero ? ` · unidad ${res.unidadNumero}` : ''}
          </div>
        </div>
        <div style={{ margin: '16px 0', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {res.pasajeros.map((p) => (
            <div key={p.asientoId} style={{ display: 'flex', fontSize: 14, padding: '4px 0' }}>
              <span style={{ fontWeight: 700, width: 70 }}>Puesto {p.asientoId}</span>
              <span style={{ color: 'var(--text-soft)' }}>{p.nombre}</span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Total a pagar</div>
          <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>
            {bs(cobro.totalBs)}
          </div>

          {!usuario ? (
            <button
              className={`${ui.btnPrimary} ${ui.btnPrimaryLg}`}
              style={{ width: '100%' }}
              onClick={() => navigate(`/ingresar?next=${encodeURIComponent(`/caja/${taquillaId}`)}`)}
            >
              Ingresar para pagar
            </button>
          ) : (
            <>
              <button
                className={`${ui.btnPrimary} ${ui.btnPrimaryLg}`}
                style={{ width: '100%' }}
                disabled={pagar.isPending}
                onClick={() => {
                  setError(null);
                  pagar.mutate(cobro.documentId);
                }}
              >
                {pagar.isPending
                  ? 'Pagando…'
                  : `Pagar con mi wallet · saldo ${bs(wallet?.saldoBs ?? 0)}`}
              </button>
              {error && (
                <div style={{ fontSize: 13, color: 'var(--bad-text)', marginTop: 12 }}>
                  {error}{' '}
                  <a href="/cuenta/wallet" style={{ fontWeight: 700 }}>
                    Ir a mi wallet
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
        Verifica que el detalle coincida con lo que pediste en la taquilla antes de pagar.
      </p>
    </div>
  );
}
