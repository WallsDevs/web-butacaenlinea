import { useNavigate } from 'react-router';
import { useAuth } from '../../stores/auth';
import { useSeo } from '../../lib/seo';
import { LogoLockup } from '../../components/brand/LogoMark';
import ui from '../../components/ui/ui.module.css';

/** Enlace de descarga del APK, si la plataforma lo publica (VITE_APK_URL). */
const APK_URL = (import.meta.env.VITE_APK_URL as string | undefined)?.trim() || null;

/**
 * El conductor no trabaja desde la web: su herramienta es la app Butaca
 * Conductor (jornada, escáner, manifiesto, ubicación). Si entra aquí con su
 * cuenta, se le dice dónde está lo suyo y se le deja cerrar sesión.
 */
export default function SoloApp() {
  useSeo('App del conductor — Butaca En Línea', undefined, { noindex: true });
  const navigate = useNavigate();
  const usuario = useAuth((s) => s.usuario);
  const cerrarSesion = useAuth((s) => s.cerrarSesion);
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)' }}>
      <div className={ui.card} style={{ maxWidth: 520, width: '100%', padding: 32, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <LogoLockup />
        </div>
        <div style={{ fontSize: 44, lineHeight: 1 }} aria-hidden>📱</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 14 }}>
          Hola{usuario?.nombreCorto ? `, ${usuario.nombreCorto}` : ''}: lo tuyo está en la app
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-soft)', lineHeight: 1.55, marginTop: 10 }}>
          Tu cuenta es de <strong>conductor</strong>. La jornada, el escáner de boletos, el manifiesto y la ubicación
          de tu unidad se manejan desde la app <strong>Butaca Conductor</strong> en el teléfono. En la web no hay
          nada que hacer con esta cuenta.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
          {APK_URL ? (
            <a className={ui.btnPrimary} href={APK_URL} style={{ textAlign: 'center' }}>
              Descargar la app para Android
            </a>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-soft)', background: 'var(--tint-50)', borderRadius: 12, padding: '10px 12px' }}>
              Pídele a quien administra tu línea el enlace de instalación de la app.
            </div>
          )}
          <button
            className={ui.btnSecondary}
            onClick={() => {
              cerrarSesion();
              navigate('/');
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
