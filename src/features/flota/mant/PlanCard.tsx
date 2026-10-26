import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { actualizarAceite, actualizarItem, aplicarPlanBase, borrarItem, crearItem, getAlertas, getPlan, type DatosItem } from '../../../lib/api/endpoints';
import type { ServicioPlan } from '../../../lib/api/types';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Field } from '../../../components/ui/Field';
import ui from '../../../components/ui/ui.module.css';
import styles from '../flota.module.css';
import { ErrorLinea, Modal, cuantoFalta, enteroDe, fechaCortaVe, km, mensajeError } from './comun';

const TONO_TEXTO = { bad: 'Vencido', warn: 'Pronto', ok: 'Al día' } as const;

/**
 * Plan de mantenimiento de la unidad: cada servicio (aceite, filtros,
 * frenos…) con cuánto falta en km y en días. Los días salen del promedio
 * real de km que mide el GPS. Al cerrar una orden marcando el servicio, su
 * contador vuelve a cero solo.
 */
export function PlanCard({ unidadId, esEmpresa }: { unidadId: string; esEmpresa: boolean }) {
  const queryClient = useQueryClient();
  const { data: plan, isLoading } = useQuery({ queryKey: ['plan', unidadId], queryFn: () => getPlan(unidadId) });
  const { data: alertas } = useQuery({ queryKey: ['alertas', unidadId], queryFn: () => getAlertas(unidadId) });
  const [editando, setEditando] = useState<ServicioPlan | 'nuevo' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = useMutation({
    mutationFn: () => aplicarPlanBase(unidadId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plan', unidadId] });
      void queryClient.invalidateQueries({ queryKey: ['alertas', unidadId] });
      void queryClient.invalidateQueries({ queryKey: ['unidad', unidadId] });
    },
    onError: (e) => setError(mensajeError(e)),
  });

  const servicios = plan?.servicios ?? [];
  // Solo el aceite (vive en la unidad) no es un plan: se ofrece el plan base
  const sinPlan = !servicios.some((s) => s.clave !== 'aceite');
  const nombres = new Set(servicios.map((s) => s.nombre));
  // Lo que no es del plan: documentos por vencer y cauchos
  const otras = (alertas ?? []).filter((a) => a.tono !== 'ok' && !nombres.has(a.titulo) && !/aceite/i.test(a.titulo));

  return (
    <div className={styles.cardPlan}>
      <div className={styles.historialCabecera} style={{ padding: 0 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Plan de mantenimiento</div>
          <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
            {plan?.promedioKmSemana
              ? `Las fechas se estiman con ${km(plan.promedioKmSemana)} km por semana, el promedio real de esta unidad.`
              : 'Cuando haya una semana de recorridos del GPS, también verás la fecha estimada de cada servicio.'}
          </div>
        </div>
        {esEmpresa && !sinPlan && (
          <button className={ui.btnSecondary} style={{ marginLeft: 'auto', fontSize: 13, padding: '10px 16px' }} onClick={() => setEditando('nuevo')}>
            Agregar servicio
          </button>
        )}
      </div>

      <div className={styles.planLayout}>
        <div>
          {!isLoading && sinPlan && (
            <div className={styles.vacio} style={servicios.length ? { marginBottom: 16 } : undefined}>
              <div style={{ fontWeight: 700 }}>Esta unidad todavía no tiene plan</div>
              <p>
                El plan base trae {servicios.length ? 'filtros,' : 'aceite cada 10.000 km, filtros,'} frenos, alineación, correas, refrigerante, engrase y extintor. Cuenta desde hoy y el km actual; después ajustas los intervalos a tu flota.
              </p>
              {esEmpresa ? (
                <button className={ui.btnPrimary} disabled={base.isPending} onClick={() => base.mutate()}>
                  {base.isPending ? 'Aplicando…' : 'Aplicar plan base'}
                </button>
              ) : (
                <p>La empresa lo configura desde su cuenta.</p>
              )}
              <ErrorLinea texto={error} />
            </div>
          )}
          <ul className={styles.listaPlan}>
            {servicios.map((s) => (
              <li key={s.clave} className={`${styles.filaPlan} ${!s.activo ? styles.filaPlanPausada : ''}`}>
                <div className={styles.filaPlanTexto}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700 }}>{s.nombre}</span>
                    {s.activo ? <StatusChip tono={s.tono} size="sm">{TONO_TEXTO[s.tono]}</StatusChip> : <StatusChip tono="neutral" size="sm">En pausa</StatusChip>}
                  </div>
                  <div className={styles.filaPlanNota}>
                    {cuantoFalta(s)}
                    <span className={styles.filaPlanCada}>
                      {' · cada '}
                      {[s.intervaloKm ? `${km(s.intervaloKm)} km` : null, s.intervaloDias ? `${s.intervaloDias} días` : null].filter(Boolean).join(' o ')}
                      {s.ultimoKm != null || s.ultimaFecha ? ` · último ${[s.ultimoKm != null ? `${km(s.ultimoKm)} km` : null, s.ultimaFecha ? fechaCortaVe(s.ultimaFecha) : null].filter(Boolean).join(', ')}` : ''}
                    </span>
                  </div>
                  <div className={styles.barraPlan} aria-hidden>
                    <div className={`${styles.barraPlanRelleno} ${s.tono === 'bad' ? styles.barraBad : s.tono === 'warn' ? styles.barraWarn : ''}`} style={{ width: `${Math.round(s.progreso * 100)}%` }} />
                  </div>
                </div>
                {esEmpresa && (
                  <button className={ui.btnGhost} style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setEditando(s)} aria-label={`Editar ${s.nombre}`}>
                    Editar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <aside className={styles.otrasAlertas}>
          <div className={styles.kicker}>Documentos y cauchos</div>
          {otras.length ? (
            otras.map((a, i) => (
              <div key={i} className={`${styles.alerta} ${a.tono === 'bad' ? styles.alertaBad : styles.alertaWarn}`}>
                <div className={styles.alertaTitulo}>{a.titulo}</div>
                <div className={styles.alertaNota}>{a.nota}</div>
              </div>
            ))
          ) : (
            <div className={`${styles.alerta} ${styles.alertaOk}`} style={{ fontSize: 13 }}>Documentos y cauchos al día.</div>
          )}
        </aside>
      </div>

      {editando && <ModalServicio unidadId={unidadId} servicio={editando === 'nuevo' ? null : editando} onCerrar={() => setEditando(null)} />}
    </div>
  );
}

function ModalServicio({ unidadId, servicio, onCerrar }: { unidadId: string; servicio: ServicioPlan | null; onCerrar: () => void }) {
  const queryClient = useQueryClient();
  const esAceite = servicio?.clave === 'aceite';
  const [nombre, setNombre] = useState(servicio?.nombre ?? '');
  const [control, setControl] = useState<'kilometraje' | 'fecha' | 'ambos'>(servicio?.controlPor ?? 'kilometraje');
  const [intervaloKm, setIntervaloKm] = useState(servicio?.intervaloKm ? String(servicio.intervaloKm) : '');
  const [intervaloDias, setIntervaloDias] = useState(servicio?.intervaloDias ? String(servicio.intervaloDias) : '');
  const [ultimoKm, setUltimoKm] = useState(servicio?.ultimoKm != null ? String(servicio.ultimoKm) : '');
  const [ultimaFecha, setUltimaFecha] = useState(servicio?.ultimaFecha ?? '');
  const [error, setError] = useState<string | null>(null);
  const porKm = control !== 'fecha';
  const porFecha = control !== 'kilometraje';

  const listo = () => {
    for (const k of ['plan', 'alertas', 'unidad']) void queryClient.invalidateQueries({ queryKey: [k, unidadId] });
    onCerrar();
  };
  const guardar = useMutation({
    mutationFn: async () => {
      if (esAceite) return actualizarAceite(unidadId, { intervaloAceiteKm: enteroDe(intervaloKm) ?? undefined, kmUltimoCambioAceite: enteroDe(ultimoKm) ?? undefined });
      const datos: DatosItem = {
        nombre: nombre.trim(),
        controlPor: control,
        intervaloKm: porKm ? enteroDe(intervaloKm) : null,
        intervaloDias: porFecha ? enteroDe(intervaloDias) : null,
        ultimoKm: enteroDe(ultimoKm),
        ultimaFecha: ultimaFecha || null,
      };
      return servicio ? actualizarItem(servicio.clave, datos) : crearItem({ ...datos, unidad: unidadId, activo: true });
    },
    onSuccess: listo,
    onError: (e) => setError(mensajeError(e)),
  });
  const pausar = useMutation({ mutationFn: () => actualizarItem(servicio!.clave, { activo: !servicio!.activo }), onSuccess: listo, onError: (e) => setError(mensajeError(e)) });
  const borrar = useMutation({ mutationFn: () => borrarItem(servicio!.clave), onSuccess: listo, onError: (e) => setError(mensajeError(e)) });

  const falta = (!esAceite && !nombre.trim()) || (porKm && !enteroDe(intervaloKm)) || (!esAceite && porFecha && !enteroDe(intervaloDias));

  return (
    <Modal
      titulo={servicio ? servicio.nombre : 'Nuevo servicio'}
      nota={esAceite ? 'El cambio de aceite se controla por km. Al cerrar una orden marcando «Aceite», el último cambio se actualiza solo.' : 'Cada cuánto se hace y cuándo fue la última vez. Al cerrar una orden marcando este servicio, el contador se reinicia solo.'}
      onCerrar={onCerrar}
    >
      {!esAceite && <Field label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus={!servicio} placeholder="Ej.: Cambio de embrague" />}
      {!esAceite && (
        <div className={ui.pillGroup} style={{ alignSelf: 'flex-start' }} role="group" aria-label="Se controla por">
          {([['kilometraje', 'Por km'], ['fecha', 'Por fecha'], ['ambos', 'Lo que llegue primero']] as const).map(([v, t]) => (
            <button key={v} type="button" className={`${ui.pill} ${control === v ? ui.pillActive : ''}`} onClick={() => setControl(v)}>{t}</button>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {porKm && <Field label="Cada (km)" inputMode="numeric" value={intervaloKm} onChange={(e) => setIntervaloKm(e.target.value)} />}
        {porKm && <Field label="Último a los (km)" inputMode="numeric" value={ultimoKm} onChange={(e) => setUltimoKm(e.target.value)} />}
        {!esAceite && porFecha && <Field label="Cada (días)" inputMode="numeric" value={intervaloDias} onChange={(e) => setIntervaloDias(e.target.value)} />}
        {!esAceite && porFecha && <Field label="Última vez" type="date" value={ultimaFecha} onChange={(e) => setUltimaFecha(e.target.value)} />}
      </div>
      <ErrorLinea texto={error} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {servicio && !esAceite && (
          <>
            <button className={ui.btnGhost} style={{ fontSize: 13 }} onClick={() => pausar.mutate()} disabled={pausar.isPending}>
              {servicio.activo ? 'Pausar' : 'Reanudar'}
            </button>
            <button className={ui.btnGhost} style={{ fontSize: 13, color: 'var(--bad-text)' }} onClick={() => window.confirm(`¿Quitar «${servicio.nombre}» del plan de esta unidad?`) && borrar.mutate()} disabled={borrar.isPending}>
              Quitar del plan
            </button>
          </>
        )}
        <span style={{ flex: 1 }} />
        <button className={ui.btnSecondary} onClick={onCerrar}>Cancelar</button>
        <button className={ui.btnPrimary} disabled={falta || guardar.isPending} onClick={() => guardar.mutate()}>
          {guardar.isPending ? 'Guardando…' : servicio ? 'Guardar cambios' : 'Agregar al plan'}
        </button>
      </div>
    </Modal>
  );
}
