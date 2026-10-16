import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getWalletLinea, retiroLinea } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { Field } from '../../components/ui/Field';
import ui from '../../components/ui/ui.module.css';

const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

/**
 * Saldo wallet de la línea (pasajes urbanos + ventas web cobradas por wallet)
 * y solicitud de retiro a banco. El retiro queda pendiente hasta que la
 * plataforma haga la transferencia real y lo confirme (cola del superadmin,
 * igual que las recargas).
 */
export function WalletEmpresa() {
  const queryClient = useQueryClient();
  const [monto, setMonto] = useState('');
  const [datosPago, setDatosPago] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: wallet } = useQuery({ queryKey: ['wallet-linea'], queryFn: getWalletLinea });

  const retirar = useMutation({
    mutationFn: () => retiroLinea(Number(monto), datosPago),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-linea'] });
      setMensaje(`Retiro de ${bs(Number(monto))} solicitado. Se acredita a tu cuenta bancaria cuando la plataforma lo procese.`);
      setError(null);
      setMonto('');
      setDatosPago('');
    },
    onError: (e) => {
      setMensaje(null);
      if (e instanceof ApiError && e.code === 'saldo_insuficiente') {
        const d = e.details as { disponibleBs?: number };
        setError(`Saldo insuficiente: disponible ${bs(d?.disponibleBs ?? wallet?.saldoBs ?? 0)} (descontando retiros ya en proceso).`);
      } else {
        setError('No se pudo solicitar el retiro. Revisa el monto y los datos bancarios.');
      }
    },
  });

  return (
    <div className={ui.card} style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700 }}>
            Wallet de la empresa
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 4 }}>
            {wallet ? bs(wallet.saldoBs) : '…'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
            Pasajes urbanos y ventas cobradas con wallet, ya con la comisión descontada.
          </div>
        </div>
      </div>

      {mensaje && (
        <div style={{ fontSize: 13, color: 'var(--ok-text)', background: 'var(--ok-bg)', borderRadius: 12, padding: '10px 12px', marginTop: 14 }}>
          {mensaje}
        </div>
      )}
      {error && (
        <div style={{ fontSize: 13, color: 'var(--bad-text)', marginTop: 14 }}>{error}</div>
      )}

      {/* Apilado: esta tarjeta vive en una columna angosta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, marginTop: 16 }}>
        <Field label="Monto a retirar (Bs)" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />
        <Field
          label="Cuenta destino (banco, cuenta o pago móvil)"
          placeholder="Ej. Banesco 0134-… · RIF J-12345678-9"
          value={datosPago}
          onChange={(e) => setDatosPago(e.target.value)}
        />
        <button
          className={ui.btnPrimary}
          style={{ fontSize: 14, justifySelf: 'end' }}
          disabled={!(Number(monto) > 0) || !datosPago.trim() || retirar.isPending}
          onClick={() => retirar.mutate()}
        >
          {retirar.isPending ? 'Solicitando…' : 'Solicitar retiro'}
        </button>
      </div>
    </div>
  );
}
