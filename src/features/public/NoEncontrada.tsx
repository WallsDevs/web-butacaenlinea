import { useLocation, useNavigate, useRouteError } from 'react-router';
import { Isotipo } from '../../components/brand/LogoMark';
import { useAuth } from '../../stores/auth';
import { useSeo } from '../../lib/seo';
import ui from '../../components/ui/ui.module.css';

const HOGAR_POR_ROL: Record<string, string> = { superadmin: '/admin', empresa: '/empresa', cajero: '/pos', chofer: '/chofer', colector: '/colector', cliente: '/cuenta' };

function Marco({ titulo, texto, children }: { titulo: string; texto: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px' }}>
      <div className={ui.card} style={{ maxWidth: 440, width: '100%', padding: 32, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Isotipo size={44} fondo="claro" />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{titulo}</h1>
        <p style={{ fontSize: 15, color: 'var(--text-soft)', marginTop: 10, lineHeight: 1.55 }}>{texto}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 22 }}>{children}</div>
      </div>
    </div>
  );
}

/** Ruta que no existe: se dice, en vez de mandar al inicio en silencio. */
export default function NoEncontrada() {
  useSeo('Página no encontrada — Butaca En Línea', undefined, { noindex: true });
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const usuario = useAuth((s) => s.usuario);
  const hogar = usuario?.role?.type ? HOGAR_POR_ROL[usuario.role.type] : null;
  return (
    <Marco titulo="Esta página no existe" texto={`No hay nada en «${pathname}». Puede que el enlace esté mal escrito o que la página haya cambiado de lugar.`}>
      <button className={ui.btnPrimary} onClick={() => navigate('/')}>Ir al inicio</button>
      {hogar && <button className={ui.btnSecondary} onClick={() => navigate(hogar)}>Mi panel</button>}
    </Marco>
  );
}

/**
 * Algo se rompió al pintar una página (un error de código, un dato que no
 * vino como se esperaba). Sin esto React Router deja la pantalla en blanco.
 */
export function ErrorPantalla() {
  const error = useRouteError() as { status?: number; message?: string } | undefined;
  const navigate = useNavigate();
  if (error?.status === 404) return <NoEncontrada />;
  return (
    <Marco titulo="Algo salió mal" texto="La página no se pudo mostrar. Vuelve a intentarlo; si sigue pasando, avísanos por WhatsApp.">
      <button className={ui.btnPrimary} onClick={() => window.location.reload()}>Volver a intentar</button>
      <button className={ui.btnSecondary} onClick={() => navigate('/')}>Ir al inicio</button>
      {import.meta.env.DEV && error?.message && (
        <pre style={{ gridColumn: '1 / -1', width: '100%', textAlign: 'left', fontSize: 12, color: 'var(--bad-text)', whiteSpace: 'pre-wrap', marginTop: 8 }}>{error.message}</pre>
      )}
    </Marco>
  );
}
