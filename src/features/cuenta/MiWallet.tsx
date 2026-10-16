import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPagoMovilPlataforma, getWallet, reportarRecarga } from '../../lib/api/endpoints';
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
/** «100,50» y «1.250,00» (como se escribe aquí) valen igual que «100.50». */
const montoDe = (texto: string): number => {
  const limpio = texto.trim().replace(/\s/g, '');
  const normal = /,\d{1,2}$/.test(limpio) ? limpio.replace(/\./g, '').replace(',', '.') : limpio.replace(/,/g, '');
  const n = Number(normal);
  return Number.isFinite(n) ? n : 0;
};

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
  const { data: pagoMovil, isLoading: cargandoPagoMovil } = useQuery({ queryKey: ['pago-movil-plataforma'], queryFn: getPagoMovilPlataforma, staleTime: 300_000 });
  const recargasPendientes = (wallet?.movimientos ?? []).filter((m) => m.tipo === 'recarga' && m.estado === 'pendiente');
  const copiar = (t: string) => void navigator.clipboard?.writeText(t).catch(() => {});


  const reportar = useMutation({
    mutationFn: () => reportarRecarga(montoDe(form.montoBs), form.referencia.trim(), form.banco || undefined),
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
            ? 'Revisa el monto: debe ser mayor que cero.'
            : code === 'referencia_requerida'
              ? 'Escribe la referencia del pago móvil.'
              : code === 'solo_pasajero'
                ? 'Solo las cuentas de pasajero recargan wallet. Entra con tu cuenta de pasajero.'
                : 'No se pudo reportar la recarga. Revisa tu conexión e inténtalo de nuevo.'
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
        {recargasPendientes.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <StatusChip tono="warn" size="sm">
              {recargasPendientes.length === 1 ? 'Recarga' : `${recargasPendientes.length} recargas`} de {bs(recargasPendientes.reduce((s, m) => s + m.montoBs, 0))} por confirmar
            </StatusChip>
          </div>
        )}
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
        <button
          className={ui.btnSecondary}
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => {
            setRecargando(true);
            setAviso(null);
            setError(null);
          }}
        >
          Recargar
        </button>
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

      {recargando && (
        <div className={styles.velo}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Recargar wallet</h3>
            <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 12 }}>
              1) Haz el pago móvil a esta cuenta · 2) Reporta aquí el monto y la referencia · 3) Tu
              saldo se acredita cuando la plataforma confirme el pago.
            </p>
            {cargandoPagoMovil ? (
              <div style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 12 }}>Cargando los datos de pago…</div>
            ) : pagoMovil ? (
              <div style={{ background: 'var(--tint-50)', borderRadius: 'var(--r-14)', padding: '12px 14px', marginBottom: 14, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '6px 12px', alignItems: 'center', fontSize: 14 }}>
                <span style={{ color: 'var(--text-faint)' }}>Banco</span><strong>{pagoMovil.banco}</strong><span />
                <span style={{ color: 'var(--text-faint)' }}>Teléfono</span><strong>{pagoMovil.telefono}</strong>
                <button className={ui.btnGhost} style={{ fontSize: 12 }} onClick={() => copiar(pagoMovil.telefono)}>Copiar</button>
                <span style={{ color: 'var(--text-faint)' }}>Cédula/RIF</span><strong>{pagoMovil.documento}</strong>
                <button className={ui.btnGhost} style={{ fontSize: 12 }} onClick={() => copiar(pagoMovil.documento)}>Copiar</button>
                {pagoMovil.titular && (<><span style={{ color: 'var(--text-faint)' }}>Titular</span><span>{pagoMovil.titular}</span><span /></>)}
                {pagoMovil.nota && <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text-soft)' }}>{pagoMovil.nota}</div>}
              </div>
            ) : (
              <div style={{ background: 'var(--warn-bg)', color: 'var(--warn-text-alert)', borderRadius: 'var(--r-14)', padding: '12px 14px', marginBottom: 14, fontSize: 13 }}>
                La plataforma todavía no publicó sus datos de pago móvil. Escríbenos por WhatsApp para recargar.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field
                label="Monto (Bs)"
                inputMode="decimal"
                placeholder="100,00"
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
              {!error && (!(montoDe(form.montoBs) > 0) || !form.referencia.trim()) && (
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  {!(montoDe(form.montoBs) > 0) ? 'Escribe el monto que pagaste (en bolívares).' : 'Falta la referencia del pago móvil.'}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className={ui.btnSecondary} onClick={() => setRecargando(false)}>
                  Cancelar
                </button>
                <button
                  className={ui.btnPrimary}
                  disabled={!(montoDe(form.montoBs) > 0) || !form.referencia.trim() || reportar.isPending}
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
