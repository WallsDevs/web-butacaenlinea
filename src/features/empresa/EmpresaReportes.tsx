import { useState } from 'react';
import { Cargando } from '../../components/ui/PantallaCarga';
import { useQuery } from '@tanstack/react-query';
import { getReportesEmpresa } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { hoyISO } from '../../lib/time';
import { Field } from '../../components/ui/Field';
import { EncabezadoPantalla } from '../../components/ui/EncabezadoPantalla';

import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const NOMBRE_CLAVE: Record<string, string> = {
  web: 'Venta web',
  pos: 'Taquilla',
  efectivo_bs: 'Efectivo Bs',
  efectivo_usd: 'Efectivo USD',
  pago_movil: 'Pago Móvil',
  transferencia: 'Transferencia',
  punto_venta: 'Punto de venta',
  tarjeta_cop: 'Pesos COP',
  zelle: 'Zelle',
};

function Tabla({ titulo, filas }: { titulo: string; filas: { clave: string; boletos: number; totalUsd: number }[] }) {
  return (
    <div className={ui.card} style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', fontWeight: 700, fontSize: 15 }}>{titulo}</div>
      <table className={styles.tabla}>
        <tbody>
          {filas.map((f) => (
            <tr key={f.clave}>
              <td>{NOMBRE_CLAVE[f.clave] ?? f.clave}</td>
              <td style={{ color: 'var(--text-soft)' }}>{f.boletos} boletos</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>
                $ {f.totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
          {!filas.length && (
            <tr>
              <td style={{ color: 'var(--text-soft)', textAlign: 'center', padding: 18 }}>Sin datos.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Reportes de la empresa: ventas por período + liquidaciones de comisión. */
export default function EmpresaReportes() {
  const [desde, setDesde] = useState(() => {
    const d = new Date(Date.now() - 6 * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(hoyISO());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['empresa-reportes', desde, hasta],
    queryFn: () => getReportesEmpresa(desde, hasta),
    retry: 1,
  });
  const codigo = error instanceof ApiError ? `${error.status || 'sin conexión'} · ${error.code}` : error ? String(error) : null;

  return (
    <div className={styles.contenido}>
      <EncabezadoPantalla
        titulo="Reportes"
        descripcion="Lo vendido en el período por día, canal, método de pago y cajero, con las liquidaciones de comisión."
        acciones={
          <>
            <div style={{ width: 165 }}>
              <Field label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div style={{ width: 165 }}>
              <Field label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          </>
        }
      />

      {error ? (
        <div className={ui.card} style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ fontWeight: 700 }}>No se pudo calcular el reporte</div>
          <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 6 }}>
            {error instanceof ApiError && error.status === 401
              ? 'Tu sesión venció: vuelve a entrar.'
              : error instanceof ApiError && error.code === 'modulo_no_contratado'
                ? 'Tu contrato no incluye reportes de venta.'
                : `El servidor respondió: ${codigo}.`}
          </div>
          <button className={ui.btnSecondary} style={{ marginTop: 14 }} onClick={() => refetch()}>Reintentar</button>
        </div>
      ) : isLoading || !data ? (
        <Cargando mensaje="Calculando el reporte…" />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            {[
              { n: String(data.totales.boletos), label: 'Boletos vendidos' },
              { n: `$ ${data.totales.totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, label: 'Ventas del período' },
              { n: String(data.totales.anulados), label: 'Anulaciones' },
              { n: `$ ${data.totales.comisionUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, label: 'Comisión de plataforma' },
            ].map((c) => (
              <div key={c.label} className={ui.card} style={{ padding: 18 }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--blue-700)' }}>{c.n}</div>
                <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>{c.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <Tabla titulo="Por día" filas={data.porDia} />
            <Tabla titulo="Por canal" filas={data.porCanal} />
            <Tabla titulo="Por método de pago" filas={data.porMetodo} />
            <Tabla titulo="Por cajero" filas={data.porCajero} />
          </div>

          <div className={ui.card} style={{ overflow: 'hidden', marginTop: 20 }}>
            <div style={{ padding: '14px 18px', fontWeight: 700, fontSize: 15 }}>
              Liquidaciones de comisión (la plataforma cobra % por boleto vendido)
            </div>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Boletos</th>
                  <th>Ventas</th>
                  <th>Comisión</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.liquidaciones.map((l) => (
                  <tr key={l.documentId}>
                    <td style={{ fontWeight: 600 }}>{l.fecha}</td>
                    <td style={{ color: 'var(--text-soft)' }}>{l.boletos}</td>
                    <td>$ {l.ventasUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                    <td style={{ fontWeight: 700 }}>$ {l.comisionUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                    <td>
                      {l.estado === 'cobrada' ? (
                        <StatusChip tono="ok" size="sm">Cobrada</StatusChip>
                      ) : l.estado === 'retenida' ? (
                        <StatusChip tono="ok" size="sm">Retenida por Butaca</StatusChip>
                      ) : (
                        <StatusChip tono="warn" size="sm">Pendiente</StatusChip>
                      )}
                    </td>
                  </tr>
                ))}
                {!data.liquidaciones.length && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 20 }}>
                      Sin liquidaciones en el período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
