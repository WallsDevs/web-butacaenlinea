import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getRutasUrbanasPublicas } from '../../../lib/api/endpoints';
import { useAuth } from '../../../stores/auth';
import { H2 } from './piezas';
import { Letrero } from '../../../components/ui/Letrero';

const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

/**
 * Las rutas urbanas de las líneas afiliadas, con cuántas busetas van rodando
 * ahora. Es para el pasajero con cuenta: al visitante se le muestra solo el
 * aviso de que registrándose ve por dónde viene su buseta.
 */
export function BusetasEnVivo() {
  const navigate = useNavigate();
  const usuario = useAuth((s) => s.usuario);
  const { data: rutas } = useQuery({ queryKey: ['rutas-urbanas-publicas', 'inicio'], queryFn: () => getRutasUrbanasPublicas(), refetchInterval: 30_000, enabled: Boolean(usuario) });
  if (!usuario) {
    return (
      <section id="busetas" style={{ background: '#FFFFFF', border: '1.5px solid #E6EBF4', borderRadius: 22, padding: '26px 28px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18 }}>
        <span style={{ fontSize: 34, flex: 'none' }}>🚌</span>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#0F172A' }}>Busetas urbanas en vivo</div>
          <div style={{ fontSize: 14, color: '#475569', marginTop: 4, lineHeight: 1.5 }}>
            Con tu cuenta ves por dónde viene tu buseta antes de salir a la parada y pagas el pasaje con QR al subir.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/registro')} style={{ height: 46, padding: '0 20px', borderRadius: 14, border: 'none', background: '#2563EB', color: '#FFFFFF', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            Crear cuenta
          </button>
          <button onClick={() => navigate('/ingresar')} style={{ height: 46, padding: '0 20px', borderRadius: 14, border: '1.5px solid #E2E8F2', background: '#FFFFFF', color: '#0F172A', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            Ingresar
          </button>
        </div>
      </section>
    );
  }
  if (!rutas?.length) return null;
  // Solo rutas con buseta de turno ahora: una ruta apagada no le sirve a quien espera en la parada
  const lista = rutas.filter((r) => r.busetasEnCamino > 0).sort((a, b) => b.busetasEnCamino - a.busetasEnCamino).slice(0, 6);
  const enCamino = rutas.reduce((s, r) => s + r.busetasEnCamino, 0);
  return (
    <section id="busetas" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <H2>Busetas urbanas en vivo</H2>
          <span style={{ fontSize: 13, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: enCamino ? '#E7F6EC' : '#EEF2F9', color: enCamino ? '#166534' : '#475569' }}>
            {enCamino ? `${enCamino} rodando ahora` : 'ninguna rodando ahora'}
          </span>
        </div>
        <span style={{ fontSize: 14, color: '#475569' }}>Mira por dónde viene antes de salir a la parada. Pagas el pasaje con QR al subir.</span>
      </div>
      {!lista.length && (
        <div style={{ background: '#FFFFFF', border: '1.5px solid #E6EBF4', borderRadius: 18, padding: '18px 20px', fontSize: 14, color: '#475569' }}>
          Ahora mismo no hay busetas de turno. Las rutas aparecen aquí en cuanto alguna arranca.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
        {lista.map((r) => (
          <button
            key={r.documentId}
            onClick={() => navigate(`/mapa/${r.documentId}`)}
            style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: '#FFFFFF', border: '1.5px solid #E6EBF4', borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6, color: '#0F172A' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22A35A', flex: 'none' }} />
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{r.nombre}</span>
            </span>
            {r.letreros?.length ? <Letrero letreros={r.letreros} tamano="sm" /> : null}
            <span style={{ fontSize: 13, color: '#7C8AA5' }}>{r.linea ?? 'Línea afiliada'}{r.origen && r.destino ? ` · ${r.origen} → ${r.destino}` : ''}</span>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>
                {r.busetasEnCamino} {r.busetasEnCamino === 1 ? 'buseta' : 'busetas'} en camino
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#2563EB' }}>{r.porTramos ? `desde ${bs(r.tarifaBs)}` : bs(r.tarifaBs)}</span>
            </span>
          </button>
        ))}
      </div>
      <div>
        <button onClick={() => navigate('/busetas')} style={{ height: 48, padding: '0 22px', borderRadius: 14, border: '1.5px solid #E2E8F2', background: '#FFFFFF', color: '#0F172A', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Ver todas las rutas y ubicarme →
        </button>
      </div>
    </section>
  );
}
