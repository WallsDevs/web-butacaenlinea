import { type ReactNode, type Ref, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import ui from '../../components/ui/ui.module.css';
import { admiteGrabacionNfc, codigoDelMensaje, lectorNfcDisponible } from './ndef';
import css from './GrabarTarjetaNfc.module.css';

type Fase = 'lista' | 'grabando' | 'incierta' | 'verificando' | 'pendiente' | 'verificada';
type FaseVisual = Fase | 'externa' | 'cargando' | 'error';
type Operacion = { control: AbortController; verificando: boolean; grabada: boolean };
const inicial = { fase: 'lista' as Fase, mensaje: '', grabada: false };

function IlustracionGrabador({ fase }: { fase: FaseVisual }) {
  const alerta = fase === 'incierta' || fase === 'pendiente' || fase === 'error';
  return (
    <svg className={css.ilustracion} viewBox="0 0 224 120" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="112" cy="65" rx="88" ry="42" fill="var(--nfc-fondo)" />
      <g transform="rotate(-9 67 60)">
        <rect x="40" y="10" width="54" height="96" rx="10" fill="var(--navy)" />
        <rect x="43" y="13" width="48" height="90" rx="8" fill="var(--blue-100)" />
        <rect x="48" y="18" width="13" height="22" rx="5" fill="var(--navy)" />
        <circle cx="54.5" cy="24" r="3" fill="var(--blue-200)" />
        <circle cx="54.5" cy="34" r="3" fill="var(--blue-200)" />
        <path d="M59 97h16" stroke="var(--tint-300)" strokeWidth="2" />
      </g>
      <g transform="rotate(10 167 64)">
        <rect x="137" y="42" width="68" height="44" rx="7" fill="var(--navy-mid)" />
        <rect x="143" y="49" width="12" height="9" rx="2" fill="var(--blue-150)" />
        <path d="M144 72h31m-31 5h18" stroke="var(--blue-150)" strokeWidth="2" />
        <path d="M184 51q3 3 0 6m4-8q5 5 0 10m4-12q7 7 0 14" stroke="var(--surface)" strokeWidth="1.6" />
      </g>
      {fase === 'verificada' ? (
        <g>
          <circle cx="116" cy="60" r="17" fill="var(--ok-text)" />
          <path d="m107.5 60 5.5 5.5 11-12" stroke="var(--surface)" strokeWidth="3.5" />
        </g>
      ) : alerta ? (
        <g>
          <path d="M113 45a3.4 3.4 0 0 1 6 0l14 24a3.4 3.4 0 0 1-3 5h-28a3.4 3.4 0 0 1-3-5z" fill="var(--warn-text-alert)" />
          <path d="M116 54v9m0 5v.2" stroke="var(--surface)" strokeWidth="3" />
        </g>
      ) : (
        <g className={css.ondas} stroke="var(--blue-600)" strokeWidth="3">
          <path d="M104 53q7 7 0 14" />
          <path d="M112 47q13 13 0 26" />
          <path d="M120 41q19 19 0 38" />
        </g>
      )}
    </svg>
  );
}

export function EstadoGrabadorNfc({ fase, titulo, descripcion, children }: {
  fase: FaseVisual;
  titulo: string;
  descripcion?: string;
  children?: ReactNode;
}) {
  return (
    <div className={css.grabador} data-fase={fase}>
      <IlustracionGrabador fase={fase} />
      <div className={css.mensaje} role="status" aria-atomic="true">
        <h3 className={css.titulo}>{titulo}</h3>
        {descripcion && <p className={css.descripcion}>{descripcion}</p>}
      </div>
      {children && <div className={css.acciones}>{children}</div>}
    </div>
  );
}

const titulos = {
  lista: 'Prepara una tarjeta en blanco',
  grabando: 'Esperando la tarjeta',
  incierta: 'Grabación sin confirmar',
  verificando: 'Vuelve a acercar la tarjeta',
  pendiente: 'Verificación pendiente',
};

function resultadoDeLectura(operacion: Operacion, mensaje: string) {
  return operacion.grabada ? 'Tarjeta grabada. ' + mensaje : mensaje;
}

function errorDelDispositivo(error: unknown, verificando: boolean) {
  const nombre = error instanceof Error ? error.name : '';
  switch (nombre) {
    case 'NotAllowedError':
      return verificando ? 'Permite el acceso NFC para verificarla.' : 'Comprueba el permiso NFC del navegador y usa una tarjeta en blanco.';
    case 'NotReadableError':
    case 'NotSupportedError':
      return 'Comprueba que el NFC esté activado y que la tarjeta sea compatible con NDEF.';
    case 'SecurityError':
      return 'Abre Butaca directamente en el navegador con HTTPS y permite el acceso NFC.';
    default:
      return verificando ? 'No pudimos leer el chip. Retira la tarjeta y acércala de nuevo.' : 'La grabación no se confirmó. Revisa que la tarjeta esté en blanco y admita escritura.';
  }
}

export type AccionGrabacionNfc = { grabar: () => void };
type Props = { codigoPublico: string; codigoInterno: string; ref?: Ref<AccionGrabacionNfc>; onListo?: () => void };

export function GrabarTarjetaNfc({ codigoPublico, codigoInterno, ref, onListo }: Props) {
  const Lector = lectorNfcDisponible();
  const compatible = admiteGrabacionNfc();
  const actual = useRef<Operacion | null>(null);
  const [estado, setEstado] = useState(inicial);

  const terminar = useCallback((operacion: Operacion, fase: Fase, mensaje: string) => {
    if (actual.current !== operacion) return;
    actual.current = null;
    operacion.control.abort();
    setEstado({ fase, mensaje, grabada: operacion.grabada });
  }, []);

  const cancelar = useCallback(() => {
    const operacion = actual.current;
    if (!operacion) return;
    if (operacion.verificando) terminar(operacion, 'pendiente', resultadoDeLectura(operacion, 'Verificación cancelada.'));
    else terminar(operacion, 'incierta', 'Grabación cancelada. Si ya acercaste la tarjeta, puedes verificar su contenido.');
  }, [terminar]);

  useLayoutEffect(() => {
    setEstado(inicial);
    const alOcultar = () => { if (document.hidden) cancelar(); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      document.removeEventListener('visibilitychange', alOcultar);
      const operacion = actual.current;
      actual.current = null;
      operacion?.control.abort();
    };
  }, [cancelar, codigoPublico, codigoInterno]);

  useImperativeHandle(ref, () => ({
    grabar() { if (compatible && estado.fase === 'lista') void iniciar(false); },
  }));

  if (!compatible) {
    return <EstadoGrabadorNfc fase="externa" titulo="Usa un grabador NFC"
      descripcion="Desde el teléfono, abre Butaca por HTTPS en Chrome para Android con NFC activado. Con una grabadora externa, guarda el código interno en un único registro de texto NDEF en UTF-8." />;
  }

  async function iniciar(soloVerificar: boolean) {
    if (!Lector || actual.current || document.hidden) return;
    const operacion = { control: new AbortController(), grabada: estado.grabada, verificando: soloVerificar };
    const { signal } = operacion.control;
    actual.current = operacion;
    try {
      const lector = new Lector();
      if (!soloVerificar) {
        setEstado({ fase: 'grabando', grabada: false, mensaje: 'Acerca la tarjeta en blanco a la parte trasera del teléfono y mantenla allí.' });
        await lector.write({ records: [{ recordType: 'text', encoding: 'utf-8', data: codigoInterno }] }, { overwrite: false, signal });
        if (signal.aborted) return;
        operacion.grabada = true;
        operacion.verificando = true;
      }

      setEstado({ fase: 'verificando', grabada: operacion.grabada, mensaje: resultadoDeLectura(operacion, 'Sepárala del teléfono y apóyala otra vez en la parte trasera.') });
      lector.onreading = ({ message }) => {
        if (codigoDelMensaje(message.records) === codigoInterno) {
          terminar(operacion, 'verificada', operacion.grabada ? 'Tarjeta grabada y verificada.' : 'Tarjeta verificada.');
        } else {
          terminar(operacion, 'pendiente', resultadoDeLectura(operacion, 'El contenido leído no coincide. Acerca la misma tarjeta para verificarla.'));
        }
      };
      lector.onreadingerror = () => terminar(operacion, 'pendiente', resultadoDeLectura(operacion, 'No pudimos leer el chip. Vuelve a verificarla.'));
      signal.addEventListener('abort', () => { lector.onreading = null; lector.onreadingerror = null; }, { once: true });
      await lector.scan({ signal });
    } catch (error) {
      const mensaje = errorDelDispositivo(error, operacion.verificando);
      if (operacion.verificando) terminar(operacion, 'pendiente', resultadoDeLectura(operacion, mensaje));
      else terminar(operacion, 'incierta', mensaje);
    }
  }

  if (estado.fase === 'verificada') {
    return (
      <EstadoGrabadorNfc fase="verificada" titulo={estado.mensaje} descripcion="Ya puedes retirar la tarjeta.">
        {onListo && <button type="button" className={ui.btnPrimary} onClick={onListo}>Listo</button>}
      </EstadoGrabadorNfc>
    );
  }

  return (
    <EstadoGrabadorNfc fase={estado.fase} titulo={titulos[estado.fase]}
      descripcion={estado.mensaje || 'Al iniciar la grabación, acerca la tarjeta a la parte trasera del teléfono.'}>
      {(estado.fase === 'pendiente' || estado.fase === 'incierta') &&
        <button type="button" className={ui.btnPrimary} onClick={() => void iniciar(true)}>Verificar tarjeta</button>}
      {(estado.fase === 'lista' || estado.fase === 'incierta') &&
        <button type="button" className={estado.fase === 'lista' ? ui.btnPrimary : ui.btnSecondary} onClick={() => void iniciar(false)}>Grabar tarjeta por NFC</button>}
      {(estado.fase === 'grabando' || estado.fase === 'verificando') &&
        <button type="button" className={ui.btnSecondary} onClick={cancelar}>{estado.fase === 'grabando' ? 'Cancelar grabación' : 'Cancelar verificación'}</button>}
    </EstadoGrabadorNfc>
  );
}
