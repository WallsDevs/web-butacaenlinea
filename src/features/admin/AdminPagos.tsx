import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getComprasPorVerificar, getDepositosAdmin, getReembolsosPlataforma, marcarReembolsoPlataforma, verificarCompra, verificarDeposito } from '../../lib/api/endpoints';
import { ApiError, urlMedia } from '../../lib/api/client';
import { fechaCorta, hora } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
const monto = (n: number, moneda: string | null) => (moneda === 'USD' ? `$${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : moneda === 'COP' ? `COP ${n.toLocaleString('es-VE')}` : bs(n));
const METODO: Record<string, string> = { pago_movil: 'Pago Móvil', transferencia: 'Transferencia', zelle: 'Zelle', tarjeta_cop: 'Tarjeta COP' };

/**
 * Plataforma → Pagos. Toda la plata de lo vendido en línea entra a Butaca:
 * aquí se verifican contra el banco las compras de quien pagó sin cuenta (al
 * aprobar, el neto entra a la wallet de la línea) y se marcan las devoluciones
 * hechas a mano. Las recargas de wallet (también las de una compra) están en
 * Wallet.
 */
export default function AdminPagos() {
  const queryClient = useQueryClient();
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const { data: compras, isLoading } = useQuery({ queryKey: ['admin-compras'], queryFn: getComprasPorVerificar, refetchInterval: 20_000 });
  const { data: reembolsos } = useQuery({ queryKey: ['admin-reembolsos'], queryFn: getReembolsosPlataforma, refetchInterval: 60_000 });

  const verificar = useMutation({
    mutationFn: ({ ids, aprobar, clave }: { ids: string[]; aprobar: boolean; clave: string }) => verificarCompra(ids, aprobar, notas[clave] || undefined),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-compras'] });
    },
    onError: (e) => setError(e instanceof ApiError && e.code === 'no_pendiente' ? 'Esa compra ya la resolvió otra persona.' : 'No se pudo guardar. Intenta de nuevo.'),
  });
  const { data: depositos } = useQuery({ queryKey: ['admin-depositos'], queryFn: getDepositosAdmin, refetchInterval: 60_000 });
  const verificarDep = useMutation({
    mutationFn: ({ id, aprobar }: { id: string; aprobar: boolean }) => verificarDeposito(id, aprobar, notas[id] || undefined),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-depositos'] }),
  });
  const reportados = (depositos ?? []).filter((d) => d.estado === 'reportado');
  const debidos = (depositos ?? []).filter((d) => d.estado !== 'reportado');
  const reembolsar = useMutation({
    mutationFn: (id: string) => marcarReembolsoPlataforma(id, refs[id] || undefined),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-reembolsos'] }),
  });

  return (
    <div className={styles.contenido}>
      <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>Pagos de pasajes</h2>
      <p style={{ fontSize: 14, color: 'var(--text-soft)', margin: '0 0 18px', maxWidth: 760 }}>
        Compras de quien pagó sin cuenta a las cuentas de Butaca. Confírmalas contra el banco: al aprobar, el neto entra a la wallet de la
        línea y la comisión queda para Butaca. Rechazar anula los boletos y libera los puestos.
      </p>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <h3 style={{ fontSize: 19, fontWeight: 700 }}>Por verificar</h3>
        {!isLoading && <StatusChip tono={compras?.length ? 'warn' : 'ok'}>{compras?.length ?? 0} compras</StatusChip>}
      </div>
      {error && <p style={{ color: 'var(--bad-text)', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(compras ?? []).map((c) => (
          <div key={c.clave} className={ui.card} style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 190 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.contacto.nombre ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                  {c.contacto.documento ?? ''}
                  {c.contacto.telefono ? ` · ${c.contacto.telefono}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{c.creadoEn ? `${fechaCorta(c.creadoEn)} ${hora(c.creadoEn)}` : ''}</div>
              </div>
              <div style={{ minWidth: 190, fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{c.linea} · {c.ruta}</div>
                <div style={{ color: 'var(--text-soft)' }}>
                  {c.salida ? `${fechaCorta(c.salida)} ${hora(c.salida)}` : ''} · {c.boletos.map((b) => b.asientoId).join(', ')} ({c.boletos.length} {c.boletos.length === 1 ? 'boleto' : 'boletos'})
                </div>
              </div>
              <div style={{ minWidth: 150 }}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{METODO[c.metodoPago ?? ''] ?? c.metodoPago}</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{monto(c.monto, c.moneda)}</div>
                {c.moneda !== 'BS' && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{bs(c.montoBs)}</div>}
              </div>
              <div style={{ minWidth: 130 }}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Referencia</div>
                <div style={{ fontWeight: 700, letterSpacing: '0.06em' }}>{c.referencia || '—'}</div>
                {c.comprobanteUrl ? (
                  <a href={urlMedia(c.comprobanteUrl) ?? undefined} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700 }}>
                    Ver captura ↗
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Sin captura</span>
                )}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input className={ui.fieldInput} style={{ width: 160, fontSize: 13 }} placeholder="Nota (opcional)" value={notas[c.clave] ?? ''} onChange={(e) => setNotas({ ...notas, [c.clave]: e.target.value })} />
                <button
                  className={ui.btnSecondary}
                  disabled={verificar.isPending}
                  onClick={() => {
                    if (confirm('¿Rechazar este pago? Los boletos se anulan y los puestos se liberan.')) verificar.mutate({ ids: c.boletos.map((b) => b.documentId), aprobar: false, clave: c.clave });
                  }}
                >
                  Rechazar
                </button>
                <button className={ui.btnPrimary} disabled={verificar.isPending} onClick={() => verificar.mutate({ ids: c.boletos.map((b) => b.documentId), aprobar: true, clave: c.clave })}>
                  Confirmar pago
                </button>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && !compras?.length && <div style={{ color: 'var(--text-soft)', fontSize: 14 }}>No hay pagos por verificar.</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '28px 0 10px' }}>
        <h3 style={{ fontSize: 19, fontWeight: 700 }}>Depósitos de taquilla</h3>
        <StatusChip tono={reportados.length ? 'warn' : 'ok'}>{reportados.length} por verificar</StatusChip>
        {debidos.length > 0 && <StatusChip tono="neutral">{debidos.length} sin reportar</StatusChip>}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-soft)', margin: '0 0 10px', maxWidth: 760 }}>
        Lo que las líneas cobraron en caja y depositan a Butaca. Al confirmarlo, el neto entra a la wallet de la línea y la comisión queda para Butaca.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[...reportados, ...debidos].map((d) => (
          <div key={d.documentId} className={ui.card} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', opacity: d.estado === 'reportado' ? 1 : 0.75 }}>
            <div style={{ minWidth: 200 }}>
              <div style={{ fontWeight: 700 }}>{d.linea}</div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                {d.turno.taquilla} · {d.turno.cajero} · {d.turno.cerradoEn ? `${fechaCorta(d.turno.cerradoEn)} ${hora(d.turno.cerradoEn)}` : ''}
              </div>
            </div>
            <div style={{ minWidth: 150 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{monto(d.monto, d.moneda)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{d.boletos} boletos · neto {bs(d.netoBs)}</div>
            </div>
            <div style={{ minWidth: 140 }}>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{d.banco ?? 'Referencia'}</div>
              <div style={{ fontWeight: 700, letterSpacing: '0.06em' }}>{d.referencia ?? '—'}</div>
              {d.comprobanteUrl && (
                <a href={urlMedia(d.comprobanteUrl) ?? undefined} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700 }}>
                  Ver captura ↗
                </a>
              )}
            </div>
            {d.estado === 'reportado' ? (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className={ui.fieldInput} style={{ width: 160, fontSize: 13 }} placeholder="Nota (opcional)" value={notas[d.documentId] ?? ''} onChange={(e) => setNotas({ ...notas, [d.documentId]: e.target.value })} />
                <button className={ui.btnSecondary} disabled={verificarDep.isPending} onClick={() => verificarDep.mutate({ id: d.documentId, aprobar: false })}>
                  Rechazar
                </button>
                <button className={ui.btnPrimary} disabled={verificarDep.isPending} onClick={() => verificarDep.mutate({ id: d.documentId, aprobar: true })}>
                  Confirmar depósito
                </button>
              </div>
            ) : (
              <span style={{ marginLeft: 'auto' }}>
                <StatusChip tono={d.estado === 'rechazado' ? 'bad' : 'neutral'} size="sm">{d.estado === 'rechazado' ? 'Rechazado, esperando nuevo reporte' : 'La línea aún no lo reporta'}</StatusChip>
              </span>
            )}
          </div>
        ))}
        {!depositos?.length && <div style={{ color: 'var(--text-soft)', fontSize: 14 }}>No hay depósitos pendientes.</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '28px 0 10px' }}>
        <h3 style={{ fontSize: 19, fontWeight: 700 }}>Devoluciones pendientes</h3>
        <StatusChip tono={reembolsos?.length ? 'warn' : 'ok'}>{reembolsos?.length ?? 0}</StatusChip>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-soft)', margin: '0 0 10px', maxWidth: 760 }}>
        Boletos anulados de quien compró sin cuenta: devuélvele por el mismo medio y márcalo. Sale de la wallet de la línea (el neto) y de
        la de Butaca (la comisión). Quien tiene cuenta recibe la devolución en su wallet al instante, sin pasar por aquí.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(reembolsos ?? []).map((r) => (
          <div key={r.documentId} className={ui.card} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 190 }}>
              <div style={{ fontWeight: 700 }}>{r.pasajeroNombre}</div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{r.pasajeroTelefono ? `Tel: ${r.pasajeroTelefono}` : 'Sin teléfono'}{r.pasajeroDocumento ? ` · ${r.pasajeroDocumento}` : ''}</div>
            </div>
            <div style={{ minWidth: 190, fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{r.folio} · {r.linea}</div>
              <div style={{ color: 'var(--text-soft)' }}>{r.ruta}{r.salida ? ` · ${fechaCorta(r.salida)}` : ''}</div>
            </div>
            <div style={{ minWidth: 140 }}>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{METODO[r.metodoPago ?? ''] ?? r.metodoPago} · ref {r.referenciaPago ?? '—'}</div>
              <div style={{ fontWeight: 700 }}>{monto(r.montoCobrado, r.monedaPago)}</div>
              {!r.pagoConfirmado && (
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warn-text)' }}>Pago nunca confirmado: revisa el banco antes de devolver</div>
              )}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <input className={ui.fieldInput} style={{ width: 170, fontSize: 13 }} placeholder="Referencia de la devolución" value={refs[r.documentId] ?? ''} onChange={(e) => setRefs({ ...refs, [r.documentId]: e.target.value })} />
              <button
                className={ui.btnPrimary}
                disabled={reembolsar.isPending}
                onClick={() => {
                  if (confirm(`¿Ya le devolviste ${monto(r.montoCobrado, r.monedaPago)} a ${r.pasajeroNombre}?`)) reembolsar.mutate(r.documentId);
                }}
              >
                Ya devolví
              </button>
            </div>
          </div>
        ))}
        {!reembolsos?.length && <div style={{ color: 'var(--text-soft)', fontSize: 14 }}>No hay devoluciones pendientes.</div>}
      </div>
    </div>
  );
}
