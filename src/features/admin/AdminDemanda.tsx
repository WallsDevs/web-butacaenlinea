import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDemandaRutas, getTelefonosRuta, marcarAvisados } from '../../lib/api/endpoints';
import { fechaCorta } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import { rutaPar } from '../../seo/contenido.mjs';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

/**
 * Plataforma → Demanda: cuánta gente pidió cada ruta con «Avísame» en las
 * guías de ruta. Es el argumento para afiliar una línea («1.200 personas
 * pidieron San Cristóbal → Caracas») y la lista a la que se escribe cuando
 * la ruta abre.
 */
export default function AdminDemanda() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-demanda'], queryFn: getDemandaRutas, refetchInterval: 60_000 });
  const [abierta, setAbierta] = useState<{ origen: string; destino: string } | null>(null);
  const { data: telefonos } = useQuery({
    queryKey: ['admin-demanda-tel', abierta?.origen, abierta?.destino],
    queryFn: () => getTelefonosRuta(abierta!.origen, abierta!.destino),
    enabled: Boolean(abierta),
  });
  const avisados = useMutation({
    mutationFn: () => marcarAvisados(abierta!.origen, abierta!.destino),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-demanda'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-demanda-tel'] });
    },
  });
  const pendientes = (telefonos ?? []).filter((t) => !t.avisadoEn);
  const copiar = () => void navigator.clipboard?.writeText(pendientes.map((t) => t.telefono).join('\n'));

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Demanda por ruta</h2>
        {!isLoading && <StatusChip tono="neutral">{data?.total ?? 0} {data?.total === 1 ? 'aviso' : 'avisos'}</StatusChip>}
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-soft)', marginBottom: 16, maxWidth: 720, lineHeight: 1.5 }}>
        Personas que dejaron su WhatsApp en las guías de ruta para que les avisemos cuando la ruta se venda en Butaca. Úsalo para mostrarle a una línea cuánta gente busca sus rutas, y escríbeles cuando abra.
      </p>

      <div className={styles.cardHistorial} style={{ marginTop: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.tabla}>
            <thead>
              <tr><th>Ruta</th><th style={{ width: 110 }}>Avisos</th><th style={{ width: 130 }}>Últimos 7 días</th><th style={{ width: 140 }}>Sin avisar</th><th style={{ width: 130 }}>Último</th></tr>
            </thead>
            <tbody>
              {(data?.rutas ?? []).map((r) => {
                const sel = abierta?.origen === r.origen && abierta?.destino === r.destino;
                return (
                  <tr key={`${r.origen}-${r.destino}`} className={styles.filaClic} onClick={() => setAbierta(sel ? null : { origen: r.origen, destino: r.destino })} aria-expanded={sel}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{r.origen} → {r.destino}</div>
                      <a href={rutaPar(r.origen, r.destino)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 12 }}>Ver la guía</a>
                    </td>
                    <td style={{ fontWeight: 700, fontSize: 18 }}>{r.avisos.toLocaleString('es-VE')}</td>
                    <td>{r.ultimaSemana ? `+${r.ultimaSemana}` : '—'}</td>
                    <td>{r.pendientes ? <StatusChip tono="warn" size="sm">{r.pendientes}</StatusChip> : <StatusChip tono="ok" size="sm">Todos avisados</StatusChip>}</td>
                    <td style={{ color: 'var(--text-soft)' }}>{fechaCorta(r.ultimo)}</td>
                  </tr>
                );
              })}
              {!isLoading && !data?.rutas.length && (
                <tr><td colSpan={5} style={{ padding: 18, textAlign: 'center', color: 'var(--text-soft)' }}>Todavía nadie dejó su WhatsApp. Los avisos llegan desde las guías de ruta en butacaenlinea.com/pasajes.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {abierta && (
        <div className={ui.card} style={{ padding: 20, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 17 }}>{abierta.origen} → {abierta.destino}</span>
            <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>{pendientes.length} por avisar</span>
            <button className={ui.btnSecondary} style={{ marginLeft: 'auto', fontSize: 13 }} disabled={!pendientes.length} onClick={copiar}>Copiar teléfonos</button>
            <button className={ui.btnPrimary} style={{ fontSize: 13 }} disabled={!pendientes.length || avisados.isPending} onClick={() => window.confirm(`¿Ya les escribiste a los ${pendientes.length} de esta ruta? Quedarán marcados como avisados.`) && avisados.mutate()}>
              Marcar como avisados
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
            {(telefonos ?? []).map((t) => (
              <div key={t.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 14, alignItems: 'center' }}>
                <a href={`https://wa.me/${t.telefono.replace('+', '')}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>{t.telefono}</a>
                <span style={{ color: 'var(--text-soft)' }}>{t.nombre ?? ''}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-faint)' }}>{fechaCorta(t.creado)}{t.avisadoEn ? ' · avisado' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
