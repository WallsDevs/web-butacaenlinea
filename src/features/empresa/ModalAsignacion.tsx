import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { reasignarSalida } from '../../lib/api/endpoints';
import type { UnidadDto } from '../../lib/api/types';
import type { SalidaDto } from '../../lib/api/types';
import { fechaCorta, hora } from '../../lib/time';
import { mensajeDeError } from './salidasErrores';
import { puestosDe } from './ModalProgramar';
import ui from '../../components/ui/ui.module.css';
import styles from './EmpresaSalidas.module.css';

/**
 * Bus y conductor de UNA salida (p. ej. la quinta de la serie: se dañó el
 * bus). El bus nuevo tiene que tener al menos tantos puestos como los ya
 * vendidos: los que no alcanzan se ven pero no se pueden escoger.
 */
export function ModalAsignacion({
  salida,
  unidades,
  choferes,
  onCerrar,
  onListo,
}: {
  salida: SalidaDto;
  unidades: UnidadDto[];
  choferes: { documentId: string; nombre: string }[];
  onCerrar: () => void;
  onListo: () => void;
}) {
  const [unidadId, setUnidadId] = useState(salida.unidad?.documentId ?? '');
  const [choferId, setChoferId] = useState(salida.chofer?.documentId ?? '');
  const [error, setError] = useState<string | null>(null);
  const vendidos = salida.vendidos ?? 0;
  const elegida = unidades.find((u) => u.documentId === unidadId);
  const puestos = elegida ? puestosDe(elegida) : 0;
  const noAlcanza = Boolean(elegida) && puestos < vendidos;
  const sinBusConVentas = !unidadId && vendidos > 0;
  const cambios = {
    ...(unidadId !== (salida.unidad?.documentId ?? '') ? { unidadId: unidadId || null } : {}),
    ...(choferId !== (salida.chofer?.documentId ?? '') ? { choferId: choferId || null } : {}),
  };

  const guardar = useMutation({
    mutationFn: () => reasignarSalida(salida.documentId, cambios),
    onSuccess: onListo,
    onError: (e) => setError(mensajeDeError(e)),
  });

  return (
    <div className={styles.velo} onClick={onCerrar}>
      <div className={`${styles.modal} ${styles.modalChico}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Bus y conductor">
        <div className={styles.modalCabecera}>
          <div>
            <div className={styles.modalTitulo}>Bus y conductor</div>
            <div className={styles.nota}>
              {salida.ruta?.origen} → {salida.ruta?.destino} · {fechaCorta(salida.fechaHoraSalida)} a las {hora(salida.fechaHoraSalida)}
              {vendidos ? ` · ${vendidos} puesto${vendidos === 1 ? '' : 's'} vendido${vendidos === 1 ? '' : 's'}` : ' · sin puestos vendidos'}
            </div>
          </div>
          <button type="button" className={styles.cerrar} onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className={styles.modalCuerpo}>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Bus</span>
            <select className={ui.fieldInput} value={unidadId} onChange={(e) => { setUnidadId(e.target.value); setError(null); }}>
              <option value="" disabled={vendidos > 0}>Por asignar{vendidos > 0 ? ' (ya hay puestos vendidos)' : ''}</option>
              {unidades
                .filter((u) => u.estado !== 'fuera_de_servicio' || u.documentId === salida.unidad?.documentId)
                .map((u) => {
                  const p = puestosDe(u);
                  return (
                    <option key={u.documentId} value={u.documentId} disabled={p < vendidos}>
                      {u.numero} · {p} puestos{u.marcaModelo ? ` · ${u.marcaModelo}` : ''}
                      {p < vendidos ? ` · no alcanza (${vendidos} vendidos)` : ''}
                      {u.documentId === salida.unidad?.documentId ? ' · el actual' : ''}
                    </option>
                  );
                })}
            </select>
          </label>
          {noAlcanza && (
            <div className={styles.aviso}>
              El bus {elegida!.numero} tiene {puestos} puestos y ya hay {vendidos} vendidos. Escoge un bus de {vendidos} puestos o más.
            </div>
          )}
          {elegida && !noAlcanza && vendidos > 0 && (
            <div className={styles.nota}>Alcanza: {puestos} puestos para {vendidos} vendidos. Los pasajeros conservan su puesto.</div>
          )}
          {!unidadId && !vendidos && <div className={styles.nota}>Sin bus la salida no se vende hasta que le pongas uno.</div>}

          <label className={ui.field}>
            <span className={ui.fieldLabel}>Conductor</span>
            <select className={ui.fieldInput} value={choferId} onChange={(e) => { setChoferId(e.target.value); setError(null); }}>
              <option value="">Por asignar</option>
              {choferes.map((c) => (
                <option key={c.documentId} value={c.documentId}>{c.nombre}</option>
              ))}
            </select>
          </label>
          <div className={styles.nota}>Se puede dejar sin conductor y asignarlo hasta el momento de salir.</div>
          {error && <div className={styles.aviso}>{error}</div>}
        </div>
        <div className={styles.modalPie}>
          <div className={styles.resumen} />
          <button type="button" className={ui.btnSecondary} onClick={onCerrar}>Cancelar</button>
          <button
            type="button"
            className={ui.btnPrimary}
            disabled={!Object.keys(cambios).length || noAlcanza || sinBusConVentas || guardar.isPending}
            onClick={() => {
              setError(null);
              guardar.mutate();
            }}
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
