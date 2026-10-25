import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarEstadoUnidad,
  asignarChoferUnidad,
  getChoferes,
  getLineas,
  getSalidas,
  getUnidad,
} from '../../lib/api/endpoints';
import { fechaCorta, hora } from '../../lib/time';
import { useAuth } from '../../stores/auth';
import { ServicioUrbanoCard } from '../urbano/ServicioUrbanoCard';
import { useModulos } from '../../lib/useModulos';
import { EtiquetasEquipajeCard } from './EtiquetasEquipajeCard';
import { StatusChip } from '../../components/ui/StatusChip';
import { KilometrajeCard } from './mant/KilometrajeCard';
import { PlanCard } from './mant/PlanCard';
import { CauchosCard } from './mant/CauchosCard';
import { OrdenesCard } from './mant/OrdenesCard';
import ui from '../../components/ui/ui.module.css';
import styles from './flota.module.css';

const NOMBRE_DOC: Record<string, string> = {
  seguro_rcv: 'Seguro RCV',
  certificado_intt: 'Certificado INTT',
  revision_tecnica: 'Revisión técnica',
  permiso_ruta: 'Permiso de ruta',
};

const fechaVe = (isoDate?: string) => {
  if (!isoDate) return '—';
  const [a, m, d] = isoDate.split('-');
  return `${d}/${m}/${a}`;
};

export default function FichaUnidad() {
  const { unidadId } = useParams<{ unidadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usuario = useAuth((s) => s.usuario);
  // Cada bloque pide su módulo: sin él el backend respondería modulo_no_contratado
  const { tiene } = useModulos();
  const conMant = tiene('mantenimiento');
  const conBol = tiene('boleteria');
  const conEq = tiene('equipaje');
  const conUrb = tiene('urbano');
  const esEmpresa = usuario?.role?.type === 'empresa';

  const { data: unidad } = useQuery({ queryKey: ['unidad', unidadId], queryFn: () => getUnidad(unidadId!) });
  const { data: choferes } = useQuery({ queryKey: ['choferes'], queryFn: getChoferes });
  // El modo de etiqueta lo fija la empresa; decide qué tarjeta de equipaje se ve
  const { data: lineas } = useQuery({ queryKey: ['lineas'], queryFn: getLineas });
  const miLinea = lineas?.find((l) => l.documentId === usuario?.linea?.documentId);
  const asignarChofer = useMutation({
    mutationFn: (choferId: string | null) => asignarChoferUnidad(unidadId!, choferId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unidad', unidadId] }),
  });
  const { data: viajes } = useQuery({
    queryKey: ['viajes-unidad', unidadId],
    queryFn: () =>
      getSalidas({
        unidadId,
        estados: ['programada', 'abordando', 'en_ruta', 'finalizada', 'cancelada'],
        orden: 'fechaHoraSalida:desc',
      }),
    enabled: Boolean(unidadId) && conBol,
  });

  const cambiarEstado = useMutation({
    mutationFn: (estado: string) => actualizarEstadoUnidad(unidadId!, estado),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unidad', unidadId] }),
  });

  const totalPuestos = useMemo(
    () =>
      unidad?.configuracionAsientos?.pisos?.reduce(
        (s, p) => s + (p.filas.length * (p.layout.izquierda + p.layout.derecha) + (p.filaTrasera ?? 0)),
        0
      ),
    [unidad]
  );

  if (!unidad) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando unidad…</div>;
  }

  const descPisos = unidad.configuracionAsientos?.pisos?.length === 2 ? 'Doble piso' : 'Piso sencillo';
  const clasesDesc = unidad.configuracionAsientos?.pisos
    ?.map((p) => `${(p.filas.length * (p.layout.izquierda + p.layout.derecha) + (p.filaTrasera ?? 0))} ${p.nombre.toLowerCase()}`)
    .join(' / ');

  return (
    <div className={styles.contenido}>
      <button className={ui.btnGhost} onClick={() => navigate('/empresa/flota?tab=unidades')} style={{ marginBottom: 14 }}>
        ← Todas las unidades
      </button>

      {/* Cabecera */}
      <div className={styles.cabeceraUnidad}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className={styles.cuadroNumeroLg}>{unidad.numero}</div>
          <div>
            <div className={styles.modelo}>{unidad.marcaModelo}</div>
            <div className={styles.metaUnidad}>
              Placa {unidad.placa} · {unidad.anio} · {descPisos}, {totalPuestos} puestos ({clasesDesc})
            </div>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', maxWidth: '100%' }}>
          {unidad.estado === 'en_ruta' && <StatusChip tono="info">En Ruta</StatusChip>}
          {unidad.estado !== 'en_ruta' && unidad.ubicacionActual && (
            <StatusChip tono="neutral">En {unidad.ubicacionActual}</StatusChip>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Estado</span>
          <div className={ui.pillGroup} style={{ maxWidth: '100%', overflowX: 'auto' }}>
            {[
              ['disponible', 'Activo'],
              ['en_mantenimiento', 'En Mantenimiento'],
              ['fuera_de_servicio', 'Fuera de Servicio'],
            ].map(([valor, label]) => (
              <button
                key={valor}
                className={`${ui.pill} ${unidad.estado === valor ? ui.pillActive : ''}`}
                style={{ fontSize: 12, padding: '9px 14px' }}
                onClick={() => cambiarEstado.mutate(valor)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kilometraje y conductor */}
      <div className={`${styles.tresTarjetas} ${styles.dosTarjetas}`}>
        {conMant ? (
          <KilometrajeCard unidadId={unidad.documentId} kilometraje={unidad.kilometraje} esEmpresa={esEmpresa} />
        ) : (
          <div className={styles.tarjeta}>
            <div className={styles.kicker}>Kilometraje</div>
            <div className={styles.cifraKm}>{unidad.kilometraje.toLocaleString('es-VE')}</div>
            <div className={styles.notaKm}>km en el odómetro</div>
          </div>
        )}

        <div className={styles.tarjeta}>
          <div className={styles.kicker}>Documentación y chófer</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, fontSize: 14 }}>
            {(unidad.documentos ?? []).map((d, i) => (
              <div key={i} className={styles.filaDato}>
                <span>{NOMBRE_DOC[d.tipo] ?? d.tipo}</span>
                <span>{fechaVe(d.vence)}</span>
              </div>
            ))}
          </div>
          <div className={styles.divisor} />
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>
            Conductor asignado — verá esta unidad en su app y podrá reportar km y novedades. Un
            mismo conductor puede tener varias unidades a su cargo: escoge cuál maneja al abrir
            su turno.
          </div>
          <select
            className={ui.fieldInput}
            value={unidad.choferAsignado?.documentId ?? ''}
            disabled={asignarChofer.isPending}
            onChange={(e) => asignarChofer.mutate(e.target.value || null)}
          >
            <option value="">Sin asignar</option>
            {(choferes ?? []).map((c) => (
              <option key={c.documentId} value={c.documentId}>
                {c.nombre}
                {c.cedula ? ` · ${c.cedula}` : ''}
              </option>
            ))}
          </select>
          {unidad.choferAsignado && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <span className={styles.avatarChofer}>
                {unidad.choferAsignado.nombre
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{unidad.choferAsignado.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                  {unidad.choferAsignado.cedula ?? 'sin cédula'}
                  {unidad.choferAsignado.licenciaGrado
                    ? ` · licencia ${unidad.choferAsignado.licenciaGrado} · vence ${fechaVe(unidad.choferAsignado.licenciaVence).slice(3)}`
                    : ''}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {conMant && <PlanCard unidadId={unidad.documentId} esEmpresa={esEmpresa} />}

      {/* Servicio urbano: ruta, reparto y QR de la buseta */}
      {usuario?.role?.type === 'empresa' && conUrb && (
        <ServicioUrbanoCard
          unidadId={unidad.documentId}
          numeroUnidad={unidad.numero}
          lineaNombre={usuario?.linea?.nombre ?? ''}
        />
      )}

      {/* Talonario de etiquetas de equipaje (rutas largas) */}
      {usuario?.role?.type === 'empresa' && conEq && (
        <EtiquetasEquipajeCard
          unidadId={unidad.documentId}
          modoEmpresa={(miLinea?.modoEtiquetaEquipaje ?? 'empresa') === 'empresa'}
        />
      )}

      {conMant && <CauchosCard unidadId={unidad.documentId} esEmpresa={esEmpresa} />}

      {conMant && <OrdenesCard unidadId={unidad.documentId} kilometraje={unidad.kilometraje} esEmpresa={esEmpresa} />}

      {/* Historial de viajes de la unidad */}
      {conBol && (
        <div className={styles.tarjeta} style={{ marginTop: 20 }}>
          <div className={styles.kicker}>Historial de viajes</div>
          <table className={styles.tablaOrdenes ?? ''} style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: 12, color: 'var(--text-faint)' }}>
                <th style={{ padding: '8px 6px' }}>Fecha</th>
                <th style={{ padding: '8px 6px' }}>Ruta</th>
                <th style={{ padding: '8px 6px' }}>Salida</th>
                <th style={{ padding: '8px 6px' }}>Llegada real</th>
                <th style={{ padding: '8px 6px' }}>Pasajeros</th>
                <th style={{ padding: '8px 6px' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {(viajes ?? []).map((v) => (
                <tr key={v.documentId} style={{ borderTop: '1px solid var(--border)', fontSize: 13 }}>
                  <td style={{ padding: '10px 6px', fontWeight: 600 }}>{fechaCorta(v.fechaHoraSalida)}</td>
                  <td style={{ padding: '10px 6px' }}>
                    {v.ruta?.origen} → {v.ruta?.destino}
                  </td>
                  <td style={{ padding: '10px 6px', color: 'var(--text-soft)' }}>{hora(v.fechaHoraSalida)}</td>
                  <td style={{ padding: '10px 6px', color: 'var(--text-soft)' }}>
                    {v.fechaHoraLlegadaReal ? `${fechaCorta(v.fechaHoraLlegadaReal)} ${hora(v.fechaHoraLlegadaReal)}` : '—'}
                  </td>
                  <td style={{ padding: '10px 6px', color: 'var(--text-soft)' }}>
                    {v.reporteSalida?.abordados ?? '—'}
                  </td>
                  <td style={{ padding: '10px 6px' }}>
                    {v.estado === 'finalizada' ? (
                      <StatusChip tono="ok" size="sm">Finalizada</StatusChip>
                    ) : v.estado === 'en_ruta' ? (
                      <StatusChip tono="info" size="sm">En Ruta</StatusChip>
                    ) : v.estado === 'cancelada' ? (
                      <StatusChip tono="bad" size="sm">Cancelada</StatusChip>
                    ) : v.estado === 'abordando' ? (
                      <StatusChip tono="info" size="sm">Abordando</StatusChip>
                    ) : (
                      <StatusChip tono="neutral" size="sm">Programada</StatusChip>
                    )}
                  </td>
                </tr>
              ))}
              {!viajes?.length && (
                <tr>
                  <td colSpan={6} style={{ padding: 18, textAlign: 'center', color: 'var(--text-soft)', fontSize: 13 }}>
                    Esta unidad aún no tiene viajes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
