import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  generarFacturas,
  getAdminFacturas,
  vencerFacturas,
  verificarFactura,
  type EstadoFactura,
  type Factura,
} from '../../lib/api/endpoints';
import { fechaConAnio } from '../../lib/time';
import { CHIP_ESTADO, nombreDePeriodo } from '../../lib/facturas';
import { PillTabs } from '../../components/ui/PillTabs';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const usd = (n: number) => `$ ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { maximumFractionDigits: 2 })}`;

type Filtro = EstadoFactura | 'todas';

/**
 * Facturas mensuales por bus. Se emiten solas el día 1; aquí el superadmin
 * verifica los pagos reportados contra el banco, y puede emitir o vencer a
 * mano si hace falta. Una vencida suspende el módulo que la originó.
 */
export default function AdminFacturas() {
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>('por_verificar');
  const [nota, setNota] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  const { data: facturas, isLoading } = useQuery({
    queryKey: ['admin-facturas', filtro],
    queryFn: () => getAdminFacturas(filtro === 'todas' ? {} : { estado: filtro }),
  });

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-facturas'] });
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
  };

  const verificar = useMutation({
    mutationFn: ({ id, aprobada }: { id: string; aprobada: boolean }) =>
      verificarFactura(id, aprobada, nota[id] || undefined),
    onSuccess: refrescar,
  });
  const emitir = useMutation({
    mutationFn: () => generarFacturas(),
    onSuccess: (r) => {
      setAviso(
        r.generadas.length
          ? `${r.generadas.length} ${r.generadas.length === 1 ? 'factura emitida' : 'facturas emitidas'} de ${nombreDePeriodo(r.periodo)}.`
          : `Nada que emitir para ${nombreDePeriodo(r.periodo)}: ya estaban emitidas o ninguna línea cobra por bus.`
      );
      refrescar();
    },
  });
  const vencer = useMutation({
    mutationFn: vencerFacturas,
    onSuccess: (r) => {
      setAviso(r.vencidas ? `${r.vencidas} ${r.vencidas === 1 ? 'factura vencida' : 'facturas vencidas'}.` : 'Ninguna factura pasó su plazo.');
      refrescar();
    },
  });

  const totalFiltro = (facturas ?? []).reduce((s, f) => s + f.montoUsd, 0);

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Facturas</h2>
        {filtro !== 'todas' && filtro !== 'pagada' && totalFiltro > 0 && (
          <StatusChip tono={CHIP_ESTADO[filtro].tono}>{usd(totalFiltro)} {CHIP_ESTADO[filtro].texto.toLowerCase()}</StatusChip>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className={ui.btnSecondary} style={{ fontSize: 13 }} disabled={emitir.isPending} onClick={() => emitir.mutate()}>
            Emitir mes anterior
          </button>
          <button className={ui.btnGhost} style={{ fontSize: 13 }} disabled={vencer.isPending} onClick={() => vencer.mutate()}>
            Vencer atrasadas
          </button>
          <PillTabs
            variant="loose"
            items={[
              { id: 'por_verificar', label: 'Por verificar' },
              { id: 'pendiente', label: 'Pendientes' },
              { id: 'vencida', label: 'Vencidas' },
              { id: 'pagada', label: 'Pagadas' },
              { id: 'todas', label: 'Todas' },
            ]}
            value={filtro}
            onChange={setFiltro}
          />
        </span>
      </div>
      {aviso && (
        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 12 }}>
          {aviso}{' '}
          <button className={ui.btnGhost} style={{ fontSize: 12, padding: '2px 6px' }} onClick={() => setAviso(null)}>
            Ocultar
          </button>
        </p>
      )}

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Mes</th>
              <th>Empresa</th>
              <th>Buses</th>
              <th>Monto</th>
              <th>Vence</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(facturas ?? []).map((f) => (
              <FilaFactura key={f.documentId} f={f} nota={nota[f.documentId] ?? ''} onNota={(v) => setNota((n) => ({ ...n, [f.documentId]: v }))} verificar={verificar} />
            ))}
            {!isLoading && !facturas?.length && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 24 }}>
                  {filtro === 'por_verificar'
                    ? 'Nada por verificar. Cuando una empresa reporte un pago aparece aquí.'
                    : 'Sin facturas en esta vista. Se emiten el día 1 de cada mes para las líneas que cobran por bus.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaFactura({
  f,
  nota,
  onNota,
  verificar,
}: {
  f: Factura;
  nota: string;
  onNota: (v: string) => void;
  verificar: { mutate: (v: { id: string; aprobada: boolean }) => void; isPending: boolean };
}) {
  const chip = CHIP_ESTADO[f.estado];
  return (
    <tr>
      <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{nombreDePeriodo(f.periodo)}</td>
      <td>{f.linea.nombre}</td>
      <td style={{ color: 'var(--text-soft)' }}>
        {f.buses} <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>× {usd(f.montoBusUsd)}</span>
      </td>
      <td style={{ fontWeight: 700 }}>
        {usd(f.montoUsd)}
        <div style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-faint)' }}>{bs(f.montoBs)}</div>
      </td>
      <td style={{ color: f.estado === 'vencida' ? 'var(--red-600, #DC2626)' : 'var(--text-soft)' }}>{fechaConAnio(`${f.venceEn}T12:00:00`)}</td>
      <td>
        <StatusChip tono={chip.tono} size="sm">{chip.texto}</StatusChip>
        {f.estado === 'por_verificar' && f.referencia && (
          <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 2 }}>
            Ref. {f.referencia}
            {f.banco ? ` · ${f.banco}` : ''}
          </div>
        )}
        {f.notaRechazo && f.estado !== 'pagada' && (
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>Devuelta: {f.notaRechazo}</div>
        )}
      </td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {f.estado === 'por_verificar' && (
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input className={ui.fieldInput} style={{ width: 170, fontSize: 13 }} placeholder="Nota si la devuelves" value={nota} onChange={(e) => onNota(e.target.value)} />
            <button
              className={ui.btnGhost}
              style={{ fontSize: 13 }}
              disabled={verificar.isPending || !nota.trim()}
              title={nota.trim() ? '' : 'Escribe por qué la devuelves'}
              onClick={() => verificar.mutate({ id: f.documentId, aprobada: false })}
            >
              Devolver
            </button>
            <button
              className={ui.btnPrimary}
              style={{ fontSize: 13, padding: '10px 16px' }}
              disabled={verificar.isPending}
              onClick={() => {
                if (confirm(`¿Confirmas que ${f.linea.nombre} pagó ${usd(f.montoUsd)} (ref. ${f.referencia})?`)) {
                  verificar.mutate({ id: f.documentId, aprobada: true });
                }
              }}
            >
              Confirmar pago
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}
