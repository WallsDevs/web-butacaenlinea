import { useEffect, useState } from 'react';
import { useModulos } from '../../lib/useModulos';
import { AvisoIntegracion } from '../../components/ui/AvisoIntegracion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  eliminarRuta,
  eliminarRutaUrbana,
  getRutas,
  getRutasUrbanas,
  getCiudades,
  guardarRuta,
  guardarRutaUrbana,
} from '../../lib/api/endpoints';
import { useAuth } from '../../stores/auth';
import { ApiError } from '../../lib/api/client';
import { duracion } from '../../lib/time';
import { Field } from '../../components/ui/Field';
import { PillTabs } from '../../components/ui/PillTabs';
import { SelectorCiudad } from '../../components/ui/SelectorCiudad';
import { StatusChip } from '../../components/ui/StatusChip';
import { Letrero } from '../../components/ui/Letrero';
import { EditorRutaUrbana, nuevaFormUrbana, tramosDe, type FormUrbana } from '../urbano/EditorRutaUrbana';
import type { RutaDto } from '../../lib/api/types';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

interface FormRuta {
  documentId: string | null;
  codigo: string;
  origen: string;
  destino: string;
  duracionMin: string;
  distanciaKm: string;
  tarifas: { claseServicio: string; precioUsd: string }[];
  /** Ida y vuelta: una sola ruta; el sistema mantiene la vuelta y el sentido se elige al programar. */
  idaYVuelta: boolean;
  /** Precio del pasaje de la vuelta si es distinto al de la ida ('' = el mismo). */
  precioVuelta: string;
}

const NUEVA: FormRuta = {
  documentId: null,
  codigo: '',
  origen: '',
  destino: '',
  duracionMin: '',
  distanciaKm: '',
  tarifas: [{ claseServicio: 'estandar', precioUsd: '' }],
  idaYVuelta: true,
  precioVuelta: '',
};

/** «San Cristóbal», «san cristobal» y «SAN CRISTÓBAL» son la misma ciudad. */
const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

type TipoRuta = 'nacional' | 'urbana';
type Filtro = 'todas' | 'nacionales' | 'urbanas';

/**
 * Todas las rutas de la línea en una sola tabla: las de viaje (entre
 * ciudades, con asientos y salidas) y las urbanas (tarifa plana por QR), con
 * filtro por tipo y búsqueda. Un solo «Nueva ruta» pregunta el tipo.
 */
export default function EmpresaRutas({ abrirNueva = 0 }: { abrirNueva?: number }) {
  const queryClient = useQueryClient();
  const { integracionActiva } = useModulos();
  const [form, setForm] = useState<FormRuta | null>(null);
  const [errorRutaViaje, setErrorRutaViaje] = useState<string | null>(null);
  // Ciudades comunes a todas las líneas: origen y destino se eligen de aquí
  // Se reintenta solo (p. ej. si el API estaba reiniciando) y al abrir el formulario si falló
  const { data: ciudades, error: errorCiudades, refetch: recargarCiudades, isFetching: cargandoCiudades } = useQuery({ queryKey: ['ciudades'], queryFn: getCiudades, staleTime: 600_000, retry: 3 });
  useEffect(() => {
    if (form && errorCiudades) void recargarCiudades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(form)]);
  const ciudadOficial = (t: string) => (ciudades ?? []).find((c) => normalizar(c.nombre) === normalizar(t))?.nombre ?? null;
  const [tipo, setTipo] = useState<TipoRuta>('nacional');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [buscar, setBuscar] = useState('');

  const slug = useAuth((s) => s.usuario)?.linea?.slug;
  const { data: rutas, isLoading } = useQuery({ queryKey: ['rutas', slug], queryFn: () => getRutas(slug) });

  // Rutas urbanas: tarifa plana en Bs, sin asientos ni salidas (pasaje por QR)
  const [formUrbana, setFormUrbana] = useState<FormUrbana | null>(null);
  const [errorUrbana, setErrorUrbana] = useState<string | null>(null);
  // Un fallo al guardar se dice con su código: antes el modal se quedaba mudo
  const explicar = (e: unknown) =>
    e instanceof ApiError
      ? e.status === 401
        ? 'Tu sesión venció: vuelve a entrar y guarda de nuevo.'
        : e.code === 'tramos_invalidos'
          ? 'Revisa los cortes de tarifa: cada tramo necesita precio y deben ir en orden.'
          : `No se pudo guardar (${e.status || 'sin conexión'} · ${e.code}).`
      : 'No se pudo guardar.';
  const { data: urbanas } = useQuery({ queryKey: ['rutas-urbanas'], queryFn: getRutasUrbanas });
  const guardarUrbana = useMutation({
    mutationFn: (f: FormUrbana) =>
      guardarRutaUrbana(f.documentId, {
        nombre: f.nombre.trim(),
        // Con tramos, la tarifa plana queda como «desde» (el tramo más barato) para pantallas viejas
        tarifaBs: f.porTramos ? Math.min(...tramosDe(f).map((t) => t.precioBs)) : Number(f.tarifaBs),
        tramos: tramosDe(f),
        circuito: f.circuito,
        letreros: f.letreros,
        activa: true,
        // El trazo por las calles y las paradas con nombre: lo que ve el pasajero
        recorrido: f.recorrido,
        paradas: f.paradas.map((x, i) => ({ ...x, orden: i + 1 })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas-urbanas'] });
      setFormUrbana(null);
      setErrorUrbana(null);
    },
    onError: (e) => setErrorUrbana(explicar(e)),
  });
  const eliminarUrbana = useMutation({
    mutationFn: (id: string) => eliminarRutaUrbana(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rutas-urbanas'] }),
  });

  const guardar = useMutation({
    mutationFn: (f: FormRuta) =>
      guardarRuta(f.documentId, {
        codigo: f.codigo,
        nombre: `Ruta ${f.codigo} · ${ciudadOficial(f.origen) ?? f.origen} — ${ciudadOficial(f.destino) ?? f.destino}`,
        origen: ciudadOficial(f.origen) ?? f.origen,
        destino: ciudadOficial(f.destino) ?? f.destino,
        idaYVuelta: f.idaYVuelta,
        // La vuelta con su propio precio base si es distinto; si no, el mismo de la ida
        ...(f.idaYVuelta
          ? {
              tarifasVuelta: f.tarifas
                .filter((t) => t.claseServicio && Number(t.precioUsd) > 0)
                .map((t) => ({ claseServicio: t.claseServicio, precioUsd: t.claseServicio === 'estandar' && Number(f.precioVuelta) > 0 ? Number(f.precioVuelta) : Number(t.precioUsd) })),
            }
          : {}),
        duracionMin: Number(f.duracionMin) || 0,
        distanciaKm: Number(f.distanciaKm) || 0,
        tarifas: f.tarifas
          .filter((t) => t.claseServicio && Number(t.precioUsd) > 0)
          .map((t) => ({ claseServicio: t.claseServicio, precioUsd: Number(t.precioUsd) })),
        activa: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas'] });
      setForm(null);
      setErrorRutaViaje(null);
    },
    onError: (e) => {
      const d = (e instanceof ApiError ? e.details : {}) as { valor?: string; sugerencias?: string[]; salidas?: number };
      setErrorRutaViaje(
        e instanceof ApiError && e.code === 'ciudad_desconocida'
          ? `«${d.valor}» no está en la lista de ciudades.${d.sugerencias?.length ? ` ¿Quisiste decir ${d.sugerencias.join(', ')}?` : ''} Si falta, pídele a Butaca En Línea que la agregue.`
          : e instanceof ApiError && e.code === 'origen_igual_destino'
            ? 'El origen y el destino no pueden ser la misma ciudad.'
            : e instanceof ApiError && e.code === 'regreso_con_salidas'
              ? `La vuelta tiene ${d.salidas} salida(s) programada(s): cancélalas antes de quitar el ida y vuelta.`
              : explicar(e)
      );
    },
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => eliminarRuta(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rutas'] }),
  });

  const editar = (r: RutaDto) =>
    setForm({
      documentId: r.documentId,
      codigo: r.codigo ?? '',
      origen: r.origen,
      destino: r.destino,
      duracionMin: String(r.duracionMin ?? ''),
      distanciaKm: String(r.distanciaKm ?? ''),
      tarifas: (r.tarifas ?? []).map((t) => ({ claseServicio: t.claseServicio, precioUsd: String(t.precioUsd) })),
      idaYVuelta: Boolean(r.idaYVuelta),
      precioVuelta: (() => {
        const vuelta = (rutas ?? []).find((x) => x.id === r.inversaId);
        const pv = vuelta?.tarifas?.find((t) => t.claseServicio === 'estandar')?.precioUsd;
        const pi = r.tarifas?.find((t) => t.claseServicio === 'estandar')?.precioUsd;
        return pv != null && pv !== pi ? String(pv) : '';
      })(),
    });

  // Abrir el modal de creación del tipo pedido (con integración, solo urbanas: las de viaje vienen del sistema de la línea)
  const abrirNuevo = (t: TipoRuta = integracionActiva ? 'urbana' : 'nacional') => {
    setTipo(t);
    if (t === 'urbana') {
      setForm(null);
      setFormUrbana(nuevaFormUrbana());
    } else {
      setFormUrbana(null);
      setForm(NUEVA);
    }
  };
  useEffect(() => {
    if (abrirNueva > 0) abrirNuevo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirNueva]);

  // El selector de tipo va arriba del formulario, solo al crear
  const selectorTipo = (
    <div style={{ marginBottom: 16 }}>
      <div className={ui.fieldLabel} style={{ marginBottom: 6 }}>Tipo de ruta</div>
      {/* Dos mitades iguales, como un interruptor: se ve igual de bien en el modal angosto y en el editor ancho */}
      <div role="tablist" aria-label="Tipo de ruta" style={{ display: 'grid', gridTemplateColumns: integracionActiva ? '1fr' : '1fr 1fr', gap: 4, padding: 4, borderRadius: 12, background: 'var(--pill-bg, #EEF2F9)', maxWidth: 380 }}>
        {([...(integracionActiva ? [] : [['nacional', 'Nacional']]), ['urbana', 'Urbana']] as [TipoRuta, string][]).map(([id, etiqueta]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tipo === id}
            onClick={() => abrirNuevo(id)}
            style={{
              padding: '10px 14px',
              borderRadius: 9,
              fontSize: 14,
              fontWeight: 700,
              color: tipo === id ? 'var(--blue-700)' : 'var(--text-soft)',
              background: tipo === id ? 'var(--surface)' : 'transparent',
              boxShadow: tipo === id ? '0 1px 2px rgba(15, 23, 42, 0.08), 0 0 0 1px var(--border)' : 'none',
              cursor: 'pointer',
              transition: 'background .12s, color .12s',
            }}
          >
            {etiqueta}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 8 }}>
        {tipo === 'nacional'
          ? 'Entre ciudades: asientos numerados, salidas programadas y precio del pasaje en dólares.'
          : 'Dentro de la ciudad: tarifa plana en bolívares y pago escaneando el QR de la buseta. Sin asientos ni salidas.'}
      </div>
    </div>
  );

  // Una sola lista con las dos clases de ruta
  interface Fila {
    clave: string;
    tipo: TipoRuta;
    titulo: string;
    sub: string;
    letreros?: string[];
    medida: string;
    precio: string;
    texto: string;
    editar: () => void;
    eliminar: () => void;
    bloqueada: boolean;
  }
  const filas: Fila[] = [
    ...(rutas ?? [])
      // La vuelta enlazada no se lista: la ida se muestra como «A ⇄ B»
      .filter((r) => !r.inversaId || !(rutas ?? []).some((x) => x.id === r.inversaId) || r.id < r.inversaId)
      .map((r): Fila => ({
      clave: `n-${r.documentId}`,
      tipo: 'nacional',
      titulo: r.idaYVuelta ? `${r.origen} ⇄ ${r.destino}` : `${r.origen} → ${r.destino}`,
      sub: [r.codigo ? `Código ${r.codigo}` : '', r.idaYVuelta ? 'Ida y vuelta' : 'Solo ida'].filter(Boolean).join(' · '),
      medida: r.duracionMin ? duracion(r.duracionMin) : '—',
      precio: (() => {
        const base = (r.tarifas ?? []).map((t) => (t.claseServicio === 'estandar' ? `$${t.precioUsd}` : `${t.claseServicio} $${t.precioUsd}`)).join(' · ') || '—';
        const vuelta = r.idaYVuelta ? (rutas ?? []).find((x) => x.id === r.inversaId)?.tarifas?.find((t) => t.claseServicio === 'estandar')?.precioUsd : undefined;
        const ida = r.tarifas?.find((t) => t.claseServicio === 'estandar')?.precioUsd;
        return vuelta != null && vuelta !== ida ? `ida ${base} · vuelta $${vuelta}` : base;
      })(),
      texto: `${r.codigo} ${r.origen} ${r.destino}`.toLowerCase(),
      editar: () => editar(r),
      eliminar: () => {
        if (confirm(`¿Eliminar la ruta ${r.origen} → ${r.destino}?`)) eliminar.mutate(r.documentId);
      },
      bloqueada: integracionActiva,
    })),
    ...(urbanas ?? []).map((u): Fila => ({
      clave: `u-${u.documentId}`,
      tipo: 'urbana',
      titulo: u.nombre,
      sub: u.paradas?.length ? `${u.paradas[0]?.nombre ?? ''} → ${u.paradas[u.paradas.length - 1]?.nombre ?? ''}` : '',
      letreros: u.letreros,
      medida: u.paradas?.length ? `${u.paradas.length} paradas` : '—',
      precio: u.tramos?.length ? `por tramos · desde Bs ${Number(u.tarifaBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : `Bs ${Number(u.tarifaBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
      texto: `${u.nombre} ${(u.paradas ?? []).map((p) => p.nombre).join(' ')}`.toLowerCase(),
      editar: () => {
        setTipo('urbana');
        setFormUrbana(nuevaFormUrbana(u));
      },
      eliminar: () => {
        if (confirm(`¿Eliminar la ruta urbana ${u.nombre}?`)) eliminarUrbana.mutate(u.documentId);
      },
      bloqueada: false,
    })),
  ];
  const q = buscar.trim().toLowerCase();
  const visibles = filas
    .filter((f) => (filtro === 'todas' ? true : filtro === 'nacionales' ? f.tipo === 'nacional' : f.tipo === 'urbana'))
    .filter((f) => !q || f.texto.includes(q));
  const n = { todas: filas.length, nacionales: (rutas ?? []).length, urbanas: (urbanas ?? []).length };
  const cargando = isLoading && !rutas;

  return (
    <div className={styles.contenido}>
      {integracionActiva && <AvisoIntegracion que="rutas de viaje y tarifas" />}

      {/* Filtros a la izquierda, búsqueda a la derecha; el botón vive en la cabecera de la pantalla */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <PillTabs<Filtro>
          items={[
            { id: 'todas', label: `Todas · ${n.todas}` },
            { id: 'nacionales', label: `Nacionales · ${n.nacionales}` },
            { id: 'urbanas', label: `Urbanas · ${n.urbanas}` },
          ]}
          value={filtro}
          onChange={setFiltro}
        />
        <input
          className={ui.fieldInput}
          style={{ marginLeft: 'auto', width: 'min(100%, 300px)' }}
          placeholder="Buscar ciudad, código o nombre"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
      </div>

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th style={{ width: 96 }}>Tipo</th>
              <th>Ruta</th>
              <th>Duración</th>
              <th>Precio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.clave}>
                <td>
                  <StatusChip tono={f.tipo === 'nacional' ? 'info' : 'ok'} size="sm">{f.tipo === 'nacional' ? 'Nacional' : 'Urbana'}</StatusChip>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{f.titulo}</div>
                  {f.sub && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{f.sub}</div>}
                  {f.letreros?.length ? <div style={{ marginTop: 4 }}><Letrero letreros={f.letreros} tamano="sm" /></div> : null}
                </td>
                <td style={{ color: 'var(--text-soft)' }}>{f.medida}</td>
                <td style={{ color: 'var(--text-soft)', fontSize: 13 }}>{f.precio}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {!f.bloqueada && (
                    <>
                      <button className={ui.btnGhost} style={{ fontSize: 13, marginRight: 12 }} onClick={f.editar}>
                        Editar
                      </button>
                      <button style={{ fontSize: 13, fontWeight: 600, color: 'var(--bad-text)' }} onClick={f.eliminar}>
                        Eliminar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!cargando && !visibles.length && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 28 }}>
                  {q
                    ? 'Ninguna ruta coincide con la búsqueda.'
                    : filas.length
                      ? 'No hay rutas de ese tipo.'
                      : 'Todavía no tienes rutas. Crea la primera con «Nueva ruta»: de viaje entre ciudades o urbana por QR.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formUrbana && (
        <EditorRutaUrbana
          inicial={formUrbana}
          cabecera={!formUrbana.documentId ? selectorTipo : undefined}
          error={errorUrbana}
          guardando={guardarUrbana.isPending}
          onGuardar={(f) => guardarUrbana.mutate(f)}
          onCancelar={() => setFormUrbana(null)}
        />
      )}

      {form && (
        <div className={styles.velo}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
              {form.documentId ? 'Editar ruta de viaje' : 'Nueva ruta'}
            </h3>
            {!form.documentId && selectorTipo}
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 12 }}>
              <Field label="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
              <SelectorCiudad label="Origen" valor={form.origen} ciudades={ciudades ?? []} excluir={ciudadOficial(form.destino) ?? undefined} onCambio={(v) => setForm((f) => (f ? { ...f, origen: v } : f))} />
              <SelectorCiudad label="Destino" valor={form.destino} ciudades={ciudades ?? []} excluir={ciudadOficial(form.origen) ?? undefined} onCambio={(v) => setForm((f) => (f ? { ...f, destino: v } : f))} />
            </div>
            {errorCiudades && (
              <div style={{ fontSize: 12, color: 'var(--bad-text)', marginTop: 6 }}>
                No se pudo cargar la lista de ciudades ({errorCiudades instanceof ApiError ? `${errorCiudades.status || 'sin conexión'} · ${errorCiudades.code}` : 'sin conexión'}).
                {errorCiudades instanceof ApiError && errorCiudades.status === 404 ? ' El servidor todavía no tiene el catálogo de ciudades: hay que actualizar el API.' : ''}{' '}
                <button type="button" onClick={() => void recargarCiudades()} disabled={cargandoCiudades} style={{ fontWeight: 700, color: 'var(--blue-600)', cursor: 'pointer' }}>
                  {cargandoCiudades ? 'Reintentando…' : 'Reintentar'}
                </button>
              </div>
            )}
            {!errorCiudades && [form.origen, form.destino].some((c) => c.trim() && !ciudadOficial(c)) && (
              <div style={{ fontSize: 12, color: 'var(--warn-text, #92400E)', marginTop: 6 }}>
                Elige el origen y el destino de la lista: son las mismas ciudades para todas las líneas, así el pasajero encuentra tus pasajes.
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.idaYVuelta} onChange={(e) => setForm({ ...form, idaYVuelta: e.target.checked })} style={{ marginTop: 3 }} />
              <span>
                Ida y vuelta{ciudadOficial(form.origen) && ciudadOficial(form.destino) ? ` (${ciudadOficial(form.origen)} ⇄ ${ciudadOficial(form.destino)})` : ''}
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-soft)' }}>
                  Una sola ruta para los dos sentidos; eliges el sentido al programar cada salida. La vuelta puede tener su propio precio.
                </span>
              </span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <Field label="Duración (min)" type="number" value={form.duracionMin} onChange={(e) => setForm({ ...form, duracionMin: e.target.value })} />
              <Field label="Distancia (km)" type="number" value={form.distanciaKm} onChange={(e) => setForm({ ...form, distanciaKm: e.target.value })} />
            </div>
            {/* Un precio para el pasaje; las clases especiales (VIP, cama) son opcionales. Ningún bus aquí. */}
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field
                label="Precio del pasaje (USD)"
                type="number"
                placeholder="12"
                value={form.tarifas.find((t) => t.claseServicio === 'estandar')?.precioUsd ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tarifas: form.tarifas.some((t) => t.claseServicio === 'estandar')
                      ? form.tarifas.map((t) => (t.claseServicio === 'estandar' ? { ...t, precioUsd: e.target.value } : t))
                      : [{ claseServicio: 'estandar', precioUsd: e.target.value }, ...form.tarifas],
                  })
                }
              />
              {form.idaYVuelta && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.precioVuelta !== ''}
                      onChange={(e) => setForm({ ...form, precioVuelta: e.target.checked ? form.tarifas.find((t) => t.claseServicio === 'estandar')?.precioUsd || '0' : '' })}
                    />
                    La vuelta cuesta distinto
                  </label>
                  {form.precioVuelta !== '' && (
                    <Field
                      label={`Vuelta${ciudadOficial(form.destino) && ciudadOficial(form.origen) ? ` (${ciudadOficial(form.destino)} → ${ciudadOficial(form.origen)})` : ''} · USD`}
                      type="number"
                      value={form.precioVuelta === '0' ? '' : form.precioVuelta}
                      onChange={(e) => setForm({ ...form, precioVuelta: e.target.value || '0' })}
                    />
                  )}
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>
              Vale para todos los puestos. Si alguna unidad tiene clases especiales (VIP, cama), ponles su precio aquí abajo; las demás cobran el del pasaje.
            </div>
            <div style={{ marginTop: 10 }}>
              {form.tarifas.map((t, i) => t.claseServicio === 'estandar' ? null : (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 36px', gap: 8, marginBottom: 8 }}>
                  <select
                    className={ui.fieldInput}
                    value={t.claseServicio}
                    onChange={(e) =>
                      setForm({ ...form, tarifas: form.tarifas.map((x, j) => (j === i ? { ...x, claseServicio: e.target.value } : x)) })
                    }
                  >
                    <option value="">Clase de asiento…</option>
                    <option value="semicama">Semicama</option>
                    <option value="vip">VIP Cama</option>
                    <option value="cama_ejecutivo">Cama Ejecutivo</option>
                  </select>
                  <input
                    className={ui.fieldInput}
                    placeholder="USD"
                    type="number"
                    value={t.precioUsd}
                    onChange={(e) =>
                      setForm({ ...form, tarifas: form.tarifas.map((x, j) => (j === i ? { ...x, precioUsd: e.target.value } : x)) })
                    }
                  />
                  <button
                    style={{ color: 'var(--bad-text)', fontWeight: 700 }}
                    onClick={() => setForm({ ...form, tarifas: form.tarifas.filter((_, j) => j !== i) })}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className={ui.btnGhost}
                style={{ fontSize: 13 }}
                onClick={() => setForm({ ...form, tarifas: [...form.tarifas, { claseServicio: '', precioUsd: '' }] })}
              >
                + Precio para una clase especial
              </button>
            </div>
            {errorRutaViaje && <div style={{ fontSize: 13, color: 'var(--bad-text)', marginTop: 14 }}>{errorRutaViaje}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button className={ui.btnSecondary} onClick={() => { setForm(null); setErrorRutaViaje(null); }}>
                Cancelar
              </button>
              <button
                className={ui.btnPrimary}
                disabled={!ciudadOficial(form.destino) || !ciudadOficial(form.origen) || guardar.isPending}
                onClick={() => guardar.mutate(form)}
              >
                {guardar.isPending ? 'Guardando…' : 'Guardar ruta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
