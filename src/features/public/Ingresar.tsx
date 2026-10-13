import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { login, getMe } from '../../lib/api/endpoints';
import { useAuth } from '../../stores/auth';
import { Field } from '../../components/ui/Field';
import ui from '../../components/ui/ui.module.css';

/** Login operativo (taquilla, chófer, flota). */
export default function Ingresar() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const iniciarSesion = useAuth((s) => s.iniciarSesion);
  const cerrarSesion = useAuth((s) => s.cerrarSesion);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await login(identifier, password);
      iniciarSesion(r.jwt, r.user);
      const yo = await getMe();
      // El operador de la plataforma NO entra por aquí (solo por su acceso
      // discreto); mismo mensaje genérico para no delatar que la cuenta existe.
      if (yo.role?.type === 'superadmin') {
        cerrarSesion();
        setError('Usuario o contraseña incorrectos.');
        return;
      }
      iniciarSesion(r.jwt, yo);
      const next = params.get('next');
      const rol = yo.role?.type ?? '';
      const porRol: Record<string, string> = {
        cajero: '/pos',
        empresa: '/empresa',
        chofer: '/chofer',
        colector: '/colector',
        cliente: '/cuenta',
      };
      // `next` solo aplica si el rol puede entrar ahí; si no, va a su propio panel
      const puedeIrA = (ruta: string) =>
        ruta.startsWith('/empresa') || ruta.startsWith('/flota')
          ? rol === 'empresa'
          : ruta.startsWith('/pos')
            ? rol === 'cajero' || rol === 'empresa'
            : ruta.startsWith('/chofer')
              ? rol === 'chofer'
              : ruta.startsWith('/colector')
                ? rol === 'colector' || rol === 'chofer' || rol === 'empresa'
              : ruta.startsWith('/admin')
                ? rol === 'superadmin'
                : ruta.startsWith('/cuenta')
                  ? rol === 'cliente'
                  : true;
      navigate(next && puedeIrA(next) ? next : porRol[rol] ?? '/');
    } catch (e) {
      const err = e as { code?: string; details?: { reintentarEnSeg?: number } };
      if (err.code === 'demasiados_intentos') {
        setError(`Demasiados intentos. Espera ${Math.ceil((err.details?.reintentarEnSeg ?? 900) / 60)} minutos.`);
      } else {
        setError('Usuario o contraseña incorrectos.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '40px 16px 56px' }}>
      <button className={ui.btnGhost} onClick={() => navigate('/')} style={{ marginBottom: 14 }}>
        ← Volver al inicio
      </button>
      <div className={ui.card} style={{ padding: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Ingresar</h2>
        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>
          Clientes, empresas, cajeros y conductores entran por aquí.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
          <Field
            label="Usuario o correo"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoFocus
          />
          <Field
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && entrar()}
          />
          {error && <div style={{ fontSize: 13, color: 'var(--bad-text)' }}>{error}</div>}
          <button
            className={`${ui.btnPrimary} ${ui.btnPrimaryLg}`}
            disabled={cargando || !identifier || !password}
            onClick={entrar}
          >
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
          <div style={{ fontSize: 13, color: 'var(--text-soft)', textAlign: 'center' }}>
            ¿Primera vez? <a href="/registro">Crea tu cuenta de pasajero</a>
          </div>
        </div>
      </div>
    </div>
  );
}
