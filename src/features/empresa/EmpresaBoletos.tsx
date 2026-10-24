import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { anularBoleto, buscarBoletos } from '../../lib/api/endpoints';
import { hora, fechaCorta, hoyISO } from '../../lib/time';
import { Field } from '../../components/ui/Field';
import { EncabezadoPantalla } from '../../components/ui/EncabezadoPantalla';

import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const fmt = (monto: number, moneda: string) =>
  moneda === 'USD'
    ? `$ ${monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
    : moneda === 'COP'
      ? `$ ${Math.round(monto).toLocaleString('es-CO')} COP`
      : `Bs ${monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

/**
 * Boletos de la empresa: búsqueda y anulación. La anulación queda auditada y
 * el registro original jamás se borra — solo se libera el puesto.
 */
export default function EmpresaBoletos() {
  const queryClient = useQueryClient();
  const [folio, setFolio] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [anulando, setAnulando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  const { data: boletos, isLoading } = useQuery({
    queryKey: ['empresa-boletos', folio, fecha],
    queryFn: () => buscarBoletos({ folio: folio || undefined, fecha: folio ? undefined : fecha }),
  });

  const anular = useMutation({
    mutationFn: (id: string) => anularBoleto(id, motivo),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['empresa-boletos'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-linea'] });
      setAnulando(null);
      setMotivo('');
      setAviso(
        r.estadoPago === 'reembolsado'
          ? `Boleto ${r.folio} anulado. Se devolvieron Bs ${(r.devueltoBs ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} a la wallet del pasajero (sale de la wallet de la línea).`
          : r.estadoPago === 'reembolso_pendiente'
            ? `Boleto ${r.folio} anulado. Se pagó por Pago Móvil o Zelle: queda en «Reembolsos pendientes» para devolverlo por el mismo medio.`
            : `Boleto ${r.folio} anulado. Si se cobró en taquilla, devuelve el dinero en la caja.`
      );
    },
  });

  return (
    <div className={styles.contenido}>
      <EncabezadoPantalla
        titulo="Boletos"
        descripcion="Busca un boleto por folio o revisa los de un día. Anular libera el puesto; el registro queda auditado."
        acciones={
          <>
            <div style={{ width: 200 }}>
              <Field label="Buscar por folio" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="C02-000410" />
            </div>
            <div style={{ width: 170 }}>
              <Field label="O por día" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={Boolean(folio)} />
            </div>
          </>
        }
      />

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Folio</th>
              <th>Pasajero</th>
              <th>Salida</th>
              <th>Canal</th>
              <th style={{ textAlign: 'right' }}>Cobrado</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(boletos ?? []).map((b) => (
              <tr key={b.documentId}>
                <td style={{ fontWeight: 700 }}>{b.folio}</td>
                <td>
                  {b.pasajeroNombre}
                  <span style={{ color: 'var(--text-faint)' }}> · {b.asientoId}</span>
                </td>
                <td style={{ color: 'var(--text-soft)', fontSize: 13 }}>
                  {b.salida ? `${fechaCorta(b.salida.fechaHoraSalida)} ${hora(b.salida.fechaHoraSalida)} · ${b.salida.ruta?.destino ?? ''}` : '—'}
                </td>
                <td style={{ color: 'var(--text-soft)' }}>{b.canal === 'web' ? 'Web' : 'Taquilla'}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(b.montoCobrado, b.monedaPago)}</td>
                <td>
                  {b.estado === 'anulado' ? (
                    <StatusChip tono="bad" size="sm">Anulado</StatusChip>
                  ) : b.estado === 'abordado' ? (
                    <StatusChip tono="ok" size="sm">Abordado</StatusChip>
                  ) : b.estadoPago === 'por_verificar' ? (
                    <StatusChip tono="warn" size="sm">Pago por verificar</StatusChip>
                  ) : (
                    <StatusChip tono="neutral" size="sm">Emitido</StatusChip>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {b.estado === 'emitido' && (
                    <button
                      style={{ fontSize: 13, fontWeight: 600, color: 'var(--bad-text)' }}
                      onClick={() => setAnulando(b.documentId)}
                    >
                      Anular
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && !boletos?.length && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 28 }}>
                  Sin boletos con ese criterio.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {aviso && (
        <div role="status" className={ui.card} style={{ marginTop: 14, padding: '12px 16px', fontSize: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ flex: 1 }}>{aviso}</span>
          <button className={ui.btnSecondary} onClick={() => setAviso(null)}>Entendido</button>
        </div>
      )}

      {anulando && (
        <div className={styles.velo}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700 }}>Anular boleto</h3>
            <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>
              El puesto vuelve a estar disponible y la anulación queda auditada con tu usuario y la
              hora. El registro original no se borra. Si se pagó con wallet, el dinero vuelve a la
              wallet del pasajero en el acto.
            </p>
            <div style={{ marginTop: 14 }}>
              <Field label="Motivo de la anulación" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className={ui.btnSecondary} onClick={() => setAnulando(null)}>
                Cancelar
              </button>
              <button
                className={ui.btnPrimary}
                style={{ background: 'var(--bad-border)' }}
                disabled={motivo.trim().length < 4 || anular.isPending}
                onClick={() => anular.mutate(anulando)}
              >
                {anular.isPending ? 'Anulando…' : 'Anular boleto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
