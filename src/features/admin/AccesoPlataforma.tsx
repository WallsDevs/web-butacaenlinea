import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { accesoPlataforma } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { useAuth } from '../../stores/auth';
import { Field } from '../../components/ui/Field';
import ui from '../../components/ui/ui.module.css';

/**
 * Acceso del dueño de la plataforma. Ruta discreta (/plataforma) con endpoint
 * propio del backend: solo superadmin, límite de intentos y 2FA si está
 * activada. Cualquier fallo responde lo mismo: "Acceso restringido".
 */
export default function AccesoPlataforma() {
  const navigate = useNavigate();
  const { usuario, iniciarSesion } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [pide2fa, setPide2fa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (usuario?.role?.type === 'superadmin') navigate('/admin', { replace: true });
  }, [usuario, navigate]);

  const entrar = async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await accesoPlataforma(identifier, password, codigo || undefined);
      if (r.requiere2fa) {
        setPide2fa(true);
        return;
      }
      if (r.jwt && r.usuario) {
        iniciarSesion(r.jwt, r.usuario);
        navigate('/admin');
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'demasiados_intentos') {
        const seg = (e.details as { reintentarEnSeg?: number })?.reintentarEnSeg ?? 900;
        setError(`Demasiados intentos. Espera ${Math.ceil(seg / 60)} minutos.`);
      } else {
        setError('Acceso restringido.');
        if (pide2fa) setCodigo('');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '72px 16px 56px' }}>
      <div className={ui.card} style={{ padding: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Plataforma</h2>
        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>
          {pide2fa
            ? 'Ingresa el código de tu app de autenticación.'
            : 'Acceso restringido al operador de Butaca En Línea.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
          {!pide2fa ? (
            <>
              <Field label="Usuario" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus />
              <Field
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && entrar()}
              />
            </>
          ) : (
            <Field
              label="Código de verificación"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && entrar()}
              autoFocus
              placeholder="000000"
            />
          )}
          {error && <div style={{ fontSize: 13, color: 'var(--bad-text)' }}>{error}</div>}
          <button
            className={`${ui.btnPrimary} ${ui.btnPrimaryLg}`}
            disabled={cargando || !identifier || !password || (pide2fa && codigo.replace(/\s/g, '').length !== 6)}
            onClick={entrar}
          >
            {cargando ? 'Verificando…' : pide2fa ? 'Verificar' : 'Entrar'}
          </button>
          {pide2fa && (
            <button
              style={{ fontSize: 13, color: 'var(--text-soft)' }}
              onClick={() => {
                setPide2fa(false);
                setCodigo('');
                setError(null);
              }}
            >
              ← Volver
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
