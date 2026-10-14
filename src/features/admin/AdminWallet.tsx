import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getConciliacion,
  getRecargasPendientes,
  getRetirosPendientes,
  resolverRetiro,
  verificarRecarga,
} from '../../lib/api/endpoints';
import { fechaCorta, hora } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
const NOMBRE_TIPO_CUENTA: Record<string, string> = {
  pasajero: 'Pasajeros',
  linea: 'Líneas',
  propietario: 'Propietarios',
  conductor: 'Conductores',
  plataforma: 'Plataforma (comisiones)',
};

/**
 * Wallet de la plataforma: cola de recargas por verificar contra el banco
 * real, y la conciliación — el ledger es el espejo de lo que debe haber en
 * las cuentas bancarias de Butaca En Línea.
 */
export default function AdminWallet() {
  const queryClient = useQueryClient();
  const [nota, setNota] = useState<Record<string, string>>({});

  const { data: recargas, isLoading } = useQuery({
    queryKey: ['admin-recargas'],
    queryFn: getRecargasPendientes,
    refetchInterval: 15_000,
  });
  const { data: conciliacion } = useQuery({
    queryKey: ['admin-conciliacion'],
    queryFn: getConciliacion,
    refetchInterval: 30_000,
  });

  const verificar = useMutation({
    mutationFn: ({ id, aprobar }: { id: string; aprobar: boolean }) =>
      verificarRecarga(id, aprobar, nota[id] || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recargas'] });
      queryClient.invalidateQueries({ queryKey: ['admin-conciliacion'] });
    },
  });

  // Retiros: primero se hace la transferencia real, después se confirma aquí
  const [refRetiro, setRefRetiro] = useState<Record<string, string>>({});
  const { data: retiros, isLoading: cargandoRetiros } = useQuery({
    queryKey: ['admin-retiros'],
    queryFn: getRetirosPendientes,
    refetchInterval: 15_000,
  });
  const resolver = useMutation({
    mutationFn: ({ id, aprobar }: { id: string; aprobar: boolean }) =>
      resolverRetiro(id, aprobar, refRetiro[id] || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-retiros'] });
      queryClient.invalidateQueries({ queryKey: ['admin-conciliacion'] });
    },
  });

  return (
    <div className={styles.contenido}>
      <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>
        Wallet de la plataforma
      </h2>

      {/* Conciliación: el espejo del banco */}
      <div className={ui.card} style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              Custodia esperada (debe cuadrar con tu banco real)
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {conciliacion ? bs(conciliacion.custodiaEsperadaBs) : '…'}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {Object.entries(conciliacion?.porTipo ?? {}).map(([tipo, saldo]) => (
              <div key={tipo} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{NOMBRE_TIPO_CUENTA[tipo] ?? tipo}</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{bs(saldo)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>
          La custodia esperada es la suma de todos los saldos internos del ledger. Si tu saldo
          bancario real no coincide, algo entró o salió sin registrarse.
        </div>
      </div>

      {/* Cola de recargas */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <h3 style={{ fontSize: 19, fontWeight: 700 }}>Recargas por verificar</h3>
        {!isLoading && (
          <StatusChip tono={recargas?.length ? 'warn' : 'ok'}>{recargas?.length ?? 0} pendientes</StatusChip>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(recargas ?? []).map((r) => (
          <div key={r.documentId} className={ui.card} style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 170 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.pasajero ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                  {fechaCorta(r.fecha)} {hora(r.fecha)}
                  {r.telefono ? ` · ${r.telefono}` : ''}
                </div>
              </div>
              <div style={{ minWidth: 130 }}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{r.banco || 'Pago móvil'}</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{bs(r.montoBs)}</div>
              </div>
              <div style={{ minWidth: 130 }}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Referencia</div>
                <div style={{ fontWeight: 700, letterSpacing: '0.06em' }}>{r.referencia || '—'}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className={ui.fieldInput}
                  style={{ width: 150, fontSize: 13 }}
                  placeholder="Nota (opcional)"
                  value={nota[r.documentId] ?? ''}
                  onChange={(e) => setNota((n) => ({ ...n, [r.documentId]: e.target.value }))}
                />
                <button
                  className={ui.btnSecondary}
                  style={{ color: 'var(--bad-text)', borderColor: '#f3c1c1' }}
                  disabled={verificar.isPending}
                  onClick={() => verificar.mutate({ id: r.documentId, aprobar: false })}
                >
                  Rechazar
                </button>
                <button
                  className={ui.btnPrimary}
                  style={{ padding: '11px 18px', fontSize: 14 }}
                  disabled={verificar.isPending}
                  onClick={() => verificar.mutate({ id: r.documentId, aprobar: true })}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && !recargas?.length && (
          <div className={ui.card} style={{ padding: 28, textAlign: 'center', color: 'var(--text-soft)' }}>
            No hay recargas pendientes.
          </div>
        )}
      </div>

      {/* Cola de retiros: la plata sale del banco → confirmar acá con la referencia */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '26px 0 10px' }}>
        <h3 style={{ fontSize: 19, fontWeight: 700 }}>Retiros por pagar</h3>
        {!cargandoRetiros && (
          <StatusChip tono={retiros?.length ? 'warn' : 'ok'}>{retiros?.length ?? 0} pendientes</StatusChip>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(retiros ?? []).map((r) => (
          <div key={r.documentId} className={ui.card} style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 190 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.titular ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                  {r.tipoTitular === 'linea' ? 'Empresa' : r.tipoTitular === 'pasajero' ? 'Pasajero' : (r.tipoTitular ?? '')}
                  {' · '}
                  {fechaCorta(r.fecha)} {hora(r.fecha)}
                </div>
              </div>
              <div style={{ minWidth: 130 }}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Monto</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{bs(r.montoBs)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Cuenta destino</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.datosPago || '—'}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className={ui.fieldInput}
                  style={{ width: 170, fontSize: 13 }}
                  placeholder="Ref. de la transferencia"
                  value={refRetiro[r.documentId] ?? ''}
                  onChange={(e) => setRefRetiro((n) => ({ ...n, [r.documentId]: e.target.value }))}
                />
                <button
                  className={ui.btnSecondary}
                  style={{ color: 'var(--bad-text)', borderColor: '#f3c1c1' }}
                  disabled={resolver.isPending}
                  onClick={() => resolver.mutate({ id: r.documentId, aprobar: false })}
                >
                  Rechazar
                </button>
                <button
                  className={ui.btnPrimary}
                  style={{ padding: '11px 18px', fontSize: 14 }}
                  disabled={resolver.isPending}
                  onClick={() => resolver.mutate({ id: r.documentId, aprobar: true })}
                >
                  Ya pagué — confirmar
                </button>
              </div>
            </div>
          </div>
        ))}
        {!cargandoRetiros && !retiros?.length && (
          <div className={ui.card} style={{ padding: 28, textAlign: 'center', color: 'var(--text-soft)' }}>
            No hay retiros pendientes.
          </div>
        )}
      </div>
    </div>
  );
}
