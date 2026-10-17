import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUnidadUrbana, getWallet, pagarPasajeUrbano } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { hora } from '../../lib/time';
import { useAuth } from '../../stores/auth';
import { useSeo } from '../../lib/seo';
import { precioTramo } from '../../lib/urbano';
import { Letrero } from '../../components/ui/Letrero';
import ui from '../../components/ui/ui.module.css';

const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

/**
 * Pantalla del pasajero al escanear el QR pegado en la buseta (PWA, móvil
 * primero). Un toque paga la tarifa plana con la wallet; la confirmación
 * verde con hora y unidad es lo que el pasajero muestra — pero la fuente de
 * verdad siempre es la pantalla del colector, que ve el pago entrar en vivo.
 * Sin equipaje: en lo urbano no existe ese concepto.
 */
export default function PagoUrbano() {
  useSeo('Pagar pasaje — Butaca En Línea', undefined, { noindex: true });
  const { unidadId } = useParams<{ unidadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usuario = useAuth((s) => s.usuario);
  const [error, setError] = useState<string | null>(null);

  const { data: info, isLoading, isError } = useQuery({
    queryKey: ['unidad-urbana', unidadId],
    queryFn: () => getUnidadUrbana(unidadId!),
    enabled: Boolean(unidadId),
    retry: false,
    // Re-chequeo suave: si la buseta inicia su jornada mientras la pantalla
    // está abierta, el botón de pago aparece solo
    refetchInterval: 10_000,
  });
  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: getWallet,
    enabled: Boolean(usuario),
  });

  // Con tarifa por tramos el pasajero dice desde dónde hasta dónde va; el precio sale de ahí
  const ruta = info?.ruta ?? null;
  const porTramos = Boolean(ruta?.tramos?.length);
  const [desde, setDesde] = useState<number | null>(null);
  const [hasta, setHasta] = useState<number | null>(null);
  useEffect(() => {
    if (!ruta || !porTramos) return;
    setDesde((d) => d ?? ruta.paradaSugerida ?? ruta.paradas[0]?.orden ?? null);
    setHasta((h) => h ?? ruta.paradas[ruta.paradas.length - 1]?.orden ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta?.documentId, porTramos]);
  const tramoListo = porTramos && desde !== null && hasta !== null && desde !== hasta;
  const precioBs = ruta ? (tramoListo ? precioTramo(ruta.tramos, ruta.tarifaBs, ruta.paradas.map((p) => p.orden), desde!, hasta!, Boolean(ruta.circuito)) : porTramos ? 0 : ruta.tarifaBs) : 0;
  const nombreParada = (orden: number | null) => ruta?.paradas.find((p) => p.orden === orden)?.nombre ?? '';

  const pagar = useMutation({
    mutationFn: () => pagarPasajeUrbano(unidadId!, tramoListo ? { desdeOrden: desde!, hastaOrden: hasta! } : undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallet'] }),
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'saldo_insuficiente') {
        const d = e.details as { saldoBs?: number; requeridoBs?: number };
        setError(`Saldo insuficiente: tienes ${bs(d.saldoBs ?? 0)} y el pasaje es ${bs(d.requeridoBs ?? 0)}. Recarga tu wallet.`);
      } else if (e instanceof ApiError && e.code === 'tramo_requerido') {
        setError('Dinos desde qué parada hasta cuál vas para calcular tu pasaje.');
        queryClient.invalidateQueries({ queryKey: ['unidad-urbana', unidadId] });
      } else if (e instanceof ApiError && e.code === 'buseta_fuera_de_servicio') {
        setError('Esta buseta acaba de salir de servicio. Pregúntale al colector.');
        queryClient.invalidateQueries({ queryKey: ['unidad-urbana', unidadId] });
      } else {
        setError('No se pudo procesar el pago. Intenta de nuevo.');
      }
    },
  });

  if (isLoading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando…</div>;
  }
  if (isError || !info) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>
        Este código no corresponde a una buseta activa. Pide ayuda al colector.
      </div>
    );
  }

  // Confirmación en verde: la "pantalla del pagado"
  if (pagar.isSuccess) {
    const r = pagar.data;
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
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ok-text)' }}>Pasaje pagado</div>
          <div style={{ fontSize: 40, fontWeight: 700, margin: '10px 0 2px' }}>{bs(r.tarifaBs)}</div>
          <div style={{ fontSize: 15, color: 'var(--text-soft)' }}>
            {r.linea} · Unidad {r.unidad}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-soft)' }}>{r.ruta}</div>
          {r.desde && r.hasta && (
            <div style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 12, padding: '10px 14px', fontSize: 14 }}>
              <div style={{ color: 'var(--text-soft)' }}>{r.desde.nombre} → {r.hasta.nombre}</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>Te bajas en {r.hasta.nombre}</div>
            </div>
          )}
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.04em', marginTop: 12 }}>
            {hora(r.hora)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>
            {r.hasta ? 'El colector y el conductor ven tu pago y dónde te bajas.' : 'El colector ve tu pago en su pantalla al instante.'}
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: 'var(--text-soft)' }}>
          Saldo restante: <strong>{bs(r.saldoBs)}</strong>
        </div>
        <button
          className={`${ui.btnSecondary}`}
          style={{ width: '100%', marginTop: 14 }}
          onClick={() => navigate('/cuenta/wallet')}
        >
          Ir a mi wallet
        </button>
      </div>
    );
  }

  // Jornada no iniciada: el QR no cobra (estilo Uber — el conductor debe
  // "Iniciar ruta" en su app). El refetch de 10 s lo despierta solo.
  if (!info.enServicio || !info.ruta) {
    return (
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '32px 16px' }}>
        <div className={ui.card} style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🚌</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            Esta buseta no está en servicio en este momento
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-soft)', marginTop: 8 }}>
            {info.linea.nombre} · Unidad {info.unidad.numero}{info.ruta ? ` · ${info.ruta.nombre}` : ''}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 14, lineHeight: 1.5 }}>
            {info.ruta
              ? 'El cobro se activa cuando el conductor inicia su ruta. Si estás a bordo, avísale al colector. Esta pantalla se actualiza sola.'
              : 'Esta buseta todavía no tiene una ruta de cobro configurada por su línea.'}
          </div>
        </div>
        {info.ruta?.documentId && (
          <button
            className={ui.btnSecondary}
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => navigate(`/mapa/${info.ruta?.documentId}`)}
          >
            🗺 Ver la ruta en el mapa
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', padding: '32px 16px' }}>
      <div className={ui.card} style={{ padding: 26, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>{info.linea.nombre}</div>
        <div style={{ fontSize: 22, fontWeight: 700, margin: '4px 0' }}>Unidad {info.unidad.numero}</div>
        <div style={{ fontSize: 14, color: 'var(--text-soft)', marginBottom: info.ruta.letreros?.length ? 8 : 18 }}>{info.ruta.nombre}</div>
        {info.ruta.letreros?.length ? <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'center' }}><Letrero letreros={info.ruta.letreros} /></div> : null}
        {porTramos && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'left', marginBottom: 14 }}>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Me subo en</span>
              <select className={ui.fieldInput} value={desde ?? ''} onChange={(e) => setDesde(Number(e.target.value))}>
                {info.ruta.paradas.map((p) => (
                  <option key={p.orden} value={p.orden}>{p.nombre}</option>
                ))}
              </select>
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Me bajo en</span>
              <select className={ui.fieldInput} value={hasta ?? ''} onChange={(e) => setHasta(Number(e.target.value))}>
                {info.ruta.paradas.map((p) => (
                  <option key={p.orden} value={p.orden}>{p.nombre}</option>
                ))}
              </select>
            </label>
            {desde !== null && hasta !== null && desde === hasta && (
              <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--warn-text, #92400E)' }}>Elige una parada distinta para bajarte.</div>
            )}
            {info.ruta.circuito && desde !== null && hasta !== null && hasta < desde && (
              <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text-soft)' }}>La buseta da la vuelta: pasa por el origen y sigue hasta {nombreParada(hasta)}.</div>
            )}
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>{porTramos ? `Pasaje ${nombreParada(desde)} → ${nombreParada(hasta)}` : 'Pasaje'}</div>
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 18 }}>
          {tramoListo || !porTramos ? bs(precioBs) : '—'}
        </div>

        {!usuario ? (
          <button
            className={`${ui.btnPrimary} ${ui.btnPrimaryLg}`}
            style={{ width: '100%' }}
            onClick={() => navigate(`/ingresar?next=${encodeURIComponent(`/pagar/${unidadId}`)}`)}
          >
            Ingresar para pagar
          </button>
        ) : (
          <>
            <button
              className={`${ui.btnPrimary} ${ui.btnPrimaryLg}`}
              style={{ width: '100%' }}
              disabled={pagar.isPending || (porTramos && !tramoListo)}
              onClick={() => {
                setError(null);
                pagar.mutate();
              }}
            >
              {pagar.isPending ? 'Pagando…' : `Pagar con mi wallet · saldo ${bs(wallet?.saldoBs ?? 0)}`}
            </button>
            {error && (
              <div style={{ fontSize: 13, color: 'var(--bad-text)', marginTop: 12 }}>
                {error}{' '}
                <a href="/cuenta/wallet" style={{ fontWeight: 700 }}>
                  Recargar
                </a>
              </div>
            )}
          </>
        )}
      </div>
      {info.ruta?.documentId && (
        <button
          className={ui.btnSecondary}
          style={{ width: '100%', marginTop: 12 }}
          onClick={() => navigate(`/mapa/${info.ruta?.documentId}`)}
        >
          🗺 Ver la ruta y las busetas en el mapa
        </button>
      )}
      <p style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
        Escaneaste el código QR de esta buseta. El pago se descuenta de tu wallet Butaca y el
        colector lo ve entrar en su pantalla.
      </p>
    </div>
  );
}
