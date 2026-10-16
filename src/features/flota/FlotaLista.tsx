import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getSalidas, getUnidades } from '../../lib/api/endpoints';
import { useAuth } from '../../stores/auth';
import { useModulos } from '../../lib/useModulos';
import { StatusChip } from '../../components/ui/StatusChip';
import { NuevaUnidad } from './NuevaUnidad';
import ui from '../../components/ui/ui.module.css';
import styles from './flota.module.css';

const ESTADO: Record<string, { label: string; tono: 'ok' | 'warn' | 'bad' | 'info' | 'neutral' }> = {
  disponible: { label: 'Activo', tono: 'ok' },
  en_ruta: { label: 'En Ruta', tono: 'info' },
  en_mantenimiento: { label: 'En Mantenimiento', tono: 'warn' },
  fuera_de_servicio: { label: 'Fuera de Servicio', tono: 'bad' },
};

export default function FlotaLista() {
  const navigate = useNavigate();
  const [creando, setCreando] = useState(false);
  const slug = useAuth((s) => s.usuario)?.linea?.slug;
  const { tiene } = useModulos();
  const { data: unidades, isLoading } = useQuery({ queryKey: ['unidades', slug], queryFn: () => getUnidades(slug) });
  const { data: viajando } = useQuery({
    queryKey: ['salidas-en-ruta', slug],
    queryFn: () => getSalidas({ estados: ['en_ruta'], lineaSlug: slug }),
    refetchInterval: 30_000,
    // «En ruta» sale de las salidas: solo existen con Boletería contratada
    enabled: tiene('boleteria'),
  });
  const destinoDe = new Map((viajando ?? []).map((s) => [s.unidad?.documentId, s.ruta?.destino]));

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {isLoading ? 'Cargando flota…' : `${unidades?.length ?? 0} unidad${(unidades?.length ?? 0) === 1 ? '' : 'es'}`}
        </h2>
        <button
          className={ui.btnPrimary}
          style={{ marginLeft: 'auto', fontSize: 14, padding: '12px 20px' }}
          onClick={() => setCreando(true)}
        >
          Nueva unidad
        </button>
      </div>
      <div className={styles.gridUnidades}>
        {(unidades ?? []).map((u) => {
          const total = u.configuracionAsientos?.pisos?.reduce(
            (s, p) => s + (p.filas.length * (p.layout.izquierda + p.layout.derecha) + (p.filaTrasera ?? 0)),
            0
          );
          return (
            <button key={u.documentId} className={styles.cardUnidad} onClick={() => navigate(`/empresa/flota/${u.documentId}`)}>
              <span className={styles.cuadroNumero}>{u.numero}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 16 }}>{u.marcaModelo}</span>
                <span style={{ display: 'block', fontSize: 13, color: 'var(--text-soft)', marginTop: 2 }}>
                  Placa {u.placa} · {total ?? '—'} puestos · {u.kilometraje.toLocaleString('es-VE')} km
                </span>
                <span style={{ display: 'inline-block', marginTop: 8, verticalAlign: 'middle' }}>
                  <StatusChip tono={ESTADO[u.estado]?.tono ?? 'neutral'} size="sm">
                    {ESTADO[u.estado]?.label ?? u.estado}
                  </StatusChip>
                </span>
                <span style={{ display: 'inline-block', marginTop: 8, marginLeft: 8, fontSize: 12, fontWeight: 600, color: 'var(--blue-700)' }}>
                  {u.estado === 'en_ruta'
                    ? `→ ${destinoDe.get(u.documentId) ?? 'en viaje'}`
                    : u.ubicacionActual
                      ? `En ${u.ubicacionActual}`
                      : ''}
                </span>
              </span>
            </button>
          );
        })}
        {!isLoading && !unidades?.length && (
          <button
            className={styles.cardUnidad}
            style={{ justifyContent: 'center', color: 'var(--text-soft)', minHeight: 110 }}
            onClick={() => setCreando(true)}
          >
            Registra tu primera unidad — el mapa de asientos de la venta sale de aquí.
          </button>
        )}
      </div>
      {creando && <NuevaUnidad onCerrar={() => setCreando(false)} />}
    </div>
  );
}
