import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '../../stores/auth';
import { useSeo } from '../../lib/seo';
import ui from '../../components/ui/ui.module.css';
import { EncabezadoPantalla } from '../../components/ui/EncabezadoPantalla';

const ROL: Record<string, string> = { cliente: 'Pasajero', empresa: 'Administrador de la línea', cajero: 'Cajero', chofer: 'Conductor', colector: 'Colector', superadmin: 'Operador de la plataforma' };

/** Mis datos y cerrar sesión: el único sitio donde se cierra la sesión. Para cualquier rol; en celular es la pestaña «Perfil». */
export default function Perfil() {
  useSeo('Mi perfil — Butaca En Línea', undefined, { noindex: true });
  const navigate = useNavigate();
  const usuario = useAuth((s) => s.usuario);
  const cerrarSesion = useAuth((s) => s.cerrarSesion);
  if (!usuario) return null;
  // El conductor no tiene nada en la web: su perfil y su salida están en la pantalla de la app
  if (usuario.role?.type === 'chofer') return <Navigate to="/app-conductor" replace />;
  const iniciales = (usuario.nombreCorto ?? usuario.username).split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const fila = (etiqueta: string, valor?: string | null) =>
    valor ? (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--divider)', fontSize: 15 }}>
        <span style={{ color: 'var(--text-soft)' }}>{etiqueta}</span>
        <span style={{ fontWeight: 600, textAlign: 'right' }}>{valor}</span>
      </div>
    ) : null;
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px 64px' }}>
      <EncabezadoPantalla
        seccion={null}
        titulo="Mi perfil"
        descripcion="Tus datos de acceso. Para cambiarlos, pide a quien administra tu línea (o a la plataforma) que los edite."
      />
      <div className={ui.card} style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--tint-100)', color: 'var(--blue-700)', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 700, flex: 'none' }}>{iniciales}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{usuario.nombreCorto ?? usuario.username}</div>
            <div style={{ fontSize: 14, color: 'var(--text-soft)' }}>{ROL[usuario.role?.type ?? ''] ?? usuario.role?.name}</div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          {fila('Usuario', usuario.username)}
          {fila('Correo', usuario.email)}
          {fila('Teléfono', usuario.telefono)}
          {fila('Documento', usuario.documento)}
          {fila('Línea', usuario.linea?.nombre)}
          {fila('Taquilla', usuario.taquilla?.nombre)}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>Al cerrar sesión, este dispositivo vuelve al sitio público.</span>
        <button
          className={ui.btnSecondary}
          style={{ color: 'var(--bad-text)' }}
          onClick={() => {
            cerrarSesion();
            navigate('/');
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
