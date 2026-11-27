import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api/client';
import { consultarChipNfc } from '../../lib/api/endpoints';
import { codigoDelMensaje, lectorNfcDisponible } from './ndef';
import ui from '../../components/ui/ui.module.css';
import css from './AdminTarjetasNfc.module.css';

function errorDeLectura(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'tarjeta_no_encontrada') return 'Este chip no está registrado en Butaca. Revisa el código público impreso.';
    if (error.status === 0) return 'Se perdió la conexión con Butaca. Conéctate y vuelve a leer la tarjeta.';
    return 'No pudimos consultar la tarjeta. Vuelve a intentarlo o usa el código público.';
  }
  switch (error instanceof Error ? error.name : '') {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Permite la lectura NFC en el navegador o usa el código público.';
    case 'NotSupportedError':
    case 'NotReadableError':
      return 'Revisa que el NFC del teléfono esté activado o usa el código público.';
    default:
      return 'No pudimos iniciar la lectura. Vuelve a intentarlo o usa el código público.';
  }
}

export function ConsultaNfc({ onFicha, disabled = false }: { onFicha: (codigo: string) => void; disabled?: boolean }) {
  const Lector = lectorNfcDisponible();
  const operacion = useRef<AbortController | null>(null);
  const [estado, setEstado] = useState({ activo: false, mensaje: '' });

  const terminar = useCallback((mensaje: string) => {
    operacion.current?.abort();
    operacion.current = null;
    setEstado({ activo: false, mensaje });
  }, []);

  useEffect(() => {
    const alOcultar = () => { if (document.hidden && operacion.current) terminar('Lectura cancelada.'); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      document.removeEventListener('visibilitychange', alOcultar);
      operacion.current?.abort();
      operacion.current = null;
    };
  }, [terminar]);

  useEffect(() => {
    if (disabled && operacion.current) terminar('');
  }, [disabled, terminar]);

  if (!window.isSecureContext || !Lector) {
    return <p className={css.ayuda}>
      {window.isSecureContext ? 'Este navegador no admite la lectura NFC.' : 'La lectura NFC requiere una conexión HTTPS.'}
      {' '}Consulta la tarjeta con el código público impreso.
    </p>;
  }

  async function iniciar() {
    if (!Lector || disabled || document.hidden || operacion.current) return;
    const tarea = new AbortController();
    const escaneo = new AbortController();
    operacion.current = tarea;
    setEstado({ activo: true, mensaje: 'Permite la lectura NFC si el navegador te lo pide.' });
    try {
      const lector = new Lector();
      tarea.signal.addEventListener('abort', () => {
        escaneo.abort();
        lector.onreading = null;
        lector.onreadingerror = null;
      }, { once: true });
      lector.onreadingerror = () => {
        if (!escaneo.signal.aborted) terminar('No pudimos leer el chip. Vuelve a acercar la tarjeta o usa el código público.');
      };
      lector.onreading = async ({ message }) => {
        if (escaneo.signal.aborted) return;
        escaneo.abort();
        const codigo = codigoDelMensaje(message.records);
        if (!codigo) {
          terminar('El chip no contiene el código de Butaca en formato de texto. Usa el código público impreso.');
          return;
        }
        setEstado({ activo: true, mensaje: 'Consultando la tarjeta…' });
        try {
          const ficha = await consultarChipNfc(codigo, tarea.signal);
          if (tarea.signal.aborted) return;
          terminar('');
          onFicha(ficha.codigoPublico);
        } catch (error) {
          if (!tarea.signal.aborted) terminar(errorDeLectura(error));
        }
      };
      await lector.scan({ signal: escaneo.signal });
      if (!escaneo.signal.aborted) setEstado({ activo: true, mensaje: 'Acerca la tarjeta a la parte trasera del teléfono.' });
    } catch (error) {
      if (!escaneo.signal.aborted) terminar(errorDeLectura(error));
    }
  }

  return (
    <div className={css.operacion}>
      {estado.activo
        ? <button type="button" className={ui.btnGhost} onClick={() => terminar('Lectura cancelada.')}>Cancelar lectura</button>
        : <button type="button" className={ui.btnSecondary} disabled={disabled} onClick={() => void iniciar()}>Leer tarjeta por NFC</button>}
      <p role="status" className={estado.mensaje ? css.ayuda : undefined}>{estado.mensaje}</p>
    </div>
  );
}
