import { useNavigate } from 'react-router';
import { Cargando } from '../../components/ui/PantallaCarga';
import { useQuery } from '@tanstack/react-query';
import { getDashboardEmpresa } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { EncabezadoPantalla } from '../../components/ui/EncabezadoPantalla';
import { hora, fechaCorta } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

/** Dashboard de la empresa: el pulso del día. */
export default function EmpresaDashboard() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['empresa-dashboard'],
    queryFn: getDashboardEmpresa,
    refetchInterval: 30000,
    retry: 1,
  });

  // Un error no se disfraza de «Cargando…»: se dice cuál es y se puede reintentar
  if (error) {
    const e = error instanceof ApiError ? error : null;
    return (
      <div className={styles.contenido}>
        <div className={ui.card} style={{ padding: 28, textAlign: 'center', maxWidth: 560 }}>
          <div style={{ fontWeight: 700 }}>No se pudo cargar el inicio</div>
          <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 6 }}>
            {e?.status === 401 ? 'Tu sesión venció: vuelve a entrar.' : `El servidor respondió: ${e ? `${e.status || 'sin conexión'} · ${e.code}` : String(error)}.`}
          </div>
          <button className={ui.btnSecondary} style={{ marginTop: 14 }} onClick={() => refetch()}>Reintentar</button>
        </div>
      </div>
    );
  }
  if (isLoading || !data) {
    return <Cargando mensaje="Preparando el inicio…" />;
  }

  const cards = [
    { n: String(data.hoy.boletos), label: 'Boletos vendidos hoy' },
    { n: `$ ${data.hoy.totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, label: 'Ventas de hoy' },
    { n: String(data.porVerificar), label: 'Pagos por verificar', alerta: data.porVerificar > 0 },
    { n: `$ ${data.hoy.comisionUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, label: 'Comisión de plataforma hoy' },
  ];

  return (
    <div className={styles.contenido}>
      <EncabezadoPantalla titulo="Inicio" descripcion="El pulso del día: ventas, pagos por verificar, próximas salidas y liquidaciones pendientes." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {cards.map((c) => (
          <div key={c.label} className={ui.card} style={{ padding: 20 }}>
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: c.alerta ? 'var(--warn-text)' : 'var(--blue-700)',
              }}
            >
              {c.n}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 6 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginTop: 20, alignItems: 'start' }}>
        {/* Próximas salidas con ocupación */}
        <div className={ui.card} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Próximas salidas</span>
            <button className={ui.btnGhost} style={{ marginLeft: 'auto', fontSize: 13 }} onClick={() => navigate('/empresa/salidas')}>
              Programar salida →
            </button>
          </div>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>Salida</th>
                <th>Destino</th>
                <th>Unidad</th>
                <th>Ocupación</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.proximasSalidas.map((s) => {
                const pct = s.ocupacion.total ? Math.round((s.ocupacion.vendidos / s.ocupacion.total) * 100) : 0;
                return (
                  <tr key={s.documentId}>
                    <td style={{ fontWeight: 700 }}>
                      {hora(s.fechaHoraSalida)}
                      <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}> · {fechaCorta(s.fechaHoraSalida)}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{s.destino}</td>
                    <td style={{ color: 'var(--text-soft)' }}>{s.unidad}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 70, height: 8, background: 'var(--divider)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--grad-progress)' }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                          {s.ocupacion.vendidos}/{s.ocupacion.total}
                        </span>
                      </div>
                    </td>
                    <td>
                      {s.estado === 'abordando' ? (
                        <StatusChip tono="info" size="sm">Abordando</StatusChip>
                      ) : s.estado === 'en_ruta' ? (
                        <StatusChip tono="ok" size="sm">En Ruta</StatusChip>
                      ) : (
                        <StatusChip tono="neutral" size="sm">Programada</StatusChip>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!data.proximasSalidas.length && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 24 }}>
                    Sin salidas próximas. Programa una desde Salidas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Liquidaciones y accesos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className={ui.card} style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Comisiones pendientes con la plataforma</div>
            {data.liquidacionesPendientes.length ? (
              data.liquidacionesPendientes.map((l) => (
                <div key={l.documentId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0' }}>
                  <span style={{ color: 'var(--text-soft)' }}>
                    {l.fecha} · {l.boletos} boletos
                  </span>
                  <span style={{ fontWeight: 700 }}>$ {l.comisionUsd.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>Al día con la plataforma ✓</div>
            )}
          </div>
          {data.porVerificar > 0 && (
            <button className={ui.card} style={{ padding: 18, textAlign: 'left', cursor: 'pointer', borderColor: 'var(--warn-border-soft)' }} onClick={() => navigate('/empresa/pagos')}>
              <span style={{ fontWeight: 700, color: 'var(--warn-text)' }}>
                {data.porVerificar} pago{data.porVerificar === 1 ? '' : 's'} web por verificar
              </span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>
                Confirma las referencias contra tu banco →
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
