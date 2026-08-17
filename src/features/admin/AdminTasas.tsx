import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminTasas, refrescarBcv, setTasaManual } from '../../lib/api/endpoints';
import { fechaCorta, hora } from '../../lib/time';
import { Field } from '../../components/ui/Field';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

/** Tasas de cambio de la plataforma: BCV (scraper) y COP comercial (manual). */
export default function AdminTasas() {
  const queryClient = useQueryClient();
  const [moneda, setMoneda] = useState<'COP' | 'BS'>('COP');
  const [valor, setValor] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['admin-tasas'], queryFn: getAdminTasas });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-tasas'] });
    queryClient.invalidateQueries({ queryKey: ['tasas'] });
  };

  const refrescar = useMutation({
    mutationFn: refrescarBcv,
    onSuccess: (r) => {
      invalidar();
      setAviso(r.actualizada ? `Tasa BCV actualizada: ${r.valor}` : 'El BCV no respondió; se mantiene la última tasa.');
    },
  });

  const fijar = useMutation({
    mutationFn: () => setTasaManual(moneda, Number(valor)),
    onSuccess: () => {
      invalidar();
      setValor('');
      setAviso('Tasa registrada.');
    },
  });

  if (isLoading || !data) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando tasas…</div>;
  }

  return (
    <div className={styles.contenido} style={{ maxWidth: 900 }}>
      <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>Tasas de cambio</h2>
      {aviso && (
        <div style={{ fontSize: 13, color: 'var(--blue-700)', background: 'var(--tint-50)', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
          {aviso}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div className={ui.card} style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Dólar BCV (Bs por USD)</div>
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 4 }}>
            {data.vigentes.bcv.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)', margin: '6px 0 14px' }}>
            Se actualiza sola cada hora desde bcv.org.ve.
          </div>
          <button className={ui.btnSecondary} disabled={refrescar.isPending} onClick={() => refrescar.mutate()}>
            {refrescar.isPending ? 'Consultando BCV…' : 'Actualizar ahora'}
          </button>
        </div>
        <div className={ui.card} style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Peso colombiano (COP por USD)</div>
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 4 }}>
            {Math.round(data.vigentes.cop).toLocaleString('es-CO')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)', margin: '6px 0 14px' }}>
            Tasa comercial: se fija a mano según el mercado de frontera.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <select className={ui.fieldInput} style={{ width: 90 }} value={moneda} onChange={(e) => setMoneda(e.target.value as 'COP' | 'BS')}>
              <option value="COP">COP</option>
              <option value="BS">BS</option>
            </select>
            <Field label="Nuevo valor" type="number" value={valor} onChange={(e) => setValor(e.target.value)} />
            <button
              className={ui.btnPrimary}
              style={{ whiteSpace: 'nowrap' }}
              disabled={!(Number(valor) > 0) || fijar.isPending}
              onClick={() => fijar.mutate()}
            >
              Fijar
            </button>
          </div>
        </div>
      </div>

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', fontWeight: 700, fontSize: 17 }}>Historial reciente</div>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Moneda</th>
              <th>Valor</th>
              <th>Fuente</th>
              <th>Vigente desde</th>
              <th>Registrada por</th>
            </tr>
          </thead>
          <tbody>
            {data.historial.map((t, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{t.moneda}</td>
                <td>{t.valor.toLocaleString('es-VE')}</td>
                <td style={{ color: 'var(--text-soft)' }}>{t.fuente}</td>
                <td style={{ color: 'var(--text-soft)' }}>
                  {fechaCorta(t.vigenteDesde)} {hora(t.vigenteDesde)}
                </td>
                <td style={{ color: 'var(--text-soft)' }}>{t.registradaPor ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
