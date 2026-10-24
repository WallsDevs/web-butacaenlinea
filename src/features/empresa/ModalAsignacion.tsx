import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cambiarHoraSalida, getBusesParaSalida, getBusesParaVarias, getSiguientesSerie, reasignarSalida, reasignarVarias } from '../../lib/api/endpoints';
import type { SalidaDto, UnidadDto } from '../../lib/api/types';
import { fechaCorta, hora } from '../../lib/time';
import { explicarSalida, mensajeDeError } from './salidasErrores';
import { puestosDe } from './ModalProgramar';
import ui from '../../components/ui/ui.module.css';
import styles from './EmpresaSalidas.module.css';

/** «Sin cambiar» (solo con varias): ese campo no se toca. */
const IGUAL = '__igual__';
/** La hora de una salida en Venezuela, «HH:MM» (para el campo de hora). */
const horaVe = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Caracas' });

/**
 * Bus y conductor de una o varias salidas. Con una (p. ej. la quinta de la
 * serie, se dañó el bus) se cambia solo esa. Con varias (las marcadas en la
 * agenda) se aplica el mismo bus o conductor a todas: las que no se pueden
 * se dicen con su motivo y las demás quedan. Un bus que no tiene puestos para
 * lo ya vendido se ve, pero no se puede escoger.
 */
export function ModalAsignacion({
  salidas,
  unidades,
  choferes,
  onCerrar,
  onListo,
}: {
  salidas: SalidaDto[];
  unidades: UnidadDto[];
  choferes: { documentId: string; nombre: string }[];
  onCerrar: () => void;
  onListo: (asignadas: number) => void;
}) {
  const queryClient = useQueryClient();
  const una = salidas.length === 1 ? salidas[0] : null;
  const [unidadId, setUnidadId] = useState(una ? (una.unidad?.documentId ?? '') : IGUAL);
  const [choferId, setChoferId] = useState(una ? (una.chofer?.documentId ?? '') : IGUAL);
  const [error, setError] = useState<string | null>(null);
  const [fallidas, setFallidas] = useState<{ documentId: string; motivo: string; detalles: Record<string, unknown> }[] | null>(null);
  // Salida de una serie: aplicar solo a esta o a esta y las siguientes
  const [alcance, setAlcance] = useState<'esta' | 'siguientes'>('esta');
  const [horaNueva, setHoraNueva] = useState(una ? horaVe(una.fechaHoraSalida) : '');
  const [avisoHora, setAvisoHora] = useState<string | null>(null);
  const { data: siguientes } = useQuery({
    queryKey: ['siguientes-serie', una?.documentId],
    queryFn: () => getSiguientesSerie(una!.documentId),
    enabled: Boolean(una?.serieId),
  });
  const masDeUna = (siguientes?.documentIds.length ?? 0) > 1;
  // Lo que más vendió manda: el bus tiene que alcanzar para esa
  const vendidos = Math.max(0, ...salidas.map((s) => s.vendidos ?? 0));
  const elegida = unidades.find((u) => u.documentId === unidadId);
  const puestos = elegida ? puestosDe(elegida) : 0;
  const noAlcanza = Boolean(elegida) && puestos < vendidos;
  const quitaBusConVentas = unidadId === '' && vendidos > 0;
  const cambios = una
    ? {
        ...(unidadId !== (una.unidad?.documentId ?? '') ? { unidadId: unidadId || null } : {}),
        ...(choferId !== (una.chofer?.documentId ?? '') ? { choferId: choferId || null } : {}),
      }
    : {
        ...(unidadId !== IGUAL ? { unidadId: unidadId || null } : {}),
        ...(choferId !== IGUAL ? { choferId: choferId || null } : {}),
      };

  const guardar = useMutation({
    mutationFn: async () => {
      if (una && alcance === 'siguientes' && siguientes && masDeUna) return reasignarVarias(siguientes.documentIds, cambios);
      if (una) {
        await reasignarSalida(una.documentId, cambios);
        return { asignadas: [una.documentId], fallidas: [] };
      }
      return reasignarVarias(salidas.map((s) => s.documentId), cambios);
    },
    onSuccess: (r) => {
      if (r.fallidas.length) setFallidas(r.fallidas);
      else onListo(r.asignadas.length);
    },
    onError: (e) => setError(mensajeDeError(e)),
  });

  // Con una salida: cada bus dice dónde estará a esa hora y si puede hacerla
  const { data: opciones, isLoading: cargandoBuses } = useQuery({
    queryKey: ['buses-salida', una?.documentId],
    queryFn: () => getBusesParaSalida(una!.documentId),
    enabled: Boolean(una),
  });
  // Con varias: cada bus dice dónde estará a la hora de la primera y en cuántas de las marcadas puede ir
  const { data: opcionesVarias, isLoading: cargandoVarias } = useQuery({
    queryKey: ['buses-varias', salidas.map((s) => s.documentId).join(',')],
    queryFn: () => getBusesParaVarias(salidas.map((s) => s.documentId)),
    enabled: !una,
  });
  const cambiarHora = useMutation({
    mutationFn: () => cambiarHoraSalida(una!.documentId, horaNueva, alcance === 'siguientes' && masDeUna ? 'siguientes' : 'esta'),
    onSuccess: (r) => {
      setAvisoHora(
        r.fallidas.length
          ? `Cambiaron ${r.cambiadas.length}. No se pudieron ${r.fallidas.length}: ${r.fallidas.map((f) => explicarSalida(f.motivo, f.detalles)).join(' · ')}`
          : `Listo: ${r.cambiadas.length === 1 ? 'la salida sale' : `las ${r.cambiadas.length} salidas salen`} a las ${horaNueva}.`
      );
      // Todas cambiaron: se cierra; si alguna no, el modal queda abierto con el motivo (y la agenda ya refrescada)
      if (!r.fallidas.length) onListo(r.cambiadas.length);
      else void queryClient.invalidateQueries({ queryKey: ['empresa-salidas'] });
    },
    onError: (e) => setAvisoHora(mensajeDeError(e)),
  });
  const porId = new Map(salidas.map((s) => [s.documentId, s]));
  const titulo = una
    ? `${una.ruta?.origen} → ${una.ruta?.destino} · ${fechaCorta(una.fechaHoraSalida)} a las ${hora(una.fechaHoraSalida)}`
    : `${salidas.length} salidas marcadas`;

  return (
    <div className={styles.velo} onClick={onCerrar}>
      <div className={`${styles.modal} ${styles.modalChico}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Bus y conductor">
        <div className={styles.modalCabecera}>
          <div>
            <div className={styles.modalTitulo}>{una ? 'Bus y conductor' : 'Asignar a varias salidas'}</div>
            <div className={styles.nota}>
              {titulo}
              {vendidos ? ` · ${una ? '' : 'la que más lleva: '}${vendidos} puesto${vendidos === 1 ? '' : 's'} vendido${vendidos === 1 ? '' : 's'}` : ' · sin puestos vendidos'}
            </div>
          </div>
          <button type="button" className={styles.cerrar} onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>

        {fallidas ? (
          <div className={styles.modalCuerpo}>
            <div className={styles.aviso}>
              {fallidas.length === salidas.length
                ? `No se pudo ninguna de las ${salidas.length}:`
                : `Quedaron ${salidas.length - fallidas.length} de ${salidas.length}. Estas no se pudieron; las demás ya tienen su ${cambios.unidadId !== undefined ? 'bus' : 'conductor'}:`}
            </div>
            <ul className={styles.fallidas}>
              {fallidas.map((f) => {
                const s = porId.get(f.documentId);
                return (
                  <li key={f.documentId}>
                    <b>{s ? `${fechaCorta(s.fechaHoraSalida)} · ${hora(s.fechaHoraSalida)}` : 'Salida'}</b>
                    <span>{explicarSalida(f.motivo, f.detalles)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className={styles.modalCuerpo}>
            {una ? (
              <div className={ui.field}>
                <span className={ui.fieldLabel}>Bus · sale de {opciones?.origen ?? una.ruta?.origen}</span>
                <div className={styles.buses} role="radiogroup" aria-label="Bus">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={unidadId === ''}
                    disabled={vendidos > 0}
                    className={`${styles.bus} ${unidadId === '' ? styles.busElegido : ''}`}
                    onClick={() => setUnidadId('')}
                  >
                    <span className={styles.busNumero}>Por asignar</span>
                    <span className={styles.busDonde}>{vendidos > 0 ? 'No: ya hay puestos vendidos' : 'Sin bus la salida no se vende'}</span>
                  </button>
                  {cargandoBuses && <div className={styles.nota}>Revisando dónde está cada bus…</div>}
                  {(opciones?.buses ?? []).map((b) => {
                    const enOrigen = b.ubicacion === opciones?.origen;
                    return (
                      <button
                        key={b.documentId}
                        type="button"
                        role="radio"
                        aria-checked={unidadId === b.documentId}
                        disabled={!b.puede && !b.actual}
                        className={`${styles.bus} ${unidadId === b.documentId ? styles.busElegido : ''} ${!b.puede ? styles.busNo : ''}`}
                        onClick={() => { setUnidadId(b.documentId); setError(null); }}
                      >
                        <span className={styles.busNumero}>
                          {b.numero} <small>{b.puestos} puestos{b.marcaModelo ? ` · ${b.marcaModelo}` : ''}</small>
                          {b.actual && <em>el actual</em>}
                        </span>
                        <span className={`${styles.busDonde} ${b.puede && enOrigen ? styles.busAqui : ''}`}>
                          {b.ubicacion ? `En ${b.ubicacion}${b.desde ? ` desde ${fechaCorta(b.desde)} ${hora(b.desde)}` : ''}` : 'Sin ubicación registrada'}
                        </span>
                        {!b.puede && b.motivo && <span className={styles.busMotivo}>{explicarSalida(b.motivo, b.detalles)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={ui.field}>
                <span className={ui.fieldLabel}>Bus · la primera sale de {opcionesVarias?.origen ?? '…'}</span>
                <div className={styles.buses} role="radiogroup" aria-label="Bus">
                  <button type="button" role="radio" aria-checked={unidadId === IGUAL} className={`${styles.bus} ${unidadId === IGUAL ? styles.busElegido : ''}`} onClick={() => setUnidadId(IGUAL)}>
                    <span className={styles.busNumero}>Sin cambiar</span>
                    <span className={styles.busDonde}>Cada salida conserva su bus</span>
                  </button>
                  <button type="button" role="radio" aria-checked={unidadId === ''} disabled={vendidos > 0} className={`${styles.bus} ${unidadId === '' ? styles.busElegido : ''}`} onClick={() => setUnidadId('')}>
                    <span className={styles.busNumero}>Por asignar</span>
                    <span className={styles.busDonde}>{vendidos > 0 ? 'No: ya hay puestos vendidos' : 'Sin bus las salidas no se venden'}</span>
                  </button>
                  {cargandoVarias && <div className={styles.nota}>Revisando dónde está cada bus…</div>}
                  {(opcionesVarias?.buses ?? []).map((b) => (
                    <button
                      key={b.documentId}
                      type="button"
                      role="radio"
                      aria-checked={unidadId === b.documentId}
                      disabled={b.pueden === 0}
                      className={`${styles.bus} ${unidadId === b.documentId ? styles.busElegido : ''} ${b.pueden === 0 ? styles.busNo : ''}`}
                      onClick={() => { setUnidadId(b.documentId); setError(null); }}
                    >
                      <span className={styles.busNumero}>
                        {b.numero} <small>{b.puestos} puestos{b.marcaModelo ? ` · ${b.marcaModelo}` : ''}</small>
                      </span>
                      <span className={`${styles.busDonde} ${b.pueden === b.total && b.ubicacion === opcionesVarias?.origen ? styles.busAqui : ''}`}>
                        {b.ubicacion ? `En ${b.ubicacion}${b.desde ? ` desde ${fechaCorta(b.desde)} ${hora(b.desde)}` : ''}` : 'Sin ubicación registrada'} · puede en {b.pueden} de {b.total}
                      </span>
                      {b.pueden < b.total && b.motivo && <span className={styles.busMotivo}>{explicarSalida(b.motivo, b.detalles)}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {noAlcanza && <div className={styles.aviso}>El bus {elegida!.numero} tiene {puestos} puestos y ya hay {vendidos} vendidos. Escoge un bus de {vendidos} puestos o más.</div>}
            {elegida && !noAlcanza && vendidos > 0 && <div className={styles.nota}>Alcanza: {puestos} puestos para {vendidos} vendidos. Los pasajeros conservan su puesto.</div>}
            {!una && elegida && <div className={styles.nota}>Se asigna en orden de fecha: si el bus no puede hacer alguna (está en otra ciudad u ocupado), te digo cuál y las demás quedan.</div>}
            {unidadId === '' && !vendidos && <div className={styles.nota}>Sin bus la salida no se vende hasta que le pongas uno.</div>}

            {una && masDeUna && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <input type="checkbox" checked={alcance === 'siguientes'} onChange={(e) => setAlcance(e.target.checked ? 'siguientes' : 'esta')} />
                Aplicar también a las siguientes de la serie ({siguientes!.documentIds.length - 1} más)
              </label>
            )}

            <label className={ui.field}>
              <span className={ui.fieldLabel}>Conductor</span>
              <select className={ui.fieldInput} value={choferId} onChange={(e) => { setChoferId(e.target.value); setError(null); }}>
                {!una && <option value={IGUAL}>Sin cambiar</option>}
                <option value="">Por asignar</option>
                {choferes.map((c) => (
                  <option key={c.documentId} value={c.documentId}>{c.nombre}</option>
                ))}
              </select>
            </label>
            <div className={styles.nota}>Se puede dejar sin conductor y asignarlo hasta el momento de salir.</div>
            {error && <div className={styles.aviso}>{error}</div>}

            {una && (
              <div className={ui.field} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <span className={ui.fieldLabel}>Hora de salida{masDeUna && alcance === 'siguientes' ? ' (esta y las siguientes)' : ''}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className={ui.fieldInput} type="time" value={horaNueva} onChange={(e) => { setHoraNueva(e.target.value); setAvisoHora(null); }} style={{ maxWidth: 140 }} />
                  <button type="button" className={ui.btnSecondary} disabled={!horaNueva || horaNueva === horaVe(una.fechaHoraSalida) || cambiarHora.isPending} onClick={() => cambiarHora.mutate()}>
                    {cambiarHora.isPending ? 'Cambiando…' : 'Cambiar hora'}
                  </button>
                </div>
                <div className={styles.nota}>Cada salida conserva su día. Las que ya tienen puestos vendidos no se cambian: avisa antes a los pasajeros.</div>
                {avisoHora && <div className={styles.aviso}>{avisoHora}</div>}
              </div>
            )}
          </div>
        )}

        <div className={styles.modalPie}>
          <div className={styles.resumen} />
          {fallidas ? (
            <button type="button" className={ui.btnPrimary} onClick={() => onListo(salidas.length - fallidas.length)}>Listo</button>
          ) : (
            <>
              <button type="button" className={ui.btnSecondary} onClick={onCerrar}>Cancelar</button>
              <button
                type="button"
                className={ui.btnPrimary}
                disabled={!Object.keys(cambios).length || noAlcanza || quitaBusConVentas || guardar.isPending}
                onClick={() => { setError(null); guardar.mutate(); }}
              >
                {guardar.isPending ? 'Guardando…' : una ? (alcance === 'siguientes' && masDeUna ? `Guardar en ${siguientes!.documentIds.length}` : 'Guardar cambios') : `Asignar a ${salidas.length}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
