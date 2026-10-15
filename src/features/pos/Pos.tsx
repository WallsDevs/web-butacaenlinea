import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  abrirTurno,
  cancelarCobroTaquilla,
  crearCobroTaquilla,
  crearReserva,
  emitirBoletos,
  getArqueo,
  getBoletosPorVerificar,
  getCobroTaquilla,
  getMapaAsientos,
  getRutas,
  getSalidas,
  getTaquillas,
  getTurnoActual,
  liberarReserva,
} from '../../lib/api/endpoints';
import { QRCodeSVG } from 'qrcode.react';
import { ApiError } from '../../lib/api/client';
import { hora, hoyISO, rangoDia } from '../../lib/time';
import { useAuth } from '../../stores/auth';
import { Money, MoneyAlt } from '../../components/ui/Money';
import { Field } from '../../components/ui/Field';
import { PillTabs } from '../../components/ui/PillTabs';
import { ReservationTimer } from '../../components/ui/ReservationTimer';
import { SeatMap } from '../../components/seat-map/SeatMap';
import { TicketCard } from '../../components/ticket/TicketCard';
import { Isotipo } from '../../components/brand/LogoMark';
import { fechaCorta } from '../../lib/time';
import type { BoletoEmitido, MetodoPago } from '../../lib/api/types';
import ui from '../../components/ui/ui.module.css';
import styles from './pos.module.css';


const METODOS: { id: MetodoPago; moneda: 'BS' | 'USD' | 'COP'; label: string; sub: string }[] = [
  { id: 'efectivo_bs', moneda: 'BS', label: 'Efectivo Bs', sub: 'Caja' },
  { id: 'efectivo_usd', moneda: 'USD', label: 'Efectivo USD', sub: 'Divisas' },
  { id: 'pago_movil', moneda: 'BS', label: 'Pago Móvil', sub: 'Verificar referencia' },
  { id: 'transferencia', moneda: 'BS', label: 'Transferencia', sub: 'Verificar referencia' },
  { id: 'punto_venta', moneda: 'BS', label: 'Punto de venta', sub: 'Débito Bs' },
  { id: 'tarjeta_cop', moneda: 'COP', label: 'Pesos COP', sub: 'Tarjeta' },
  { id: 'wallet', moneda: 'BS', label: 'Wallet QR', sub: 'QR de caja' },
];

interface PasajeroPos {
  asientoId: string;
  nombre: string;
  documento: string;
}

export default function Pos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usuario = useAuth((s) => s.usuario);

  const [destino, setDestino] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [salidaId, setSalidaId] = useState<string | null>(null);
  const [pisoActivo, setPisoActivo] = useState(1);
  const [pasajeros, setPasajeros] = useState<PasajeroPos[]>([]);
  const [reserva, setReserva] = useState<{ token: string; expiraEn: string; serverOffsetMs: number } | null>(null);
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo_bs');
  const [error, setError] = useState<string | null>(null);
  const [emitidos, setEmitidos] = useState<BoletoEmitido[] | null>(null);
  // Cobro wallet publicado en el QR fijo de la caja (esperando al pasajero)
  const [cobro, setCobro] = useState<{ documentId: string; totalBs: number; expiraEn: string } | null>(null);
  const [qrCajaAbierto, setQrCajaAbierto] = useState(false);
  const buscarRef = useRef<HTMLInputElement>(null);

  // Turno abierto del cajero
  const { data: turno, isLoading: cargandoTurno } = useQuery({
    queryKey: ['turno-actual'],
    queryFn: getTurnoActual,
  });

  // Destinos REALES de la línea (accesos rápidos del buscador)
  const { data: rutasLinea } = useQuery({
    queryKey: ['rutas', usuario?.linea?.slug],
    queryFn: () => getRutas(usuario?.linea?.slug),
    enabled: Boolean(usuario?.linea?.slug),
  });
  const destinosLinea = useMemo(
    () => [...new Set((rutasLinea ?? []).map((r) => r.destino).filter(Boolean))].sort() as string[],
    [rutasLinea]
  );

  // Abrir turno con un clic: la taquilla fija del cajero o la primera de la empresa
  const abrir = useMutation({
    mutationFn: async () => {
      let taquillaId = usuario?.taquilla?.documentId;
      if (!taquillaId) {
        const ts = await getTaquillas();
        if (!ts.length) throw new ApiError(400, 'sin_taquillas');
        taquillaId = ts[0].documentId;
      }
      return abrirTurno(taquillaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turno-actual'] });
      setError(null);
    },
    onError: (e) =>
      setError(
        e instanceof ApiError && e.code === 'sin_taquillas'
          ? 'Tu empresa no tiene taquillas: créala al agregar un cajero en Personal.'
          : e instanceof ApiError && e.code === 'turno_ya_abierto'
            ? 'Esa taquilla ya tiene un turno abierto (quizá de otro cajero). Ciérrenlo primero o usa otra taquilla.'
            : 'No se pudo abrir el turno.'
      ),
  });

  // Salidas del día para el destino
  const { desde, hasta } = rangoDia(fecha);
  const { data: salidas } = useQuery({
    queryKey: ['pos-salidas', usuario?.linea?.slug, destino, fecha],
    queryFn: () => getSalidas({ destino, desde, hasta, lineaSlug: usuario?.linea?.slug }),
  });

  useEffect(() => {
    if (!salidaId && salidas?.length) setSalidaId(salidas[0].documentId);
  }, [salidas, salidaId]);

  // Mapa con polling corto (el POS comparte el mapa con la web)
  const { data: mapa } = useQuery({
    queryKey: ['mapa', salidaId],
    queryFn: () => getMapaAsientos(salidaId!),
    refetchInterval: 5000,
    enabled: Boolean(salidaId),
  });

  // Arqueo en vivo de la barra inferior
  const { data: arqueo } = useQuery({
    queryKey: ['arqueo', turno?.documentId],
    queryFn: () => getArqueo(turno!.documentId),
    enabled: Boolean(turno),
    refetchInterval: 15000,
  });

  // Pagos web pendientes de verificar (pago manual)
  const { data: porVerificar } = useQuery({
    queryKey: ['por-verificar'],
    queryFn: getBoletosPorVerificar,
    refetchInterval: 20000,
  });

  const seleccionados = pasajeros.map((p) => p.asientoId);

  // Reservar/rehacer el hold con la selección completa (debounce corto).
  // El temporizador SOLO refleja el expiraEn que devuelve el servidor.
  const rehacerHold = useMutation({
    mutationFn: async (asientos: string[]) => {
      if (reserva) await liberarReserva(reserva.token).catch(() => {});
      if (!asientos.length) return null;
      return crearReserva(salidaId!, asientos);
    },
    onSuccess: (r) => {
      if (!r) return setReserva(null);
      setReserva({
        token: r.token,
        expiraEn: r.expiraEn,
        serverOffsetMs: new Date(r.serverTime).getTime() - Date.now(),
      });
    },
    onError: (e) => {
      setReserva(null);
      if (e instanceof ApiError && e.code === 'asientos_no_disponibles') {
        const tomados = (e.details as { asientos?: string[] })?.asientos ?? [];
        setError(`Puesto${tomados.length === 1 ? '' : 's'} ${tomados.join(', ')} ya no disponible${tomados.length === 1 ? '' : 's'}.`);
        setPasajeros((ps) => ps.filter((p) => !tomados.includes(p.asientoId)));
        queryClient.invalidateQueries({ queryKey: ['mapa', salidaId] });
      }
    },
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toggleAsiento = (id: string) => {
    setError(null);
    setEmitidos(null);
    setPasajeros((ps) => {
      const existe = ps.some((p) => p.asientoId === id);
      const siguiente = existe
        ? ps.filter((p) => p.asientoId !== id)
        : [...ps, { asientoId: id, nombre: '', documento: '' }].sort((a, b) =>
            a.asientoId.localeCompare(b.asientoId)
          );
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        rehacerHold.mutate(siguiente.map((p) => p.asientoId));
      }, 450);
      return siguiente;
    });
  };

  const liberarTodo = () => {
    if (reserva) liberarReserva(reserva.token).catch(() => {});
    setReserva(null);
    setPasajeros([]);
    setError(null);
    queryClient.invalidateQueries({ queryKey: ['mapa', salidaId] });
  };

  // Emisión F9
  const emitir = useMutation({
    mutationFn: () => {
      const m = METODOS.find((x) => x.id === metodo)!;
      return emitirBoletos({
        reservaToken: reserva!.token,
        pasajeros: pasajeros.map((p) => ({
          asientoId: p.asientoId,
          nombre: p.nombre,
          documento: p.documento,
          equipajePiezas: 1,
        })),
        pago: { metodoPago: m.id, monedaPago: m.moneda },
        turnoId: turno!.documentId,
      });
    },
    onSuccess: (r) => {
      setEmitidos(r.boletos);
      setPasajeros([]);
      setReserva(null);
      queryClient.invalidateQueries({ queryKey: ['mapa', salidaId] });
      queryClient.invalidateQueries({ queryKey: ['arqueo'] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'reserva_expirada') {
        setError('La reserva expiró: los puestos se liberaron.');
        setReserva(null);
      } else setError('No se pudo emitir. Verifica turno y datos.');
    },
  });

  // Wallet QR: en vez de emitir, publica el cobro en el QR fijo de la caja
  // y espera a que el pasajero lo pague desde su teléfono
  const esWallet = metodo === 'wallet';
  const publicarCobro = useMutation({
    mutationFn: () =>
      crearCobroTaquilla({
        reservaToken: reserva!.token,
        pasajeros: pasajeros.map((p) => ({ asientoId: p.asientoId, nombre: p.nombre, documento: p.documento })),
        turnoId: turno!.documentId,
      }),
    onSuccess: (r) => {
      setError(null);
      setCobro({ documentId: r.documentId, totalBs: r.totalBs, expiraEn: r.expiraEn });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'reserva_invalida') {
        setError('La reserva expiró: los puestos se liberaron.');
        setReserva(null);
      } else setError('No se pudo publicar el cobro. Verifica turno y datos.');
    },
  });
  const { data: cobroEstado } = useQuery({
    queryKey: ['cobro-pos', cobro?.documentId],
    queryFn: () => getCobroTaquilla(cobro!.documentId),
    enabled: Boolean(cobro),
    refetchInterval: 2500,
  });
  useEffect(() => {
    if (!cobro || !cobroEstado) return;
    if (cobroEstado.estado === 'pagado' && cobroEstado.resultado) {
      setEmitidos(cobroEstado.resultado.boletos as BoletoEmitido[]);
      setCobro(null);
      setPasajeros([]);
      setReserva(null);
      queryClient.invalidateQueries({ queryKey: ['mapa', salidaId] });
      queryClient.invalidateQueries({ queryKey: ['arqueo'] });
    } else if (cobroEstado.estado === 'expirado' || cobroEstado.estado === 'cancelado') {
      setCobro(null);
      setError(
        cobroEstado.estado === 'expirado'
          ? 'El cobro expiró sin pagarse: los puestos se liberaron.'
          : 'El cobro fue cancelado.'
      );
      setReserva(null);
      setPasajeros([]);
      queryClient.invalidateQueries({ queryKey: ['mapa', salidaId] });
    }
  }, [cobroEstado]); // eslint-disable-line react-hooks/exhaustive-deps
  const cancelarCobro = useMutation({
    mutationFn: () => cancelarCobroTaquilla(cobro!.documentId),
    onSettled: () => setCobro(null),
  });

  const taquillaCajaId = turno?.taquilla?.documentId ?? usuario?.taquilla?.documentId ?? null;

  const datosCompletos = pasajeros.length > 0 && pasajeros.every((p) => p.nombre.trim().length > 2);
  const puedeEmitir = Boolean(
    reserva && turno && datosCompletos && !emitir.isPending && !publicarCobro.isPending && !cobro
  );
  const accionPrincipal = () => (esWallet ? publicarCobro.mutate() : emitir.mutate());

  // Atajos F2 / F9
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        buscarRef.current?.focus();
      }
      if (e.key === 'F9' && puedeEmitir) {
        e.preventDefault();
        accionPrincipal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [puedeEmitir, esWallet]); // eslint-disable-line react-hooks/exhaustive-deps

  const salida = salidas?.find((s) => s.documentId === salidaId);
  const piso = mapa?.pisos.find((p) => p.numero === pisoActivo) ?? mapa?.pisos[0];

  const precios = mapa?.preciosUsd ?? {};
  const clasePorAsiento = useMemo(() => {
    const m = new Map<string, { clase: string; nombre: string; precio: number }>();
    for (const p of mapa?.pisos ?? []) {
      for (const f of p.filas) {
        for (const a of [...f.izquierda, ...f.derecha]) {
          m.set(a.id, { clase: p.claseServicio, nombre: p.nombre, precio: Number(precios[p.claseServicio] ?? 0) });
        }
      }
    }
    return m;
  }, [mapa, precios]);

  const subtotal = seleccionados.reduce((s, id) => s + (clasePorAsiento.get(id)?.precio ?? 0), 0);
  const recargos = mapa?.recargosUsd ?? { tasaTerminal: 0, seguro: 0 };
  const tasa = recargos.tasaTerminal * seleccionados.length;
  const total = subtotal + tasa + recargos.seguro * seleccionados.length;

  const efectivoBs = arqueo?.porMetodo.find((m) => m.metodoPago === 'efectivo_bs')?.monto ?? 0;
  const divisas = arqueo?.porMetodo.find((m) => m.metodoPago === 'efectivo_usd')?.monto ?? 0;

  if (cargandoTurno) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando POS…</div>;
  }

  return (
    <div className={styles.marco}>
      <div className={styles.ventana}>
        {/* Cabecera navy */}
        <div className={styles.cabecera}>
          <span className={styles.cabeceraIso} style={{ color: '#fff' }}>
            <Isotipo size={20} fondo="navy" />
          </span>
          <span className={styles.cabeceraTitulo}>
            Taquilla · {turno?.taquilla?.terminal || usuario?.linea?.nombre || 'Taquilla'}
          </span>
          <span className={styles.cabeceraMeta}>
            {turno?.taquilla?.nombre ?? 'Sin turno'} · {usuario?.nombreCorto ?? usuario?.username}
            {turno ? ` · Turno desde ${hora(turno.abiertoEn)}` : ''}
          </span>
          {!turno && !cargandoTurno && (
            <button
              style={{
                marginLeft: 10,
                background: '#fff',
                color: 'var(--navy)',
                fontWeight: 700,
                fontSize: 13,
                padding: '8px 16px',
                borderRadius: 10,
              }}
              disabled={abrir.isPending}
              onClick={() => abrir.mutate()}
            >
              {abrir.isPending ? 'Abriendo…' : 'Abrir turno'}
            </button>
          )}
          {turno && (
            <button
              style={{
                marginLeft: 10,
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                padding: '8px 16px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.35)',
              }}
              onClick={() => navigate('/pos/cierre')}
            >
              Cerrar turno
            </button>
          )}
          {turno && (
            <span className={styles.folioPill}>
              <span className={styles.folioLabel}>{arqueo?.folios?.hasta ? 'Folio' : 'Serie'}</span>
              <span className={styles.folioValor}>
                {arqueo?.folios?.hasta ?? turno?.taquilla?.serieFolio ?? '—'}
              </span>
            </span>
          )}
        </div>

        <div className={styles.cuerpo}>
          {/* Panel izquierdo */}
          <div className={styles.panelIzq}>
            <div className={styles.criterios}>
              <label className={ui.field}>
                <span className={ui.fieldLabel}>Destino</span>
                <input
                  ref={buscarRef}
                  className={`${ui.fieldInput} ${ui.fieldInputPos}`}
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  style={{ fontWeight: 700 }}
                />
              </label>
              <Field label="Fecha" size="pos" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              <Field label="Puestos" size="pos" value={String(seleccionados.length || '')} readOnly />
              <button className={ui.btnPrimary} style={{ padding: '14px 24px' }} onClick={() => setSalidaId(null)}>
                Buscar · F2
              </button>
            </div>

            <div className={styles.rutasRapidas}>
              <button
                className={`${styles.rutaRapida} ${destino === '' ? styles.rutaRapidaActiva : ''}`}
                onClick={() => {
                  setDestino('');
                  setSalidaId(null);
                }}
              >
                Todas
              </button>
              {destinosLinea.map((r) => (
                <button
                  key={r}
                  className={`${styles.rutaRapida} ${destino === r ? styles.rutaRapidaActiva : ''}`}
                  onClick={() => {
                    setDestino(r);
                    setSalidaId(null);
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Salidas del día */}
            <div className={styles.listaSalidasMini}>
              {(salidas ?? []).map((s) => (
                <button
                  key={s.documentId}
                  className={`${styles.salidaMini} ${s.documentId === salidaId ? styles.salidaMiniActiva : ''}`}
                  onClick={() => {
                    liberarTodo();
                    setSalidaId(s.documentId);
                    setPisoActivo(1);
                  }}
                >
                  <span className={styles.salidaMiniHora}>{hora(s.fechaHoraSalida)}</span>
                  <span className={styles.salidaMiniMeta}>
                    Unidad {s.unidad?.numero} · {s.rampa}
                  </span>
                </button>
              ))}
              {!salidas?.length && (
                <span style={{ fontSize: 13, color: 'var(--text-soft)', padding: 8 }}>
                  {rutasLinea && !rutasLinea.length
                    ? 'Tu empresa aún no tiene rutas ni salidas: cuando el administrador las programe, aquí aparecerán para vender.'
                    : destino
                      ? `Sin salidas a ${destino} ese día.`
                      : 'Sin salidas programadas ese día. El administrador las programa en Empresa → Salidas.'}
                </span>
              )}
            </div>

            {salida && mapa && piso && (
              <>
                <div className={styles.salidaCabecera}>
                  <div>
                    <div className={styles.salidaTitulo}>
                      {hora(salida.fechaHoraSalida)} · Unidad {salida.unidad?.numero}
                    </div>
                    <div className={styles.salidaMeta}>
                      {mapa.pisos.length > 1 ? 'Doble piso' : 'Piso sencillo'} ·{' '}
                      {[...new Set(mapa.pisos.map((p) => p.nombre))].join(' + ')} · {mapa.resumen.libres} libres
                    </div>
                  </div>
                  {mapa.pisos.length > 1 && (
                    <div style={{ marginLeft: 'auto' }}>
                      <PillTabs
                        items={mapa.pisos.map((p) => ({ id: String(p.numero), label: `Piso ${p.numero}` }))}
                        value={String(piso.numero)}
                        onChange={(id) => setPisoActivo(Number(id))}
                      />
                    </div>
                  )}
                </div>
                <div className={styles.zonaMapa}>
                  <SeatMap piso={piso} seleccionados={seleccionados} onToggle={toggleAsiento} size="pos" />
                </div>
              </>
            )}
          </div>

          {/* Panel derecho */}
          <div className={styles.panelDer}>
            {reserva && (
              <ReservationTimer
                expiraEn={reserva.expiraEn}
                serverOffsetMs={reserva.serverOffsetMs}
                onExpire={() => {
                  setReserva(null);
                  setError('La reserva llegó a 00:00 y los puestos se liberaron.');
                  setPasajeros([]);
                  queryClient.invalidateQueries({ queryKey: ['mapa', salidaId] });
                }}
              />
            )}

            {error && (
              <div
                style={{
                  background: 'var(--warn-bg)',
                  border: '1px solid var(--warn-border-soft)',
                  color: 'var(--warn-text-alert)',
                  borderRadius: 'var(--r-14)',
                  padding: '12px 14px',
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>Puestos apartados</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pasajeros.map((p, i) => (
                  <div key={p.asientoId} className={styles.apartadoFila}>
                    <div className={styles.apartadoCabecera}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span className={styles.apartadoCuadro}>{p.asientoId}</span>
                        {clasePorAsiento.get(p.asientoId)?.nombre}
                      </span>
                      <Money usd={clasePorAsiento.get(p.asientoId)?.precio ?? 0} style={{ fontWeight: 600 }} />
                    </div>
                    <div className={styles.apartadoCampos}>
                      <input
                        className={styles.apartadoInput}
                        placeholder="Nombre del pasajero"
                        value={p.nombre}
                        onChange={(e) =>
                          setPasajeros((ps) => ps.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))
                        }
                      />
                      <input
                        className={styles.apartadoInput}
                        placeholder="Cédula"
                        value={p.documento}
                        onChange={(e) =>
                          setPasajeros((ps) => ps.map((x, j) => (j === i ? { ...x, documento: e.target.value } : x)))
                        }
                      />
                    </div>
                  </div>
                ))}
                {!pasajeros.length && <div className={styles.vacioPos ?? ''} style={{ fontSize: 13, color: 'var(--text-faint)', background: 'var(--surface-alt)', borderRadius: 12, padding: 14, textAlign: 'center' }}>Toca los asientos del mapa para apartar</div>}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>Método de pago</div>
              <div className={styles.metodos}>
                {METODOS.map((m) => (
                  <button
                    key={m.id}
                    className={`${styles.metodo} ${metodo === m.id ? styles.metodoActivo : ''}`}
                    onClick={() => setMetodo(m.id)}
                  >
                    <span className={styles.metodoLabel}>{m.label}</span>
                    <span className={styles.metodoSub}>{m.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.totales}>
              <div className={styles.totalFila}>
                <span>Subtotal</span>
                <Money usd={subtotal} />
              </div>
              <div className={styles.totalFila} style={{ marginTop: 4 }}>
                <span>Tasa de terminal</span>
                <Money usd={tasa} />
              </div>
              <div className={styles.cobrarFila}>
                <span className={styles.cobrarLabel}>Cobrar</span>
                <Money usd={total} className={styles.cobrarValor} />
              </div>
              <MoneyAlt usd={total} />
              <button className={styles.btnEmitir} disabled={!puedeEmitir} onClick={accionPrincipal}>
                {esWallet
                  ? publicarCobro.isPending
                    ? 'Publicando…'
                    : 'Publicar cobro en el QR · F9'
                  : emitir.isPending
                    ? 'Emitiendo…'
                    : 'Emitir e imprimir · F9'}
              </button>
              <div className={styles.secundarios}>
                <button className={styles.btnSec} onClick={liberarTodo}>
                  Liberar puestos
                </button>
                {taquillaCajaId && (
                  <button className={styles.btnSec} onClick={() => setQrCajaAbierto(true)}>
                    QR de mi caja
                  </button>
                )}
                <button
                  className={styles.btnSec}
                  style={porVerificar?.length ? { borderColor: 'var(--warn-border)', color: 'var(--warn-text)' } : undefined}
                  onClick={() => navigate('/pos/pagos')}
                >
                  Pagos web{porVerificar?.length ? ` · ${porVerificar.length}` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de arqueo */}
        <div className={styles.arqueo}>
          <span>
            Emisiones del turno <strong>{arqueo?.folios.emitidos ?? 0}</strong>
          </span>
          <span>
            Efectivo Bs{' '}
            <strong>{efectivoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
          </span>
          <span>
            Divisas <strong>$ {divisas.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
          </span>
          <span className={styles.arqueoAnulacion}>
            Anulaciones <strong>{arqueo?.anulaciones.cantidad ?? 0}</strong> · requiere supervisor
          </span>
          <span style={{ marginLeft: 'auto' }}>Cada boleto queda con folio, cajero y hora.</span>
        </div>
      </div>

      {/* Modal de espera: cobro publicado en el QR de la caja */}
      {cobro && (
        <div className={styles.velo}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420, textAlign: 'center', background: '#fff', borderRadius: 20, padding: 24 }}
          >
            <div style={{ fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700 }}>
              Cobro publicado en el QR de la caja
            </div>
            <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.02em', margin: '10px 0 2px' }}>
              Bs {cobro.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-soft)', marginBottom: 14 }}>
              {cobroEstado?.estado === 'pagando'
                ? 'El pasajero está pagando…'
                : 'Pídele al pasajero que escanee el QR de la caja y confirme el pago en su teléfono.'}
            </div>
            <ReservationTimer
              expiraEn={cobro.expiraEn}
              serverOffsetMs={reserva?.serverOffsetMs ?? 0}
            />
            <button
              className={ui.btnSecondary}
              style={{ width: '100%', marginTop: 16 }}
              disabled={cancelarCobro.isPending}
              onClick={() => cancelarCobro.mutate()}
            >
              Cancelar cobro
            </button>
          </div>
        </div>
      )}

      {/* Modal QR fijo de la caja (imprimible una sola vez, se pega en la taquilla) */}
      {qrCajaAbierto && taquillaCajaId && (
        <div className={styles.velo}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420, background: '#fff', borderRadius: 20, padding: 24 }}
          >
            <div className="ficha-imprimible" style={{ textAlign: 'center', padding: '10px 0', background: '#fff' }}>
              <div style={{ fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                Paga tu boleto aquí
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 2px' }}>{usuario?.linea?.nombre}</div>
              <div style={{ fontSize: 15, color: 'var(--text-soft)', marginBottom: 14 }}>
                {turno?.taquilla?.nombre ?? usuario?.taquilla?.nombre}
                {turno?.taquilla?.terminal ? ` · ${turno.taquilla.terminal}` : ''}
              </div>
              <div style={{ background: '#fff', display: 'inline-block', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
                <QRCodeSVG value={`${window.location.origin}/caja/${taquillaCajaId}`} size={220} level="M" />
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 12 }}>
                Escanea con la cámara de tu teléfono y paga con tu wallet de Butaca En Línea.
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>butacaenlinea.com</div>
            </div>
            <div className="no-print" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className={ui.btnSecondary} onClick={() => setQrCajaAbierto(false)}>
                Cerrar
              </button>
              <button className={ui.btnPrimary} onClick={() => window.print()}>
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de boletos emitidos */}
      {emitidos && salida && (
        <div className={styles.velo}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <TicketCard
              variant="movil"
              data={{
                folio: emitidos[0].folio,
                codigo: emitidos[0].qrId.slice(0, 8).toUpperCase(),
                qrValue: emitidos[0].qr,
                lineaNombre: usuario?.linea?.nombre ?? '',
                origen: salida.ruta?.origen ?? '',
                destino: salida.ruta?.destino ?? '',
                fecha: fechaCorta(salida.fechaHoraSalida),
                salidaHora: hora(salida.fechaHoraSalida),
                llegadaHora: hora(salida.fechaHoraLlegada),
                puestos: emitidos.map((b) => b.asientoId).join('·'),
                piso: String(emitidos[0].piso),
                rampa: salida.rampa?.replace('Rampa ', ''),
                pasajeroNombre: emitidos[0].pasajeroNombre,
                totalUsd: emitidos.reduce((s, b) => s + b.totalUsd, 0),
              }}
              footer={
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className={ui.btnSecondary} style={{ flex: 1 }} onClick={() => window.print()}>
                    Imprimir
                  </button>
                  <button className={`${ui.btnPrimary}`} style={{ flex: 1, padding: 13 }} onClick={() => setEmitidos(null)}>
                    Listo
                  </button>
                </div>
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
