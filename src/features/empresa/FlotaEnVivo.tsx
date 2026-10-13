import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFlotaEnVivo, getRecorrido, type UnidadEnVivo } from '../../lib/api/endpoints';
import { MapaRecorrido } from '../urbano/MapaRecorrido';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const MODO: Record<string, string> = { urbano: 'Ruta urbana', largo: 'Viaje', jornada: 'Jornada' };

function haceCuanto(seg: number | null): string {
  if (seg === null) return 'sin señal';
  if (seg < 90) return 'ahora';
  if (seg < 3600) return `hace ${Math.round(seg / 60)} min`;
  return `hace ${Math.round(seg / 3600)} h`;
}

/**
 * Dónde está cada unidad de la empresa, en vivo. La app del conductor reporta
 * mientras tiene un turno abierto; aquí se refresca cada 15 s. Al elegir una
 * unidad se dibuja su recorrido de las últimas 12 horas.
 */
export default function FlotaEnVivo() {
  const [elegida, setElegida] = useState<string | null>(null);
  const { data: flota, isLoading } = useQuery({ queryKey: ['flota-en-vivo'], queryFn: getFlotaEnVivo, refetchInterval: 15_000 });
  const { data: recorrido } = useQuery({
    queryKey: ['recorrido', elegida],
    queryFn: () => getRecorrido(elegida!, new Date(Date.now() - 12 * 3600_000).toISOString()),
    enabled: Boolean(elegida),
    refetchInterval: 30_000,
  });

  const conPosicion = (flota ?? []).filter((u): u is UnidadEnVivo & { posicion: NonNullable<UnidadEnVivo['posicion']> } => Boolean(u.posicion));
  const enCamino = (flota ?? []).filter((u) => u.jornada && u.posicion?.viva).length;
  const buses = conPosicion.filter((u) => u.posicion.viva).map((u) => ({ documentId: u.documentId, numero: u.numero, lat: u.posicion.lat, lng: u.posicion.lng }));
  const trazo: [number, number][] = (recorrido?.puntos ?? []).map((p) => [p.lat, p.lng]);

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Flota en vivo</h2>
        <StatusChip tono={enCamino ? 'ok' : 'neutral'}>{enCamino} en jornada con señal</StatusChip>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 16, alignItems: 'start' }}>
        <div className={ui.card} style={{ overflow: 'hidden' }}>
          {isLoading && <div style={{ padding: 16, color: 'var(--text-soft)' }}>Cargando…</div>}
          {(flota ?? []).map((u) => (
            <button
              key={u.documentId}
              onClick={() => setElegida(elegida === u.documentId ? null : u.documentId)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                background: elegida === u.documentId ? 'var(--blue-50, #EFF4FF)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>Unidad {u.numero}</strong>
                {u.jornada ? <StatusChip tono="ok" size="sm">{MODO[u.jornada.modo] ?? u.jornada.modo}</StatusChip> : <StatusChip tono="neutral" size="sm">Sin jornada</StatusChip>}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-soft)', marginTop: 2 }}>
                {u.chofer ?? 'Sin conductor'} · {u.posicion ? haceCuanto(u.posicion.haceSeg) : 'nunca reportó'}
                {u.posicion && !u.posicion.viva ? ' (última conocida)' : ''}
              </span>
            </button>
          ))}
          {!isLoading && !flota?.length && <div style={{ padding: 16, color: 'var(--text-soft)' }}>Todavía no hay unidades.</div>}
        </div>
        <div className={ui.card} style={{ padding: 8 }}>
          <MapaRecorrido puntos={trazo} buses={buses} alto={520} />
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '8px 8px 0' }}>
            {elegida ? `Recorrido de las últimas 12 h: ${recorrido?.total ?? 0} posiciones.` : 'Elige una unidad para ver su recorrido.'} Solo se muestran las unidades con señal de los últimos 10 min.
          </p>
        </div>
      </div>
    </div>
  );
}
