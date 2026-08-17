import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdminEmpresas, getAdminEventos } from '../../lib/api/endpoints';
import { fechaCorta, hora } from '../../lib/time';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const NOMBRE_TIPO: Record<string, string> = {
  emision: 'Emisión de boleto',
  anulacion: 'Anulación',
  reserva: 'Reserva',
  liberacion: 'Liberación',
  validacion: 'Validación a bordo',
  apertura_turno: 'Apertura de turno',
  cierre_turno: 'Cierre de turno',
  cierre_abordaje: 'Cierre de abordaje',
  cambio_estado_unidad: 'Cambio estado unidad',
  rotacion_caucho: 'Rotación de caucho',
  reemplazo_caucho: 'Reemplazo de caucho',
  orden_mantenimiento: 'Orden de mantenimiento',
  actualizacion_tasa: 'Actualización de tasa',
  actualizacion_km: 'Kilometraje',
  verificacion_pago: 'Verificación de pago',
  liquidacion: 'Liquidación',
  cancelacion_salida: 'Cancelación de salida',
  llegada: 'Llegada de unidad',
  reembolso: 'Reembolso',
  onboarding_empresa: 'Alta/cambio de empresa',
  equipaje: 'Equipaje',
  asignacion_unidad: 'Asignación de unidad',
};

const fmtMonto = (monto: number | null | undefined, moneda?: string | null) => {
  if (monto == null) return '—';
  return moneda === 'USD' ? `$ ${monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : `${monto.toLocaleString('es-VE')} ${moneda ?? ''}`;
};

/** Auditoría global: todo lo que pasa en la plataforma, empresa por empresa. */
export default function AdminAuditoria() {
  const [tipo, setTipo] = useState('');
  const [linea, setLinea] = useState('');

  const { data: empresas } = useQuery({ queryKey: ['admin-empresas'], queryFn: getAdminEmpresas });
  const { data: eventos, isLoading } = useQuery({
    queryKey: ['admin-eventos', tipo, linea],
    queryFn: () => getAdminEventos({ tipo: tipo || undefined, linea: linea || undefined }),
    refetchInterval: 30_000,
  });

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Auditoría</h2>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <select className={ui.fieldInput} style={{ width: 220 }} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos los eventos</option>
            {Object.entries(NOMBRE_TIPO).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select className={ui.fieldInput} style={{ width: 200 }} value={linea} onChange={(e) => setLinea(e.target.value)}>
            <option value="">Todas las empresas</option>
            {(empresas ?? []).map((e) => (
              <option key={e.documentId} value={e.documentId}>
                {e.nombre}
              </option>
            ))}
          </select>
        </span>
      </div>

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Cuándo</th>
              <th>Evento</th>
              <th>Empresa</th>
              <th>Quién</th>
              <th>Monto</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {(eventos ?? []).map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--text-soft)' }}>
                  {fechaCorta(e.fecha)} {hora(e.fecha)}
                </td>
                <td style={{ fontWeight: 600 }}>{NOMBRE_TIPO[e.tipo] ?? e.tipo}</td>
                <td style={{ color: 'var(--text-soft)' }}>{e.linea ?? '—'}</td>
                <td style={{ color: 'var(--text-soft)' }}>{e.usuario ?? 'sistema'}</td>
                <td>{fmtMonto(e.monto, e.moneda)}</td>
                <td style={{ fontSize: 12, color: 'var(--text-faint)', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.datos ? JSON.stringify(e.datos) : '—'}
                </td>
              </tr>
            ))}
            {!isLoading && !eventos?.length && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 24 }}>
                  Sin eventos con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
