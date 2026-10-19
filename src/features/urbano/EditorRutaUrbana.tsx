import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { MapaParadas } from './MapaParadas';
import { MAX_PARADAS, trazarPorCalles } from './trazado';
import { Field } from '../../components/ui/Field';
import { StatusChip } from '../../components/ui/StatusChip';
import { borrarEtiquetaRuta, getEtiquetasRutas, guardarEtiquetaRuta, type ParadaUrbana, type RutaUrbanaDto } from '../../lib/api/endpoints';
import ui from '../../components/ui/ui.module.css';

/**
 * Editor de rutas urbanas a pantalla completa.
 *
 * Antes se dibujaba la línea toque a toque en un mapa pequeño, y lo que
 * quedaba era geometría sin significado. Ahora la ruta se arma como la piensa
 * la empresa: un ORIGEN, las PARADAS del camino y un DESTINO. El trazo por las
 * calles se calcula solo (ver `trazado.ts`) y es lo que verá el pasajero.
 */
export interface FormUrbana {
  documentId: string | null;
  nombre: string;
  tarifaBs: string;
  /** Pasaje por tramos: las paradas marcadas como corte llevan el precio del tramo que termina en ellas. */
  porTramos: boolean;
  /** Circuito: la buseta vuelve al origen después de la última parada. */
  circuito: boolean;
  /** El cartel del parabrisas: etiquetas cortas de por dónde pasa. */
  letreros: string[];
  paradas: ParadaUrbana[];
  recorrido: [number, number][];
}

export function nuevaFormUrbana(u?: RutaUrbanaDto): FormUrbana {
  const tramos = u?.tramos ?? [];
  const paradas: ParadaUrbana[] = [...(u?.paradas ?? [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map((p) => ({ ...p, cortePrecioBs: undefined }));
  // Los cortes guardados vuelven a su parada; el último tramo siempre cierra en la última parada
  for (const t of tramos) {
    const p = paradas.find((x) => x.orden === t.hastaOrden);
    if (p) p.cortePrecioBs = String(t.precioBs);
  }
  if (tramos.length && paradas.length && paradas[paradas.length - 1].cortePrecioBs === undefined) {
    paradas[paradas.length - 1].cortePrecioBs = String(tramos[tramos.length - 1].precioBs);
  }
  return {
    documentId: u?.documentId ?? null,
    nombre: u?.nombre ?? '',
    tarifaBs: u ? String(u.tarifaBs) : '',
    porTramos: tramos.length > 0,
    circuito: Boolean(u?.circuito),
    letreros: u?.letreros ?? [],
    paradas,
    recorrido: u?.recorrido ?? [],
  };
}

/** Los tramos que se mandan al servidor: cada parada-corte cierra el tramo con su precio. */
export function tramosDe(f: FormUrbana): { hastaOrden: number; precioBs: number }[] {
  if (!f.porTramos) return [];
  return f.paradas
    .filter((p, i) => i > 0 && p.cortePrecioBs !== undefined && Number(p.cortePrecioBs) > 0)
    .map((p) => ({ hastaOrden: p.orden, precioBs: Number(p.cortePrecioBs) }));
}

export function EditorRutaUrbana({
  inicial,
  cabecera,
  error,
  guardando,
  onGuardar,
  onCancelar,
}: {
  inicial: FormUrbana;
  /** Algo que va encima del título (p. ej. el selector Nacional / Urbana al crear). */
  cabecera?: ReactNode;
  /** Por qué no se pudo guardar, si pasó. */
  error?: string | null;
  guardando: boolean;
  onGuardar: (f: FormUrbana) => void;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState<FormUrbana>(inicial);
  const [letreroNuevo, setLetreroNuevo] = useState('');
  const [distanciaKm, setDistanciaKm] = useState(0);
  // Letreros: se agregan con Enter o coma, se quitan con la ×, máximo 8
  const agregarLetrero = (texto: string) => {
    const partes = texto.split(',').map((t) => t.trim().replace(/\s+/g, ' ')).filter(Boolean);
    if (!partes.length) return;
    setForm((f) => {
      const vistos = new Set(f.letreros.map((l) => l.toLowerCase()));
      const nuevos = partes.filter((p) => !vistos.has(p.toLowerCase()) && vistos.add(p.toLowerCase())).map((p) => p.slice(0, 30));
      return { ...f, letreros: [...f.letreros, ...nuevos].slice(0, 8) };
    });
    setLetreroNuevo('');
  };
  const quitarLetrero = (l: string) => setForm((f) => ({ ...f, letreros: f.letreros.filter((x) => x.toLowerCase() !== l.toLowerCase()) }));
  // El catálogo guardado de la línea (más las de esta ruta, por si alguna aún no estaba)
  const [guardadas, setGuardadas] = useState<string[]>([]);
  useEffect(() => {
    getEtiquetasRutas().then(setGuardadas).catch(() => {});
  }, []);
  const catalogo = [...new Map([...guardadas, ...form.letreros].map((l) => [l.toLowerCase(), l])).values()];
  const crearEtiqueta = async () => {
    const texto = letreroNuevo.trim().replace(/\s+/g, ' ');
    if (!texto) return;
    try {
      setGuardadas(await guardarEtiquetaRuta(texto));
    } catch {
      /* sin red: igual queda en la ruta y se guarda en el catálogo al guardar la ruta */
    }
    agregarLetrero(texto);
  };
  const borrarEtiqueta = async (l: string) => {
    quitarLetrero(l);
    try {
      setGuardadas(await borrarEtiquetaRuta(l));
    } catch {
      /* se reintenta la próxima vez */
    }
  };
  const [sobreCalles, setSobreCalles] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El trazador necesita saber si cierra al origen; se lee por ref para no recrear la función
  const circuitoRef = useRef(inicial.circuito);

  const paradas = form.paradas;

  /** Recalcula el trazo (cerrando al origen si es circuito). Se agrupa con un respiro para no pedir en cada arrastre. */
  const recalcular = useCallback((lista: ParadaUrbana[], circuito = circuitoRef.current) => {
    circuitoRef.current = circuito;
    if (temporizador.current) clearTimeout(temporizador.current);
    if (lista.length < 2) {
      setForm((f) => ({ ...f, recorrido: lista.map((p) => [p.lat, p.lng]) }));
      setDistanciaKm(0);
      setSobreCalles(true);
      return;
    }
    setCalculando(true);
    temporizador.current = setTimeout(async () => {
      const t = await trazarPorCalles(circuito ? [...lista, lista[0]] : lista);
      setForm((f) => ({ ...f, recorrido: t.recorrido }));
      setDistanciaKm(t.distanciaKm);
      setSobreCalles(t.sobreCalles);
      setCalculando(false);
    }, 450);
  }, []);

  // Al abrir con paradas ya guardadas, se recalcula para tener la distancia
  useEffect(() => {
    if (inicial.paradas.length >= 2) recalcular(inicial.paradas);
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fijarParadas = (lista: ParadaUrbana[]) => {
    const conOrden = lista.map((p, i) => ({ ...p, orden: i + 1 }));
    setForm((f) => ({ ...f, paradas: conOrden }));
    recalcular(conOrden);
  };

  const agregar = (lat: number, lng: number) => {
    if (paradas.length >= MAX_PARADAS) return;
    fijarParadas([
      ...paradas,
      { nombre: `Parada ${paradas.length + 1}`, orden: paradas.length + 1, lat, lng },
    ]);
  };

  const mover = (i: number, lat: number, lng: number) =>
    fijarParadas(paradas.map((p, j) => (j === i ? { ...p, lat, lng } : p)));

  const renombrar = (i: number, nombre: string) =>
    setForm((f) => ({
      ...f,
      paradas: f.paradas.map((p, j) => (j === i ? { ...p, nombre } : p)),
    }));

  const eliminar = (i: number) => fijarParadas(paradas.filter((_, j) => j !== i));

  // Cortes de tarifa: la última parada siempre es corte; las demás se marcan a mano
  const esUltima = (i: number) => i === paradas.length - 1;
  const esCorte = (i: number) => i > 0 && (esUltima(i) || paradas[i].cortePrecioBs !== undefined);
  const marcarCorte = (i: number, activo: boolean) =>
    setForm((f) => ({ ...f, paradas: f.paradas.map((p, j) => (j === i ? { ...p, cortePrecioBs: activo ? (p.cortePrecioBs ?? '') : undefined } : p)) }));
  const precioCorte = (i: number, v: string) =>
    setForm((f) => ({ ...f, paradas: f.paradas.map((p, j) => (j === i ? { ...p, cortePrecioBs: v } : p)) }));
  const corteAnterior = (i: number) => {
    for (let j = i - 1; j > 0; j--) if (paradas[j].cortePrecioBs !== undefined) return paradas[j].nombre;
    return paradas[0]?.nombre ?? 'el origen';
  };
  const cortesValidos =
    paradas.length >= 2 &&
    paradas.every((p, i) => !esCorte(i) || Number(esUltima(i) ? (p.cortePrecioBs ?? '') : p.cortePrecioBs) > 0);

  const subir = (i: number) => {
    if (i === 0) return;
    const l = [...paradas];
    [l[i - 1], l[i]] = [l[i], l[i - 1]];
    fijarParadas(l);
  };
  const bajar = (i: number) => {
    if (i >= paradas.length - 1) return;
    const l = [...paradas];
    [l[i], l[i + 1]] = [l[i + 1], l[i]];
    fijarParadas(l);
  };

  const etiquetaDe = (i: number) =>
    i === 0 ? 'A' : i === paradas.length - 1 ? 'B' : String(i + 1);
  const papelDe = (i: number) =>
    paradas.length < 2 ? 'Punto de partida' : i === 0 ? 'Origen' : i === paradas.length - 1 ? (form.circuito ? 'Última parada · vuelve al origen' : 'Destino') : 'Parada';

  const listo = form.nombre.trim().length > 0 && paradas.length >= 2 && (form.porTramos ? cortesValidos : Number(form.tarifaBs) > 0);

  return (
    <div className={ui.velo ?? ''} style={estilos.velo}>
      <div style={estilos.panel} onClick={(e) => e.stopPropagation()}>
        <div style={estilos.cabecera}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {form.documentId ? 'Editar ruta urbana' : 'Nueva ruta'}
            </h3>
            {cabecera ? <div style={{ marginTop: 12 }}>{cabecera}</div> : (
              <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>
                Marca el origen, las paradas del camino y el destino. El recorrido por las calles
                se calcula solo.
              </p>
            )}
          </div>
          <button className={ui.btnSecondary} onClick={onCancelar} style={{ fontSize: 14 }}>
            Cerrar
          </button>
        </div>

        <div style={estilos.cuerpo}>
          <div style={estilos.columnaMapa}>
            <MapaParadas
              paradas={paradas}
              recorrido={form.recorrido}
              onAgregar={agregar}
              onMover={mover}
              alto={0}
            />
            <div style={estilos.piePista}>
              {paradas.length === 0
                ? 'Toca el mapa donde arranca la ruta.'
                : paradas.length === 1
                  ? 'Ahora toca dónde termina.'
                  : `Toca para agregar otra parada · arrastra los marcadores para corregir`}
            </div>
          </div>

          <div style={estilos.columnaLado}>
            <div style={{ display: 'grid', gridTemplateColumns: form.porTramos ? '1fr' : '1fr 130px', gap: 12 }}>
              <Field
                label="Nombre de la ruta"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
              {!form.porTramos && (
                <Field
                  label="Pasaje (Bs)"
                  type="number"
                  min={0}
                  value={form.tarifaBs}
                  onChange={(e) => setForm({ ...form, tarifaBs: e.target.value })}
                />
              )}
            </div>

            {/* Etiquetas: por dónde pasa la buseta. Se guardan en el catálogo de la línea y se reutilizan */}
            <div style={{ marginTop: 12 }}>
              <div className={ui.fieldLabel} style={{ marginBottom: 6 }}>Etiquetas</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {catalogo.map((l) => {
                  const puesta = form.letreros.some((x) => x.toLowerCase() === l.toLowerCase());
                  return (
                    <span key={l} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 6, border: puesta ? '1.5px solid var(--navy)' : '1px dashed var(--border-input)', background: puesta ? '#fff' : 'transparent' }}>
                      <button
                        type="button"
                        aria-pressed={puesta}
                        onClick={() => (puesta ? quitarLetrero(l) : agregarLetrero(l))}
                        disabled={!puesta && form.letreros.length >= 8}
                        style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '4px 4px 4px 8px', color: puesta ? 'var(--navy)' : 'var(--text-soft)', cursor: 'pointer' }}
                      >
                        {puesta ? '✓ ' : '+ '}{l}
                      </button>
                      <button
                        type="button"
                        title="Borrar del catálogo"
                        aria-label={`Borrar ${l} del catálogo`}
                        onClick={() => void borrarEtiqueta(l)}
                        style={{ fontSize: 12, color: 'var(--text-faint)', padding: '2px 7px 2px 3px', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
                {!catalogo.length && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Todavía no hay etiquetas guardadas.</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  className={ui.fieldInput}
                  placeholder="Nueva etiqueta: 5ta Avenida, Centro, Directo…"
                  value={letreroNuevo}
                  onChange={(e) => setLetreroNuevo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void crearEtiqueta();
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <button type="button" className={ui.btnSecondary} style={{ fontSize: 13 }} disabled={!letreroNuevo.trim()} onClick={() => void crearEtiqueta()}>
                  Guardar
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 6 }}>
                Toca una etiqueta para ponerla o quitarla de esta ruta (máximo 8). Quedan guardadas para tus otras rutas; los pasajeros las ven cuando viene la buseta.
              </div>
            </div>

            {/* Cómo se cobra: un solo pasaje, o por tramos entre paradas marcadas como corte */}
            <div style={{ marginTop: 12 }}>
              <div className={ui.fieldLabel} style={{ marginBottom: 6 }}>Cómo se cobra el pasaje</div>
              <div role="tablist" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, borderRadius: 12, background: 'var(--pill-bg, #EEF2F9)' }}>
                {([[false, 'Pasaje único'], [true, 'Por tramos']] as [boolean, string][]).map(([valor, etiqueta]) => (
                  <button
                    key={etiqueta}
                    type="button"
                    role="tab"
                    aria-selected={form.porTramos === valor}
                    onClick={() => setForm((f) => ({ ...f, porTramos: valor }))}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 9,
                      fontSize: 13,
                      fontWeight: 700,
                      color: form.porTramos === valor ? 'var(--blue-700)' : 'var(--text-soft)',
                      background: form.porTramos === valor ? 'var(--surface)' : 'transparent',
                      boxShadow: form.porTramos === valor ? '0 1px 2px rgba(15, 23, 42, 0.08), 0 0 0 1px var(--border)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 6, lineHeight: 1.45 }}>
                {form.porTramos
                  ? 'Marca en la lista las paradas donde cambia el precio (cortes) y ponle precio a cada tramo. El pasajero dice desde dónde hasta dónde va y paga los tramos que cruza; el colector ve dónde se baja.'
                  : 'Todos pagan lo mismo sin importar dónde suban o bajen.'}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.circuito}
                  onChange={(e) => {
                    const circuito = e.target.checked;
                    setForm((f) => ({ ...f, circuito }));
                    recalcular(paradas, circuito);
                  }}
                />
                <span>
                  Es un circuito: vuelve al origen
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-soft)' }}>
                    Después de la última parada la buseta regresa al punto de salida; el recorrido se cierra solo.
                  </span>
                </span>
              </label>
            </div>

            <div style={estilos.filaResumen}>
              <div>
                <div style={estilos.claveChica}>Paradas</div>
                <div style={estilos.valorGrande}>{paradas.length}</div>
              </div>
              <div>
                <div style={estilos.claveChica}>Recorrido</div>
                <div style={estilos.valorGrande}>
                  {calculando ? '…' : `${distanciaKm.toLocaleString('es-VE')} km`}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>
                {calculando ? (
                  <StatusChip tono="neutral">Calculando…</StatusChip>
                ) : paradas.length < 2 ? (
                  <StatusChip tono="neutral">Sin trazar</StatusChip>
                ) : sobreCalles ? (
                  <StatusChip tono="ok">Sobre las calles</StatusChip>
                ) : (
                  <StatusChip tono="warn">En línea recta</StatusChip>
                )}
              </div>
            </div>

            {!sobreCalles && paradas.length >= 2 && !calculando && (
              <div style={estilos.avisoAmbar}>
                No se pudo consultar el trazador de calles, así que la línea va derecha entre
                paradas. Guarda igual si quieres: vuelve a abrir el editor para reintentarlo.
              </div>
            )}

            <div style={estilos.tituloLista}>Paradas de la ruta</div>

            {paradas.length === 0 ? (
              <div style={estilos.vacio}>
                Todavía no has marcado ninguna. Toca el mapa donde arranca la buseta y después
                donde termina; en el medio agrega las paradas que haga.
              </div>
            ) : (
              <div style={estilos.lista}>
                {paradas.map((p, i) => (
                  <div key={i} style={estilos.parada}>
                    <div
                      style={{
                        ...estilos.marca,
                        background:
                          i === 0 || i === paradas.length - 1
                            ? 'var(--navy)'
                            : 'var(--blue-600, #2563EB)',
                      }}
                    >
                      {etiquetaDe(i)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input
                        value={p.nombre}
                        onChange={(e) => renombrar(i, e.target.value)}
                        placeholder={papelDe(i)}
                        style={estilos.inputNombre}
                      />
                      <div style={estilos.coords}>
                        {papelDe(i)} · {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                      </div>
                      {form.porTramos && i > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-soft)' }}>
                            <input type="checkbox" checked={esCorte(i)} disabled={esUltima(i)} onChange={(e) => marcarCorte(i, e.target.checked)} />
                            Corte de tarifa
                          </label>
                          {esCorte(i) && (
                            <>
                              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{corteAnterior(i)} → aquí</span>
                              <input
                                type="number"
                                min={0}
                                placeholder="Bs"
                                value={p.cortePrecioBs ?? ''}
                                onChange={(e) => precioCorte(i, e.target.value)}
                                style={{ ...estilos.inputNombre, width: 96, fontSize: 13, padding: '5px 8px', border: '1px solid var(--border-input)', borderRadius: 8 }}
                              />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button
                        style={estilos.botonIcono}
                        disabled={i === 0}
                        onClick={() => subir(i)}
                        title="Subir"
                      >
                        ↑
                      </button>
                      <button
                        style={estilos.botonIcono}
                        disabled={i === paradas.length - 1}
                        onClick={() => bajar(i)}
                        title="Bajar"
                      >
                        ↓
                      </button>
                      <button
                        style={{ ...estilos.botonIcono, color: 'var(--bad-text)' }}
                        onClick={() => eliminar(i)}
                        title="Quitar"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {paradas.length >= MAX_PARADAS && (
              <div style={estilos.avisoAmbar}>
                Máximo {MAX_PARADAS} paradas por ruta.
              </div>
            )}

            {error && (
              <div style={{ ...estilos.avisoAmbar, background: 'var(--bad-bg, #FEF2F2)', color: 'var(--bad-text)', borderColor: 'var(--bad-text)' }}>{error}</div>
            )}
            <div style={estilos.pie}>
              <button
                className={ui.btnSecondary}
                disabled={!paradas.length}
                onClick={() => fijarParadas([])}
              >
                Limpiar
              </button>
              <button
                className={ui.btnPrimary}
                style={{ marginLeft: 'auto' }}
                disabled={!listo || guardando || calculando}
                onClick={() => onGuardar(form)}
              >
                {guardando ? 'Guardando…' : 'Guardar ruta'}
              </button>
            </div>
            {!listo && (
              <div style={estilos.pista}>
                {!form.nombre.trim()
                  ? 'Ponle nombre a la ruta.'
                  : paradas.length < 2
                    ? 'Marca al menos el origen y el destino.'
                    : form.porTramos
                      ? 'Ponle precio a cada tramo (incluido el que termina en el destino).'
                      : 'Falta el pasaje en bolívares.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  velo: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(11,42,107,0.45)',
    display: 'grid',
    placeItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  panel: {
    background: 'var(--surface)',
    borderRadius: 22,
    width: 'min(1320px, 100%)',
    height: 'min(860px, 92vh)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 30px 80px rgba(15,23,42,0.28)',
  },
  cabecera: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    padding: '22px 26px 16px',
    borderBottom: '1px solid var(--divider)',
  },
  cuerpo: { flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 400px', minHeight: 0 },
  columnaMapa: { display: 'flex', flexDirection: 'column', minWidth: 0, padding: 18, gap: 10 },
  piePista: { fontSize: 13, color: 'var(--text-soft)' },
  columnaLado: {
    borderLeft: '1px solid var(--divider)',
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    overflowY: 'auto',
  },
  filaResumen: {
    display: 'flex',
    gap: 26,
    padding: '12px 14px',
    background: 'var(--surface-alt, #F7F9FE)',
    border: '1px solid var(--border)',
    borderRadius: 14,
  },
  claveChica: { fontSize: 12, color: 'var(--text-faint)' },
  valorGrande: { fontSize: 20, fontWeight: 700, marginTop: 2 },
  tituloLista: { fontSize: 15, fontWeight: 700 },
  vacio: { fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.55 },
  lista: { display: 'flex', flexDirection: 'column', gap: 8 },
  parada: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid var(--border)',
    borderRadius: 13,
    padding: '9px 11px',
  },
  marca: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontSize: 12,
    fontWeight: 700,
    flex: 'none',
  },
  inputNombre: {
    width: '100%',
    border: 0,
    outline: 'none',
    background: 'transparent',
    font: '600 14px/1.3 inherit',
    color: 'var(--text)',
    padding: 0,
  },
  coords: { fontSize: 11, color: 'var(--text-faint)', marginTop: 2 },
  botonIcono: {
    border: 0,
    background: 'transparent',
    color: 'var(--text-soft)',
    cursor: 'pointer',
    fontSize: 14,
    padding: '4px 6px',
  },
  avisoAmbar: {
    fontSize: 13,
    lineHeight: 1.5,
    color: 'var(--warn-text)',
    background: 'var(--warn-bg)',
    borderRadius: 12,
    padding: '11px 13px',
  },
  pie: { display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 8 },
  pista: { fontSize: 12, color: 'var(--text-faint)', textAlign: 'right' },
};
