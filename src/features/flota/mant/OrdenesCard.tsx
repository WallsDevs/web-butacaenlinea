import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cerrarOrden, crearOrden, getOrdenes, getPlan, getRepuestos, getResumenMantenimiento, type DatosOrden } from '../../../lib/api/endpoints';
import type { OrdenMantenimientoDto } from '../../../lib/api/types';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Field } from '../../../components/ui/Field';
import ui from '../../../components/ui/ui.module.css';
import styles from '../flota.module.css';
import { ErrorLinea, Modal, cantidad, conMedida, enteroDe, fechaCortaVe, hoyVe, km, mensajeError, numeroDe, usd } from './comun';

/**
 * Historial de órdenes de trabajo de la unidad. Las abiertas (unidad en el
 * taller o falla reportada por el conductor) van arriba con «Cerrar orden».
 */
export function OrdenesCard({ unidadId, kilometraje, esEmpresa }: { unidadId: string; kilometraje: number; esEmpresa: boolean }) {
  const queryClient = useQueryClient();
  const { data: ordenes } = useQuery({ queryKey: ['ordenes', unidadId], queryFn: () => getOrdenes(unidadId) });
  const { data: resumen } = useQuery({ queryKey: ['resumen-mant', unidadId], queryFn: () => getResumenMantenimiento(unidadId) });
  const [modal, setModal] = useState<{ modo: 'crear' } | { modo: 'cerrar'; orden: OrdenMantenimientoDto } | null>(null);
  const lista = useMemo(() => [...(ordenes ?? [])].sort((a, b) => Number(a.estado !== 'abierta') - Number(b.estado !== 'abierta')), [ordenes]);

  const listo = () => {
    for (const k of ['ordenes', 'resumen-mant', 'plan', 'alertas', 'unidad']) void queryClient.invalidateQueries({ queryKey: [k, unidadId] });
    void queryClient.invalidateQueries({ queryKey: ['repuestos'] });
    void queryClient.invalidateQueries({ queryKey: ['tablero-mant'] });
  };

  return (
    <div className={styles.cardHistorial}>
      <div className={styles.historialCabecera}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Órdenes de trabajo</div>
        {esEmpresa && (
          <button className={ui.btnPrimary} style={{ marginLeft: 'auto', fontSize: 13, padding: '11px 18px' }} onClick={() => setModal({ modo: 'crear' })}>
            Nueva orden
          </button>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th style={{ width: 110 }}>Fecha</th>
              <th style={{ width: 130 }}>Tipo</th>
              <th>Trabajo</th>
              <th style={{ width: 100 }}>Km</th>
              <th style={{ width: 170 }}>Taller</th>
              <th style={{ width: 130 }}>Costo</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((o) => (
              <tr key={o.documentId} className={o.estado === 'abierta' ? styles.filaAbierta : undefined}>
                <td>
                  {fechaCortaVe(o.fecha)}
                  {o.estado === 'cerrada' && o.fechaFin && o.fechaFin !== o.fecha && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>al {fechaCortaVe(o.fechaFin)}</div>}
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                    <StatusChip tono={o.tipo === 'correctivo' ? 'bad' : 'info'} size="sm">{o.tipo === 'correctivo' ? 'Correctivo' : 'Preventivo'}</StatusChip>
                    {o.estado === 'abierta' && <StatusChip tono="warn" size="sm">Abierta</StatusChip>}
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{o.intervencion}</div>
                  {o.detalle && <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{o.detalle}</div>}
                  {o.repuestos.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                      Repuestos: {o.repuestos.map((r) => `${r.nombre} × ${cantidad(r.cantidad)}`).join(', ')}
                    </div>
                  )}
                  {o.estado === 'abierta' && esEmpresa && (
                    <button className={ui.btnSecondary} style={{ marginTop: 8, fontSize: 12, padding: '6px 12px' }} onClick={() => setModal({ modo: 'cerrar', orden: o })}>
                      Cerrar orden
                    </button>
                  )}
                </td>
                <td style={{ color: 'var(--text-soft)' }}>{km(o.km)}</td>
                <td style={{ color: 'var(--text-soft)' }}>
                  {o.taller || '—'}
                  {o.tallerTipo && <div style={{ fontSize: 11 }}>{o.tallerTipo === 'propio' ? 'Taller propio' : 'Taller externo'}</div>}
                </td>
                <td>
                  <div style={{ fontWeight: 700 }}>{o.estado === 'abierta' && !o.costoUsd ? '—' : usd(o.costoUsd)}</div>
                  {o.costoRepuestosUsd > 0 && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{usd(o.costoRepuestosUsd)} en repuestos</div>}
                </td>
              </tr>
            ))}
            {!lista.length && (
              <tr>
                <td colSpan={6} style={{ padding: 18, textAlign: 'center', color: 'var(--text-soft)', fontSize: 13 }}>
                  Sin órdenes todavía. Registra aquí cada servicio y reparación para conocer el costo real de la unidad.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className={styles.pieHistorial}>
        <span>Costo {resumen?.anio} <strong>{usd(resumen?.costoAnioUsd)}</strong></span>
        <span>En repuestos <strong>{usd(resumen?.repuestosAnioUsd)}</strong></span>
        <span>Recorrido en el año <strong>{km(resumen?.kmAnio)} km</strong></span>
        <span>Costo por km <strong>{resumen?.costoPorKmUsd != null ? `$ ${String(resumen.costoPorKmUsd).replace('.', ',')}` : '—'}</strong></span>
        <span className={styles.diasFuera}>Días fuera de servicio <strong>{resumen?.diasFueraServicio ?? 0}</strong></span>
      </div>
      {modal && (
        <ModalOrden
          unidadId={unidadId}
          kilometraje={kilometraje}
          orden={modal.modo === 'cerrar' ? modal.orden : null}
          onCerrar={(hecho) => {
            setModal(null);
            if (hecho) listo();
          }}
        />
      )}
    </div>
  );
}

type FilaRepuesto = { repuesto: string; cantidad: string };

/** Crear una orden (ya hecha o que entra al taller) o cerrar una abierta. */
export function ModalOrden({ unidadId, kilometraje, orden, onCerrar }: { unidadId: string; kilometraje: number; orden: OrdenMantenimientoDto | null; onCerrar: (hecho: boolean) => void }) {
  const cerrando = Boolean(orden);
  const { data: plan } = useQuery({ queryKey: ['plan', unidadId], queryFn: () => getPlan(unidadId) });
  const { data: repuestos } = useQuery({ queryKey: ['repuestos'], queryFn: () => getRepuestos() });
  const [tipo, setTipo] = useState<'preventivo' | 'correctivo'>(orden?.tipo ?? 'preventivo');
  const [estado, setEstado] = useState<'cerrada' | 'abierta'>('cerrada');
  const [fecha, setFecha] = useState(hoyVe());
  const [fechaFin, setFechaFin] = useState(hoyVe() < (orden?.fecha ?? '') ? orden!.fecha : hoyVe());
  const [kmTexto, setKmTexto] = useState(String(orden?.km ?? kilometraje));
  const [intervencion, setIntervencion] = useState(orden?.intervencion ?? '');
  const [detalle, setDetalle] = useState(orden?.detalle ?? '');
  const [tallerTipo, setTallerTipo] = useState<'propio' | 'externo'>(orden?.tallerTipo ?? 'propio');
  const [taller, setTaller] = useState(orden?.taller ?? '');
  const [manoObra, setManoObra] = useState(orden?.costoManoObraUsd ? String(orden.costoManoObraUsd) : '');
  const [servicios, setServicios] = useState<string[]>([]);
  const [filas, setFilas] = useState<FilaRepuesto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const finalizada = cerrando || estado === 'cerrada';

  const porId = new Map((repuestos ?? []).map((r) => [r.documentId, r]));
  const costoRepuestos = filas.reduce((s, f) => s + (numeroDe(f.cantidad) ?? 0) * (porId.get(f.repuesto)?.costoPromedioUsd ?? 0), 0);
  const total = (numeroDe(manoObra) ?? 0) + costoRepuestos + (orden?.costoRepuestosUsd ?? 0);
  const repuestosValidos = filas.filter((f) => f.repuesto && (numeroDe(f.cantidad) ?? 0) > 0);
  const filaMala = filas.some((f) => f.repuesto && !((numeroDe(f.cantidad) ?? 0) > 0));

  const guardar = useMutation({
    mutationFn: () => {
      const datos: DatosOrden = {
        intervencion: intervencion.trim(),
        detalle: detalle.trim() || undefined,
        km: enteroDe(kmTexto) ?? kilometraje,
        tallerTipo,
        taller: taller.trim() || undefined,
        costoManoObraUsd: numeroDe(manoObra) ?? 0,
        repuestos: repuestosValidos.map((f) => ({ repuesto: f.repuesto, cantidad: numeroDe(f.cantidad)! })),
        ...(finalizada ? { servicios, fechaFin } : {}),
      };
      if (orden) return cerrarOrden(orden.documentId, datos);
      return crearOrden({ ...datos, unidad: unidadId, tipo, fecha, estado, enTaller: estado === 'abierta' });
    },
    onSuccess: () => onCerrar(true),
    onError: (e) => setError(mensajeError(e)),
  });

  const alternar = (clave: string) => setServicios((s) => (s.includes(clave) ? s.filter((x) => x !== clave) : [...s, clave]));

  return (
    <Modal
      ancho={640}
      titulo={cerrando ? `Cerrar orden: ${orden!.intervencion}` : 'Nueva orden de trabajo'}
      nota={cerrando ? `Abierta el ${fechaCortaVe(orden!.fecha)}. Anota lo que se hizo; los servicios marcados reinician su contador y la unidad vuelve a estar activa.` : undefined}
      onCerrar={() => onCerrar(false)}
    >
      {!cerrando && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className={ui.pillGroup} role="group" aria-label="Tipo">
            {(['preventivo', 'correctivo'] as const).map((t) => (
              <button key={t} type="button" className={`${ui.pill} ${tipo === t ? ui.pillActive : ''}`} onClick={() => setTipo(t)}>{t === 'preventivo' ? 'Preventivo' : 'Correctivo'}</button>
            ))}
          </div>
          <div className={ui.pillGroup} role="group" aria-label="Estado">
            <button type="button" className={`${ui.pill} ${estado === 'cerrada' ? ui.pillActive : ''}`} onClick={() => setEstado('cerrada')}>Ya se hizo</button>
            <button type="button" className={`${ui.pill} ${estado === 'abierta' ? ui.pillActive : ''}`} onClick={() => setEstado('abierta')}>Entra al taller</button>
          </div>
        </div>
      )}
      <Field label={cerrando ? 'Qué se hizo' : estado === 'abierta' ? 'Qué se le va a hacer o qué falla tiene' : 'Qué se hizo'} value={intervencion} onChange={(e) => setIntervencion(e.target.value)} autoFocus={!cerrando} placeholder="Ej.: Cambio de pastillas delanteras" />
      <Field label="Detalle (opcional)" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
      <div className={styles.rejillaOrden}>
        {!cerrando && <Field label={estado === 'abierta' ? 'Entró al taller' : 'Fecha'} type="date" value={fecha} max={hoyVe()} onChange={(e) => { setFecha(e.target.value); if (fechaFin < e.target.value) setFechaFin(e.target.value); }} />}
        {finalizada && (cerrando || estado === 'cerrada') && <Field label={cerrando ? 'Salió del taller' : 'Terminó'} type="date" value={fechaFin} min={orden?.fecha ?? fecha} onChange={(e) => setFechaFin(e.target.value)} />}
        <Field label="Km de la unidad" inputMode="numeric" value={kmTexto} onChange={(e) => setKmTexto(e.target.value)} />
      </div>

      <div>
        <div className={styles.etiquetaGrupo}>Taller</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className={ui.pillGroup} role="group" aria-label="Taller">
            <button type="button" className={`${ui.pill} ${tallerTipo === 'propio' ? ui.pillActive : ''}`} onClick={() => setTallerTipo('propio')}>Propio</button>
            <button type="button" className={`${ui.pill} ${tallerTipo === 'externo' ? ui.pillActive : ''}`} onClick={() => setTallerTipo('externo')}>Externo</button>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Field label={tallerTipo === 'propio' ? 'Mecánico o área (opcional)' : 'Nombre del taller'} value={taller} onChange={(e) => setTaller(e.target.value)} />
          </div>
        </div>
      </div>

      {finalizada && plan && plan.servicios.length > 0 && (
        <div>
          <div className={styles.etiquetaGrupo}>Servicios del plan que se hicieron</div>
          <div className={styles.chipsServicios}>
            {plan.servicios.filter((s) => s.activo).map((s) => (
              <label key={s.clave} className={`${styles.chipServicio} ${servicios.includes(s.clave) ? styles.chipServicioSel : ''}`}>
                <input type="checkbox" checked={servicios.includes(s.clave)} onChange={() => alternar(s.clave)} />
                {s.nombre}
              </label>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>Su contador vuelve a cero con el km y la fecha de esta orden.</p>
        </div>
      )}

      <div>
        <div className={styles.etiquetaGrupo}>Repuestos del almacén</div>
        {orden && orden.repuestos.length > 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 6 }}>Ya usados: {orden.repuestos.map((r) => `${r.nombre} × ${cantidad(r.cantidad)}`).join(', ')}</p>
        )}
        {filas.map((f, i) => {
          const r = porId.get(f.repuesto);
          const pedido = numeroDe(f.cantidad) ?? 0;
          return (
            <div key={i} className={styles.filaRepuesto}>
              <select className={ui.fieldInput} value={f.repuesto} onChange={(e) => setFilas((fs) => fs.map((x, j) => (j === i ? { ...x, repuesto: e.target.value } : x)))} aria-label="Repuesto">
                <option value="">Escoge un repuesto…</option>
                {(repuestos ?? []).map((x) => (
                  <option key={x.documentId} value={x.documentId} disabled={x.stock <= 0}>
                    {x.nombre}{x.codigo ? ` (${x.codigo})` : ''} · quedan {conMedida(x.stock, x.unidadMedida)}
                  </option>
                ))}
              </select>
              <input className={ui.fieldInput} style={{ width: 90 }} inputMode="decimal" placeholder="Cant." value={f.cantidad} onChange={(e) => setFilas((fs) => fs.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)))} aria-label="Cantidad" />
              <span className={styles.costoFila} style={r && pedido > r.stock ? { color: 'var(--bad-text)' } : undefined}>
                {r ? (pedido > r.stock ? `Solo hay ${cantidad(r.stock)}` : usd(pedido * r.costoPromedioUsd)) : ''}
              </span>
              <button type="button" className={ui.btnGhost} style={{ fontSize: 12, padding: '6px 8px' }} onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))} aria-label="Quitar repuesto">✕</button>
            </div>
          );
        })}
        {repuestos && repuestos.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>El inventario está vacío. Carga tus repuestos en Flota → Mantenimiento → Inventario.</p>
        ) : (
          <button type="button" className={ui.btnGhost} style={{ fontSize: 13, padding: '6px 0' }} onClick={() => setFilas((fs) => [...fs, { repuesto: '', cantidad: '1' }])}>
            + Agregar repuesto
          </button>
        )}
      </div>

      <div className={styles.rejillaOrden}>
        <Field label={tallerTipo === 'externo' ? 'Lo que cobró el taller (USD)' : 'Mano de obra (USD)'} inputMode="decimal" value={manoObra} onChange={(e) => setManoObra(e.target.value)} placeholder="0" />
        <div className={styles.totalOrden}>
          <span>Total de la orden</span>
          <strong>{usd(total)}</strong>
        </div>
      </div>

      <ErrorLinea texto={error} />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className={ui.btnSecondary} onClick={() => onCerrar(false)}>Cancelar</button>
        <button className={ui.btnPrimary} disabled={!intervencion.trim() || filaMala || guardar.isPending} onClick={() => guardar.mutate()}>
          {guardar.isPending ? 'Guardando…' : cerrando ? 'Cerrar orden' : estado === 'abierta' ? 'Abrir orden' : 'Registrar orden'}
        </button>
      </div>
    </Modal>
  );
}
