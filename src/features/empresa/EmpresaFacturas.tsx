import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMisFacturas, reportarPagoFactura, type Factura } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { useModulos } from '../../lib/useModulos';
import { fechaConAnio, fechaCorta } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';
import { CHIP_ESTADO, nombreDePeriodo } from '../../lib/facturas';

const usd = (n: number) => `$ ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { maximumFractionDigits: 2 })}`;
const dia = (iso: string) => fechaConAnio(`${iso}T12:00:00`);
const NOMBRE_PLAN = { mantenimiento: 'Mantenimiento', venta: 'Solo boletería', completo: 'Full', personalizado: 'Personalizado' } as const;
const NOMBRE_MODULO: Record<string, string> = { flota: 'Flota y personal', mantenimiento: 'Mantenimiento', boleteria: 'Boletería', taquilla: 'Taquilla', equipaje: 'Equipaje', urbano: 'Urbano por QR' };

/** Lo que la empresa tiene contratado: plan, módulos, cómo paga y hasta cuándo. */
function MiContratoCard() {
  const { contrato, vencido } = useModulos();
  if (!contrato) return null;
  const porBus = contrato.modulos.includes('mantenimiento');
  const comision = contrato.modulos.some((m) => m !== 'flota' && m !== 'mantenimiento');
  return (
    <div className={ui.card} style={{ padding: '14px 18px', marginBottom: 16, borderColor: vencido ? 'var(--bad-text)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mi contrato</span>
        <strong>{NOMBRE_PLAN[contrato.plan]}</strong>
        {vencido ? (
          <StatusChip tono="bad" size="sm">Vencido el {contrato.venceEn ? dia(contrato.venceEn) : ''}</StatusChip>
        ) : contrato.estado === 'por_vencer' ? (
          <StatusChip tono="warn" size="sm">Vence en {contrato.diasRestantes} {contrato.diasRestantes === 1 ? 'día' : 'días'}</StatusChip>
        ) : contrato.venceEn ? (
          <StatusChip tono="ok" size="sm">Hasta el {dia(contrato.venceEn)}</StatusChip>
        ) : (
          <StatusChip tono="ok" size="sm">Indefinido</StatusChip>
        )}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 8, lineHeight: 1.6 }}>
        {contrato.modulos.map((m) => NOMBRE_MODULO[m] ?? m).join(' · ')}
        <br />
        {comision && <>Comisión de la plataforma: <strong>{contrato.comisionPct} %</strong> por pasaje. </>}
        {porBus && <>Tarifa de Mantenimiento: <strong>{usd(contrato.montoBusUsd)}</strong> por bus al mes, {contrato.diasGracia} días de gracia.</>}
        {vencido && <><br />Para renovar, comuníquese con Butaca En Línea: mientras tanto el acceso a los módulos y la venta de sus salidas están cerrados; sus datos siguen intactos.</>}
      </div>
    </div>
  );
}

/**
 * Las facturas de la empresa por los módulos de cobro fijo (Mantenimiento).
 * Paga por su canal y reporta aquí la referencia; la plataforma la verifica.
 * Una factura vencida suspende el módulo hasta que el pago se verifique — los
 * datos siguen ahí, solo se cierra el acceso.
 */
export default function EmpresaFacturas() {
  const queryClient = useQueryClient();
  const [formulario, setFormulario] = useState<Record<string, { referencia: string; banco: string }>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: facturas, isLoading } = useQuery({ queryKey: ['mis-facturas'], queryFn: getMisFacturas });

  const reportar = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      reportarPagoFactura(id, formulario[id]?.referencia ?? '', formulario[id]?.banco || undefined),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['mis-facturas'] });
      queryClient.invalidateQueries({ queryKey: ['mi-contrato'] });
    },
    onError: (e) =>
      setError(
        e instanceof ApiError && e.code === 'referencia_invalida'
          ? 'La referencia debe tener entre 4 y 100 caracteres.'
          : 'No se pudo reportar el pago. Intente de nuevo.'
      ),
  });

  const vencidas = (facturas ?? []).filter((f) => f.estado === 'vencida');
  const pendientes = (facturas ?? []).filter((f) => f.estado === 'pendiente' || f.estado === 'vencida');
  const totalPendiente = pendientes.reduce((s, f) => s + f.montoUsd, 0);

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Facturas</h2>
        {totalPendiente > 0 && <StatusChip tono="warn">{usd(totalPendiente)} por pagar</StatusChip>}
      </div>

      <MiContratoCard />

      {vencidas.length > 0 && (
        <div className={`${styles.alerta} ${styles.alertaBad}`} style={{ marginBottom: 16 }}>
          <div className={styles.alertaTitulo}>Mantenimiento suspendido por una factura vencida</div>
          <div className={styles.alertaNota}>
            Sus datos siguen intactos. El acceso se reabre cuando la plataforma verifique el pago: reporte la
            referencia abajo.
          </div>
        </div>
      )}

      <p style={{ color: 'var(--text-soft)', fontSize: 14, marginBottom: 16, maxWidth: 720 }}>
        Cada mes se factura un monto fijo por cada unidad activa en Mantenimiento. Pague por su canal habitual y
        reporte aquí la referencia; la plataforma la verifica contra el banco.
      </p>

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Mes</th>
              <th>Buses</th>
              <th>Monto</th>
              <th>Vence</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(facturas ?? []).map((f: Factura) => {
              const chip = CHIP_ESTADO[f.estado];
              const puedePagar = f.estado === 'pendiente' || f.estado === 'vencida';
              const campos = formulario[f.documentId] ?? { referencia: '', banco: '' };
              return (
                <tr key={f.documentId}>
                  <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{nombreDePeriodo(f.periodo)}</td>
                  <td style={{ color: 'var(--text-soft)' }}>
                    {f.buses} <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>× {usd(f.montoBusUsd)}</span>
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {usd(f.montoUsd)}
                    <div style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-faint)' }}>
                      {bs(f.montoBs)} · tasa {f.tasaBs.toLocaleString('es-VE', { maximumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td style={{ color: f.estado === 'vencida' ? 'var(--red-600, #DC2626)' : 'var(--text-soft)' }}>
                    {fechaConAnio(`${f.venceEn}T12:00:00`)}
                  </td>
                  <td>
                    <StatusChip tono={chip.tono} size="sm">{chip.texto}</StatusChip>
                    {f.estado === 'por_verificar' && (
                      <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 2 }}>
                        Ref. {f.referencia}
                        {f.banco ? ` · ${f.banco}` : ''} — en revisión
                      </div>
                    )}
                    {f.estado === 'pagada' && f.verificadaEn && (
                      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
                        Verificada el {fechaCorta(f.verificadaEn)}
                      </div>
                    )}
                    {f.notaRechazo && puedePagar && (
                      <div style={{ fontSize: 11, color: 'var(--red-600, #DC2626)', marginTop: 2 }}>
                        Devuelta: {f.notaRechazo}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {puedePagar && (
                      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                        <input
                          className={ui.fieldInput}
                          style={{ width: 140, fontSize: 13 }}
                          placeholder="Referencia"
                          value={campos.referencia}
                          onChange={(e) =>
                            setFormulario((x) => ({ ...x, [f.documentId]: { ...campos, referencia: e.target.value } }))
                          }
                        />
                        <input
                          className={ui.fieldInput}
                          style={{ width: 120, fontSize: 13 }}
                          placeholder="Banco"
                          value={campos.banco}
                          onChange={(e) =>
                            setFormulario((x) => ({ ...x, [f.documentId]: { ...campos, banco: e.target.value } }))
                          }
                        />
                        <button
                          className={ui.btnPrimary}
                          style={{ fontSize: 13, padding: '10px 16px' }}
                          disabled={reportar.isPending || campos.referencia.trim().length < 4}
                          onClick={() => reportar.mutate({ id: f.documentId })}
                        >
                          Reportar pago
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!isLoading && !facturas?.length && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 24 }}>
                  Sin facturas. Se emiten el día 1 de cada mes si su contrato incluye módulos de cobro fijo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {error && <p style={{ color: 'var(--red-600, #DC2626)', fontSize: 13, marginTop: 12 }}>{error}</p>}
    </div>
  );
}
