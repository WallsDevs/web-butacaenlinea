import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getMapaRutaUrbana } from '../../lib/api/endpoints';
import { MapaRecorrido } from './MapaRecorrido';
import { useSeo } from '../../lib/seo';
import ui from '../../components/ui/ui.module.css';

const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

const hace = (iso: string) => {
  const seg = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return seg < 60 ? `hace ${seg} s` : `hace ${Math.round(seg / 60)} min`;
};

/** Distancia en km entre dos coordenadas. */
const haversine = (a: Punto, b: Punto) => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
};

const distancia = (km: number) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString('es-VE', { maximumFractionDigits: 1 })} km`;

interface Punto {
  lat: number;
  lng: number;
}

/**
 * Mapa público de una ruta urbana (PWA del pasajero): el recorrido dibujado
 * por la empresa y las busetas moviéndose en vivo (polling 8 s). El pasajero
 * llega aquí desde la pantalla de pago o desde el link que comparta la línea.
 */
export default function MapaRuta() {
  const navigate = useNavigate();
  useSeo('¿Por dónde viene la buseta? — Butaca En Línea');
  const { rutaId } = useParams<{ rutaId: string }>();
  const [yo, setYo] = useState<{ lat: number; lng: number; precision?: number } | null>(null);
  const [errorUbic, setErrorUbic] = useState<string | null>(null);
  const [centrar, setCentrar] = useState(0);
  const watchRef = useRef<number | null>(null);

  /**
   * Se sigue la posición del pasajero mientras la pantalla está abierta: lo
   * que le importa no es dónde está la buseta en abstracto, sino cuánto falta
   * entre ella y él. OJO: el navegador exige HTTPS (en dev solo localhost).
   */
  useEffect(() => {
    if (!navigator.geolocation) {
      setErrorUbic('Tu navegador no puede darnos la ubicación.');
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) =>
        setYo({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: pos.coords.accuracy,
        }),
      () => setErrorUbic('No pudimos ubicarte. El mapa igual te sirve.'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    );
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  const { data: mapa, isLoading } = useQuery({
    queryKey: ['mapa-ruta', rutaId],
    queryFn: () => getMapaRutaUrbana(rutaId!),
    enabled: Boolean(rutaId),
    refetchInterval: 8000,
    retry: false,
  });

  /** La buseta más cercana a mí, que es la que voy a agarrar. */
  const masCerca = useMemo(() => {
    if (!yo || !mapa?.unidades?.length) return null;
    let mejor: { numero: string; km: number; hora: string } | null = null;
    for (const u of mapa.unidades) {
      const km = haversine(yo, { lat: u.lat, lng: u.lng });
      if (!mejor || km < mejor.km) mejor = { numero: u.numero, km, hora: u.hora };
    }
    return mejor;
  }, [yo, mapa]);

  if (isLoading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando mapa…</div>;
  }
  if (!mapa) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>
        Esta ruta no está disponible.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>
      <button
        onClick={() => navigate('/busetas')}
        style={{
          border: 0,
          background: 'transparent',
          color: 'var(--text-soft)',
          fontSize: 14,
          cursor: 'pointer',
          padding: '4px 0',
          marginBottom: 6,
        }}
      >
        ← Otras busetas
      </button>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>{mapa.linea}</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{mapa.nombre}</h2>
        <div style={{ fontSize: 14, color: 'var(--text-soft)' }}>Pasaje {bs(mapa.tarifaBs)}</div>
      </div>

      {/* Lo primero que quiere saber quien espera: cuánto falta */}
      {masCerca ? (
        <div style={estilos.cintaCerca}>
          <span style={estilos.puntoVivo} />
          <span>
            La buseta <strong>{masCerca.numero}</strong> está a{' '}
            <strong>{distancia(masCerca.km)}</strong> de ti
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.75 }}>
            {hace(masCerca.hora)}
          </span>
        </div>
      ) : yo && mapa.unidades.length === 0 ? (
        <div style={estilos.cintaApagada}>
          Ninguna buseta de esta ruta está en servicio ahora mismo.
        </div>
      ) : null}

      <div className={ui.card} style={{ padding: 10, position: 'relative' }}>
        <MapaRecorrido
          puntos={mapa.recorrido}
          buses={mapa.unidades}
          paradas={mapa.paradas ?? []}
          miUbicacion={yo}
          centrarEnMi={centrar}
          alto={420}
        />
        {yo && (
          <button
            onClick={() => setCentrar((n) => n + 1)}
            title="Centrar en mi ubicación"
            style={estilos.botonCentrar}
          >
            ◎
          </button>
        )}
      </div>
      {errorUbic && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8, textAlign: 'center' }}>
          {errorUbic}
        </div>
      )}

      {(mapa.paradas?.length ?? 0) > 0 && (
        <div className={ui.card} style={{ padding: '14px 16px', marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Dónde para</div>
          {mapa.paradas!.map((p, i) => (
            <div
              key={`${p.nombre}-${i}`}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: i === 0 || i === mapa.paradas!.length - 1 ? 'var(--navy)' : 'var(--tint-100, #EFF4FF)',
                  color: i === 0 || i === mapa.paradas!.length - 1 ? '#fff' : 'var(--navy)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flex: 'none',
                }}
              >
                {i === 0 ? 'A' : i === mapa.paradas!.length - 1 ? 'B' : i + 1}
              </span>
              <span style={{ fontSize: 14 }}>{p.nombre}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-faint)' }}>
                {i === 0 ? 'sale' : i === mapa.paradas!.length - 1 ? 'llega' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {mapa.unidades.length ? (
          mapa.unidades.map((u) => (
            <div
              key={u.documentId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                fontSize: 14,
              }}
            >
              <span style={{ fontSize: 18 }}>🚌</span>
              <span style={{ fontWeight: 700 }}>Unidad {u.numero}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--text-soft)', fontSize: 13 }}>
                {hace(u.hora)}
              </span>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-soft)', textAlign: 'center', padding: 10 }}>
            Ninguna buseta está transmitiendo su posición en este momento.
          </p>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', marginTop: 6 }}>
        El mapa se actualiza solo cada pocos segundos.
      </p>
    </div>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  cintaCerca: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    background: 'var(--ok-bg)',
    color: 'var(--ok-text)',
    border: '1px solid var(--ok-dot)',
    borderRadius: 14,
    padding: '11px 14px',
    fontSize: 14,
    marginBottom: 10,
  },
  puntoVivo: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--ok-dot)',
    display: 'inline-block',
    flex: 'none',
  },
  cintaApagada: {
    background: 'var(--pill-bg, #F1F5F9)',
    color: 'var(--text-soft)',
    borderRadius: 14,
    padding: '11px 14px',
    fontSize: 14,
    marginBottom: 10,
  },
  botonCentrar: {
    position: 'absolute',
    right: 22,
    bottom: 22,
    width: 38,
    height: 38,
    borderRadius: '50%',
    border: '1px solid var(--border)',
    background: '#fff',
    color: 'var(--blue-600, #2563EB)',
    fontSize: 18,
    cursor: 'pointer',
    boxShadow: '0 2px 10px rgba(15,23,42,.18)',
    zIndex: 500,
  },
};
