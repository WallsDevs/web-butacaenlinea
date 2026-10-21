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
import { PillTabs } from '../../components/ui/PillTabs';
import { ModalRutaViaje, type FormRuta } from './ModalRutaViaje';
import { StatusChip } from '../../components/ui/StatusChip';
import { Letrero } from '../../components/ui/Letrero';
import { EditorRutaUrbana, nuevaFormUrbana, paradasParaGuardar, tramosDe, trazadoDe, type FormUrbana } from '../urbano/EditorRutaUrbana';
import type { Referencia } from '../urbano/MapaParadas';
import type { RutaUrbanaDto } from '../../lib/api/endpoints';
import type { RutaDto } from '../../lib/api/types';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';


const NUEVA: FormRuta = {
  documentId: null,
  codigo: '',
  origen: '',
  destino: '',
  duracionMin: '',
  distanciaKm: '',
  tarifas: [{ claseServicio: 'estandar', precioUsd: '' }],
  idaYVuelta: true,
  origenLugar: null,
  destinoLugar: null,
};

/** «San Cristóbal», «san cristobal» y «SAN CRISTÓBAL» son la misma ciudad. */
const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const NOMBRE_CLASE: Record<string, string> = { semicama: 'Semicama', vip: 'VIP Cama', cama_ejecutivo: 'Cama Ejecutivo' };

/** Las paradas de las otras rutas urbanas de la línea, juntas si están en el mismo sitio. */
function referenciasUrbanas(urbanas: RutaUrbanaDto[], actual: string | null): Referencia[] {
  const porSitio = new Map<string, Referencia>();
  for (const u of urbanas) {
    if (u.documentId === actual) continue;
    const lista = u.paradas ?? [];
    lista.forEach((p, i) => {
      if (p.lat == null || p.lng == null) return;
      const clave = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
      const terminal = i === 0 || i === lista.length - 1;
      const r = porSitio.get(clave);
      if (r) {
        if (!r.rutas.includes(u.nombre)) r.rutas.push(u.nombre);
        r.terminal ||= terminal;
      } else porSitio.set(clave, { nombre: p.nombre || 'Parada', lat: p.lat, lng: p.lng, rutas: [u.nombre], terminal });
    });
  }
  return [...porSitio.values()];
}

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
        // Cómo se arma cada tramo (puntos de paso o a mano), para poder seguir editándolo
        trazado: trazadoDe(f),
        paradas: paradasParaGuardar(f),
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
        // El sitio exacto marcado en el mapa (null = solo la ciudad)
        origenLugar: f.origenLugar,
        destinoLugar: f.destinoLugar,
        // Cada clase con su precio de vuelta si es distinto; si no, el mismo de la ida
        ...(f.idaYVuelta
          ? {
              tarifasVuelta: f.tarifas
                .filter((t) => t.claseServicio && Number(t.precioUsd) > 0)
                .map((t) => ({ claseServicio: t.claseServicio, precioUsd: Number(t.precioVuelta) > 0 ? Number(t.precioVuelta) : Number(t.precioUsd) })),
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
            : e instanceof ApiError && e.code === 'lugar_lejos_de_ciudad'
              ? `El sitio marcado queda a ${(d as { km?: number }).km} km de ${(d as { ciudad?: string }).ciudad}: márcalo dentro de esa ciudad.`
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
      // El precio de vuelta de cada clase sale de la ruta enlazada ('' = el mismo de la ida)
      tarifas: (r.tarifas ?? []).map((t) => {
        const pv = (rutas ?? []).find((x) => x.id === r.inversaId)?.tarifas?.find((v) => v.claseServicio === t.claseServicio)?.precioUsd;
        return { claseServicio: t.claseServicio, precioUsd: String(t.precioUsd), precioVuelta: pv != null && pv !== t.precioUsd ? String(pv) : '' };
      }),
      idaYVuelta: Boolean(r.idaYVuelta),
      origenLugar: r.origenLugar ?? null,
      destinoLugar: r.destinoLugar ?? null,
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
  // Compacto, en la misma fila del título: el mapa se lleva el alto
  const selectorTipo = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <div role="tablist" aria-label="Tipo de ruta" style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 10, background: 'var(--pill-bg, #EEF2F9)', flex: 'none' }}>
        {([...(integracionActiva ? [] : [['nacional', 'Nacional']]), ['urbana', 'Urbana']] as [TipoRuta, string][]).map(([id, etiqueta]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tipo === id}
            onClick={() => abrirNuevo(id)}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              fontSize: 13,
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
      <span style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.35, minWidth: 0 }} className="solo-ancho">
        {tipo === 'nacional' ? 'Entre ciudades · asientos y salidas · USD' : 'Dentro de la ciudad · pago con QR · Bs'}
      </span>
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
        // «$12» o «$12 / $10» (ida / vuelta) por clase
        const vuelta = r.idaYVuelta ? (rutas ?? []).find((x) => x.id === r.inversaId)?.tarifas : undefined;
        return (
          (r.tarifas ?? [])
            .map((t) => {
              const pv = vuelta?.find((v) => v.claseServicio === t.claseServicio)?.precioUsd;
              const monto = pv != null && pv !== t.precioUsd ? `$${t.precioUsd} / $${pv}` : `$${t.precioUsd}`;
              return t.claseServicio === 'estandar' ? monto : `${NOMBRE_CLASE[t.claseServicio] ?? t.claseServicio} ${monto}`;
            })
            .join(' · ') || '—'
        );
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
          referencias={referenciasUrbanas(urbanas ?? [], formUrbana.documentId)}
          cabecera={!formUrbana.documentId ? selectorTipo : undefined}
          error={errorUrbana}
          guardando={guardarUrbana.isPending}
          onGuardar={(f) => guardarUrbana.mutate(f)}
          onCancelar={() => setFormUrbana(null)}
        />
      )}

      {form && (
        <div className={styles.velo}>
          <ModalRutaViaje
            form={form}
            setForm={setForm}
            ciudades={ciudades ?? []}
            ciudadOficial={ciudadOficial}
            selectorTipo={!form.documentId ? selectorTipo : undefined}
            error={errorRutaViaje}
            guardando={guardar.isPending}
            onCancelar={() => {
              setForm(null);
              setErrorRutaViaje(null);
            }}
            onGuardar={() => guardar.mutate(form)}
            avisoCiudades={
              errorCiudades ? (
                <div style={{ fontSize: 12, color: 'var(--bad-text)' }}>
                  No se pudo cargar la lista de ciudades ({errorCiudades instanceof ApiError ? `${errorCiudades.status || 'sin conexión'} · ${errorCiudades.code}` : 'sin conexión'}).
                  {errorCiudades instanceof ApiError && errorCiudades.status === 404 ? ' El servidor todavía no tiene el catálogo de ciudades: hay que actualizar el API.' : ''}{' '}
                  <button type="button" onClick={() => void recargarCiudades()} disabled={cargandoCiudades} style={{ fontWeight: 700, color: 'var(--blue-600)', cursor: 'pointer' }}>
                    {cargandoCiudades ? 'Reintentando…' : 'Reintentar'}
                  </button>
                </div>
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
