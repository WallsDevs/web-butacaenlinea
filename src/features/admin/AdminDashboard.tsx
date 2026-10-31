import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { getAdminDashboard, getVisitas, type VisitasOrigen } from '../../lib/api/endpoints';
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
  const { data: visitas } = useQuery({ queryKey: ['admin-visitas'], queryFn: getVisitas, refetchInterval: 60_000 });
  const instagram = visitas?.find((v) => v.origen === 'instagram');

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

      {instagram && <TarjetaInstagram v={instagram} />}

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

/**
 * Visitas desde Instagram: hoy, 7 y 30 días, y una barra por día (30 días).
 * Se cuentan quienes entran por butacaenlinea.com/ig, por enlaces con
 * ?utm_source=instagram o desde instagram.com, una vez por sesión.
 */
function TarjetaInstagram({ v }: { v: VisitasOrigen }) {
  const max = Math.max(1, ...v.dias.map((d) => d.visitas));
  const copiar = () => void navigator.clipboard?.writeText('https://butacaenlinea.com/ig');
  return (
    <div className={ui.card} style={{ padding: 20, marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Visitas desde Instagram</span>
        <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>@butacaenlinea</span>
        <button className={ui.btnSecondary} style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 12px' }} onClick={copiar} title="Pon este enlace en la biografía de Instagram">
          Copiar enlace para la bio: butacaenlinea.com/ig
        </button>
      </div>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 12 }}>
        {[['Hoy', v.hoy], ['Últimos 7 días', v.semana], ['Últimos 30 días', v.mes]].map(([t, n]) => (
          <div key={t as string}>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{t}</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{(n as number).toLocaleString('es-VE')}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56, marginTop: 14 }} role="img" aria-label={`Visitas desde Instagram por día en los últimos 30 días: ${v.mes} en total`}>
        {v.dias.map((d) => (
          <span
            key={d.dia}
            title={`${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}: ${d.visitas} visita${d.visitas === 1 ? '' : 's'}`}
            style={{ flex: 1, height: `${Math.max(d.visitas ? 6 : 2, (d.visitas / max) * 100)}%`, background: d.visitas ? 'var(--blue-600)' : 'var(--divider)', borderRadius: '3px 3px 0 0' }}
          />
        ))}
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-faint)' }}>
        Cuenta a quien entra por el enlace de la bio, por enlaces con ?utm_source=instagram o desde instagram.com, una vez por visita.
      </p>
    </div>
  );
}
