import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { emitirBoletos, getMapaAsientos, getMetodosPago, getWallet } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { hora, fechaCorta } from '../../lib/time';
import { Field } from '../../components/ui/Field';
import { TicketCard } from '../../components/ticket/TicketCard';
import { ReservationTimer } from '../../components/ui/ReservationTimer';
import { useBooking } from './useBooking';
import { useAuth } from '../../stores/auth';
import type { MetodoPago } from '../../lib/api/types';
import ui from '../../components/ui/ui.module.css';
import styles from './public.module.css';

const METODOS: { id: MetodoPago; moneda: 'BS' | 'USD' | 'COP'; label: string; sub: string }[] = [
  { id: 'pago_movil', moneda: 'BS', label: 'Pago Móvil', sub: 'Bs · C2P' },
  { id: 'zelle', moneda: 'USD', label: 'Zelle / divisas', sub: 'USD' },
  { id: 'transferencia', moneda: 'BS', label: 'Transferencia', sub: 'Banco nacional' },
  { id: 'tarjeta_cop', moneda: 'COP', label: 'Tarjeta COP', sub: 'Pesos' },
];

export default function Checkout() {
  const navigate = useNavigate();
  const {
    salidaId,
    reservaToken,
    reservaExpiraEn,
    serverOffsetMs,
    pasajeros,
    setPasajero,
    metodoPago,
    setMetodoPago,
    reiniciar,
  } = useBooking();
  const [expirada, setExpirada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referencia, setReferencia] = useState('');

  // Cliente con sesión: prefill del primer pasajero y método guardado
  const usuario = useAuth((s) => s.usuario);
  const esCliente = usuario?.role?.type === 'cliente';
  const { data: metodosGuardados } = useQuery({
    queryKey: ['metodos-pago'],
    queryFn: getMetodosPago,
    enabled: esCliente,
  });
  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: getWallet,
    enabled: esCliente,
  });
  const prefillHecho = useRef(false);
  useEffect(() => {
    if (!esCliente || prefillHecho.current || !pasajeros.length) return;
    prefillHecho.current = true;
    if (!pasajeros[0].nombre && usuario?.nombreCorto) {
      setPasajero(0, {
        nombre: usuario.nombreCorto,
        documento: usuario.documento ?? '',
        telefono: usuario.telefono ?? '',
      });
    }
    const predeterminado = metodosGuardados?.find((m) => m.predeterminado) ?? metodosGuardados?.[0];
    if (predeterminado) setMetodoPago(predeterminado.tipo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esCliente, metodosGuardados, pasajeros.length]);

  const { data: mapa } = useQuery({
    queryKey: ['mapa', salidaId],
    queryFn: () => getMapaAsientos(salidaId!),
    enabled: Boolean(salidaId),
  });

  const emitir = useMutation({
    mutationFn: () => {
      const metodo =
        metodoPago === 'wallet'
          ? { id: 'wallet' as MetodoPago, moneda: 'BS' as const }
          : METODOS.find((m) => m.id === metodoPago)!;
      return emitirBoletos({
        reservaToken: reservaToken!,
        pasajeros: pasajeros.map((p) => ({
          asientoId: p.asientoId,
          nombre: p.nombre,
          documento: p.documento,
          telefono: p.telefono,
          equipajePiezas: 1,
        })),
        pago: {
          metodoPago: metodo.id,
          monedaPago: metodo.moneda,
          referencia: metodo.id === 'wallet' ? undefined : referencia,
        },
      });
    },
    onSuccess: (r) => {
      reiniciar();
      navigate(`/boleto/${r.boletos[0].qrId}`, {
        state: { grupo: r.boletos.map((b) => ({ qrId: b.qrId, asientoId: b.asientoId })) },
      });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'reserva_expirada') setExpirada(true);
      else if (e instanceof ApiError && e.code === 'saldo_insuficiente') {
        const d = e.details as { saldoBs?: number; requeridoBs?: number };
        setError(
          `Saldo insuficiente: tienes Bs ${(d.saldoBs ?? 0).toLocaleString('es-VE')} y el total es Bs ${(d.requeridoBs ?? 0).toLocaleString('es-VE')}. Recarga tu wallet o usa otro método.`
        );
      } else setError('No se pudo emitir el boleto. Revisa los datos e intenta de nuevo.');
    },
  });

  if (!salidaId || !reservaToken || !pasajeros.length) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)', fontSize: 14 }}>
        No hay una compra en curso. <a href="/salidas">Busca tu salida</a>.
      </div>
    );
  }

  const s = mapa?.salida;
  const precios = mapa?.preciosUsd ?? {};
  const recargos = mapa?.recargosUsd ?? { tasaTerminal: 0, seguro: 0 };
  const subtotal = pasajeros.reduce((acc, p) => acc + Number(precios[p.claseServicio] ?? 0), 0);
  const total = subtotal + pasajeros.length * (recargos.tasaTerminal + recargos.seguro);
  const totalBs = Math.round(total * (mapa?.tasas?.bcv ?? 0) * 100) / 100;
  const saldoBs = wallet?.saldoBs ?? 0;
  const walletAlcanza = saldoBs >= totalBs && totalBs > 0;
  const datosCompletos = pasajeros.every((p) => p.nombre.trim().length > 2 && p.documento.trim().length > 4);

  const pisoLabel = [...new Set(pasajeros.map((p) => p.piso))].join(' · ');

  return (
    <div className={styles.layoutCheckout}>
      <div>
        <button className={ui.btnGhost} onClick={() => navigate(-1)}>
          ← Regresar al mapa
        </button>
        <h2 className={styles.resultadosH2} style={{ margin: '10px 0 4px' }}>
          Datos de los pasajeros
        </h2>
        <p className={styles.resultadosSub} style={{ margin: 0 }}>
          Nombre y cédula deben coincidir con el documento que presente al abordar.
        </p>

        <div style={{ marginTop: 16 }}>
          <ReservationTimer
            variant="web"
            expiraEn={reservaExpiraEn!}
            serverOffsetMs={serverOffsetMs}
            onExpire={() => setExpirada(true)}
          />
        </div>

        {expirada && (
          <div
            style={{
              marginTop: 14,
              background: 'var(--bad-bg)',
              color: 'var(--bad-text)',
              borderRadius: 'var(--r-14)',
              padding: '12px 14px',
              fontSize: 13,
            }}
          >
            La reserva expiró y los puestos se liberaron.{' '}
            <a href={`/salidas/${salidaId}/asientos`}>Vuelve a escogerlos</a>.
          </div>
        )}

        {pasajeros.map((p, i) => (
          <div key={p.asientoId} className={styles.tarjetaPasajero}>
            <div className={styles.pasajeroCabecera}>
              <span className={styles.pasajeroCuadro}>{p.asientoId}</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Pasajero {i + 1}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-faint)' }}>
                {p.claseServicio === 'vip' ? 'VIP Cama' : p.claseServicio === 'semicama' ? 'Semicama' : p.claseServicio}
              </span>
            </div>
            <div className={styles.pasajeroCampos}>
              <Field
                label="Nombre y apellido"
                value={p.nombre}
                onChange={(e) => setPasajero(i, { nombre: e.target.value })}
                placeholder="Como aparece en la cédula"
              />
              <Field
                label="Cédula o pasaporte"
                value={p.documento}
                onChange={(e) => setPasajero(i, { documento: e.target.value })}
                placeholder="V-00.000.000"
              />
              <Field
                label="Teléfono"
                value={p.telefono}
                onChange={(e) => setPasajero(i, { telefono: e.target.value })}
                placeholder="0414 000 0000"
              />
            </div>
          </div>
        ))}

        <h3 style={{ margin: '28px 0 12px', fontSize: 20, fontWeight: 700 }}>Forma de pago</h3>
        <div className={styles.metodosPago}>
          {esCliente && (
            <button
              className={`${styles.metodoPago} ${metodoPago === 'wallet' ? styles.metodoPagoActivo : ''}`}
              disabled={!walletAlcanza}
              style={!walletAlcanza ? { opacity: 0.55 } : undefined}
              onClick={() => setMetodoPago('wallet')}
            >
              <span className={styles.metodoLabel}>Wallet Butaca ⚡</span>
              <span className={styles.metodoSub}>
                {walletAlcanza
                  ? `Saldo Bs ${saldoBs.toLocaleString('es-VE')} · pago instantáneo`
                  : `Saldo Bs ${saldoBs.toLocaleString('es-VE')} · insuficiente`}
              </span>
            </button>
          )}
          {METODOS.map((m) => (
            <button
              key={m.id}
              className={`${styles.metodoPago} ${metodoPago === m.id ? styles.metodoPagoActivo : ''}`}
              onClick={() => setMetodoPago(m.id)}
            >
              <span className={styles.metodoLabel}>{m.label}</span>
              <span className={styles.metodoSub}>{m.sub}</span>
            </button>
          ))}
        </div>

        {metodoPago === 'wallet' ? (
          <p style={{ fontSize: 13, color: 'var(--blue-700)', background: 'var(--tint-50)', borderRadius: 12, padding: '10px 14px', marginTop: 16, maxWidth: 460 }}>
            Se descuentan Bs {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} de tu
            wallet y el boleto sale <strong>pagado al instante</strong> — sin referencias ni espera
            de verificación.
          </p>
        ) : (
          <div style={{ marginTop: 16, maxWidth: 420 }}>
            <Field
              label="Referencia del pago (nro. de operación o confirmación)"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej. 00482913"
            />
            <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8, lineHeight: 1.5 }}>
              Tu boleto se emite de inmediato y la línea verifica el pago contra su banco antes de la
              salida. Guarda tu comprobante.
            </p>
          </div>
        )}
      </div>

      <div>
        <TicketCard
          data={{
            folio: 'Por emitir',
            lineaNombre: s?.linea?.nombre ?? '',
            origen: s?.ruta?.origen ?? '',
            destino: s?.ruta?.destino ?? '',
            fecha: s ? fechaCorta(s.fechaHoraSalida) : '',
            salidaHora: s ? hora(s.fechaHoraSalida) : '',
            llegadaHora: s ? hora(s.fechaHoraLlegada) : '',
            puestos: pasajeros.map((p) => p.asientoId).join('·'),
            piso: pisoLabel,
            rampa: s?.rampa?.replace('Rampa ', ''),
            aborda: s ? hora(new Date(new Date(s.fechaHoraSalida).getTime() - 40 * 60000).toISOString()) : undefined,
            codigo: 'Se genera al emitir',
            totalUsd: total,
          }}
          footer={
            <>
              {error && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--bad-text)' }}>{error}</div>
              )}
              <button
                className={`${ui.btnPrimary} ${ui.btnPrimaryLg}`}
                style={{ marginTop: 12 }}
                disabled={!datosCompletos || (metodoPago !== 'wallet' && !referencia.trim()) || expirada || emitir.isPending}
                onClick={() => emitir.mutate()}
              >
                {emitir.isPending ? 'Emitiendo…' : 'Confirmar y emitir'}
              </button>
              <button className={ui.btnSecondary} style={{ width: '100%', marginTop: 8 }}>
                Enviar por WhatsApp · descargar PDF
              </button>
            </>
          }
        />
      </div>
    </div>
  );
}
