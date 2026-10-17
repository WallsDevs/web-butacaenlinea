import { useEffect, useState } from 'react';
import { useModulos } from '../../lib/useModulos';
import { AvisoIntegracion } from '../../components/ui/AvisoIntegracion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  eliminarRuta,
  eliminarRutaUrbana,
  getRutas,
  getRutasUrbanas,
  guardarRuta,
  guardarRutaUrbana,
} from '../../lib/api/endpoints';
import { useAuth } from '../../stores/auth';
import { duracion } from '../../lib/time';
import { Field } from '../../components/ui/Field';
import { PillTabs } from '../../components/ui/PillTabs';
import { StatusChip } from '../../components/ui/StatusChip';
import { EditorRutaUrbana, nuevaFormUrbana, type FormUrbana } from '../urbano/EditorRutaUrbana';
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
}

const NUEVA: FormRuta = {
  documentId: null,
  codigo: '',
  origen: 'San Cristóbal',
  destino: '',
  duracionMin: '',
  distanciaKm: '',
  tarifas: [{ claseServicio: 'estandar', precioUsd: '' }],
};

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
  const [tipo, setTipo] = useState<TipoRuta>('nacional');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [buscar, setBuscar] = useState('');

  const slug = useAuth((s) => s.usuario)?.linea?.slug;
  const { data: rutas, isLoading } = useQuery({ queryKey: ['rutas', slug], queryFn: () => getRutas(slug) });

  // Rutas urbanas: tarifa plana en Bs, sin asientos ni salidas (pasaje por QR)
  const [formUrbana, setFormUrbana] = useState<FormUrbana | null>(null);
  const { data: urbanas } = useQuery({ queryKey: ['rutas-urbanas'], queryFn: getRutasUrbanas });
  const guardarUrbana = useMutation({
    mutationFn: (f: FormUrbana) =>
      guardarRutaUrbana(f.documentId, {
        nombre: f.nombre.trim(),
        tarifaBs: Number(f.tarifaBs),
        activa: true,
        // El trazo por las calles y las paradas con nombre: lo que ve el pasajero
        recorrido: f.recorrido,
        paradas: f.paradas.map((x, i) => ({ ...x, orden: i + 1 })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas-urbanas'] });
      setFormUrbana(null);
    },
  });
  const eliminarUrbana = useMutation({
    mutationFn: (id: string) => eliminarRutaUrbana(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rutas-urbanas'] }),
  });

  const guardar = useMutation({
    mutationFn: (f: FormRuta) =>
      guardarRuta(f.documentId, {
        codigo: f.codigo,
        nombre: `Ruta ${f.codigo} · ${f.origen} — ${f.destino}`,
        origen: f.origen,
        destino: f.destino,
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
      <PillTabs<TipoRuta>
        items={[...(integracionActiva ? [] : [{ id: 'nacional' as const, label: 'Nacional' }]), { id: 'urbana' as const, label: 'Urbana' }]}
        value={tipo}
        onChange={(id) => abrirNuevo(id)}
      />
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
    medida: string;
    precio: string;
    texto: string;
    editar: () => void;
    eliminar: () => void;
    bloqueada: boolean;
  }
  const filas: Fila[] = [
    ...(rutas ?? []).map((r): Fila => ({
      clave: `n-${r.documentId}`,
      tipo: 'nacional',
      titulo: `${r.origen} → ${r.destino}`,
      sub: r.codigo ? `Código ${r.codigo}` : '',
      medida: r.duracionMin ? duracion(r.duracionMin) : '—',
      precio: (r.tarifas ?? []).map((t) => (t.claseServicio === 'estandar' ? `$${t.precioUsd}` : `${t.claseServicio} $${t.precioUsd}`)).join(' · ') || '—',
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
      medida: u.paradas?.length ? `${u.paradas.length} paradas` : '—',
      precio: `Bs ${Number(u.tarifaBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
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
              <Field label="Origen" value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })} />
              <Field label="Destino" value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} />
            </div>
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
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button className={ui.btnSecondary} onClick={() => setForm(null)}>
                Cancelar
              </button>
              <button
                className={ui.btnPrimary}
                disabled={!form.destino || !form.origen || guardar.isPending}
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
