import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cerrarAbordaje, getManifiesto, getSalidas, marcarLlegada } from '../../lib/api/endpoints';
import { hora, hoyISO, rangoDia } from '../../lib/time';
import { useAuth } from '../../stores/auth';
import { StatusChip } from '../../components/ui/StatusChip';
import { EquipajeStepper } from './EquipajeStepper';
import type { ReporteSalida } from '../../lib/api/types';
import ui from '../../components/ui/ui.module.css';
import styles from './chofer.module.css';

export default function ManifiestoPage() {
  const queryClient = useQueryClient();
  const [salidaId, setSalidaId] = useState<string | null>(null);

  const { desde, hasta } = rangoDia(hoyISO());
  const usuarioSesion = useAuth((s) => s.usuario);
  const { data: salidas } = useQuery({
    queryKey: ['chofer-salidas', usuarioSesion?.linea?.slug],
    queryFn: () =>
      getSalidas({
        desde,
        hasta,
        lineaSlug: usuarioSesion?.linea?.slug,
        estados: ['programada', 'abordando', 'en_ruta', 'finalizada'],
      }),
  });
  useEffect(() => {
    if (!salidaId && salidas?.length) {
      // La más relevante: abordando > en ruta > programada > la última finalizada
      const activa =
        salidas.find((s) => s.estado === 'abordando') ??
        salidas.find((s) => s.estado === 'en_ruta') ??
        salidas.find((s) => s.estado === 'programada') ??
        salidas[salidas.length - 1];
      setSalidaId(activa.documentId);
    }
  }, [salidas, salidaId]);

  const { data: manifiesto } = useQuery({
    queryKey: ['manifiesto', salidaId],
    queryFn: () => getManifiesto(salidaId!),
    enabled: Boolean(salidaId),
    refetchInterval: 8000,
  });

  const cerrar = useMutation({
    mutationFn: () => cerrarAbordaje(salidaId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manifiesto', salidaId] });
      queryClient.invalidateQueries({ queryKey: ['chofer-salidas'] });
    },
  });

  const llegada = useMutation({
    mutationFn: () => marcarLlegada(salidaId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manifiesto', salidaId] });
      queryClient.invalidateQueries({ queryKey: ['chofer-salidas'] });
    },
  });

  if (salidas && !salidas.length) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>
        Hoy no hay salidas de tu empresa. El manifiesto aparecerá cuando programen la próxima.
      </div>
    );
  }
  if (!manifiesto) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando manifiesto…</div>;
  }

  const s = manifiesto.salida;
  const reporte = s.reporteSalida as ReporteSalida | null;
  const enRuta = s.estado === 'en_ruta';
  const finalizada = s.estado === 'finalizada';

  return (
    <div className={styles.manifiestoContenido}>
      <div className={styles.manifiestoCard}>
        <div className={styles.manifiestoCabecera}>
          <div>
            <div className={styles.manifiestoTitulo}>Manifiesto de pasajeros</div>
            <div className={styles.manifiestoMeta}>
              Unidad {s.unidad?.numero} · {s.ruta?.origen} → {s.ruta?.destino} · Salida{' '}
              {hora(s.fechaHoraSalida)}
            </div>
            {(salidas?.length ?? 0) > 1 && (
              <select
                className="no-print"
                value={salidaId ?? ''}
                onChange={(e) => setSalidaId(e.target.value)}
                style={{
                  marginTop: 8,
                  border: '1.5px solid var(--border)',
                  borderRadius: 10,
                  padding: '7px 10px',
                  fontSize: 13,
                  background: 'var(--surface)',
                }}
              >
                {(salidas ?? []).map((x) => (
                  <option key={x.documentId} value={x.documentId}>
                    {hora(x.fechaHoraSalida)} · {x.ruta?.destino} · Unidad {x.unidad?.numero}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusChip tono="ok">{manifiesto.resumen.abordados} abordados</StatusChip>
            <StatusChip tono="warn">{manifiesto.resumen.pendientes} por abordar</StatusChip>
            {enRuta && <StatusChip tono="info">En Ruta</StatusChip>}
            <button className={ui.btnSecondary} style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => window.print()}>
              Exportar
            </button>
          </div>
        </div>

        <div className={styles.tablaWrap}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th style={{ width: 70 }}>Puesto</th>
                <th>Pasajero</th>
                <th style={{ width: 130 }}>Documento</th>
                <th style={{ width: 150 }}>Estado</th>
                <th style={{ width: 170 }}>Equipaje</th>
              </tr>
            </thead>
            <tbody>
              {manifiesto.pasajeros.map((p) => (
                <tr key={p.qrId}>
                  <td>
                    <span className={styles.puestoMini}>{p.asientoId}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{p.pasajeroNombre}</td>
                  <td style={{ color: 'var(--text-soft)' }}>{p.pasajeroDocumento}</td>
                  <td>
                    {p.estado === 'abordado' ? (
                      <StatusChip tono="ok">Abordado</StatusChip>
                    ) : p.estado === 'pendiente' ? (
                      <StatusChip tono="warn">Pendiente</StatusChip>
                    ) : (
                      <StatusChip tono="neutral">No se presentó</StatusChip>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {p.estado === 'no_show' ? (
                      '—'
                    ) : finalizada ? (
                      p.equipajePiezas ? `${p.equipajePiezas} pieza${p.equipajePiezas === 1 ? '' : 's'}` : 'Sin equipaje'
                    ) : (
                      <EquipajeStepper key={`${p.qrId}-${p.equipajePiezas}`} qrId={p.qrId} piezas={p.equipajePiezas ?? 0} />
                    )}
                    <span className="solo-impresion" style={{ display: 'none' }}>
                      {p.equipajePiezas ? `${p.equipajePiezas} pieza${p.equipajePiezas === 1 ? '' : 's'}` : 'Sin equipaje'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.reporte}>
          <div>
            <div className={styles.reporteLabel}>Reporte de salida</div>
            <div className={styles.reporteValor}>
              {(reporte?.abordados ?? manifiesto.resumen.abordados)} a bordo
            </div>
          </div>
          <div>
            <div className={styles.reporteLabel}>Equipaje en bodega</div>
            <div className={styles.reporteValor}>
              {(reporte?.piezasEquipaje ?? manifiesto.resumen.piezas)} piezas
            </div>
          </div>
          <div>
            <div className={styles.reporteLabel}>No se presentaron</div>
            <div className={styles.reporteValor}>{reporte?.ausentes ?? manifiesto.resumen.ausentes}</div>
          </div>
          {finalizada ? (
            <div style={{ fontWeight: 700, color: 'var(--ok-text)' }}>
              Viaje finalizado · llegada registrada en {s.ruta?.destino} ✓
            </div>
          ) : enRuta ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700, color: 'var(--ok-text)' }}>
                Abordaje cerrado · unidad En Ruta ✓
                {reporte?.cerradoPor && (
                  <div style={{ fontSize: 12, color: 'var(--text-soft)', fontWeight: 400 }}>
                    por {reporte.cerradoPor} · {reporte.hora ? hora(reporte.hora) : ''}
                  </div>
                )}
              </div>
              <button
                className={ui.btnPrimary}
                style={{ padding: '13px 20px', borderRadius: 'var(--r-14)' }}
                disabled={llegada.isPending}
                onClick={() => {
                  if (confirm(`¿Confirmar que la unidad llegó a ${s.ruta?.destino}? Quedará disponible allí.`)) llegada.mutate();
                }}
              >
                {llegada.isPending ? 'Registrando…' : `Marcar llegada a ${s.ruta?.destino}`}
              </button>
            </div>
          ) : (
            <button
              className={ui.btnPrimary}
              style={{ padding: '15px 24px', borderRadius: 'var(--r-14)' }}
              disabled={cerrar.isPending}
              onClick={() => cerrar.mutate()}
            >
              {cerrar.isPending ? 'Cerrando…' : 'Cerrar abordaje · En Ruta'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
