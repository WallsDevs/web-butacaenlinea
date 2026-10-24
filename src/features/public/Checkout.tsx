import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { adjuntarComprobante, emitirBoletos, getDatosPago, getMapaAsientos, getWallet, type DatosPagoPlataforma } from '../../lib/api/endpoints';
import { ApiError, esSinConexion } from '../../lib/api/client';
import { hora, fechaCorta } from '../../lib/time';
import { Field } from '../../components/ui/Field';
import { TicketCard } from '../../components/ticket/TicketCard';
import { ReservationTimer } from '../../components/ui/ReservationTimer';
import { useBooking } from './useBooking';
import { useAuth } from '../../stores/auth';
import type { MetodoPago } from '../../lib/api/types';
import ui from '../../components/ui/ui.module.css';
import styles from './public.module.css';

/**
 * Por qué no se pudo emitir, dicho para el pasajero. Lo que no esté aquí
 * muestra su código, para poder rastrearlo (antes todo decía «revisa los datos»).
 */
function motivoEmision(e: unknown): string {
  if (esSinConexion(e) || !(e instanceof ApiError)) return 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo; tus puestos siguen apartados mientras corre el tiempo.';
  switch (e.code) {
    case 'linea_sin_venta':
      return 'Esta línea no está vendiendo en línea en este momento. Compra en la taquilla del terminal o escoge otra salida.';
    case 'sistema_de_la_linea_no_responde':
      return 'El sistema de la línea no respondió. No se cobró nada: intenta de nuevo en un momento.';
    case 'asientos_no_disponibles':
      return 'Alguien tomó uno de tus puestos. Regresa al mapa y escoge otro.';
    case 'asientos_fuera_de_reserva':
    case 'reserva_no_encontrada':
      return 'Tu apartado de puestos ya no está vigente. Regresa al mapa y escógelos de nuevo.';
    case 'pasajeros_invalidos':
      return 'Falta el nombre de algún pasajero.';
    case 'wallet_requiere_sesion':
      return 'Para pagar con tu wallet tienes que ingresar a tu cuenta.';
    case 'payload_invalido':
      return 'Falta algún dato del pago. Revisa el método y la referencia.';
    case 'referencia_requerida':
      return 'Escribe la referencia de tu pago a Butaca.';
    case 'referencia_duplicada':
      return 'Esa referencia ya se usó en otro pago. Revisa el número de operación.';
    case 'salida_no_vendible':
      return 'Esta salida ya no está a la venta (se canceló o ya partió). Busca otra; no se te cobró nada.';
    case 'metodo_no_permitido':
      return 'Por la web se paga con tu wallet o a las cuentas de Butaca. Escoge Pago Móvil, transferencia o Zelle.';
    case 'demasiadas_solicitudes':
    case 'demasiados_intentos':
      return 'Demasiados intentos seguidos. Espera un minuto e intenta de nuevo.';
    default:
      return `No se pudo emitir el boleto (${e.status || 'sin conexión'} · ${e.code}). Si sigue pasando, escríbenos por WhatsApp con este código.`;
  }
}

/** Sin cuenta se paga directo a las cuentas de Butaca. Con cuenta, todo va por la wallet. */
const METODOS: { id: MetodoPago; moneda: 'BS' | 'USD'; label: string; sub: string }[] = [
  { id: 'pago_movil', moneda: 'BS', label: 'Pago Móvil', sub: 'Bolívares' },
  { id: 'transferencia', moneda: 'BS', label: 'Transferencia', sub: 'Bolívares' },
  { id: 'zelle', moneda: 'USD', label: 'Zelle', sub: 'Dólares' },
];

const fmtBs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const copiar = (t: string) => void navigator.clipboard?.writeText(t).catch(() => {});

/** Los datos de la cuenta de Butaca a la que paga, con el monto exacto y botones de copiar. */
function CuentaButaca({ metodo, datos, monto }: { metodo: MetodoPago; datos: DatosPagoPlataforma | undefined; monto: string }) {
  const filas: [string, string][] =
    metodo === 'pago_movil' && datos?.pagoMovil
      ? [['Banco', datos.pagoMovil.banco], ['Teléfono', datos.pagoMovil.telefono], ['Cédula o RIF', datos.pagoMovil.documento], ...(datos.pagoMovil.titular ? ([['Titular', datos.pagoMovil.titular]] as [string, string][]) : [])]
      : metodo === 'transferencia' && datos?.transferencia
        ? [['Banco', datos.transferencia.banco], ['Cuenta', datos.transferencia.cuenta], ['Titular', datos.transferencia.titular], ...(datos.transferencia.documento ? ([['Cédula o RIF', datos.transferencia.documento]] as [string, string][]) : [])]
        : metodo === 'zelle' && datos?.zelle
          ? [['Correo Zelle', datos.zelle.correo], ...(datos.zelle.titular ? ([['Titular', datos.zelle.titular]] as [string, string][]) : [])]
          : [];
  if (!filas.length) {
    return (
      <p style={{ fontSize: 13, color: 'var(--warn-text)', background: 'var(--warn-bg)', borderRadius: 12, padding: '10px 14px', marginTop: 14 }}>
        Butaca todavía no publicó estos datos de pago. Escoge otro método o escríbenos por WhatsApp.
      </p>
    );
  }
  return (
    <div style={{ marginTop: 14, borderRadius: 14, border: '1px solid var(--tint-200)', background: 'var(--tint-50)', padding: '12px 14px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue-700)', marginBottom: 6 }}>Paga a Butaca En Línea</div>
      {filas.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, padding: '3px 0' }}>
          <span style={{ color: 'var(--text-faint)', minWidth: 96 }}>{k}</span>
          <strong style={{ flex: 1, wordBreak: 'break-all' }}>{v}</strong>
          <button type="button" className={ui.btnGhost} style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => copiar(v)}>Copiar</button>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, padding: '6px 0 0', borderTop: '1px solid var(--tint-200)', marginTop: 6 }}>
        <span style={{ color: 'var(--text-faint)', minWidth: 96 }}>Monto</span>
        <strong style={{ flex: 1, fontSize: 16 }}>{monto}</strong>
        <button type="button" className={ui.btnGhost} style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => copiar(monto.replace(/[^0-9,.]/g, ''))}>Copiar</button>
      </div>
    </div>
  );
}

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
  // La captura del pago a Butaca (recarga o pago directo): Butaca la ve al verificar
  const [captura, setCaptura] = useState<File | null>(null);
  // Con wallet sin saldo: por dónde recarga el faltante (en bolívares)
  const [medioRecarga, setMedioRecarga] = useState<'pago_movil' | 'transferencia'>('pago_movil');

  // Con cuenta todo se paga con la wallet; sin cuenta, directo a Butaca
  const usuario = useAuth((s) => s.usuario);
  const esCliente = usuario?.role?.type === 'cliente';
  const { data: wallet, refetch: refrescarWallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: getWallet,
    enabled: esCliente,
  });
  const { data: datosPago } = useQuery({ queryKey: ['datos-pago'], queryFn: getDatosPago, staleTime: 600_000 });
  const prefillHecho = useRef(false);
  useEffect(() => {
    if (esCliente && metodoPago !== 'wallet') setMetodoPago('wallet');
    if (!esCliente && (metodoPago === 'wallet' || !METODOS.some((m) => m.id === metodoPago))) setMetodoPago('pago_movil');
    if (!esCliente || prefillHecho.current || !pasajeros.length) return;
    prefillHecho.current = true;
    if (!pasajeros[0].nombre && usuario?.nombreCorto) {
      setPasajero(0, {
        nombre: usuario.nombreCorto,
        documento: usuario.documento ?? '',
        telefono: usuario.telefono ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esCliente, pasajeros.length]);

  const { data: mapa } = useQuery({
    queryKey: ['mapa', salidaId],
    queryFn: () => getMapaAsientos(salidaId!),
    enabled: Boolean(salidaId),
  });

  const totalUsdCompra = (() => {
    const pr = mapa?.preciosUsd ?? {};
    const rc = mapa?.recargosUsd ?? { tasaTerminal: 0, seguro: 0 };
    return pasajeros.reduce((acc, p) => acc + Number(pr[p.claseServicio] ?? 0), 0) + pasajeros.length * (rc.tasaTerminal + rc.seguro);
  })();
  const totalBsCompra = Math.round(totalUsdCompra * (mapa?.tasas?.bcv ?? 0) * 100) / 100;
  const saldoBs = wallet?.saldoBs ?? 0;
  const walletAlcanza = totalBsCompra > 0 && saldoBs >= totalBsCompra;
  const faltanteBs = Math.ceil(Math.max(totalBsCompra - Math.max(saldoBs, 0), 0) * 100) / 100;

  const emitir = useMutation({
    // Sin respuesta (señal cortada) se reintenta solo: el servidor reconoce la misma reserva y
    // devuelve los boletos ya emitidos, sin cobrar dos veces
    retry: (n, e) => esSinConexion(e) && n < 2,
    mutationFn: () => {
      const metodo = esCliente ? { id: 'wallet' as MetodoPago, moneda: 'BS' as const } : (METODOS.find((m) => m.id === metodoPago) ?? METODOS[0]);
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
          referencia: metodo.id === 'wallet' ? undefined : referencia.trim(),
        },
        // Con wallet y saldo corto: el faltante se recarga a Butaca en esta misma compra
        ...(esCliente && !walletAlcanza ? { recarga: { referencia: referencia.trim(), banco: medioRecarga === 'pago_movil' ? 'Pago Móvil' : 'Transferencia' } } : {}),
      });
    },
    onSuccess: async (r) => {
      // La captura se adjunta a toda la compra (Butaca la ve al verificar); si falla, el boleto ya está emitido igual
      if (captura && (!esCliente || !walletAlcanza)) {
        await adjuntarComprobante(r.boletos.map((b) => b.qrId), captura).catch(() => undefined);
      }
      reiniciar();
      navigate(`/boleto/${r.boletos[0].qrId}`, {
        state: { grupo: r.boletos.map((b) => ({ qrId: b.qrId, asientoId: b.asientoId })) },
      });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'reserva_expirada') setExpirada(true);
      else if (e instanceof ApiError && e.code === 'saldo_insuficiente') {
        // El saldo cambió mientras compraba: se refresca y aparece la recarga del faltante
        void refrescarWallet();
        setError('Tu saldo cambió y ya no alcanza. Recarga el faltante a Butaca para apartar tus puestos.');
      } else setError(motivoEmision(e));
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
  const totalBs = totalBsCompra;
  const pideReferencia = !esCliente || !walletAlcanza;
  const metodoActual = METODOS.find((m) => m.id === metodoPago) ?? METODOS[0];
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

        <h3 style={{ margin: '28px 0 12px', fontSize: 20, fontWeight: 700 }}>Pago</h3>
        {esCliente ? (
          walletAlcanza ? (
            <p style={{ fontSize: 14, color: 'var(--blue-700)', background: 'var(--tint-50)', borderRadius: 12, padding: '12px 14px', maxWidth: 480, margin: 0 }}>
              Se descuentan <strong>{fmtBs(totalBs)}</strong> de tu wallet (saldo {fmtBs(saldoBs)}) y el boleto sale{' '}
              <strong>pagado al instante</strong>.
            </p>
          ) : (
            <div style={{ maxWidth: 480 }}>
              <p style={{ fontSize: 14, margin: '0 0 4px' }}>
                Tu saldo es {fmtBs(saldoBs)} y el total {fmtBs(totalBs)}. Recarga <strong>{fmtBs(faltanteBs)}</strong> a Butaca y tus puestos
                quedan apartados: el boleto se paga solo de tu wallet cuando Butaca confirme la recarga.
              </p>
              <div className={styles.metodosPago} style={{ marginTop: 10 }}>
                {(['pago_movil', 'transferencia'] as const).map((m) => (
                  <button key={m} type="button" className={`${styles.metodoPago} ${medioRecarga === m ? styles.metodoPagoActivo : ''}`} onClick={() => setMedioRecarga(m)}>
                    <span className={styles.metodoLabel}>{m === 'pago_movil' ? 'Pago Móvil' : 'Transferencia'}</span>
                    <span className={styles.metodoSub}>Bolívares</span>
                  </button>
                ))}
              </div>
              <CuentaButaca metodo={medioRecarga} datos={datosPago} monto={fmtBs(faltanteBs)} />
            </div>
          )
        ) : (
          <div style={{ maxWidth: 480 }}>
            <div className={styles.metodosPago}>
              {METODOS.map((m) => (
                <button key={m.id} type="button" className={`${styles.metodoPago} ${metodoPago === m.id ? styles.metodoPagoActivo : ''}`} onClick={() => setMetodoPago(m.id)}>
                  <span className={styles.metodoLabel}>{m.label}</span>
                  <span className={styles.metodoSub}>{m.sub}</span>
                </button>
              ))}
            </div>
            <CuentaButaca metodo={metodoActual.id} datos={datosPago} monto={metodoActual.moneda === 'USD' ? `$${total.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : fmtBs(totalBs)} />
            <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 10 }}>
              Con una <a href="/registro">cuenta</a> pagas con tu wallet al instante y tus boletos quedan guardados.
            </p>
          </div>
        )}

        {pideReferencia && (
          <div style={{ marginTop: 14, maxWidth: 420 }}>
            <Field
              label="Referencia del pago (nro. de operación o confirmación)"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej. 00482913"
            />
            <label className={ui.field} style={{ marginTop: 12 }}>
              <span className={ui.fieldLabel}>Captura del pago (recomendado)</span>
              <input
                className={ui.fieldInput}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setCaptura(e.target.files?.[0] ?? null)}
                style={{ padding: 10 }}
              />
              {captura && <span style={{ fontSize: 12, color: 'var(--ok-text)', marginTop: 4 }}>Adjunta: {captura.name}</span>}
            </label>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8, lineHeight: 1.5 }}>
              Tu boleto se emite de inmediato con el puesto apartado y queda «por verificar» hasta que Butaca confirme el pago
              contra su banco. Con la captura lo confirmamos más rápido.
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
                disabled={!datosCompletos || (pideReferencia && !referencia.trim()) || expirada || emitir.isPending || !totalBs}
                onClick={() => emitir.mutate()}
              >
                {emitir.isPending ? 'Emitiendo…' : esCliente && walletAlcanza ? `Pagar ${fmtBs(totalBs)} con mi wallet` : esCliente ? 'Recargar y apartar mis puestos' : 'Ya pagué · emitir mis boletos'}
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
