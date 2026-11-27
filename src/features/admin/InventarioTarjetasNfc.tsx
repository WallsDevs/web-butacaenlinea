import { Fragment, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Field } from '../../components/ui/Field';
import { StatusChip } from '../../components/ui/StatusChip';
import { ApiError } from '../../lib/api/client';
import { getChipTarjetaNfc, getInventarioNfc, type TarjetaInventarioNfc } from '../../lib/api/endpoints';
import { fechaConAnio } from '../../lib/time';
import { useAuth } from '../../stores/auth';
import { EstadoGrabadorNfc, GrabarTarjetaNfc, type AccionGrabacionNfc } from './GrabarTarjetaNfc';
import { admiteGrabacionNfc } from './ndef';
import ui from '../../components/ui/ui.module.css';
import css from './InventarioTarjetasNfc.module.css';

type Props = { onFicha: (codigo: string) => void; visible: boolean; revision: number };

export function InventarioTarjetasNfc({ revision, ...props }: Props) {
  return <Inventario key={revision} {...props} revision={revision} />;
}

function Inventario({ onFicha, visible, revision }: Props) {
  const operador = useAuth((s) => s.usuario?.id);
  const [entrada, setEntrada] = useState('');
  const [filtro, setFiltro] = useState({ busqueda: '', pagina: 1 });
  useEffect(() => {
    const busqueda = entrada.trim();
    if (busqueda === filtro.busqueda) return;
    const timer = window.setTimeout(() => setFiltro({ busqueda, pagina: 1 }), 180);
    return () => window.clearTimeout(timer);
  }, [entrada, filtro.busqueda]);
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['inventario-nfc', operador, revision, filtro],
    queryFn: ({ signal }) => getInventarioNfc(filtro, signal),
    enabled: visible,
    retry: false,
  });
  if (!visible) return null;

  const buscando = entrada.trim() !== filtro.busqueda;
  const pagina = data?.pagina ?? 1;
  const paginas = data ? Math.ceil(data.total / data.porPagina) : 0;
  const irAPagina = (n: number) => {
    setFiltro({ ...filtro, pagina: n });
    document.getElementById('inventario-titulo')?.focus();
  };

  return (
    <section aria-labelledby="inventario-titulo" className={`${ui.card} ${css.inventario}`}>
      <header className={css.barra}>
        <div className={css.titulo}>
          <h2 id="inventario-titulo" tabIndex={-1}>Todas las tarjetas</h2>
          {data && <span aria-live="polite">{data.total} {filtro.busqueda
            ? (data.total === 1 ? 'coincidencia' : 'coincidencias')
            : (data.total === 1 ? 'tarjeta registrada' : 'tarjetas registradas')}</span>}
        </div>
        <Field label="Buscar por código público" type="search" placeholder="Código completo o parcial" autoComplete="off"
          maxLength={128} spellCheck={false} value={entrada} onChange={(e) => setEntrada(e.target.value)} />
      </header>
      {isError && !buscando && <div className={css.aviso} role="alert">No pudimos actualizar el inventario. <button className={ui.btnGhost} onClick={() => void refetch()}>Reintentar</button></div>}
      {(buscando || (!data && !isError)) && <p className={css.aviso} role="status">{buscando ? 'Buscando tarjetas…' : 'Cargando tarjetas…'}</p>}
      {data && !buscando && (data.tarjetas.length ? (
        <TablaTarjetas key={JSON.stringify(filtro)} tarjetas={data.tarjetas} onFicha={onFicha} />
      ) : (
        <div className={css.aviso}>
          <p>{filtro.busqueda ? 'Ninguna tarjeta coincide con ese código.' : 'Todavía no hay tarjetas registradas.'}</p>
          {filtro.busqueda && <button className={ui.btnGhost} onClick={() => { setEntrada(''); setFiltro({ busqueda: '', pagina: 1 }); }}>Ver todas las tarjetas</button>}
        </div>
      ))}
      {paginas > 1 && !buscando && <nav className={css.paginacion} aria-label="Páginas del inventario">
        <span>Página {pagina} de {paginas}</span>
        <div>
          <button className={ui.btnSecondary} disabled={pagina === 1 || isFetching} onClick={() => irAPagina(pagina - 1)}>Anterior</button>
          <button className={ui.btnSecondary} disabled={pagina === paginas || isFetching} onClick={() => irAPagina(pagina + 1)}>Siguiente</button>
        </div>
      </nav>}
    </section>
  );
}

type ModoChip = 'grabar' | 'externo' | 'datos';
type PanelChip = { codigo: string; modo: ModoChip } & (
  | { fase: 'cargando' | 'externa' }
  | { fase: 'error'; mensaje: string }
  | { fase: 'listo'; interno: string }
);

function IconoNfc() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M6 9a5.5 5.5 0 0 1 0 6M10 6a10 10 0 0 1 0 12M14 3a15 15 0 0 1 0 18" />
  </svg>;
}

function DialogoGrabacion({ codigo, onCerrar, children }: { codigo: string; onCerrar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialogo = ref.current!;
    dialogo.showModal();
    return () => dialogo.close();
  }, []);

  return createPortal(
    <dialog ref={ref} className={css.dialogo} aria-label={`Grabación NFC de ${codigo}`}
      onCancel={(e) => { e.preventDefault(); onCerrar(); }}>
      <header className={css.cabeceraDialogo}>
        <div className={css.tarjetaElegida}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>
          </svg>
          <span>{codigo}</span>
        </div>
        <button type="button" className={css.cerrar} aria-label="Cerrar grabación" onClick={onCerrar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button>
      </header>
      <div className={css.cuerpoDialogo}>{children}</div>
    </dialog>,
    document.body,
  );
}

function TablaTarjetas({ tarjetas, onFicha }: { tarjetas: TarjetaInventarioNfc[]; onFicha: Props['onFicha'] }) {
  const [panel, setPanel] = useState<PanelChip | null>(null);
  const [aviso, setAviso] = useState({ codigo: '', texto: '' });
  const peticion = useRef<AbortController | null>(null);
  const grabador = useRef<AccionGrabacionNfc>(null);
  const region = useRef<HTMLElement>(null);
  const disparador = useRef<HTMLButtonElement | null>(null);

  const cancelarCarga = useCallback(() => {
    peticion.current?.abort();
    peticion.current = null;
  }, []);
  const cerrar = useCallback(() => {
    cancelarCarga();
    setPanel(null);
    setAviso({ codigo: '', texto: '' });
  }, [cancelarCarga]);

  useLayoutEffect(() => {
    const alOcultar = () => { if (document.hidden && peticion.current) cerrar(); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      document.removeEventListener('visibilitychange', alOcultar);
      cancelarCarga();
    };
  }, [cerrar, cancelarCarga]);
  const codigoAbierto = panel?.codigo;
  const panelDeDatos = panel?.modo === 'datos';
  const permiteChip = Boolean(codigoAbierto && tarjetas.some((t) => t.codigoPublico === codigoAbierto && t.puedeVerChip));
  useLayoutEffect(() => {
    if (codigoAbierto && !permiteChip) cerrar();
  }, [codigoAbierto, permiteChip, cerrar]);
  const fasePanel = panel?.fase;
  useLayoutEffect(() => {
    if (panelDeDatos && fasePanel !== 'cargando') region.current?.scrollIntoView({ block: 'nearest' });
  }, [codigoAbierto, fasePanel, panelDeDatos]);

  async function abrir(codigo: string, modo: ModoChip) {
    cancelarCarga();
    setAviso({ codigo: '', texto: '' });
    if (modo === 'grabar' && !admiteGrabacionNfc()) {
      setPanel({ codigo, modo, fase: 'externa' });
      return;
    }
    const control = new AbortController();
    peticion.current = control;
    setPanel({ codigo, modo, fase: 'cargando' });
    try {
      const { codigoInterno } = await getChipTarjetaNfc(codigo, control.signal);
      if (control.signal.aborted || document.hidden) return;
      const listo: PanelChip = { codigo, modo, fase: 'listo', interno: codigoInterno };
      if (modo === 'grabar' && navigator.userActivation?.isActive) {
        // Monta el grabador de esta fila mientras sigue vigente el gesto del usuario.
        flushSync(() => setPanel(listo));
        if (!control.signal.aborted && navigator.userActivation.isActive) grabador.current?.grabar();
      } else {
        setPanel(listo);
      }
    } catch (error) {
      if (!control.signal.aborted) setPanel({ codigo, modo, fase: 'error', mensaje: error instanceof ApiError && error.status === 403
        ? 'Solo puede preparar el chip quien emitió esta tarjeta.' : 'No pudimos cargar el código de esta tarjeta.' });
    } finally {
      if (peticion.current === control) peticion.current = null;
    }
  }
  function cerrarYEnfocar() {
    cerrar();
    disparador.current?.focus({ preventScroll: true });
  }
  async function copiar(valor: string, codigo: string) {
    try {
      await navigator.clipboard.writeText(valor);
      setAviso({ codigo, texto: 'Código copiado.' });
    } catch {
      setAviso({ codigo, texto: 'Selecciona el código para copiarlo.' });
    }
  }
  const datosExternos = panel?.fase === 'listo' && panel.modo !== 'grabar' && <div className={css.datosExternos}>
    <p>Graba este código interno como un único registro de texto NDEF en UTF-8.</p>
    <code>{panel.interno}</code>
    <button type="button" className={ui.btnSecondary} onClick={() => void copiar(panel.interno, panel.codigo)}>Copiar código interno</button>
    {aviso.codigo === panel.codigo && <p role="status">{aviso.texto}</p>}
  </div>;

  return (
    <>
    <table className={css.tabla} aria-label="Inventario de tarjetas NFC">
      <thead><tr><th scope="col">Código público</th><th scope="col">Titular</th><th scope="col">Fecha de registro</th><th scope="col" className={css.ultima}>Acciones</th></tr></thead>
      <tbody>{tarjetas.map((tarjeta) => {
        const codigo = tarjeta.codigoPublico;
        const abierto = panel?.codigo === codigo && tarjeta.puedeVerChip;
        const grabando = abierto && !panelDeDatos;
        const enDatos = abierto && panel.modo === 'datos';
        const idPanel = 'chip-' + codigo;
        return <Fragment key={codigo}>
          <tr className={`${css.fila} ${abierto ? css.seleccionada : ''}`}>
            <th scope="row" className={css.identidad}>
              <div className={css.codigo}><strong>{codigo}</strong>
                <button className={css.copiar} title="Copiar código público" aria-label={`Copiar código público de ${codigo}`} onClick={() => void copiar(codigo, codigo)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="8" y="8" width="12.5" height="13" rx="2"/><path d="M15.5 8V5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2H8"/></svg>
                </button>
              </div>
              {!abierto && aviso.codigo === codigo && <span className={css.mensaje} role="status">{aviso.texto}</span>}
            </th>
            <td className={css.titular}>{tarjeta.titular ? <span>{tarjeta.titular.nombre}</span> : <StatusChip tono="neutral" size="sm">Sin vincular</StatusChip>}</td>
            <td className={css.fecha}><time dateTime={tarjeta.creadaEn}>{fechaConAnio(tarjeta.creadaEn)}</time></td>
            <td className={css.ultima}><div className={css.acciones}>
              {tarjeta.puedeVerChip && <button type="button" className={css.grabar} aria-haspopup="dialog" aria-expanded={grabando} aria-label={`Grabar NFC en ${codigo}`}
                onClick={(e) => {
                  disparador.current = e.currentTarget;
                  void abrir(codigo, 'grabar');
                }}>
                <IconoNfc /> Grabar NFC
              </button>}
              <button type="button" className={css.verFicha} aria-label={`Ver ficha de ${codigo}`} onClick={() => onFicha(codigo)}>Ver ficha <span aria-hidden="true">→</span></button>
              {tarjeta.puedeVerChip && <button type="button" className={css.datosChip} title="Datos del chip" aria-expanded={enDatos} aria-controls={enDatos ? idPanel : undefined} aria-label={`${enDatos ? 'Ocultar' : 'Ver'} código del chip de ${codigo}`}
                onClick={(e) => { disparador.current = e.currentTarget; if (enDatos) cerrar(); else void abrir(codigo, 'datos'); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="5" width="14" height="14" rx="3"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3M19 9h3m-3 6h3"/>
                </svg>
              </button>}
            </div></td>
          </tr>
          {enDatos && <tr className={css.filaChip}><td colSpan={4}>
            <section ref={region} className={css.panelChip} id={idPanel} tabIndex={-1} aria-label={`Datos del chip de ${codigo}`}>
              <div className={css.cabeceraChip}>
                <h3>Datos del chip</h3>
                <button type="button" className={css.cerrar} aria-label="Cerrar datos del chip" title="Cerrar" onClick={cerrarYEnfocar}>
                  <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
                </button>
              </div>
              {panel.fase === 'cargando' && <p role="status">Preparando la tarjeta…</p>}
              {panel.fase === 'error' && <p role="alert">{panel.mensaje} <button className={ui.btnGhost} onClick={() => void abrir(codigo, panel.modo)}>Reintentar</button></p>}
              {datosExternos}
            </section>
          </td></tr>}
        </Fragment>;
      })}</tbody>
    </table>
    {panel && !panelDeDatos && permiteChip &&
      <DialogoGrabacion key={panel.codigo} codigo={panel.codigo} onCerrar={cerrar}>
        {panel.fase === 'cargando' && <EstadoGrabadorNfc fase="cargando"
          titulo={panel.modo === 'externo' ? 'Cargando el código del chip…' : 'Preparando la grabación…'} />}
        {panel.fase === 'error' && <EstadoGrabadorNfc fase="error" titulo="No se pudo preparar la tarjeta" descripcion={panel.mensaje}>
          <button type="button" className={ui.btnSecondary} onClick={() => void abrir(panel.codigo, panel.modo)}>Reintentar</button>
        </EstadoGrabadorNfc>}
        {panel.fase === 'externa' && <EstadoGrabadorNfc fase="externa" titulo="Usa un teléfono con NFC"
          descripcion="Este navegador no puede grabar la tarjeta. Abre Butaca por HTTPS en Chrome para Android y activa el NFC del teléfono.">
          <button type="button" className={ui.btnSecondary} onClick={() => void abrir(panel.codigo, 'externo')}>Ver código para grabador externo</button>
        </EstadoGrabadorNfc>}
        {panel.fase === 'listo' && (panel.modo === 'grabar'
          ? <GrabarTarjetaNfc ref={grabador} codigoPublico={panel.codigo} codigoInterno={panel.interno} onListo={cerrar} />
          : <div className={css.codigoExterno}><h2>Código para grabador externo</h2>{datosExternos}</div>)}
      </DialogoGrabacion>}
    </>
  );
}
