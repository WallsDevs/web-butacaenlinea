import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eliminarMetodoPago, getMetodosPago, guardarMetodoPago } from '../../lib/api/endpoints';
import { Field } from '../../components/ui/Field';
import { StatusChip } from '../../components/ui/StatusChip';
import { CuentaLayout } from './CuentaLayout';
import type { MetodoPagoCliente } from '../../lib/api/types';
import ui from '../../components/ui/ui.module.css';

const NOMBRE_TIPO: Record<string, string> = {
  pago_movil: 'Pago Móvil',
  transferencia: 'Transferencia',
  zelle: 'Zelle',
  tarjeta_cop: 'Tarjeta COP',
};

/** Métodos de pago guardados: se precargan en el checkout. */
export default function MetodosPago() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Partial<MetodoPagoCliente> | null>(null);

  const { data: metodos, isLoading } = useQuery({ queryKey: ['metodos-pago'], queryFn: getMetodosPago });

  const guardar = useMutation({
    mutationFn: (m: Partial<MetodoPagoCliente>) => guardarMetodoPago(m),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metodos-pago'] });
      setEditando(null);
    },
  });
  const eliminar = useMutation({
    mutationFn: (id: string) => eliminarMetodoPago(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['metodos-pago'] }),
  });

  return (
    <CuentaLayout activa="metodos">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(metodos ?? []).map((m) => (
          <div key={m.documentId} className={ui.card} style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                {m.alias || NOMBRE_TIPO[m.tipo]}{' '}
                {m.predeterminado && (
                  <span style={{ marginLeft: 6 }}>
                    <StatusChip tono="info" size="sm">Predeterminado</StatusChip>
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 2 }}>
                {NOMBRE_TIPO[m.tipo]}
                {m.banco ? ` · ${m.banco}` : ''}
                {m.telefonoPago ? ` · ${m.telefonoPago}` : ''}
                {m.titular ? ` · ${m.titular}` : ''}
              </div>
            </div>
            <button className={ui.btnGhost} onClick={() => setEditando(m)}>
              Editar
            </button>
            <button
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--bad-text)' }}
              onClick={() => eliminar.mutate(m.documentId)}
            >
              Eliminar
            </button>
          </div>
        ))}
        {!isLoading && !metodos?.length && !editando && (
          <div className={ui.card} style={{ padding: 28, textAlign: 'center', color: 'var(--text-soft)' }}>
            Guarda tu Pago Móvil o Zelle para precargar el checkout.
          </div>
        )}

        {editando ? (
          <div className={ui.card} style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
              {editando.documentId ? 'Editar método' : 'Nuevo método de pago'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className={ui.field}>
                <span className={ui.fieldLabel}>Tipo</span>
                <select
                  className={ui.fieldInput}
                  value={editando.tipo ?? 'pago_movil'}
                  onChange={(e) => setEditando({ ...editando, tipo: e.target.value as MetodoPagoCliente['tipo'] })}
                >
                  {Object.entries(NOMBRE_TIPO).map(([v, n]) => (
                    <option key={v} value={v}>{n}</option>
                  ))}
                </select>
              </label>
              <Field label="Alias (ej. Mi pago móvil)" value={editando.alias ?? ''} onChange={(e) => setEditando({ ...editando, alias: e.target.value })} />
              <Field label="Banco" value={editando.banco ?? ''} onChange={(e) => setEditando({ ...editando, banco: e.target.value })} />
              <Field label="Teléfono asociado" value={editando.telefonoPago ?? ''} onChange={(e) => setEditando({ ...editando, telefonoPago: e.target.value })} />
              <Field label="Titular" value={editando.titular ?? ''} onChange={(e) => setEditando({ ...editando, titular: e.target.value })} />
              <Field label="Documento del titular" value={editando.documentoTitular ?? ''} onChange={(e) => setEditando({ ...editando, documentoTitular: e.target.value })} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={Boolean(editando.predeterminado)}
                onChange={(e) => setEditando({ ...editando, predeterminado: e.target.checked })}
              />
              Usar como método predeterminado
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className={ui.btnSecondary} onClick={() => setEditando(null)}>
                Cancelar
              </button>
              <button
                className={ui.btnPrimary}
                disabled={guardar.isPending || !editando.tipo}
                onClick={() => guardar.mutate(editando)}
              >
                {guardar.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        ) : (
          <button className={ui.btnSecondary} onClick={() => setEditando({ tipo: 'pago_movil', predeterminado: !metodos?.length })}>
            Agregar método de pago
          </button>
        )}
      </div>
    </CuentaLayout>
  );
}
