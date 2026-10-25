import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ajusteRepuesto, crearRepuesto, entradaRepuesto, getMovimientosRepuesto, getRepuestos, getTableroMantenimiento } from '../../../lib/api/endpoints';
import type { RepuestoDto } from '../../../lib/api/types';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Field } from '../../../components/ui/Field';
import ui from '../../../components/ui/ui.module.css';
import styles from '../flota.module.css';
import { ErrorLinea, Modal, cantidad, conMedida, cuantoFalta, diaLargo, km, mensajeError, numeroDe, usd } from './comun';

type Vista = 'tablero' | 'inventario';

/** Flota → Mantenimiento: qué atender esta semana y el almacén de repuestos. */
export default function MantenimientoFlota() {
  const [vista, setVista] = useState<Vista>('tablero');
  return (
    <div className={styles.contenido}>
      <div className={ui.pillGroup} role="tablist" aria-label="Mantenimiento">
        {([['tablero', 'Tablero'], ['inventario', 'Inventario de repuestos']] as const).map(([v, t]) => (
          <button key={v} role="tab" aria-selected={vista === v} className={`${ui.pill} ${vista === v ? ui.pillActive : ''}`} onClick={() => setVista(v)}>{t}</button>
        ))}
      </div>
      {vista === 'tablero' ? <Tablero onInventario={() => setVista('inventario')} /> : <Inventario />}
    </div>
  );
}

function Tablero({ onInventario }: { onInventario: () => void }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['tablero-mant'], queryFn: getTableroMantenimiento, refetchInterval: 120_000 });
  if (isLoading || !data) return <div className={styles.notaSuave} style={{ marginTop: 20 }}>Cargando…</div>;
  const t = data.totales;
  const costoKm = t.km90 > 0 ? t.costo90Usd / t.km90 : null;
  const filas = [...data.unidades].sort((a, b) => b.vencidos - a.vencidos || Number(Boolean(b.enTaller)) - Number(Boolean(a.enTaller)) || b.porVencer - a.porVencer);

  return (
    <>
      <div className={styles.cifrasTablero}>
        <div className={styles.cifraTablero} data-tono={t.conVencidos ? 'bad' : undefined}><strong>{t.conVencidos}</strong><span>con servicios vencidos</span></div>
        <div className={styles.cifraTablero} data-tono={t.porVencer ? 'warn' : undefined}><strong>{t.porVencer}</strong><span>con algo por vencer</span></div>
        <div className={styles.cifraTablero}><strong>{t.enTaller}</strong><span>en el taller</span></div>
        <button className={styles.cifraTablero} data-tono={t.repuestosBajos ? 'warn' : undefined} onClick={onInventario}><strong>{t.repuestosBajos}</strong><span>repuestos bajo el mínimo</span></button>
        <div className={styles.cifraTablero}><strong>{usd(t.costo90Usd)}</strong><span>gastado en 90 días · {costoKm != null ? `$ ${costoKm.toFixed(3).replace('.', ',')} por km` : 'sin km medidos'}</span></div>
      </div>

      <div className={styles.cardHistorial}>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Qué atender</th>
                <th>Próximo servicio</th>
                <th style={{ width: 120 }}>Km / semana</th>
                <th style={{ width: 140 }}>Costo por km (90 días)</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((u) => (
                <tr key={u.documentId} className={styles.filaClic} onClick={() => navigate(`/empresa/flota/${u.documentId}`)}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{u.numero}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{u.placa ?? ''} · {km(u.kilometraje)} km</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      {u.enTaller && <StatusChip tono="info" size="sm">En taller · {u.enTaller.dias} día{u.enTaller.dias === 1 ? '' : 's'}</StatusChip>}
                      {u.vencidos > 0 && <StatusChip tono="bad" size="sm">{u.vencidos} vencido{u.vencidos === 1 ? '' : 's'}</StatusChip>}
                      {u.porVencer > 0 && <StatusChip tono="warn" size="sm">{u.porVencer} por vencer</StatusChip>}
                      {!u.enTaller && !u.vencidos && !u.porVencer && !u.sinPlan && <StatusChip tono="ok" size="sm">Al día</StatusChip>}
                      {u.sinPlan && <StatusChip tono="neutral" size="sm">Sin plan</StatusChip>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                      {u.enTaller ? u.enTaller.intervencion : u.alertas.map((a) => a.titulo).join(' · ')}
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {u.proximo ? (
                      <>
                        <div style={{ fontWeight: 600 }}>{u.proximo.nombre}</div>
                        <div style={{ color: u.proximo.tono === 'bad' ? 'var(--bad-text)' : 'var(--text-soft)' }}>{cuantoFalta(u.proximo)}</div>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-faint)' }}>{u.sinPlan ? 'Aplica el plan base en su ficha' : '—'}</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-soft)' }}>{u.promedioKmSemana ? km(u.promedioKmSemana) : '—'}</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{u.costoPorKmUsd != null ? `$ ${String(u.costoPorKmUsd).replace('.', ',')}` : '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{usd(u.costo90Usd)} · {km(u.km90)} km</div>
                  </td>
                </tr>
              ))}
              {!filas.length && (
                <tr><td colSpan={5} style={{ padding: 18, textAlign: 'center', color: 'var(--text-soft)' }}>Registra tus unidades en la pestaña Unidades.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Inventario() {
  const [busca, setBusca] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [accion, setAccion] = useState<{ tipo: 'entrada' | 'ajuste'; r: RepuestoDto } | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const { data: repuestos, isLoading } = useQuery({ queryKey: ['repuestos'], queryFn: () => getRepuestos() });
  const q = busca.trim().toLowerCase();
  const lista = (repuestos ?? []).filter((r) => !q || r.nombre.toLowerCase().includes(q) || (r.codigo ?? '').toLowerCase().includes(q));
  const valor = (repuestos ?? []).reduce((s, r) => s + r.valorUsd, 0);
  const bajos = (repuestos ?? []).filter((r) => r.bajo).length;

  return (
    <div className={styles.cardHistorial}>
      <div className={styles.historialCabecera} style={{ flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Inventario de repuestos</div>
          <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
            {repuestos?.length ?? 0} repuestos · valor {usd(valor)}{bajos ? ` · ${bajos} bajo el mínimo` : ''}. Lo que se usa en una orden se descuenta solo.
          </div>
        </div>
        <input className={ui.fieldInput} style={{ marginLeft: 'auto', width: 220 }} placeholder="Buscar por nombre o código" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar repuesto" />
        <button className={ui.btnPrimary} style={{ fontSize: 13, padding: '11px 18px' }} onClick={() => setNuevo(true)}>Nuevo repuesto</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Repuesto</th>
              <th style={{ width: 150 }}>Stock</th>
              <th style={{ width: 130 }}>Costo promedio</th>
              <th style={{ width: 110 }}>Valor</th>
              <th style={{ width: 230 }} aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {lista.map((r) => (
              <FilaInventario key={r.documentId} r={r} abierto={abierto === r.documentId} onAlternar={() => setAbierto((a) => (a === r.documentId ? null : r.documentId))} onAccion={(tipo) => setAccion({ tipo, r })} />
            ))}
            {!isLoading && !lista.length && (
              <tr>
                <td colSpan={5} style={{ padding: 18, textAlign: 'center', color: 'var(--text-soft)', fontSize: 13 }}>
                  {q ? 'Ningún repuesto coincide con la búsqueda.' : 'Carga tus repuestos (aceite, filtros, pastillas…) con su stock y costo para descontarlos en las órdenes.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {nuevo && <ModalRepuesto onCerrar={() => setNuevo(false)} />}
      {accion && <ModalMovimiento tipo={accion.tipo} r={accion.r} onCerrar={() => setAccion(null)} />}
    </div>
  );
}

function FilaInventario({ r, abierto, onAlternar, onAccion }: { r: RepuestoDto; abierto: boolean; onAlternar: () => void; onAccion: (t: 'entrada' | 'ajuste') => void }) {
  const { data: movs } = useQuery({ queryKey: ['movimientos-repuesto', r.documentId], queryFn: () => getMovimientosRepuesto(r.documentId), enabled: abierto });
  return (
    <>
      <tr>
        <td>
          <div style={{ fontWeight: 600 }}>{r.nombre}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{[r.codigo, r.categoria, r.ubicacion].filter(Boolean).join(' · ') || '—'}</div>
        </td>
        <td>
          <div style={{ fontWeight: 700 }}>{conMedida(r.stock, r.unidadMedida)}</div>
          {r.bajo ? <StatusChip tono="warn" size="sm">Mínimo {cantidad(r.stockMinimo)}</StatusChip> : r.stockMinimo > 0 ? <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>mínimo {cantidad(r.stockMinimo)}</div> : null}
        </td>
        <td style={{ color: 'var(--text-soft)' }}>{usd(r.costoPromedioUsd)}</td>
        <td style={{ fontWeight: 600 }}>{usd(r.valorUsd)}</td>
        <td>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className={ui.btnSecondary} style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => onAccion('entrada')}>Entrada</button>
            <button className={ui.btnGhost} style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => onAccion('ajuste')}>Conteo</button>
            <button className={ui.btnGhost} style={{ fontSize: 12, padding: '6px 10px' }} onClick={onAlternar} aria-expanded={abierto}>{abierto ? 'Ocultar' : 'Historial'}</button>
          </div>
        </td>
      </tr>
      {abierto && (
        <tr>
          <td colSpan={5} style={{ background: 'var(--surface-alt)' }}>
            {(movs ?? []).map((m) => (
              <div key={m.id} className={styles.movRepuesto}>
                <span style={{ width: 90 }}>{diaLargo(m.fecha.slice(0, 10))}</span>
                <span style={{ width: 70, fontWeight: 700, color: m.cantidad < 0 ? 'var(--bad-text)' : 'var(--text)' }}>{m.cantidad > 0 ? '+' : ''}{cantidad(m.cantidad)}</span>
                <span style={{ flex: 1 }}>
                  {m.tipo === 'entrada' ? `Entrada${m.proveedor ? ` · ${m.proveedor}` : ''}${m.costoUnitarioUsd != null ? ` · ${usd(m.costoUnitarioUsd)} c/u` : ''}` : m.tipo === 'salida' ? `Orden${m.unidad ? ` · unidad ${m.unidad}` : ''}${m.orden ? ` · ${m.orden.intervencion}` : ''}` : 'Ajuste por conteo'}
                  {m.nota ? ` · ${m.nota}` : ''}
                </span>
                <span style={{ color: 'var(--text-faint)' }}>quedan {cantidad(m.stockDespues)}</span>
              </div>
            ))}
            {movs && !movs.length && <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>Sin movimientos.</span>}
          </td>
        </tr>
      )}
    </>
  );
}

const MEDIDAS = [['unidad', 'Unidad'], ['litro', 'Litro'], ['galon', 'Galón'], ['kg', 'Kilo'], ['metro', 'Metro'], ['juego', 'Juego'], ['caja', 'Caja']] as const;

function ModalRepuesto({ onCerrar }: { onCerrar: () => void }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [medida, setMedida] = useState('unidad');
  const [stock, setStock] = useState('');
  const [costo, setCosto] = useState('');
  const [minimo, setMinimo] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => crearRepuesto({ nombre: nombre.trim(), codigo: codigo.trim() || undefined, categoria: categoria.trim() || undefined, unidadMedida: medida, stockInicial: numeroDe(stock) ?? 0, costoUnitarioUsd: numeroDe(costo) ?? 0, stockMinimo: numeroDe(minimo) ?? 0, ubicacion: ubicacion.trim() || undefined }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['repuestos'] }); void queryClient.invalidateQueries({ queryKey: ['tablero-mant'] }); onCerrar(); },
    onError: (e) => setError(mensajeError(e)),
  });
  return (
    <Modal titulo="Nuevo repuesto" nota="El stock inicial entra con su costo; las compras siguientes se registran con «Entrada» y el costo se promedia solo." onCerrar={onCerrar}>
      <form style={{ display: 'contents' }} onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <Field label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus placeholder="Ej.: Aceite 15W40" />
        <div className={styles.rejillaOrden}>
          <Field label="Código (opcional)" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          <Field label="Categoría (opcional)" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Motor, frenos…" />
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Se cuenta por</span>
            <select className={ui.fieldInput} value={medida} onChange={(e) => setMedida(e.target.value)}>
              {MEDIDAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
          <Field label="Stock actual" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
          <Field label="Costo por unidad (USD)" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="0" />
          <Field label="Avisar cuando queden" inputMode="decimal" value={minimo} onChange={(e) => setMinimo(e.target.value)} placeholder="0" />
        </div>
        <Field label="Ubicación en el almacén (opcional)" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
        <ErrorLinea texto={error} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className={ui.btnSecondary} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={ui.btnPrimary} disabled={!nombre.trim() || m.isPending}>{m.isPending ? 'Guardando…' : 'Agregar repuesto'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ModalMovimiento({ tipo, r, onCerrar }: { tipo: 'entrada' | 'ajuste'; r: RepuestoDto; onCerrar: () => void }) {
  const queryClient = useQueryClient();
  const [cant, setCant] = useState(tipo === 'ajuste' ? String(r.stock) : '');
  const [costo, setCosto] = useState(tipo === 'entrada' && r.costoPromedioUsd ? String(r.costoPromedioUsd) : '');
  const [proveedor, setProveedor] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () =>
      tipo === 'entrada'
        ? entradaRepuesto(r.documentId, { cantidad: numeroDe(cant) ?? 0, costoUnitarioUsd: numeroDe(costo) ?? -1, proveedor: proveedor.trim() || undefined, nota: nota.trim() || undefined })
        : ajusteRepuesto(r.documentId, { stockReal: numeroDe(cant) ?? -1, nota: nota.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['repuestos'] });
      void queryClient.invalidateQueries({ queryKey: ['movimientos-repuesto', r.documentId] });
      void queryClient.invalidateQueries({ queryKey: ['tablero-mant'] });
      onCerrar();
    },
    onError: (e) => setError(mensajeError(e)),
  });
  const n = numeroDe(cant);
  return (
    <Modal
      titulo={tipo === 'entrada' ? `Entrada de ${r.nombre}` : `Conteo de ${r.nombre}`}
      nota={tipo === 'entrada' ? `Hay ${conMedida(r.stock, r.unidadMedida)}. La compra suma al stock y el costo promedio se recalcula.` : `El sistema dice ${conMedida(r.stock, r.unidadMedida)}. Escribe lo que contaste; la diferencia queda registrada.`}
      onCerrar={onCerrar}
    >
      <form style={{ display: 'contents' }} onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <div className={styles.rejillaOrden}>
          <Field label={tipo === 'entrada' ? `Cantidad (${r.unidadMedida})` : `Contado (${r.unidadMedida})`} inputMode="decimal" value={cant} onChange={(e) => setCant(e.target.value)} autoFocus />
          {tipo === 'entrada' && <Field label="Costo por unidad (USD)" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} />}
        </div>
        {tipo === 'entrada' && <Field label="Proveedor (opcional)" value={proveedor} onChange={(e) => setProveedor(e.target.value)} />}
        <Field label={tipo === 'entrada' ? 'Nota (opcional)' : 'Motivo del ajuste'} value={nota} onChange={(e) => setNota(e.target.value)} placeholder={tipo === 'ajuste' ? 'Ej.: conteo de fin de mes' : 'Ej.: factura 0041'} />
        {tipo === 'ajuste' && n != null && n !== r.stock && <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>Diferencia: {n - r.stock > 0 ? '+' : ''}{conMedida(n - r.stock, r.unidadMedida)}</div>}
        <ErrorLinea texto={error} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className={ui.btnSecondary} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={ui.btnPrimary} disabled={n == null || (tipo === 'ajuste' && !nota.trim()) || (tipo === 'entrada' && numeroDe(costo) == null) || m.isPending}>
            {m.isPending ? 'Guardando…' : tipo === 'entrada' ? 'Registrar entrada' : 'Guardar conteo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
