import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { reasignarSalida, reasignarVarias } from '../../lib/api/endpoints';
import type { SalidaDto, UnidadDto } from '../../lib/api/types';
import { fechaCorta, hora } from '../../lib/time';
import { explicarSalida, mensajeDeError } from './salidasErrores';
import { puestosDe } from './ModalProgramar';
import ui from '../../components/ui/ui.module.css';
import styles from './EmpresaSalidas.module.css';

/** «Sin cambiar» (solo con varias): ese campo no se toca. */
const IGUAL = '__igual__';

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
  const una = salidas.length === 1 ? salidas[0] : null;
  const [unidadId, setUnidadId] = useState(una ? (una.unidad?.documentId ?? '') : IGUAL);
  const [choferId, setChoferId] = useState(una ? (una.chofer?.documentId ?? '') : IGUAL);
  const [error, setError] = useState<string | null>(null);
  const [fallidas, setFallidas] = useState<{ documentId: string; motivo: string; detalles: Record<string, unknown> }[] | null>(null);
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
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Bus</span>
              <select className={ui.fieldInput} value={unidadId} onChange={(e) => { setUnidadId(e.target.value); setError(null); }}>
                {!una && <option value={IGUAL}>Sin cambiar</option>}
                <option value="" disabled={vendidos > 0}>Por asignar{vendidos > 0 ? ' (ya hay puestos vendidos)' : ''}</option>
                {unidades
                  .filter((u) => u.estado !== 'fuera_de_servicio' || u.documentId === una?.unidad?.documentId)
                  .map((u) => {
                    const p = puestosDe(u);
                    return (
                      <option key={u.documentId} value={u.documentId} disabled={p < vendidos}>
                        {u.numero} · {p} puestos{u.marcaModelo ? ` · ${u.marcaModelo}` : ''}
                        {p < vendidos ? ` · no alcanza (${vendidos} vendidos)` : ''}
                        {u.documentId === una?.unidad?.documentId ? ' · el actual' : ''}
                      </option>
                    );
                  })}
              </select>
            </label>
            {noAlcanza && <div className={styles.aviso}>El bus {elegida!.numero} tiene {puestos} puestos y ya hay {vendidos} vendidos. Escoge un bus de {vendidos} puestos o más.</div>}
            {elegida && !noAlcanza && vendidos > 0 && <div className={styles.nota}>Alcanza: {puestos} puestos para {vendidos} vendidos. Los pasajeros conservan su puesto.</div>}
            {!una && elegida && <div className={styles.nota}>Se asigna en orden de fecha: si el bus no puede hacer alguna (está en otra ciudad u ocupado), te digo cuál y las demás quedan.</div>}
            {unidadId === '' && !vendidos && <div className={styles.nota}>Sin bus la salida no se vende hasta que le pongas uno.</div>}

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
                {guardar.isPending ? 'Guardando…' : una ? 'Guardar cambios' : `Asignar a ${salidas.length}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
