import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFlotaEnVivo, getMapaRutaUrbana, getRecorrido, type UnidadEnVivo } from '../../lib/api/endpoints';
import { MapaRecorrido } from '../urbano/MapaRecorrido';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const MODO: Record<string, string> = { urbano: 'Ruta urbana', largo: 'Viaje', jornada: 'Jornada' };

function haceCuanto(seg: number | null): string {
  if (seg === null) return 'sin señal';
  if (seg < 90) return 'ahora';
  if (seg < 3600) return `hace ${Math.round(seg / 60)} min`;
  if (seg < 48 * 3600) return `hace ${Math.round(seg / 3600)} h`;
  return `hace ${Math.round(seg / 86400)} días`;
}

/**
 * Dónde está cada unidad de la empresa, en vivo. La app del conductor reporta
 * mientras tiene un turno abierto; aquí se refresca cada 15 s. Todas las
 * unidades con alguna posición salen en el mapa (en gris las que llevan más de
 * 10 min sin señal). Al elegir una, el mapa centra en ella y dibuja su ruta
 * urbana de fondo y por dónde fue de verdad en las últimas 12 horas.
 */
export default function FlotaEnVivo() {
  const [elegida, setElegida] = useState<string | null>(null);
  const { data: flota, isLoading } = useQuery({ queryKey: ['flota-en-vivo'], queryFn: getFlotaEnVivo, refetchInterval: 15_000 });
  const unidad = (flota ?? []).find((u) => u.documentId === elegida) ?? null;
  const { data: recorrido } = useQuery({
    queryKey: ['recorrido', elegida],
    queryFn: () => getRecorrido(elegida!, new Date(Date.now() - 12 * 3600_000).toISOString()),
    enabled: Boolean(elegida),
    refetchInterval: 30_000,
  });
  const { data: ruta } = useQuery({
    queryKey: ['mapa-ruta-urbana', unidad?.ruta?.documentId],
    queryFn: () => getMapaRutaUrbana(unidad!.ruta!.documentId),
    enabled: Boolean(unidad?.ruta?.documentId),
    staleTime: 300_000,
  });

  const conPosicion = (flota ?? []).filter((u): u is UnidadEnVivo & { posicion: NonNullable<UnidadEnVivo['posicion']> } => Boolean(u.posicion));
  const enCamino = (flota ?? []).filter((u) => u.jornada && u.posicion?.viva).length;
  const buses = conPosicion.map((u) => ({ documentId: u.documentId, numero: u.numero, lat: u.posicion.lat, lng: u.posicion.lng, apagado: !u.posicion.viva, resaltado: u.documentId === elegida }));
  const trazo: [number, number][] = (recorrido?.puntos ?? []).map((p) => [p.lat, p.lng]);
  const rutaFondo = unidad?.ruta ? (ruta?.recorrido ?? []) : [];
  const paradas = unidad?.ruta ? (ruta?.paradas ?? []) : [];
  const enfocar = unidad?.posicion ? { lat: unidad.posicion.lat, lng: unidad.posicion.lng, clave: unidad.documentId } : null;

  const explicacion = !unidad
    ? null
    : !unidad.posicion
      ? unidad.jornada
        ? 'Tiene la jornada abierta pero el teléfono todavía no ha mandado ninguna posición. Revisa que la app tenga el permiso de ubicación «Siempre» y señal; lo guardado sin señal llega cuando la recupere.'
        : 'Nunca ha reportado posición: aparece en el mapa cuando el conductor abra una jornada o un turno en la app.'
      : !unidad.posicion.viva
        ? `Sin señal ${haceCuanto(unidad.posicion.haceSeg)}: se muestra su última posición conocida.`
        : `Con señal (${haceCuanto(unidad.posicion.haceSeg)}).`;

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
                background: elegida === u.documentId ? 'var(--tint-50)' : 'transparent',
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
              {u.ruta && <span style={{ display: 'block', fontSize: 12, color: 'var(--blue-700)', marginTop: 2 }}>{u.ruta.nombre}</span>}
            </button>
          ))}
          {!isLoading && !flota?.length && <div style={{ padding: 16, color: 'var(--text-soft)' }}>Todavía no hay unidades.</div>}
        </div>
        <div className={ui.card} style={{ padding: 8 }}>
          {unidad && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', padding: '6px 8px 10px', fontSize: 13 }}>
              <strong>Unidad {unidad.numero}</strong>
              {unidad.ruta ? <span style={{ color: 'var(--blue-700)' }}>{unidad.ruta.nombre}</span> : <span style={{ color: 'var(--text-faint)' }}>Sin ruta urbana asignada</span>}
              <span style={{ color: unidad.posicion?.viva ? 'var(--ok-text)' : 'var(--text-soft)' }}>{explicacion}</span>
            </div>
          )}
          <MapaRecorrido puntos={trazo} rutaFondo={rutaFondo} paradas={paradas} buses={buses} enfocar={enfocar} ajustarCada={elegida ? `${elegida}:${ruta?.recorrido?.length ?? 0}:${trazo.length ? 1 : 0}` : ''} alto={520} />
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '8px 8px 0' }}>
            {elegida
              ? `Línea clara: su ruta urbana. Línea azul: por dónde fue en las últimas 12 h (${recorrido?.total ?? 0} posiciones).`
              : 'Elige una unidad para centrar el mapa en ella y ver su ruta y su recorrido.'}{' '}
            Las busetas en gris llevan más de 10 min sin señal y se muestran en su última posición conocida.
          </p>
        </div>
      </div>
    </div>
  );
}
