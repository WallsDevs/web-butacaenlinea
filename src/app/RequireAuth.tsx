import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { login, getMe } from '../lib/api/endpoints';
import { useAuth } from '../stores/auth';
import { DEMO_MODE } from './AppChrome';

/** Credenciales sembradas para el auto-login del modo demo. */
const DEMO_USERS: Record<string, { identifier: string; password: string }> = {
  cajero: { identifier: 'mcontreras', password: 'Butaca2026!' },
  empresa: { identifier: 'scastro', password: 'Butaca2026!' },
  chofer: { identifier: 'aramirez', password: 'Butaca2026!' },
};

/**
 * Guard por rol. En modo demo hace auto-login con el usuario sembrado del
 * primer rol requerido, para que el conmutador de módulos fluya sin fricción
 * frente al cliente. En producción redirige a /ingresar.
 */
export function RequireAuth({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { jwt, usuario, iniciarSesion } = useAuth();
  const location = useLocation();
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const intentado = useRef(false);

  const autorizado = Boolean(jwt && usuario && roles.includes(usuario.role?.type ?? ''));

  useEffect(() => {
    if (autorizado || !DEMO_MODE || intentado.current) return;
    const demo = DEMO_USERS[roles[0]];
    if (!demo) {
      setFallo(true);
      return;
    }
    intentado.current = true;
    setCargando(true);
    (async () => {
      try {
        const r = await login(demo.identifier, demo.password);
        iniciarSesion(r.jwt, r.user);
        const yo = await getMe();
        iniciarSesion(r.jwt, yo);
      } catch {
        setFallo(true);
      } finally {
        setCargando(false);
      }
    })();
  }, [autorizado, roles, iniciarSesion]);

  if (autorizado) return <>{children}</>;
  if (DEMO_MODE && !fallo) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)', fontSize: 14 }}>
        {cargando ? 'Iniciando sesión de demostración…' : 'Preparando módulo…'}
      </div>
    );
  }
  // Con sesión de OTRO rol: a su propio panel (mandarlo al login sería un bucle)
  if (jwt && usuario) {
    const hogar: Record<string, string> = {
      superadmin: '/admin',
      empresa: '/empresa',
      cajero: '/pos',
      chofer: '/chofer',
      cliente: '/cuenta',
    };
    return <Navigate to={hogar[usuario.role?.type ?? ''] ?? '/'} replace />;
  }
  return <Navigate to={`/ingresar?next=${encodeURIComponent(location.pathname)}`} replace />;
}
