import { useState } from 'react';
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
  tarifas: [{ claseServicio: 'semicama', precioUsd: '' }],
};

/** Rutas y tarifas por clase de servicio. */
export default function EmpresaRutas() {
  const queryClient = useQueryClient();
  const { integracionActiva } = useModulos();
  const [form, setForm] = useState<FormRuta | null>(null);

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

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {isLoading ? 'Cargando…' : `${rutas?.length ?? 0} rutas`}
        </h2>
        {!integracionActiva && (
          <button className={ui.btnPrimary} style={{ marginLeft: 'auto', fontSize: 14, padding: '12px 20px' }} onClick={() => setForm(NUEVA)}>
            Nueva ruta
          </button>
        )}
      </div>
      {integracionActiva && <AvisoIntegracion que="rutas y tarifas" />}

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th style={{ width: 70 }}>Código</th>
              <th>Trayecto</th>
              <th>Duración</th>
              <th>Tarifas (USD)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(rutas ?? []).map((r) => (
              <tr key={r.documentId}>
                <td style={{ fontWeight: 700 }}>{r.codigo}</td>
                <td style={{ fontWeight: 600 }}>
                  {r.origen} → {r.destino}
                </td>
                <td style={{ color: 'var(--text-soft)' }}>{r.duracionMin ? duracion(r.duracionMin) : '—'}</td>
                <td style={{ color: 'var(--text-soft)', fontSize: 13 }}>
                  {(r.tarifas ?? []).map((t) => `${t.claseServicio} $${t.precioUsd}`).join(' · ') || '—'}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className={ui.btnGhost} style={{ fontSize: 13, marginRight: 12 }} onClick={() => editar(r)} hidden={integracionActiva}>
                    Editar
                  </button>
                  <button
                    hidden={integracionActiva}
                    style={{ fontSize: 13, fontWeight: 600, color: 'var(--bad-text)' }}
                    onClick={() => {
                      if (confirm(`¿Eliminar la ruta ${r.origen} → ${r.destino}?`)) eliminar.mutate(r.documentId);
                    }}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', margin: '32px 0 16px' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Rutas urbanas</h2>
          <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
            Tarifa plana en bolívares; el pasajero paga escaneando el QR de la unidad. Sin asientos, sin salidas, sin equipaje.
          </div>
        </div>
        <button
          className={ui.btnSecondary}
          style={{ marginLeft: 'auto', fontSize: 14 }}
          onClick={() => setFormUrbana(nuevaFormUrbana())}
        >
          Nueva ruta urbana
        </button>
      </div>
      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Ruta</th>
              <th>Pasaje (Bs)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(urbanas ?? []).map((u) => (
              <tr key={u.documentId}>
                <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                <td>Bs {Number(u.tarifaBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    className={ui.btnGhost}
                    style={{ fontSize: 13, marginRight: 12 }}
                    onClick={() => setFormUrbana(nuevaFormUrbana(u))}
                  >
                    Editar
                  </button>
                  <button
                    style={{ fontSize: 13, fontWeight: 600, color: 'var(--bad-text)' }}
                    onClick={() => {
                      if (confirm(`¿Eliminar la ruta urbana ${u.nombre}?`)) eliminarUrbana.mutate(u.documentId);
                    }}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {!urbanas?.length && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 22 }}>
                  Sin rutas urbanas. Crea una y asígnala a tus unidades en la ficha de cada bus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formUrbana && (
        <EditorRutaUrbana
          inicial={formUrbana}
          guardando={guardarUrbana.isPending}
          onGuardar={(f) => guardarUrbana.mutate(f)}
          onCancelar={() => setFormUrbana(null)}
        />
      )}

      {form && (
        <div className={styles.velo}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
              {form.documentId ? 'Editar ruta' : 'Nueva ruta'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 12 }}>
              <Field label="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
              <Field label="Origen" value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })} />
              <Field label="Destino" value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <Field label="Duración (min)" type="number" value={form.duracionMin} onChange={(e) => setForm({ ...form, duracionMin: e.target.value })} />
              <Field label="Distancia (km)" type="number" value={form.distanciaKm} onChange={(e) => setForm({ ...form, distanciaKm: e.target.value })} />
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>
                Precio por clase de asiento — la salida solo se puede programar si la ruta tiene
                tarifa para cada clase de la unidad.
              </div>
              {form.tarifas.map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 36px', gap: 8, marginBottom: 8 }}>
                  <select
                    className={ui.fieldInput}
                    value={t.claseServicio}
                    onChange={(e) =>
                      setForm({ ...form, tarifas: form.tarifas.map((x, j) => (j === i ? { ...x, claseServicio: e.target.value } : x)) })
                    }
                  >
                    <option value="">Clase de asiento…</option>
                    <option value="estandar">Estándar</option>
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
                + Agregar clase
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
