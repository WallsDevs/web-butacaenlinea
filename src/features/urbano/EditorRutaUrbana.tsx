import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { MapaParadas } from './MapaParadas';
import { MAX_PARADAS, trazarPorCalles } from './trazado';
import { Field } from '../../components/ui/Field';
import { StatusChip } from '../../components/ui/StatusChip';
import type { ParadaUrbana, RutaUrbanaDto } from '../../lib/api/endpoints';
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
  paradas: ParadaUrbana[];
  recorrido: [number, number][];
}

export function nuevaFormUrbana(u?: RutaUrbanaDto): FormUrbana {
  return {
    documentId: u?.documentId ?? null,
    nombre: u?.nombre ?? '',
    tarifaBs: u ? String(u.tarifaBs) : '',
    paradas: [...(u?.paradas ?? [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
    recorrido: u?.recorrido ?? [],
  };
}

export function EditorRutaUrbana({
  inicial,
  cabecera,
  guardando,
  onGuardar,
  onCancelar,
}: {
  inicial: FormUrbana;
  /** Algo que va encima del título (p. ej. el selector Nacional / Urbana al crear). */
  cabecera?: ReactNode;
  guardando: boolean;
  onGuardar: (f: FormUrbana) => void;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState<FormUrbana>(inicial);
  const [distanciaKm, setDistanciaKm] = useState(0);
  const [sobreCalles, setSobreCalles] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const paradas = form.paradas;

  /** Recalcula el trazo. Se agrupa con un respiro para no pedir en cada arrastre. */
  const recalcular = useCallback((lista: ParadaUrbana[]) => {
    if (temporizador.current) clearTimeout(temporizador.current);
    if (lista.length < 2) {
      setForm((f) => ({ ...f, recorrido: lista.map((p) => [p.lat, p.lng]) }));
      setDistanciaKm(0);
      setSobreCalles(true);
      return;
    }
    setCalculando(true);
    temporizador.current = setTimeout(async () => {
      const t = await trazarPorCalles(lista);
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
    paradas.length < 2 ? 'Punto de partida' : i === 0 ? 'Origen' : i === paradas.length - 1 ? 'Destino' : 'Parada';

  const listo = form.nombre.trim().length > 0 && Number(form.tarifaBs) > 0 && paradas.length >= 2;

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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 12 }}>
              <Field
                label="Nombre de la ruta"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
              <Field
                label="Pasaje (Bs)"
                type="number"
                min={0}
                value={form.tarifaBs}
                onChange={(e) => setForm({ ...form, tarifaBs: e.target.value })}
              />
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
                  : !(Number(form.tarifaBs) > 0)
                    ? 'Falta el pasaje en bolívares.'
                    : 'Marca al menos el origen y el destino.'}
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
