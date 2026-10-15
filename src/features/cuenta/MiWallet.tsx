import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getWallet, reportarRecarga, solicitarRetiro } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { fechaCorta, hora } from '../../lib/time';
import { Field } from '../../components/ui/Field';
import { StatusChip } from '../../components/ui/StatusChip';
import { useSeo } from '../../lib/seo';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const NOMBRE_MOV: Record<string, string> = {
  recarga: 'Recarga',
  pasaje: 'Pasaje',
  retiro: 'Retiro',
  ajuste: 'Ajuste',
  comision: 'Comisión',
  reparto: 'Reparto',
};

const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

/**
 * Wallet del pasajero (PWA): recarga por pago móvil reportada con referencia
 * y verificada por la plataforma; el saldo paga pasajes urbanos por QR.
 */
export default function MiWallet() {
  useSeo('Mi wallet — Butaca En Línea', undefined, { noindex: true });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [recargando, setRecargando] = useState(false);
  const [form, setForm] = useState({ montoBs: '', referencia: '', banco: '' });
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const { data: wallet, isLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: getWallet,
    refetchInterval: 20_000,
  });

  const [retirando, setRetirando] = useState(false);
  const [formRetiro, setFormRetiro] = useState({ montoBs: '', datosPago: '' });
  const retirar = useMutation({
    mutationFn: () => solicitarRetiro(Number(formRetiro.montoBs), formRetiro.datosPago),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      setRetirando(false);
      setFormRetiro({ montoBs: '', datosPago: '' });
      setError(null);
      setAviso('Retiro solicitado. Te llega a tu cuenta cuando la plataforma lo procese.');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'saldo_insuficiente') {
        const d = e.details as { disponibleBs?: number };
        setError(`Saldo insuficiente: disponible ${bs(d?.disponibleBs ?? 0)} (descontando retiros en proceso).`);
      } else {
        setError('No se pudo solicitar el retiro.');
      }
    },
  });

  const reportar = useMutation({
    mutationFn: () => reportarRecarga(Number(form.montoBs), form.referencia, form.banco || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      setRecargando(false);
      setForm({ montoBs: '', referencia: '', banco: '' });
      setError(null);
      setAviso('Recarga reportada. Se acredita cuando la plataforma confirme tu pago (normalmente en minutos).');
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : null;
      setError(
        code === 'referencia_duplicada'
          ? 'Esa referencia ya fue reportada.'
          : code === 'monto_invalido'
            ? 'Revisa el monto.'
            : 'No se pudo reportar la recarga.'
      );
    },
  });

  return (
    <div className={styles.contenido} style={{ maxWidth: 560 }}>
      <div className={ui.card} style={{ padding: 24, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>Saldo disponible</div>
        <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em', margin: '6px 0 14px' }}>
          {isLoading ? '…' : bs(wallet?.saldoBs ?? 0)}
        </div>
        <button
          className={`${ui.btnPrimary} ${ui.btnPrimaryLg}`}
          style={{ width: '100%' }}
          onClick={() => navigate('/pagar')}
        >
          Pagar pasaje — escanear QR
        </button>
        <button
          className={ui.btnSecondary}
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => navigate('/busetas')}
        >
          🚌 ¿Por dónde viene mi buseta?
        </button>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button
            className={ui.btnSecondary}
            style={{ flex: 1 }}
            onClick={() => {
              setRecargando(true);
              setAviso(null);
              setError(null);
            }}
          >
            Recargar
          </button>
          <button
            className={ui.btnSecondary}
            style={{ flex: 1 }}
            disabled={!((wallet?.saldoBs ?? 0) > 0)}
            onClick={() => {
              setRetirando(true);
              setAviso(null);
              setError(null);
            }}
          >
            Retirar
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>
          Con tu saldo pagas el pasaje escaneando el QR de la buseta.
        </div>
      </div>

      {aviso && (
        <div style={{ fontSize: 13, color: 'var(--blue-700)', background: 'var(--tint-50)', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
          {aviso}
        </div>
      )}

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', fontWeight: 700, fontSize: 15 }}>Movimientos</div>
        <div>
          {(wallet?.movimientos ?? []).map((m) => (
            <div
              key={m.documentId}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: '1px solid var(--border)' }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {NOMBRE_MOV[m.tipo] ?? m.tipo}
                  {m.unidad ? ` · unidad ${m.unidad}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  {fechaCorta(m.fecha)} {hora(m.fecha)}
                  {m.referencia ? ` · ref ${m.referencia}` : ''}
                </div>
              </div>
              {m.estado === 'pendiente' && <StatusChip tono="warn" size="sm">Por confirmar</StatusChip>}
              {m.estado === 'rechazado' && <StatusChip tono="bad" size="sm">Rechazada</StatusChip>}
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: m.estado !== 'confirmado' ? 'var(--text-faint)' : m.direccion === 'entrada' ? 'var(--ok-text)' : 'var(--text)',
                }}
              >
                {m.direccion === 'entrada' ? '+' : '−'}
                {bs(m.montoBs)}
              </div>
            </div>
          ))}
          {!isLoading && !wallet?.movimientos.length && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-soft)', fontSize: 13 }}>
              Aún no tienes movimientos. Haz tu primera recarga.
            </div>
          )}
        </div>
      </div>

      {retirando && (
        <div className={styles.velo}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Retirar saldo</h3>
            <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 14 }}>
              Tu saldo vuelve a tu cuenta bancaria o pago móvil. La plataforma procesa el retiro
              manualmente y te avisa al confirmarlo.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field
                label="Monto (Bs)"
                type="number"
                value={formRetiro.montoBs}
                onChange={(e) => setFormRetiro({ ...formRetiro, montoBs: e.target.value })}
                autoFocus
              />
              <Field
                label="Cuenta destino (banco y número, o pago móvil)"
                placeholder="Ej. Pago móvil 0414-1234567 · Banesco · V-12.345.678"
                value={formRetiro.datosPago}
                onChange={(e) => setFormRetiro({ ...formRetiro, datosPago: e.target.value })}
              />
              {error && <div style={{ fontSize: 13, color: 'var(--bad-text)' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className={ui.btnSecondary} onClick={() => setRetirando(false)}>
                  Cancelar
                </button>
                <button
                  className={ui.btnPrimary}
                  disabled={!(Number(formRetiro.montoBs) > 0) || !formRetiro.datosPago.trim() || retirar.isPending}
                  onClick={() => retirar.mutate()}
                >
                  {retirar.isPending ? 'Solicitando…' : 'Solicitar retiro'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {recargando && (
        <div className={styles.velo}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Recargar wallet</h3>
            <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 14 }}>
              1) Haz el pago móvil a la cuenta de Butaca En Línea · 2) Reporta aquí el monto y la
              referencia · 3) Tu saldo se acredita al confirmarse el pago.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field
                label="Monto (Bs)"
                type="number"
                value={form.montoBs}
                onChange={(e) => setForm({ ...form, montoBs: e.target.value })}
                autoFocus
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field
                  label="Referencia del pago"
                  value={form.referencia}
                  onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                />
                <Field label="Banco (opcional)" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
              </div>
              {error && <div style={{ fontSize: 13, color: 'var(--bad-text)' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className={ui.btnSecondary} onClick={() => setRecargando(false)}>
                  Cancelar
                </button>
                <button
                  className={ui.btnPrimary}
                  disabled={!(Number(form.montoBs) > 0) || !form.referencia.trim() || reportar.isPending}
                  onClick={() => reportar.mutate()}
                >
                  {reportar.isPending ? 'Reportando…' : 'Reportar recarga'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
