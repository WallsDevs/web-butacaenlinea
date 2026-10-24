import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWalletLinea } from '../../lib/api/endpoints';
import { fechaCorta, hora } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import { EncabezadoPantalla } from '../../components/ui/EncabezadoPantalla';
import { CuentasRetiro, WalletEmpresa } from './WalletEmpresa';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
const NOMBRE_MOV: Record<string, string> = { reparto: 'Venta cobrada con wallet', retiro: 'Retiro', ajuste: 'Ajuste', comision: 'Comisión', recarga: 'Abono', reembolso: 'Devolución al pasajero' };
/** El pasaje urbano lleva unidad; el boleto de viaje, su folio en la referencia. */
const nombreMov = (m: { tipo: string; unidad?: string | null }) =>
  m.tipo === 'pasaje' ? (m.unidad ? 'Pasaje urbano' : 'Boleto de viaje') : (NOMBRE_MOV[m.tipo] ?? m.tipo);
const FILTROS = [
  { id: 'todo', label: 'Todo' },
  { id: 'urbano', label: 'Urbano' },
  { id: 'viajes', label: 'Boletos de viaje' },
  { id: 'devoluciones', label: 'Devoluciones' },
  { id: 'retiros', label: 'Retiros' },
] as const;
type Filtro = (typeof FILTROS)[number]['id'];
const pasaFiltro = (f: Filtro, m: { tipo: string; unidad?: string | null }) =>
  f === 'todo' ||
  (f === 'urbano' && m.tipo === 'pasaje' && Boolean(m.unidad)) ||
  (f === 'viajes' && (m.tipo === 'pasaje' || m.tipo === 'reparto') && !m.unidad) ||
  (f === 'devoluciones' && m.tipo === 'reembolso') ||
  (f === 'retiros' && m.tipo === 'retiro');
const TONO_ESTADO: Record<string, 'ok' | 'warn' | 'bad' | 'neutral'> = { confirmado: 'ok', pendiente: 'warn', rechazado: 'bad' };

/**
 * La wallet de la línea como pantalla propia: lo que entra (pasajes urbanos
 * por QR y ventas cobradas con wallet, ya sin la comisión), lo que sale
 * (retiros al banco) y la solicitud de retiro.
 */
export default function EmpresaWallet() {
  const { data: wallet, isLoading } = useQuery({ queryKey: ['wallet-linea'], queryFn: getWalletLinea, refetchInterval: 30_000 });
  const [filtro, setFiltro] = useState<Filtro>('todo');
  const movimientos = wallet?.movimientos ?? [];
  const visibles = movimientos.filter((m) => pasaFiltro(filtro, m));
  const entradasConfirmadas = movimientos.filter((m) => m.direccion === 'entrada' && m.estado === 'confirmado');
  const retirosPendientes = movimientos.filter((m) => m.tipo === 'retiro' && m.estado === 'pendiente');
  const cobradoBs = entradasConfirmadas.reduce((s, m) => s + m.montoBs, 0);
  const pendienteBs = retirosPendientes.reduce((s, m) => s + m.montoBs, 0);

  return (
    <div className={styles.contenido} style={{ maxWidth: 1240 }}>
      <EncabezadoPantalla
        titulo="Wallet"
        chip={retirosPendientes.length > 0 && <StatusChip tono="warn">{retirosPendientes.length} {retirosPendientes.length === 1 ? 'retiro en proceso' : 'retiros en proceso'}</StatusChip>}
        descripcion="Lo que la línea cobra por wallet (pasajes urbanos por QR y boletos de viaje pagados con saldo), ya con la comisión descontada, las devoluciones a pasajeros y los retiros a tu banco."
      />
      <div className={styles.dosColumnas}>
        <div className={ui.card} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Movimientos</span>
            <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>
              {isLoading ? 'Cargando…' : `${entradasConfirmadas.length} cobros por ${bs(cobradoBs)}${pendienteBs ? ` · ${bs(pendienteBs)} en retiros por procesar` : ''}`}
            </span>
          </div>
          <div role="tablist" aria-label="Filtrar movimientos" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={filtro === f.id ? ui.btnPrimary : ui.btnSecondary}
                style={{ padding: '6px 12px', fontSize: 13 }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {visibles.map((m) => (
            <div key={m.documentId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {nombreMov(m)}
                  {m.unidad ? ` · unidad ${m.unidad}` : ''}
                  {m.tipo !== 'pasaje' && m.contraparte && m.contraparte !== 'Retiro' ? ` · ${m.contraparte}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  {fechaCorta(m.fecha)} {hora(m.fecha)}
                  {m.referencia ? ` · ${m.tipo === 'pasaje' || m.tipo === 'reembolso' ? 'boleto' : 'ref'} ${m.referencia}` : ''}
                  {m.nota ? ` · ${m.nota}` : ''}
                </div>
              </div>
              <StatusChip tono={TONO_ESTADO[m.estado] ?? 'neutral'} size="sm">{m.estado}</StatusChip>
              <div style={{ fontWeight: 700, minWidth: 120, textAlign: 'right', color: m.direccion === 'entrada' ? 'var(--ok-text)' : 'var(--text)' }}>
                {m.direccion === 'entrada' ? '+' : '−'}{bs(m.montoBs)}
              </div>
            </div>
          ))}
          {!isLoading && movimientos.length > 0 && !visibles.length && (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-soft)', fontSize: 14 }}>Nada de este tipo en los últimos movimientos.</div>
          )}
          {!isLoading && !movimientos.length && (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-soft)', fontSize: 14 }}>
              Todavía no hay movimientos. Aparecen aquí al cobrar un pasaje urbano por QR o una venta pagada con wallet.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <WalletEmpresa />
          <CuentasRetiro />
        </div>
      </div>
    </div>
  );
}
