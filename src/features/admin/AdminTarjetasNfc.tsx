import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EncabezadoPantalla } from '../../components/ui/EncabezadoPantalla';
import { Field } from '../../components/ui/Field';
import { IconoNav } from '../../app/iconos';
import { InventarioTarjetasNfc } from './InventarioTarjetasNfc';
import { descargarCodigos } from './exportarTarjetasNfc';
import { ConsultaNfc } from './ConsultaNfc';
import { PrepararGrabacionNfc } from './PrepararGrabacionNfc';
import { StatusChip } from '../../components/ui/StatusChip';
import { ApiError } from '../../lib/api/client';
import { useAuth } from '../../stores/auth';
import {
  getAdminPasajeros, getLotesNfc, getTarjetaNfc, recargarTarjetaNfc, solicitarLoteNfc, solicitarTarjetaNfc, vincularTarjetaNfc,
  type AdminPasajero, type LoteNfc, type PagoRecargaNfc, type SolicitudLoteNfc, type TarjetaNfc,
} from '../../lib/api/endpoints';
import ui from '../../components/ui/ui.module.css';
import flota from '../flota/flota.module.css';
import css from './AdminTarjetasNfc.module.css';

const operaciones = ['admin-tarjetas-nfc'];
const claveFicha = (codigo: string) => ['admin-tarjeta-nfc', codigo];
const formatoBs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const patronPublico = '\\s*[A-Za-z0-9][A-Za-z0-9._:\\-]*\\s*';
const ayudaCodigo = 'Empieza con una letra o número. También puedes usar punto, guion, dos puntos y guion bajo.';
const mensajes: Record<string, string> = {
  codigo_publico_invalido: 'Revisa el código público impreso en la tarjeta.',
  solicitud_invalida: 'El identificador de la solicitud es inválido. Solicita la tarjeta de nuevo.',
  solicitud_ajena: 'La solicitud pertenece a otro operador.',
  cantidad_invalida: 'Escribe una cantidad entera entre 1 y 200.',
  solicitud_incompatible: 'La cantidad difiere de la solicitud original. Consulta las tarjetas en el inventario.',
  tarjeta_no_encontrada: 'No encontramos una tarjeta registrada con ese código.',
  tarjeta_ya_vinculada: 'Otro operador ya vinculó esta tarjeta. Vuelve a consultar su ficha.',
  pasajero_no_encontrado: 'La cuenta del pasajero ya no está disponible.',
  pasajero_inactivo: 'El pasajero necesita una cuenta activa para usar la tarjeta.',
  tarjeta_sin_titular: 'Vincula la tarjeta con un pasajero antes de recargar.',
  monto_invalido: 'Escribe un monto entre Bs 0,01 y Bs 99.999.999,99, con hasta dos decimales.',
  referencia_requerida: 'Escribe la referencia que aparece en el banco.',
  referencia_invalida: 'Revisa la referencia del pago bancario.',
  referencia_duplicada: 'Esta referencia ya se usó para otra operación. Revisa los movimientos de saldo.',
  banco_invalido: 'Revisa el banco de origen.',
  sin_conexion: 'Sin conexión con el servidor. Vuelve a intentarlo cuando recuperes la conexión.',
};
const mensajeError = (error: unknown) =>
  (error instanceof ApiError && mensajes[error.code]) || 'No se pudo completar la operación. Vuelve a intentarlo.';

export default function AdminTarjetasNfc() {
  const operador = useAuth((s) => s.usuario?.id);
  return operador == null ? null : <PanelTarjetas key={operador} operador={operador} />;
}

type IntentoNfc = SolicitudLoteNfc & { individual?: boolean; anterior?: boolean };

const esUuid = (valor: unknown): valor is string => typeof valor === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(valor);
const contarTarjetas = (n: number) => `${n} ${n === 1 ? 'tarjeta' : 'tarjetas'}`;

function crearIdSolicitud(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

function leerPendientes(clave: string): IntentoNfc[] {
  try {
    const valor = sessionStorage.getItem(clave);
    if (!valor) return [];
    // Formatos anteriores: un UUID individual o una sola solicitud de lote.
    if (esUuid(valor)) return [{ solicitudId: valor, cantidad: 1, individual: true, anterior: true }];
    const datos = JSON.parse(valor);
    const anterior = !Array.isArray(datos);
    return (anterior ? [datos] : datos).flatMap((intento: IntentoNfc) => {
      if (!intento || !esUuid(intento.solicitudId) || !Number.isInteger(intento.cantidad) || intento.cantidad < 1 || intento.cantidad > 200) return [];
      return [{ solicitudId: intento.solicitudId, cantidad: intento.cantidad, individual: intento.individual === true, anterior: anterior || intento.anterior === true }];
    });
  } catch {
    return [];
  }
}

function PanelTarjetas({ operador }: { operador: number }) {
  const cliente = useQueryClient();
  const ocupado = useIsMutating({ mutationKey: operaciones }) > 0;
  const clavePendiente = `bel-solicitud-nfc:${operador}`;
  const claveCola = ['pendientes-nfc', operador];
  const { data: pendientes } = useQuery({
    queryKey: claveCola, queryFn: () => leerPendientes(clavePendiente), initialData: () => leerPendientes(clavePendiente), enabled: false,
  });
  const [cantidad, setCantidad] = useState('1');
  const [vista, setVista] = useState<'inventario' | 'generar' | 'consulta' | 'ficha'>('inventario');
  const [revision, setRevision] = useState(0);
  const [entrada, setEntrada] = useState('');
  const [codigo, setCodigo] = useState('');
  const enVuelo = useRef(false);
  const actualizarPendientes = useCallback((intento: IntentoNfc, guardar: boolean) => {
    const cola = cliente.setQueryData<IntentoNfc[]>(['pendientes-nfc', operador], (previos = []) => {
      const otros = previos.filter((p) => p.solicitudId !== intento.solicitudId);
      return guardar ? [intento, ...otros] : otros;
    });
    try {
      if (cola?.length) sessionStorage.setItem(clavePendiente, JSON.stringify(cola));
      else sessionStorage.removeItem(clavePendiente);
    } catch {
      // La cola en memoria sigue disponible si el navegador bloquea el almacenamiento.
    }
  }, [cliente, clavePendiente, operador]);
  const recientes = useQuery({ queryKey: ['lotes-nfc', operador], queryFn: getLotesNfc, enabled: pendientes.some((p) => p.anterior), retry: false });
  useEffect(() => {
    // La interfaz anterior guardaba también las solicitudes ya entregadas. El historial las confirma.
    for (const intento of pendientes) {
      if (intento.anterior && recientes.data?.some((lote) => lote.solicitudId === intento.solicitudId)) actualizarPendientes(intento, false);
    }
  }, [actualizarPendientes, pendientes, recientes.data]);
  const emision = useMutation({
    mutationKey: operaciones, retry: false, networkMode: 'always', gcTime: 0,
    mutationFn: async ({ solicitudId, cantidad, individual }: IntentoNfc): Promise<LoteNfc> => individual
      ? { solicitudId, cantidad, tarjetas: [await solicitarTarjetaNfc(solicitudId)] }
      : solicitarLoteNfc({ solicitudId, cantidad }),
    onSuccess: (_lote, intento) => {
      actualizarPendientes(intento, false);
      void cliente.invalidateQueries({ queryKey: ['admin-eventos'] });
      void cliente.invalidateQueries({ queryKey: ['inventario-nfc'] });
      setRevision((anterior) => anterior + 1);
      setVista('inventario');
      window.scrollTo(0, 0);
    },
    onError: (error, intento) => {
      if (error instanceof ApiError && ['solicitud_invalida', 'solicitud_ajena', 'solicitud_incompatible', 'cantidad_invalida'].includes(error.code)) actualizarPendientes(intento, false);
    },
    onSettled: () => { enVuelo.current = false; },
  });
  const solicitar = (intento: IntentoNfc, nueva = false) => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    if (nueva || intento.anterior) actualizarPendientes({ ...intento, anterior: undefined }, true);
    emision.mutate(intento);
  };
  const claveFichaOperador = [...claveFicha(codigo), operador];
  const ficha = useQuery({
    queryKey: claveFichaOperador, queryFn: () => getTarjetaNfc(codigo), enabled: vista === 'ficha' && !!codigo, staleTime: 0, retry: false, networkMode: 'always',
  });
  const abrirFicha = (valor: string) => {
    setEntrada(valor); setCodigo(valor); setVista('ficha'); window.scrollTo(0, 0);
  };
  const volver = () => {
    setVista('inventario');
    window.scrollTo(0, 0);
  };
  const numero = Number(cantidad);
  const valida = /^\d+$/.test(cantidad) && numero >= 1 && numero <= 200;
  const coincidente = valida ? pendientes.find((p) => p.cantidad === numero) : undefined;
  const generar = () => {
    if (valida && !enVuelo.current) solicitar({ solicitudId: crearIdSolicitud(), cantidad: numero }, true);
  };

  return (
    <main className={`${flota.contenido} ${css.pagina}`}>
      <EncabezadoPantalla titulo="Tarjetas NFC" acciones={vista === 'inventario' ? (
        <div className={css.accionesCabecera}>
          <button className={ui.btnPrimary} onClick={() => { setCantidad('1'); setVista('generar'); }}>Generar tarjetas</button>
          <button className={ui.btnSecondary} onClick={() => { setEntrada(''); setVista('consulta'); }}>Consultar por NFC</button>
        </div>
      ) : <button className={ui.btnSecondary} disabled={ocupado} onClick={volver}>Volver al inventario</button>} />
      {vista === 'inventario' && emision.data && (
        <section className={css.emisionConfirmada} aria-label="Generación completada">
          <h2 aria-live="polite">{contarTarjetas(emision.data.cantidad)} {emision.data.cantidad === 1 ? 'generada' : 'generadas'}</h2>
          <button className={ui.btnGhost} onClick={() => descargarCodigos(emision.data, false)}>Descargar códigos públicos</button>
          <details className={css.descargaChip}>
            <summary>Preparar chips</summary>
            <p>El CSV incluye los códigos públicos e internos de esta generación.</p>
            <button className={ui.btnSecondary} onClick={() => descargarCodigos(emision.data, true)}>Descargar para grabar chips</button>
          </details>
        </section>
      )}
      <InventarioTarjetasNfc visible={vista === 'inventario'} revision={revision} onFicha={abrirFicha} />
      {vista === 'generar' && <div className={css.tarea}>
        <section className={`${ui.card} ${css.panel}`} aria-labelledby="solicitar-nfc">
          <div className={css.tituloHerramienta}><span><IconoNav id="metodos" /></span><h2 id="solicitar-nfc">Generar tarjetas</h2></div>
          <form className={css.generacion} onSubmit={(e) => {
            e.preventDefault();
            if (coincidente) solicitar(coincidente);
            else generar();
          }}>
            <div className={css.elegirCantidad}>
              <Field label="Cantidad de tarjetas" type="number" min={1} max={200} step={1} inputMode="numeric" required
                value={cantidad} onChange={(e) => setCantidad(e.target.value)} onFocus={(e) => e.target.select()}
                aria-describedby="limite-tarjetas" aria-invalid={cantidad !== '' && !valida} />
              <div className={css.cantidades} role="group" aria-label="Cantidades frecuentes">
                {[1, 10, 50, 200].map((n) => <button type="button" key={n} aria-pressed={n === numero}
                  onClick={() => setCantidad(String(n))}>{n}</button>)}
              </div>
            </div>
            <p id="limite-tarjetas" className={cantidad && !valida ? css.errorCantidad : css.pistaCantidad}>
              {cantidad && !valida ? mensajes.cantidad_invalida : 'De 1 a 200 tarjetas por solicitud.'}
            </p>
            {coincidente && <p className={css.notaPendiente}>Hay una solicitud de {contarTarjetas(numero)} por recuperar.</p>}
            <div className={css.acciones}>
              <button className={ui.btnPrimary} disabled={ocupado || !valida}
                onClick={(e) => { if (e.detail > 1) e.preventDefault(); }}>
                {emision.isPending ? 'Procesando…' : coincidente ? 'Reintentar generación' : `Generar ${valida ? contarTarjetas(numero) : 'tarjetas'}`}
              </button>
              {coincidente && <button type="button" className={ui.btnSecondary} disabled={ocupado}
                onClick={(e) => { if (e.detail <= 1) generar(); }}>Crear nueva solicitud</button>}
            </div>
          </form>
          {emision.isError && <p className={css.error} role="alert">{mensajeError(emision.error)}</p>}
        </section>
        {pendientes.length > 0 && <section className={`${ui.card} ${css.panel}`} aria-labelledby="pendientes-nfc">
          <h2 id="pendientes-nfc">Solicitudes pendientes</h2>
          <ul className={css.filas}>
            {pendientes.map((intento) => <li key={intento.solicitudId} className={css.filaPendiente}>
              <div><strong>{contarTarjetas(intento.cantidad)}</strong><span className={css.etiqueta}>Solicitud {intento.solicitudId.slice(0, 8)}</span></div>
              <button className={ui.btnSecondary} disabled={ocupado} onClick={() => solicitar(intento)}>Recuperar solicitud</button>
            </li>)}
          </ul>
        </section>}
      </div>}
      {vista === 'consulta' && <div className={css.tarea}>
        <section className={`${ui.card} ${css.panel}`} aria-labelledby="consultar-nfc">
          <div className={css.tituloHerramienta}><span><IconoNav id="viajar" /></span><h2 id="consultar-nfc">Consultar tarjeta</h2></div>
          <form className={css.busqueda} onSubmit={(e) => { e.preventDefault(); abrirFicha(entrada.trim().toUpperCase()); }}>
            <Field label="Código público de la tarjeta" placeholder="BUT-XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters"
              spellCheck={false} maxLength={128} pattern={patronPublico} title={ayudaCodigo} required disabled={ocupado} value={entrada} onChange={(e) => setEntrada(e.target.value)} />
            <button className={ui.btnSecondary} disabled={ocupado || !entrada.trim()}>Consultar tarjeta</button>
          </form>
          <ConsultaNfc onFicha={abrirFicha} disabled={ocupado} />
        </section>
      </div>}
      {vista === 'ficha' && <section className={`${ui.card} ${css.panel}`} aria-label="Ficha de la tarjeta">
        <div className={css.tituloFicha}>
          <div><div className={css.etiqueta}>Código público</div><h2>{codigo}</h2></div>
          {ficha.data && <StatusChip tono={ficha.data.titular ? 'ok' : 'neutral'}>{ficha.data.titular ? 'Vinculada' : 'Sin vincular'}</StatusChip>}
        </div>
        {ficha.isLoading && <p className={css.ayuda} role="status">Consultando tarjeta…</p>}
        {ficha.isError && <div className={css.acciones}><p role="alert" className={css.error}>{ficha.data ? 'No pudimos actualizar la ficha. Los datos corresponden a la última consulta.' : mensajeError(ficha.error)}</p><button className={ui.btnGhost} onClick={() => void ficha.refetch()}>Reintentar consulta</button></div>}
        {ficha.data?.puedeVerChip && <PrepararGrabacionNfc key={codigo} codigoPublico={codigo} operador={operador} />}
        {ficha.data && (ficha.data.titular ? <>
          <dl className={css.datos}>
            <div><dt>Titular</dt><dd>{ficha.data.titular.nombre}</dd></div>
            <div><dt>Saldo disponible</dt><dd className={css.saldo}>{ficha.data.saldoBs === null ? '—' : formatoBs(ficha.data.saldoBs)}</dd></div>
          </dl>
          <Recarga codigo={codigo} titular={ficha.data.titular} />
        </> : <Vinculacion codigo={codigo} onListo={(tarjeta) => {
          cliente.setQueryData(claveFichaOperador, { ...ficha.data, ...tarjeta });
          void cliente.invalidateQueries({ queryKey: ['inventario-nfc'] });
          void cliente.invalidateQueries({ queryKey: ['admin-eventos'] });
        }} />)}
      </section>}
    </main>
  );
}

function Vinculacion({ codigo, onListo }: { codigo: string; onListo: (tarjeta: TarjetaNfc) => void }) {
  const [entrada, setEntrada] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [elegido, setElegido] = useState<AdminPasajero | null>(null);
  const pasajeros = useQuery({
    queryKey: ['admin-pasajeros', busqueda], queryFn: () => getAdminPasajeros(busqueda), enabled: Boolean(busqueda),
  });
  const vincular = useMutation({
    mutationKey: operaciones, retry: false, networkMode: 'always',
    mutationFn: (pasajero: AdminPasajero) => vincularTarjetaNfc(codigo, pasajero.documentId), onSuccess: onListo,
  });
  return (
    <div className={css.operacion}>
      <h3>Vincular a un pasajero</h3>
      {elegido ? (
        <div className={css.formulario}>
          <p>La tarjeta <strong>{codigo}</strong> quedará vinculada al saldo de <strong>{elegido.nombreCorto || elegido.username}</strong> (@{elegido.username}{elegido.documento && ` · ${elegido.documento}`}).</p>
          {vincular.isError && <p className={css.error} role="alert">{mensajeError(vincular.error)}</p>}
          <div className={css.acciones}>
            <button className={ui.btnPrimary} disabled={vincular.isPending} onClick={() => vincular.mutate(elegido)}>{vincular.isPending ? 'Vinculando…' : 'Confirmar vinculación'}</button>
            <button className={ui.btnSecondary} disabled={vincular.isPending} onClick={() => { setElegido(null); vincular.reset(); }}>Cambiar pasajero</button>
          </div>
        </div>
      ) : (
        <>
          <form className={css.busqueda} onSubmit={(e) => {
            e.preventDefault();
            if (busqueda === entrada.trim()) void pasajeros.refetch();
            else setBusqueda(entrada.trim());
          }}>
            <Field label="Nombre, cédula o usuario del pasajero" value={entrada} onChange={(e) => { setEntrada(e.target.value); setBusqueda(''); }} required />
            <button className={ui.btnSecondary} disabled={!entrada.trim() || pasajeros.isFetching}>{pasajeros.isFetching ? 'Buscando…' : 'Buscar pasajero'}</button>
          </form>
          {pasajeros.isError && <p className={css.error} role="alert">{mensajeError(pasajeros.error)}</p>}
          {busqueda && pasajeros.isSuccess && (
            pasajeros.data.length ? (
              <ul className={css.resultados}>
                {pasajeros.data.map((p) => (
                  <li key={p.documentId}>
                    <button type="button" disabled={p.bloqueado || !p.confirmado || !p.documentId} onClick={() => setElegido(p)}>
                      <span><strong>{p.nombreCorto || p.username}</strong><small>@{p.username}{p.documento && ` · ${p.documento}`}</small></span>
                      <span>{p.bloqueado ? 'Bloqueado' : !p.confirmado ? 'Sin confirmar' : 'Seleccionar'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className={css.ayuda} role="status">Ningún pasajero coincide con la búsqueda.</p>
          )}
        </>
      )}
    </div>
  );
}

function Recarga({ codigo, titular }: { codigo: string; titular: NonNullable<TarjetaNfc['titular']> }) {
  const cliente = useQueryClient();
  const [abierta, setAbierta] = useState(false);
  const [pago, setPago] = useState<PagoRecargaNfc | null>(null);
  const [monto, setMonto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [banco, setBanco] = useState('');
  const recarga = useMutation({
    mutationKey: operaciones, retry: false, networkMode: 'always',
    mutationFn: (datos: PagoRecargaNfc) => recargarTarjetaNfc(codigo, datos),
    onSuccess: () => {
      for (const queryKey of [claveFicha(codigo), ['admin-conciliacion'], ['admin-pasajero', titular.documentId], ['admin-pasajeros'], ['admin-eventos'], ['wallet']]) {
        void cliente.invalidateQueries({ queryKey });
      }
    },
  });
  const cancelar = () => {
    setAbierta(false); setPago(null); setMonto(''); setReferencia(''); setBanco(''); recarga.reset();
  };
  const montoBs = Number(monto.trim().replace(',', '.'));
  const montoValido = /^\d+(?:[.,]\d{1,2})?$/.test(monto.trim()) && montoBs > 0 && montoBs <= 99999999.99;
  const respuestaIncierta = recarga.isError && (!(recarga.error instanceof ApiError) || recarga.error.status === 0 || recarga.error.status >= 500);
  if (!abierta) return <button className={ui.btnSecondary} onClick={() => setAbierta(true)}>Recargar saldo</button>;

  return (
    <div className={css.operacion}>
      {recarga.isSuccess && pago ? (
        <div className={css.recibo} role="status">
          <h3>Recarga acreditada</h3>
          <dl className={css.resumen}>
            <div><dt>Importe</dt><dd>{formatoBs(pago.montoBs)}</dd></div>
            <div><dt>Referencia bancaria</dt><dd>{pago.referencia}</dd></div>
            <div><dt>Movimiento</dt><dd>{recarga.data.movimientoId}</dd></div>
            <div><dt>Saldo tras la recarga</dt><dd>{formatoBs(recarga.data.saldoBs)}</dd></div>
          </dl>
          <button className={ui.btnSecondary} onClick={cancelar}>Listo</button>
        </div>
      ) : pago ? (
        <>
          <h3>Confirmar recarga</h3>
          <p>Verifica que el pago figure en el banco antes de acreditar el saldo.</p>
          <dl className={css.resumen}>
            <div><dt>Titular</dt><dd>{titular.nombre}</dd></div>
            <div><dt>Tarjeta</dt><dd>{codigo}</dd></div>
            <div><dt>Importe a acreditar</dt><dd>{formatoBs(pago.montoBs)}</dd></div>
            <div><dt>Referencia bancaria</dt><dd>{pago.referencia}</dd></div>
            {pago.banco && <div><dt>Banco de origen</dt><dd>{pago.banco}</dd></div>}
          </dl>
          {recarga.isError && <p className={css.error} role="alert">{respuestaIncierta ? 'No recibimos la confirmación. Reintenta con los mismos datos para recuperar el recibo.' : mensajeError(recarga.error)}</p>}
          <div className={css.acciones}>
            <button className={ui.btnPrimary} disabled={recarga.isPending} onClick={() => recarga.mutate(pago)}>
              {recarga.isPending ? 'Acreditando…' : respuestaIncierta ? 'Reintentar con esta referencia' : 'Confirmar pago y acreditar'}
            </button>
            {!respuestaIncierta && <button className={ui.btnSecondary} disabled={recarga.isPending} onClick={() => { setPago(null); recarga.reset(); }}>Editar pago</button>}
          </div>
        </>
      ) : (
        <>
          <h3>Recargar saldo</h3>
          <form className={css.formulario} onSubmit={(e) => {
            e.preventDefault();
            if (montoValido && referencia.trim()) setPago({ montoBs, referencia: referencia.trim(), banco: banco.trim() || undefined });
          }}>
            <div className={css.campos}>
              <Field label="Monto en bolívares" placeholder="0,00" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} required />
              <Field label="Referencia bancaria" value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={100} required />
              <Field label="Banco de origen (opcional)" value={banco} onChange={(e) => setBanco(e.target.value)} maxLength={100} />
            </div>
            {monto && !montoValido && <p className={css.error}>{mensajes.monto_invalido}</p>}
            <div className={css.acciones}>
              <button className={ui.btnPrimary} disabled={!montoValido || !referencia.trim()}>Revisar recarga</button>
              <button type="button" className={ui.btnSecondary} onClick={cancelar}>Cancelar</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
