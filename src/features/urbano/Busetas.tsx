import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getRutasUrbanasPublicas } from '../../lib/api/endpoints';
import { useSeo } from '../../lib/seo';
import ui from '../../components/ui/ui.module.css';

const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

/**
 * "¿Por dónde viene mi buseta?" — la entrada del pasajero que ESPERA.
 *
 * Hasta ahora al mapa solo se llegaba escaneando el QR pegado dentro de la
 * buseta, o sea estando ya montado. Justo al revés de quien más lo necesita:
 * el que está parado en la esquina. Esta página es esa puerta.
 *
 * Si el pasajero da su ubicación, las rutas se ordenan por la parada más
 * cercana. Si no, primero las que tienen busetas rodando ahora mismo.
 */
export default function Busetas() {
  useSeo(
    'Busetas en vivo — Butaca En Línea',
    'Mira por dónde viene tu buseta antes de salir a la parada.'
  );
  const navigate = useNavigate();
  const [buscar, setBuscar] = useState('');
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(null);
  const [ubicando, setUbicando] = useState(false);
  const [avisoUbic, setAvisoUbic] = useState<string | null>(null);

  const { data: rutas, isLoading } = useQuery({
    queryKey: ['rutas-urbanas-publicas', buscar, punto?.lat, punto?.lng],
    queryFn: () =>
      getRutasUrbanasPublicas({ buscar, lat: punto?.lat, lng: punto?.lng }),
    // Las busetas entran y salen de servicio; esto tiene que sentirse vivo
    refetchInterval: 15_000,
  });

  const ubicarme = () => {
    if (!navigator.geolocation) {
      setAvisoUbic('Tu navegador no puede darnos la ubicación.');
      return;
    }
    setUbicando(true);
    setAvisoUbic(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPunto({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUbicando(false);
      },
      () => {
        setUbicando(false);
        setAvisoUbic('No pudimos ubicarte. Busca tu ruta por nombre.');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
  };

  // Se intenta una vez al abrir: es lo que la persona espera al entrar aquí
  useEffect(() => {
    ubicarme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conBusetas = (rutas ?? []).filter((r) => r.busetasEnCamino > 0).length;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 40px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em' }}>
        ¿Por dónde viene tu buseta?
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-soft)', marginTop: 6, lineHeight: 1.5 }}>
        Mira la ruta en el mapa antes de salir a la parada. No hace falta escanear nada.
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar ruta, empresa o sector"
          className={ui.fieldInput}
          style={{ flex: 1 }}
        />
        <button
          className={ui.btnSecondary}
          onClick={ubicarme}
          disabled={ubicando}
          style={{ whiteSpace: 'nowrap' }}
        >
          {ubicando ? 'Ubicando…' : punto ? '📍 Cerca de mí' : '📍 Ubicarme'}
        </button>
      </div>

      {avisoUbic && (
        <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 8 }}>{avisoUbic}</div>
      )}

      <div style={{ fontSize: 13, color: 'var(--text-soft)', margin: '16px 0 10px' }}>
        {isLoading
          ? 'Buscando rutas…'
          : !rutas?.length
            ? ''
            : conBusetas > 0
              ? `${conBusetas} ${conBusetas === 1 ? 'ruta con buseta rodando' : 'rutas con busetas rodando'} ahora`
              : 'Ninguna buseta en servicio en este momento'}
      </div>

      {!isLoading && !rutas?.length && (
        <div className={ui.card} style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🚌</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {buscar ? 'Ninguna ruta coincide' : 'Todavía no hay rutas urbanas publicadas'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-soft)', marginTop: 8, lineHeight: 1.5 }}>
            {buscar
              ? 'Prueba con el nombre del sector o de la empresa.'
              : 'Las empresas de tu ciudad todavía no han cargado sus rutas.'}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(rutas ?? []).map((r) => (
          <button
            key={r.documentId}
            className={ui.card}
            onClick={() => navigate(`/mapa/${r.documentId}`)}
            style={{
              padding: 16,
              textAlign: 'left',
              cursor: 'pointer',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{r.nombre}</span>
                {r.busetasEnCamino > 0 ? (
                  <span style={estilos.chipVivo}>
                    <span style={estilos.punto} />
                    {r.busetasEnCamino} en camino
                  </span>
                ) : (
                  <span style={estilos.chipApagado}>sin servicio ahora</span>
                )}
              </div>
              {(r.origen || r.destino) && (
                <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>
                  {r.origen}
                  {r.destino ? ` → ${r.destino}` : ''}
                  {r.paradas > 2 ? ` · ${r.paradas} paradas` : ''}
                </div>
              )}
              <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 4 }}>
                {r.linea} · pasaje {bs(r.tarifaBs)}
                {r.kmALaParadaMasCercana !== null &&
                  ` · parada más cerca a ${r.kmALaParadaMasCercana.toLocaleString('es-VE')} km`}
              </div>
            </div>
            <span style={{ fontSize: 20, color: 'var(--text-faint)' }}>›</span>
          </button>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 20, lineHeight: 1.55 }}>
        Las busetas aparecen en el mapa mientras su conductor está de turno. Si una no sale, es
        que no está rodando en este momento.
      </p>
    </div>
  );
}

const estilos: Record<string, React.CSSProperties> = {
  chipVivo: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--ok-text)',
    background: 'var(--ok-bg)',
    borderRadius: 999,
    padding: '3px 10px',
  },
  punto: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'var(--ok-dot)',
    display: 'inline-block',
  },
  chipApagado: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-faint)',
    background: 'var(--pill-bg, #F1F5F9)',
    borderRadius: 999,
    padding: '3px 10px',
  },
};
