import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import { construirConfiguracion, expandirConfiguracion, type PisoBuilder } from '../../lib/asientos';
import { SeatMap } from '../../components/seat-map/SeatMap';
import { Field } from '../../components/ui/Field';
import { PillTabs } from '../../components/ui/PillTabs';
import ui from '../../components/ui/ui.module.css';
import styles from './flota.module.css';

const CLASES = [
  { valor: 'semicama', nombre: 'Semicama' },
  { valor: 'vip', nombre: 'VIP Cama' },
  { valor: 'cama_ejecutivo', nombre: 'Cama Ejecutivo' },
];

const AMENIDADES = ['Wi-Fi', 'A/A', 'Baño', 'Pantallas', 'USB'];

const PISO_DEFECTO: PisoBuilder = { nombre: 'Semicama', claseServicio: 'semicama', layout: '2+2', filas: 10 };

/** Alta de unidad con armador de asientos y vista previa en vivo del mapa. */
export function NuevaUnidad({ onCerrar }: { onCerrar: (creada: boolean) => void }) {
  const queryClient = useQueryClient();
  const [datos, setDatos] = useState({ numero: '', placa: '', marcaModelo: '', anio: '', kilometraje: '' });
  const [pisos, setPisos] = useState<PisoBuilder[]>([{ ...PISO_DEFECTO }]);
  const [amenidades, setAmenidades] = useState<string[]>(['Wi-Fi', 'A/A', 'Baño']);
  const [pisoPreview, setPisoPreview] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const config = useMemo(() => construirConfiguracion(pisos), [pisos]);
  const preview = useMemo(() => expandirConfiguracion(config), [config]);
  const totalPuestos = preview.reduce((s, p) => s + p.totalAsientos, 0);

  const crear = useMutation({
    mutationFn: () =>
      api('/api/unidades', {
        method: 'POST',
        body: {
          data: {
            numero: datos.numero.trim(),
            placa: datos.placa.trim() || null,
            marcaModelo: datos.marcaModelo.trim() || null,
            anio: Number(datos.anio) || null,
            estado: 'disponible',
            kilometraje: Number(datos.kilometraje) || 0,
            kmUltimoCambioAceite: Number(datos.kilometraje) || 0,
            fechaUltimoCambioAceite: new Date().toISOString().slice(0, 10),
            intervaloAceiteKm: 15000,
            configuracionAsientos: config,
            configuracionEjes: {
              ejes:
                pisos.length > 1 || totalPuestos > 44
                  ? [
                      { numero: 1, nombre: 'Eje 1', tipo: 'direccional', porLado: 1 },
                      { numero: 2, nombre: 'Eje 2', tipo: 'traccion', porLado: 2 },
                      { numero: 3, nombre: 'Eje 3', tipo: 'porta', porLado: 2 },
                    ]
                  : [
                      { numero: 1, nombre: 'Eje 1', tipo: 'direccional', porLado: 1 },
                      { numero: 2, nombre: 'Eje 2', tipo: 'traccion', porLado: 2 },
                    ],
            },
            amenidades,
          },
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unidades'] });
      onCerrar(true);
    },
    onError: () => setError('No se pudo crear la unidad. ¿El número ya existe?'),
  });

  const actualizarPiso = (i: number, cambios: Partial<PisoBuilder>) =>
    setPisos((ps) => ps.map((p, j) => (j === i ? { ...p, ...cambios } : p)));

  return (
    <div className={styles.velo} onClick={() => onCerrar(false)}>
      <div
        className={styles.modal}
        style={{ width: 940, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700 }}>Nueva unidad</h3>
          <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4, marginBottom: 16 }}>
            El mapa de asientos de la venta se genera solo desde esta configuración.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: 12 }}>
            <Field label="Número" value={datos.numero} onChange={(e) => setDatos({ ...datos, numero: e.target.value })} autoFocus />
            <Field label="Placa" value={datos.placa} onChange={(e) => setDatos({ ...datos, placa: e.target.value })} />
            <Field label="Marca y modelo" value={datos.marcaModelo} onChange={(e) => setDatos({ ...datos, marcaModelo: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Año" type="number" value={datos.anio} onChange={(e) => setDatos({ ...datos, anio: e.target.value })} />
            <Field label="Kilometraje actual" type="number" value={datos.kilometraje} onChange={(e) => setDatos({ ...datos, kilometraje: e.target.value })} />
          </div>

          {/* Armador de pisos */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Asientos · {totalPuestos} puestos</span>
              <div style={{ marginLeft: 'auto' }}>
                <PillTabs
                  items={[
                    { id: '1', label: 'Piso sencillo' },
                    { id: '2', label: 'Doble piso' },
                  ]}
                  value={String(pisos.length)}
                  onChange={(id) => {
                    setPisos((ps) =>
                      id === '2' && ps.length === 1
                        ? [{ nombre: 'VIP Cama', claseServicio: 'vip', layout: '1+1', filas: 6 }, { ...ps[0] }]
                        : id === '1' && ps.length === 2
                          ? [ps[1]]
                          : ps
                    );
                    setPisoPreview(0);
                  }}
                />
              </div>
            </div>
            {pisos.map((p, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 110px 90px',
                  gap: 10,
                  marginTop: 10,
                  background: 'var(--surface-alt)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-12)',
                  padding: 12,
                }}
              >
                <label className={ui.field}>
                  <span className={ui.fieldLabel}>Piso {i + 1} · clase de servicio</span>
                  <select
                    className={ui.fieldInput}
                    value={p.claseServicio}
                    onChange={(e) => {
                      const clase = CLASES.find((c) => c.valor === e.target.value);
                      actualizarPiso(i, { claseServicio: e.target.value, nombre: clase?.nombre ?? e.target.value });
                    }}
                  >
                    {CLASES.map((c) => (
                      <option key={c.valor} value={c.valor}>{c.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className={ui.field}>
                  <span className={ui.fieldLabel}>Distribución</span>
                  <select
                    className={ui.fieldInput}
                    value={p.layout}
                    onChange={(e) => actualizarPiso(i, { layout: e.target.value as PisoBuilder['layout'] })}
                  >
                    <option value="1+1">1 + 1</option>
                    <option value="2+1">2 + 1</option>
                    <option value="2+2">2 + 2</option>
                  </select>
                </label>
                <Field
                  label="Filas"
                  type="number"
                  value={String(p.filas)}
                  onChange={(e) => actualizarPiso(i, { filas: Math.max(1, Math.min(15, Number(e.target.value) || 1)) })}
                />
              </div>
            ))}
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>
              Las clases de servicio deben coincidir con las tarifas de tus rutas (vip, semicama, cama_ejecutivo).
            </div>
          </div>

          {/* Amenidades */}
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {AMENIDADES.map((a) => (
              <button
                key={a}
                className={ui.pill}
                style={{
                  border: '1px solid var(--border-input)',
                  borderRadius: 'var(--r-pill)',
                  ...(amenidades.includes(a) ? { background: 'var(--tint-50)', color: 'var(--blue-700)', borderColor: 'var(--tint-300)' } : {}),
                }}
                onClick={() =>
                  setAmenidades((xs) => (xs.includes(a) ? xs.filter((x) => x !== a) : [...xs, a]))
                }
              >
                {a}
              </button>
            ))}
          </div>

          {error && <div style={{ fontSize: 13, color: 'var(--bad-text)', marginTop: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button className={ui.btnSecondary} onClick={() => onCerrar(false)}>
              Cancelar
            </button>
            <button
              className={ui.btnPrimary}
              disabled={!datos.numero.trim() || crear.isPending}
              onClick={() => crear.mutate()}
            >
              {crear.isPending ? 'Creando…' : 'Crear unidad'}
            </button>
          </div>
        </div>

        {/* Vista previa en vivo */}
        <div style={{ background: 'var(--surface-alt)', borderRadius: 'var(--r-16)', padding: 16, overflow: 'auto', maxHeight: 620 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)' }}>VISTA PREVIA</span>
            {preview.length > 1 && (
              <div style={{ marginLeft: 'auto' }}>
                <PillTabs
                  items={preview.map((p, i) => ({ id: String(i), label: `Piso ${p.numero}` }))}
                  value={String(pisoPreview)}
                  onChange={(id) => setPisoPreview(Number(id))}
                />
              </div>
            )}
          </div>
          {preview[pisoPreview] && (
            <SeatMap piso={preview[pisoPreview]} seleccionados={[]} size="movil" readOnly />
          )}
        </div>
      </div>
    </div>
  );
}
