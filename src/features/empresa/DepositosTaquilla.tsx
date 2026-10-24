import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDatosPago, getDepositos, reportarDeposito, type DepositoTaquilla } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { fechaCorta, hora } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';

const monto = (v: number, m: string) => (m === 'USD' ? `$${v.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : m === 'COP' ? `COP ${v.toLocaleString('es-VE')}` : `Bs ${v.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`);
const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
const ESTADO: Record<DepositoTaquilla['estado'], { tono: 'ok' | 'warn' | 'bad' | 'neutral'; texto: string }> = {
  pendiente: { tono: 'warn', texto: 'Por depositar' },
  reportado: { tono: 'neutral', texto: 'En revisión por Butaca' },
  verificado: { tono: 'ok', texto: 'Acreditado' },
  rechazado: { tono: 'bad', texto: 'Rechazado: revisa y vuelve a reportar' },
  anulado: { tono: 'neutral', texto: 'Sin nada que depositar (boletos anulados)' },
};

/**
 * Depósitos a Butaca de lo cobrado en la taquilla. Al cerrar cada turno nace
 * uno por moneda; la línea deposita a las cuentas de Butaca y lo reporta aquí.
 * Cuando Butaca lo confirma, el neto entra a la wallet de la línea.
 */
export function DepositosTaquilla() {
  const queryClient = useQueryClient();
  const { data: depositos } = useQuery({ queryKey: ['depositos'], queryFn: getDepositos, refetchInterval: 60_000 });
  const { data: cuentas } = useQuery({ queryKey: ['datos-pago'], queryFn: getDatosPago, staleTime: 600_000 });
  const [abierto, setAbierto] = useState<string | null>(null);
  const [referencia, setReferencia] = useState('');
  const [banco, setBanco] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reportar = useMutation({
    mutationFn: (id: string) => reportarDeposito(id, referencia.trim(), banco.trim() || undefined, archivo),
    onSuccess: () => {
      setAbierto(null);
      setReferencia('');
      setBanco('');
      setArchivo(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['depositos'] });
    },
    onError: (e) => setError(e instanceof ApiError && e.code === 'no_pendiente' ? 'Ese depósito ya se reportó.' : 'No se pudo reportar. Intenta de nuevo.'),
  });

  const lista = depositos ?? [];
  const porPagar = lista.filter((d) => d.estado === 'pendiente' || d.estado === 'rechazado');
  const deuda = porPagar.reduce((acc, d) => acc.set(d.moneda, (acc.get(d.moneda) ?? 0) + d.monto), new Map<string, number>());
  if (!lista.length) return null;

  return (
    <div className={ui.card} style={{ padding: 20, marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Depósitos a Butaca</span>
        {deuda.size > 0 && <StatusChip tono="warn">Por depositar: {[...deuda.entries()].map(([m, v]) => monto(v, m)).join(' · ')}</StatusChip>}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-soft)', margin: '6px 0 12px', lineHeight: 1.5 }}>
        Lo cobrado en la taquilla se deposita a Butaca. Cuando Butaca lo confirma, el neto (lo cobrado menos la comisión) entra a tu wallet.
        {cuentas?.pagoMovil || cuentas?.transferencia || cuentas?.zelle ? (
          <>
            {' '}Bolívares: {cuentas?.transferencia ? `${cuentas.transferencia.banco} ${cuentas.transferencia.cuenta} · ${cuentas.transferencia.titular}` : cuentas?.pagoMovil ? `Pago Móvil ${cuentas.pagoMovil.banco} ${cuentas.pagoMovil.telefono} · ${cuentas.pagoMovil.documento}` : '—'}.
            {cuentas?.zelle ? ` Dólares: Zelle ${cuentas.zelle.correo}.` : ''}
          </>
        ) : null}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {lista.slice(0, 20).map((d) => (
          <div key={d.documentId} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 14 }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 600 }}>
                  {d.turno.taquilla ?? 'Taquilla'} · {d.turno.cajero ?? ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  Turno cerrado {d.turno.cerradoEn ? `${fechaCorta(d.turno.cerradoEn)} ${hora(d.turno.cerradoEn)}` : ''} · {d.boletos} boletos
                  {d.referencia ? ` · ref ${d.referencia}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>{monto(d.monto, d.moneda)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>a tu wallet: {bs(d.netoBs)}</div>
              </div>
              <StatusChip tono={ESTADO[d.estado].tono} size="sm">{ESTADO[d.estado].texto}</StatusChip>
              {(d.estado === 'pendiente' || d.estado === 'rechazado') && abierto !== d.documentId && (
                <button className={ui.btnSecondary} style={{ fontSize: 13 }} onClick={() => setAbierto(d.documentId)}>
                  Reportar depósito
                </button>
              )}
            </div>
            {d.estado === 'rechazado' && d.nota && <div style={{ fontSize: 12, color: 'var(--bad-text)', marginTop: 4 }}>Butaca: {d.nota}</div>}
            {abierto === d.documentId && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                <input className={ui.fieldInput} style={{ width: 190 }} placeholder="Referencia del depósito" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
                <input className={ui.fieldInput} style={{ width: 150 }} placeholder="Banco (opcional)" value={banco} onChange={(e) => setBanco(e.target.value)} />
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} style={{ fontSize: 12 }} />
                <button className={ui.btnPrimary} disabled={!referencia.trim() || reportar.isPending} onClick={() => reportar.mutate(d.documentId)}>
                  {reportar.isPending ? 'Enviando…' : 'Reportar'}
                </button>
                <button className={ui.btnGhost} onClick={() => setAbierto(null)}>Cancelar</button>
                {error && <span style={{ fontSize: 13, color: 'var(--bad-text)' }}>{error}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
