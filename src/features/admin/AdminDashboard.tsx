import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { getAdminDashboard } from '../../lib/api/endpoints';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const usd = (n: number) => `$ ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

/** Cifras del día de toda la plataforma y desglose por empresa. */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboard,
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando plataforma…</div>;
  }

  const cifras = [
    { label: 'Empresas activas', valor: `${data.empresasActivas} / ${data.empresas}` },
    { label: 'Boletos hoy', valor: String(data.boletosHoy) },
    { label: 'Ventas hoy', valor: usd(data.ventasUsdHoy) },
    { label: 'Comisión hoy', valor: usd(data.comisionUsdHoy) },
    { label: 'Comisión por cobrar', valor: usd(data.comisionPendienteUsd), destacada: data.comisionPendienteUsd > 0 },
  ];

  return (
    <div className={styles.contenido}>
      <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>
        La plataforma hoy
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
        {cifras.map((c) => (
          <div key={c.label} className={ui.card} style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: c.destacada ? 'var(--warn-text)' : 'var(--text)' }}>
              {c.valor}
            </div>
          </div>
        ))}
      </div>

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', fontWeight: 700, fontSize: 17 }}>Por empresa</div>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Boletos hoy</th>
              <th>Ventas hoy</th>
              <th>Comisión %</th>
              <th>Comisión hoy</th>
              <th>Por cobrar</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.porEmpresa.map((e) => (
              <tr key={e.documentId} style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/empresas')}>
                <td style={{ fontWeight: 600 }}>{e.nombre}</td>
                <td>{e.boletosHoy}</td>
                <td>{usd(e.ventasUsdHoy)}</td>
                <td style={{ color: 'var(--text-soft)' }}>{e.comisionPct}%</td>
                <td>{usd(e.comisionUsdHoy)}</td>
                <td style={{ fontWeight: e.pendienteUsd > 0 ? 700 : 400 }}>{usd(e.pendienteUsd)}</td>
                <td>
                  {e.activa ? (
                    <StatusChip tono="ok" size="sm">Activa</StatusChip>
                  ) : (
                    <StatusChip tono="bad" size="sm">Suspendida</StatusChip>
                  )}
                </td>
              </tr>
            ))}
            {!data.porEmpresa.length && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 24 }}>
                  Aún no hay empresas. Crea la primera en la sección Empresas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
