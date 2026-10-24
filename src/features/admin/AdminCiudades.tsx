import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { borrarCiudad, crearCiudad, editarCiudad, getCiudades, type Ciudad } from '../../lib/api/endpoints';
import { ApiError, esSinConexion } from '../../lib/api/client';
import { EncabezadoPantalla } from '../../components/ui/EncabezadoPantalla';
import { Field } from '../../components/ui/Field';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Plataforma → Ciudades: el catálogo común de origen y destino de todas las
 * líneas. Un solo nombre por ciudad («San Cristóbal», no «Táchira» ni «Sn
 * Cristobal») para que el pasajero encuentre todos los pasajes juntos.
 */
export default function AdminCiudades() {
  const queryClient = useQueryClient();
  const [buscar, setBuscar] = useState('');
  const [nueva, setNueva] = useState({ nombre: '', estado: '' });
  const [editando, setEditando] = useState<{ id: number; nombre: string; estado: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: ciudades, isLoading } = useQuery({ queryKey: ['ciudades'], queryFn: getCiudades });

  const motivo = (e: unknown) => {
    const d = (e instanceof ApiError ? e.details : {}) as { existente?: string; rutas?: number };
    if (esSinConexion(e) || !(e instanceof ApiError)) return 'Sin conexión con el servidor.';
    if (e.code === 'ciudad_repetida') return `Ya existe como «${d.existente}».`;
    if (e.code === 'ciudad_en_uso') return `La usan ${d.rutas} ruta(s): renómbrala en vez de borrarla.`;
    return `No se pudo (${e.status} · ${e.code}).`;
  };
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['ciudades'] });
  const crear = useMutation({
    mutationFn: () => crearCiudad({ nombre: nueva.nombre.trim(), estado: nueva.estado.trim() || undefined }),
    onSuccess: () => {
      setNueva({ nombre: '', estado: '' });
      setError(null);
      refrescar();
    },
    onError: (e) => setError(motivo(e)),
  });
  const guardar = useMutation({
    mutationFn: () => editarCiudad(editando!.id, { nombre: editando!.nombre.trim(), estado: editando!.estado.trim() }),
    onSuccess: () => {
      setEditando(null);
      setError(null);
      refrescar();
    },
    onError: (e) => setError(motivo(e)),
  });
  const borrar = useMutation({
    mutationFn: (id: number) => borrarCiudad(id),
    onSuccess: () => {
      setError(null);
      refrescar();
    },
    onError: (e) => setError(motivo(e)),
  });

  const q = normalizar(buscar);
  const visibles = (ciudades ?? []).filter((c) => !q || normalizar(c.nombre).includes(q) || normalizar(c.estado ?? '').includes(q));

  return (
    <div className={styles.contenido} style={{ maxWidth: 980 }}>
      <EncabezadoPantalla
        titulo="Ciudades"
        descripcion="El origen y el destino de las rutas de todas las líneas salen de esta lista. Un solo nombre por ciudad, para que el pasajero encuentre todos los pasajes. Renombrar arregla las rutas que la usan. Cada ciudad se ubica sola en el mapa por su nombre."
        acciones={
          <input className={ui.fieldInput} style={{ width: 260 }} placeholder="Buscar ciudad o estado" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        }
      />

      <div className={ui.card} style={{ padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
        <Field label="Nueva ciudad" placeholder="Táriba" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
        <Field label="Estado" placeholder="Táchira" value={nueva.estado} onChange={(e) => setNueva({ ...nueva, estado: e.target.value })} />
        <button className={ui.btnPrimary} disabled={!nueva.nombre.trim() || crear.isPending} onClick={() => crear.mutate()}>
          {crear.isPending ? 'Agregando…' : 'Agregar'}
        </button>
      </div>
      {error && <div style={{ fontSize: 13, color: 'var(--bad-text)', marginBottom: 12 }}>{error}</div>}

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Ciudad</th>
              <th>Estado</th>
              <th>Mapa</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((c: Ciudad) =>
              editando?.id === c.id ? (
                <tr key={c.id}>
                  <td><input className={ui.fieldInput} value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} /></td>
                  <td><input className={ui.fieldInput} value={editando.estado} onChange={(e) => setEditando({ ...editando, estado: e.target.value })} /></td>
                  <td />
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className={ui.btnGhost} style={{ fontSize: 13, marginRight: 8 }} onClick={() => setEditando(null)}>Cancelar</button>
                    <button className={ui.btnPrimary} style={{ fontSize: 13 }} disabled={!editando.nombre.trim() || guardar.isPending} onClick={() => guardar.mutate()}>Guardar</button>
                  </td>
                </tr>
              ) : (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                  <td style={{ color: 'var(--text-soft)' }}>{c.estado ?? '—'}</td>
                  {/* Las nuevas se ubican solas por su nombre; «Sin ubicar» no sale como punto en el mapa de rutas */}
                  <td style={{ fontSize: 13, color: c.lat != null ? 'var(--text-soft)' : 'var(--warn-text, #92400E)' }}>{c.lat != null ? 'Ubicada' : 'Sin ubicar'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className={ui.btnGhost} style={{ fontSize: 13, marginRight: 12 }} onClick={() => setEditando({ id: c.id, nombre: c.nombre, estado: c.estado ?? '' })}>Renombrar</button>
                    <button
                      style={{ fontSize: 13, fontWeight: 600, color: 'var(--bad-text)' }}
                      onClick={() => {
                        if (confirm(`¿Borrar ${c.nombre}?`)) borrar.mutate(c.id);
                      }}
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              )
            )}
            {!isLoading && !visibles.length && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 22 }}>Ninguna ciudad coincide.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
