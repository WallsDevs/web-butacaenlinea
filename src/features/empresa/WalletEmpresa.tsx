import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eliminarCuentaRetiro, getCuentasRetiro, getWalletLinea, guardarCuentaRetiro, retiroLinea, type CuentaRetiro } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { Field } from '../../components/ui/Field';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';

const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
const NOMBRE_TIPO: Record<CuentaRetiro['tipo'], string> = { pago_movil: 'Pago Móvil', transferencia: 'Transferencia' };
const describir = (c: CuentaRetiro) => `${c.alias || NOMBRE_TIPO[c.tipo]} · ${c.banco} · ${c.numero}`;

/**
 * Saldo wallet de la línea (pasajes urbanos + ventas web cobradas por wallet)
 * y solicitud de retiro a una de sus cuentas guardadas. El retiro queda
 * pendiente hasta que la plataforma haga la transferencia real y lo confirme
 * (cola del superadmin, igual que las recargas).
 */
export function WalletEmpresa() {
  const queryClient = useQueryClient();
  const [monto, setMonto] = useState('');
  const [cuentaId, setCuentaId] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: wallet, error: errorWallet } = useQuery({ queryKey: ['wallet-linea'], queryFn: getWalletLinea, retry: 1 });
  const { data: cuentas } = useQuery({ queryKey: ['cuentas-retiro'], queryFn: getCuentasRetiro });
  const elegida = (cuentas ?? []).find((c) => c.id === cuentaId) ?? (cuentas ?? []).find((c) => c.predeterminada) ?? cuentas?.[0];

  const retirar = useMutation({
    mutationFn: () => retiroLinea(Number(monto), elegida!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-linea'] });
      setMensaje(`Retiro de ${bs(Number(monto))} solicitado a ${describir(elegida!)}. Se acredita cuando la plataforma lo procese.`);
      setError(null);
      setMonto('');
    },
    onError: (e) => {
      setMensaje(null);
      if (e instanceof ApiError && e.code === 'saldo_insuficiente') {
        const d = e.details as { disponibleBs?: number };
        setError(`Saldo insuficiente: disponible ${bs(d?.disponibleBs ?? wallet?.saldoBs ?? 0)} (descontando retiros ya en proceso).`);
      } else {
        setError('No se pudo solicitar el retiro. Revisa el monto.');
      }
    },
  });

  return (
    <div className={ui.card} style={{ padding: 24 }}>
      <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700 }}>Wallet de la empresa</div>
      <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 4 }}>
        {wallet ? bs(wallet.saldoBs) : errorWallet ? '—' : '…'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
        {errorWallet
          ? `No se pudo leer el saldo (${errorWallet instanceof ApiError ? `${errorWallet.status || 'sin conexión'} · ${errorWallet.code}` : String(errorWallet)}).`
          : 'Lo que vendes por Butaca (pasajes urbanos, boletos de viaje y depósitos de taquilla), ya con la comisión descontada.'}
      </div>

      {mensaje && (
        <div style={{ fontSize: 13, color: 'var(--ok-text)', background: 'var(--ok-bg)', borderRadius: 12, padding: '10px 12px', marginTop: 14 }}>{mensaje}</div>
      )}
      {error && <div style={{ fontSize: 13, color: 'var(--bad-text)', marginTop: 14 }}>{error}</div>}

      {cuentas && !cuentas.length ? (
        <div style={{ fontSize: 13, color: 'var(--text-soft)', background: 'var(--tint-50)', borderRadius: 12, padding: '10px 12px', marginTop: 16 }}>
          Para retirar, guarda primero la cuenta de la línea en <strong>Cuentas para retiros</strong>, aquí debajo. Se guarda una vez.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, marginTop: 16 }}>
          <Field label="Monto a retirar (Bs)" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />
          <label className={ui.field}>
            <span className={ui.fieldLabel}>A la cuenta</span>
            <select className={ui.fieldInput} value={elegida?.id ?? ''} onChange={(e) => setCuentaId(e.target.value)}>
              {(cuentas ?? []).map((c) => (
                <option key={c.id} value={c.id}>{describir(c)}</option>
              ))}
            </select>
          </label>
          <button
            className={ui.btnPrimary}
            style={{ fontSize: 14, justifySelf: 'end' }}
            disabled={!(Number(monto) > 0) || !elegida || retirar.isPending}
            onClick={() => retirar.mutate()}
          >
            {retirar.isPending ? 'Solicitando…' : 'Solicitar retiro'}
          </button>
        </div>
      )}
    </div>
  );
}

const NUEVA = { tipo: 'pago_movil' as CuentaRetiro['tipo'], alias: '', banco: '', numero: '', titular: '', documento: '', predeterminada: false };

/** Las cuentas bancarias o pago móvil de la línea para recibir retiros: se guardan una vez y se eligen al retirar. */
export function CuentasRetiro() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<(typeof NUEVA & { id?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: cuentas, isLoading } = useQuery({ queryKey: ['cuentas-retiro'], queryFn: getCuentasRetiro });

  const guardar = useMutation({
    mutationFn: () => guardarCuentaRetiro({ ...form!, alias: form!.alias || undefined, documento: form!.documento || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cuentas-retiro'] });
      setForm(null);
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError && e.code === 'demasiadas_cuentas' ? 'Máximo cinco cuentas guardadas.' : 'No se pudo guardar: banco, número y titular son obligatorios.'),
  });
  const eliminar = useMutation({
    mutationFn: (id: string) => eliminarCuentaRetiro(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cuentas-retiro'] }),
  });
  const listo = form && form.banco.trim() && form.numero.trim() && form.titular.trim();

  return (
    <div className={ui.card} style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Cuentas para retiros</div>
          <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 2 }}>A dónde te transfiere la plataforma. Se guardan una vez.</div>
        </div>
        {!form && (
          <button className={ui.btnSecondary} style={{ marginLeft: 'auto', fontSize: 13 }} onClick={() => setForm({ ...NUEVA, predeterminada: !cuentas?.length })}>
            Agregar cuenta
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {(cuentas ?? []).map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-12)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {c.alias || NOMBRE_TIPO[c.tipo]}{' '}
                {c.predeterminada && <StatusChip tono="info" size="sm">Predeterminada</StatusChip>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                {NOMBRE_TIPO[c.tipo]} · {c.banco} · {c.numero} · {c.titular}{c.documento ? ` · ${c.documento}` : ''}
              </div>
            </div>
            <button className={ui.btnGhost} style={{ fontSize: 12 }} onClick={() => setForm({ tipo: c.tipo, alias: c.alias ?? '', banco: c.banco, numero: c.numero, titular: c.titular, documento: c.documento ?? '', predeterminada: c.predeterminada, id: c.id })}>
              Editar
            </button>
            <button style={{ fontSize: 12, fontWeight: 600, color: 'var(--bad-text)' }} onClick={() => eliminar.mutate(c.id)}>
              Quitar
            </button>
          </div>
        ))}
        {!isLoading && !cuentas?.length && !form && (
          <div style={{ fontSize: 13, color: 'var(--text-soft)', padding: '6px 0' }}>Todavía no hay ninguna cuenta guardada.</div>
        )}
      </div>

      {form && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Tipo</span>
            <select className={ui.fieldInput} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as CuentaRetiro['tipo'] })}>
              <option value="pago_movil">Pago Móvil</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </label>
          <Field label="Alias (opcional)" placeholder="Cuenta principal" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} />
          <Field label="Banco" placeholder="Banesco" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
          <Field label={form.tipo === 'pago_movil' ? 'Teléfono' : 'Número de cuenta'} placeholder={form.tipo === 'pago_movil' ? '0414-1234567' : '0134-0000-00-0000000000'} value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
          <Field label="Titular" value={form.titular} onChange={(e) => setForm({ ...form, titular: e.target.value })} />
          <Field label="Cédula o RIF del titular" placeholder="J-12345678-9" value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
          <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={form.predeterminada} onChange={(e) => setForm({ ...form, predeterminada: e.target.checked })} />
            Usar esta cuenta por defecto
          </label>
          {error && <div style={{ gridColumn: '1 / -1', fontSize: 13, color: 'var(--bad-text)' }}>{error}</div>}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className={ui.btnSecondary} onClick={() => { setForm(null); setError(null); }}>Cancelar</button>
            <button className={ui.btnPrimary} disabled={!listo || guardar.isPending} onClick={() => guardar.mutate()}>
              {guardar.isPending ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Guardar cuenta'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
