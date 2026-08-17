import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAlertas, getOrdenes } from '../../lib/api/endpoints';
import { api } from '../../lib/api/client';
import { useAuth } from '../../stores/auth';
import { Field } from '../../components/ui/Field';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from './chofer.module.css';

/**
 * Mantenimiento de MI unidad (opcional para el conductor): kilometraje,
 * alertas calculadas y reporte de novedades como orden de trabajo.
 */
export default function MiUnidad() {
  const queryClient = useQueryClient();
  const usuario = useAuth((s) => s.usuario);
  const [km, setKm] = useState('');
  const [novedad, setNovedad] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);

  // La unidad asignada al conductor autenticado (endpoint dedicado)
  const { data: miUnidad, isLoading } = useQuery({
    queryKey: ['mi-unidad', usuario?.id],
    queryFn: () => api<import('../../lib/api/types').UnidadDto | null>('/api/unidades/mi-unidad'),
    enabled: Boolean(usuario),
  });

  const { data: alertas } = useQuery({
    queryKey: ['alertas', miUnidad?.documentId],
    queryFn: () => getAlertas(miUnidad!.documentId),
    enabled: Boolean(miUnidad),
  });
  const { data: ordenes } = useQuery({
    queryKey: ['ordenes', miUnidad?.documentId],
    queryFn: () => getOrdenes(miUnidad!.documentId),
    enabled: Boolean(miUnidad),
  });

  const registrarKm = useMutation({
    mutationFn: () =>
      api(`/api/unidades/${miUnidad!.documentId}/kilometraje`, { method: 'POST', body: { km: Number(km) } }),
    onSuccess: () => {
      setMensaje(`Kilometraje registrado: ${Number(km).toLocaleString('es-VE')} km`);
      setKm('');
      queryClient.invalidateQueries({ queryKey: ['unidades'] });
      queryClient.invalidateQueries({ queryKey: ['alertas', miUnidad?.documentId] });
    },
    onError: () => setMensaje('El kilometraje debe ser mayor al actual.'),
  });

  const reportar = useMutation({
    mutationFn: () =>
      api('/api/ordenes-mantenimiento', {
        method: 'POST',
        body: {
          data: {
            unidad: miUnidad!.documentId,
            fecha: new Date().toISOString().slice(0, 10),
            tipo: 'correctivo',
            intervencion: novedad,
            km: miUnidad!.kilometraje,
            taller: 'Reportado por el conductor',
            costoUsd: 0,
            estado: 'abierta',
          },
        },
      }),
    onSuccess: () => {
      setMensaje('Novedad reportada al taller.');
      setNovedad('');
      queryClient.invalidateQueries({ queryKey: ['ordenes', miUnidad?.documentId] });
    },
  });

  if (isLoading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando…</div>;
  }
  if (!miUnidad) {
    return (
      <div className={styles.pantalla} style={{ padding: 24 }}>
        <div className={ui.card} style={{ padding: 28, textAlign: 'center', color: 'var(--text-soft)' }}>
          No tienes una unidad asignada. Pide a tu empresa que te asigne una.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pantalla}>
      <div className={styles.cabecera}>
        <div className={styles.cabeceraFila}>
          <span className={styles.cabeceraTitulo}>Mi unidad · {miUnidad.numero}</span>
          <span className={styles.cabeceraMeta}>{miUnidad.marcaModelo}</span>
        </div>
        <div className={styles.contadores}>
          <div className={styles.contador} style={{ flex: 2 }}>
            <div className={styles.contadorLabel}>Kilometraje</div>
            <div className={styles.contadorValor}>{miUnidad.kilometraje.toLocaleString('es-VE')}</div>
          </div>
          <div className={styles.contador}>
            <div className={styles.contadorLabel}>Alertas</div>
            <div className={styles.contadorValor}>
              {(alertas ?? []).filter((a) => a.tono !== 'ok').length}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.cuerpo}>

        {mensaje && (
          <div
            style={{
              background: 'var(--tint-50)',
              border: '1px solid var(--tint-200)',
              color: 'var(--blue-700)',
              borderRadius: 'var(--r-14)',
              padding: '12px 14px',
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {mensaje}
          </div>
        )}

        {/* Registro rápido de km */}
        <div className={ui.card} style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Registrar kilometraje</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Field
                label={`Actual: ${miUnidad.kilometraje.toLocaleString('es-VE')} km`}
                type="number"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                placeholder="Nuevo kilometraje"
              />
            </div>
            <button
              className={ui.btnPrimary}
              style={{ padding: '13px 18px', fontSize: 14 }}
              disabled={!km || Number(km) <= miUnidad.kilometraje || registrarKm.isPending}
              onClick={() => registrarKm.mutate()}
            >
              Registrar
            </button>
          </div>
        </div>

        {/* Alertas */}
        <div className={ui.card} style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Alertas de la unidad</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(alertas ?? []).map((a, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--r-12)',
                  fontSize: 13,
                  background: a.tono === 'bad' ? 'var(--bad-bg)' : a.tono === 'warn' ? 'var(--warn-bg)' : 'var(--pill-bg)',
                  color: a.tono === 'bad' ? 'var(--bad-text)' : a.tono === 'warn' ? 'var(--warn-text-alert)' : '#3c4a63',
                }}
              >
                <strong>{a.titulo}</strong> · {a.nota}
              </div>
            ))}
            {!alertas?.length && <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>Sin alertas activas.</div>}
          </div>
        </div>

        {/* Reportar novedad */}
        <div className={ui.card} style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Reportar novedad al taller</div>
          <Field
            label="¿Qué presenta la unidad?"
            value={novedad}
            onChange={(e) => setNovedad(e.target.value)}
            placeholder="Ej. Vibración en el eje trasero al frenar"
          />
          <button
            className={ui.btnSecondary}
            style={{ width: '100%', marginTop: 10 }}
            disabled={novedad.trim().length < 5 || reportar.isPending}
            onClick={() => reportar.mutate()}
          >
            {reportar.isPending ? 'Enviando…' : 'Enviar reporte'}
          </button>
        </div>

        {/* Últimas órdenes */}
        <div className={ui.card} style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Últimas intervenciones</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(ordenes ?? []).slice(0, 5).map((o) => (
              <div key={o.documentId} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
                <StatusChip tono={o.tipo === 'correctivo' ? 'bad' : 'info'} size="sm">
                  {o.tipo === 'correctivo' ? 'Correctivo' : 'Preventivo'}
                </StatusChip>
                <span style={{ minWidth: 0, flex: 1 }}>{o.intervencion}</span>
                <span style={{ color: 'var(--text-faint)', flex: 'none' }}>{o.fecha}</span>
              </div>
            ))}
            {!ordenes?.length && <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>Sin registros aún.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
