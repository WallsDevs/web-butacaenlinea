import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { accesoPlataforma } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { useAuth } from '../../stores/auth';
import { Isotipo } from '../../components/brand/LogoMark';
import { useSeo } from '../../lib/seo';
import css from '../public/acceso.module.css';

const SOPORTE = 'https://wa.me/584129647161?text=' + encodeURIComponent('Hola, necesito ayuda con el acceso a la plataforma');

type Paso = 'credenciales' | 'codigo' | 'listo';

/**
 * Acceso del dueño de la plataforma (diseño «Plataforma Login»). Ruta
 * discreta (/plataforma) con endpoint propio del backend: solo superadmin,
 * límite de intentos y 2FA con app de autenticación si está activada.
 * Cualquier fallo responde lo mismo: «Acceso restringido».
 */
export default function AccesoPlataforma() {
  useSeo('Plataforma — Butaca En Línea', undefined, { noindex: true });
  const navigate = useNavigate();
  const { usuario: sesion, iniciarSesion } = useAuth();
  const [paso, setPaso] = useState<Paso>('credenciales');
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Quien ya tiene sesión de superadmin entra directo; al terminar el acceso, tras un instante
  useEffect(() => {
    if (paso === 'credenciales' && sesion?.role?.type === 'superadmin') navigate('/admin', { replace: true });
    if (paso === 'listo') {
      const t = setTimeout(() => navigate('/admin', { replace: true }), 900);
      return () => clearTimeout(t);
    }
  }, [paso, sesion, navigate]);

  const u = usuario.trim();
  const ok = paso === 'credenciales' ? u.length > 1 && clave.length > 0 : codigo.length === 6;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok || cargando) return;
    setCargando(true);
    setError(null);
    try {
      const r = await accesoPlataforma(u, clave, paso === 'codigo' ? codigo : undefined);
      if (r.requiere2fa) {
        setPaso('codigo');
        return;
      }
      if (r.jwt && r.usuario) {
        iniciarSesion(r.jwt, r.usuario);
        setPaso('listo');
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'demasiados_intentos') {
        const seg = (err.details as { reintentarEnSeg?: number })?.reintentarEnSeg ?? 900;
        setError(`Demasiados intentos. Espera ${Math.ceil(seg / 60)} minutos.`);
      } else {
        setError('Acceso restringido.');
      }
      if (paso === 'codigo') setCodigo('');
    } finally {
      setCargando(false);
    }
  };

  const etiqueta = { display: 'flex', flexDirection: 'column', gap: 8 } as const;
  const rotulo = { fontSize: 14, fontWeight: 500, color: '#475569' } as const;
  const cta = (activo: boolean) => ({
    height: 56, border: 'none', borderRadius: 14, fontFamily: 'inherit', fontSize: 17, fontWeight: 700, color: '#FFFFFF',
    background: activo ? '#2563EB' : '#B9CDF8', cursor: activo && !cargando ? 'pointer' : 'default', boxShadow: activo ? '0 10px 24px rgba(37,99,235,.3)' : 'none',
  }) as const;
  const alerta = error && <div role="alert" style={{ fontSize: 14, color: '#8F1D1D', background: '#FDE7E7', borderRadius: 12, padding: '12px 14px', marginTop: -8 }}>{error}</div>;

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#081F52', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(159,192,255,.12) 1.5px,transparent 1.5px)', backgroundSize: '28px 28px' }} />
      <div style={{ position: 'absolute', left: '50%', top: '44%', width: 900, height: 900, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,99,235,.35) 0%,rgba(37,99,235,0) 62%)' }} />

      <header style={{ position: 'relative', maxWidth: 1180, width: '100%', margin: '0 auto', padding: '22px 28px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Isotipo size={32} trazo={5} contorno="#FFFFFF" acento="#60A5FA" />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 0.85, color: '#FFFFFF' }}>Butaca</span>
          <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: '#9FC0FF', lineHeight: 1 }}>EN LÍNEA</span>
        </span>
        <span style={{ marginLeft: 6, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(159,192,255,.35)', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: '#C7D9FB' }}>PLATAFORMA</span>
      </header>

      <main style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px 48px' }}>
        <div style={{ width: '100%', maxWidth: 460, background: '#FFFFFF', borderRadius: 26, boxShadow: '0 40px 100px rgba(2,10,32,.55)', overflow: 'hidden' }}>
          {paso === 'credenciales' && (
            <form onSubmit={enviar} noValidate style={{ padding: '36px 36px 30px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05 }}>Plataforma</h1>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: '#475569' }}>Acceso restringido al operador de Butaca En Línea.</p>
              </div>
              <label style={etiqueta}>
                <span style={rotulo}>Usuario</span>
                <input className={css.campo} value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="admin" autoComplete="username" autoCapitalize="none" autoFocus />
              </label>
              <label style={etiqueta}>
                <span style={rotulo}>Contraseña</span>
                <span style={{ position: 'relative', display: 'flex' }}>
                  <input className={css.campo} style={{ paddingRight: 54 }} type={ver ? 'text' : 'password'} value={clave} onChange={(e) => setClave(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                  <button
                    type="button"
                    className={css.ojo}
                    onClick={() => setVer((v) => !v)}
                    aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={ver}
                    style={{ position: 'absolute', right: 6, top: 6, width: 42, height: 42, border: 'none', background: 'transparent', borderRadius: 10, cursor: 'pointer', color: ver ? '#2563EB' : '#7C8AA5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                      {ver && <path d="M4 20 20 4" strokeLinecap="round" />}
                    </svg>
                  </button>
                </span>
              </label>
              {alerta}
              <button type="submit" className={css.cta} disabled={!ok || cargando} style={cta(ok)}>{cargando ? 'Verificando…' : 'Entrar'}</button>
            </form>
          )}

          {paso === 'codigo' && (
            <form onSubmit={enviar} noValidate style={{ padding: '36px 36px 30px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <button
                type="button"
                onClick={() => { setPaso('credenciales'); setCodigo(''); setError(null); }}
                style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: '#2563EB', cursor: 'pointer' }}
              >
                ← Cambiar usuario
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05 }}>Confirma que eres tú</h1>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: '#475569', textWrap: 'pretty' }}>Ingresa el código de 6 dígitos de tu app de autenticación.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, background: '#F4F7FC' }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: '#0B2A6B', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flex: 'none' }}>{u.slice(0, 2).toUpperCase()}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u}</span>
                  <span style={{ fontSize: 13, color: '#7C8AA5' }}>Operador · Butaca En Línea</span>
                </span>
              </div>
              <label style={etiqueta}>
                <span style={rotulo}>Código</span>
                <input
                  className={css.campo}
                  style={{ height: 64, fontSize: 30, fontWeight: 700, letterSpacing: '0.5em', textAlign: 'center', paddingLeft: '0.5em' }}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  autoFocus
                />
              </label>
              {alerta}
              <button type="submit" className={css.cta} disabled={!ok || cargando} style={cta(ok)}>{cargando ? 'Verificando…' : 'Entrar'}</button>
            </form>
          )}

          {paso === 'listo' && (
            <div style={{ padding: '48px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <span style={{ width: 64, height: 64, borderRadius: '50%', background: '#E7F6EC', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700 }}>✓</span>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>Bienvenido, {u}</h1>
              <p style={{ margin: 0, fontSize: 15, color: '#475569' }}>Entrando al panel del operador…</p>
              <button type="button" onClick={() => navigate('/admin', { replace: true })} style={{ marginTop: 8, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#2563EB', cursor: 'pointer' }}>
                Ir al panel ahora
              </button>
            </div>
          )}

          <div style={{ borderTop: '1px solid #EEF2F9', background: '#F9FBFE', padding: '16px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13, color: '#7C8AA5' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22A35A' }} />Conexión segura</span>
            <a className={css.enlace} href={SOPORTE} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>Soporte</a>
          </div>
        </div>
      </main>
      <footer style={{ position: 'relative', padding: '0 28px 24px', textAlign: 'center', fontSize: 13, color: '#7C8AA5' }}>Los intentos de acceso quedan registrados.</footer>
    </div>
  );
}
