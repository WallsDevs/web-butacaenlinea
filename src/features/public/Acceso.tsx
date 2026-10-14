import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { login, getMe, registrarCliente } from '../../lib/api/endpoints';
import { useAuth } from '../../stores/auth';
import { Isotipo } from '../../components/brand/LogoMark';
import { useSeo } from '../../lib/seo';
import css from './acceso.module.css';

const HOME_POR_ROL: Record<string, string> = { cajero: '/pos', empresa: '/empresa', chofer: '/chofer', colector: '/colector', cliente: '/cuenta' };

/** `next` solo vale si el rol puede entrar ahí; si no, cada rol va a su propio panel. */
function destinoTras(rol: string, next: string | null): string {
  const puede = (ruta: string) =>
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
  return next && next.startsWith('/') && !next.startsWith('//') && puede(next) ? next : HOME_POR_ROL[rol] ?? '/';
}

const PUNTOS = [
  { txt: 'Tus boletos guardados, aunque no tengas señal', lleno: false },
  { txt: 'Kilómetros acumulados en todas las líneas', lleno: false },
  { txt: 'Pasajeros y pagos guardados para comprar en un toque', lleno: true },
];

/**
 * Acceso (diseño «Ingresar»): una sola pantalla con dos pestañas. Cada pestaña
 * conserva su ruta (/ingresar y /registro) para que los enlaces y el
 * `?next=` sigan funcionando.
 */
export default function Acceso({ modo }: { modo: 'login' | 'registro' }) {
  const reg = modo === 'registro';
  useSeo(reg ? 'Crear cuenta — Butaca En Línea' : 'Ingresar — Butaca En Línea', undefined, { noindex: true });
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const iniciarSesion = useAuth((s) => s.iniciarSesion);
  const cerrarSesion = useAuth((s) => s.cerrarSesion);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const query = params.toString() ? `?${params}` : '';
  const ir = (ruta: string) => { setError(null); navigate(`${ruta}${query}`); };

  const ok = reg ? nombre.trim().length > 2 && /\S+@\S+\.\S+/.test(correo) && clave.length >= 6 : correo.trim().length > 2 && clave.length > 0;
  const score = Math.min(4, Number(clave.length >= 6) + Number(clave.length >= 10) + Number(/[0-9]/.test(clave)) + Number(/[A-Z!@#$%^&*.]/.test(clave)));
  const colorFuerza = ['#E6EBF4', '#F59E0B', '#F59E0B', '#22A35A', '#22A35A'][score];

  const entrar = async () => {
    const r = await login(correo.trim(), clave);
    iniciarSesion(r.jwt, r.user);
    const yo = await getMe();
    // El operador de la plataforma NO entra por aquí (solo por su acceso
    // discreto); mismo mensaje genérico para no delatar que la cuenta existe.
    if (yo.role?.type === 'superadmin') {
      cerrarSesion();
      throw Object.assign(new Error('superadmin'), { code: 'credenciales' });
    }
    iniciarSesion(r.jwt, yo);
    navigate(destinoTras(yo.role?.type ?? '', params.get('next')));
  };

  const registrar = async () => {
    const email = correo.trim();
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '') || `cliente${Date.now()}`;
    const r = await registrarCliente({ username, email, password: clave });
    iniciarSesion(r.jwt, r.user);
    const yo = await getMe();
    iniciarSesion(r.jwt, { ...yo, nombreCorto: yo.nombreCorto ?? nombre.trim() });
    navigate(destinoTras(yo.role?.type ?? 'cliente', params.get('next')));
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok || cargando) return;
    setCargando(true);
    setError(null);
    try {
      await (reg ? registrar() : entrar());
    } catch (err) {
      const { code = '', details } = err as { code?: string; details?: { reintentarEnSeg?: number } };
      if (code === 'demasiados_intentos') setError(`Demasiados intentos. Espera ${Math.ceil((details?.reintentarEnSeg ?? 900) / 60)} minutos.`);
      else if (reg) setError(/already taken/i.test(code) ? 'Ese correo ya tiene una cuenta. Ingresa con ella.' : 'No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.');
      else setError('Usuario o contraseña incorrectos.');
    } finally {
      setCargando(false);
    }
  };

  const tab = (on: boolean) => ({
    height: 44, border: 'none', borderRadius: 11, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    background: on ? '#FFFFFF' : 'transparent', color: on ? '#0F172A' : '#7C8AA5', boxShadow: on ? '0 2px 8px rgba(11,42,107,.10)' : 'none',
  }) as const;
  const etiqueta = { display: 'flex', flexDirection: 'column', gap: 8 } as const;
  const rotulo = { fontSize: 14, fontWeight: 500, color: '#475569' } as const;

  return (
    <div className={css.pagina}>
      <aside
        className={css.aside}
        style={{ position: 'relative', flex: '1 1 440px', minHeight: 360, background: 'linear-gradient(165deg,#0B2A6B 0%,#123B8F 55%,#1D4ED8 100%)', color: '#FFFFFF', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '28px 48px 40px', boxSizing: 'border-box', gap: 40 }}
      >
        <div style={{ position: 'absolute', right: -160, top: -160, width: 520, height: 520, borderRadius: '50%', background: 'rgba(96,165,250,.14)' }} />
        <div style={{ position: 'absolute', left: -100, bottom: -180, width: 380, height: 380, borderRadius: '50%', background: 'rgba(96,165,250,.10)' }} />

        <a href="/" aria-label="Butaca En Línea" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'flex-start' }}>
          <Isotipo size={34} trazo={5} contorno="#FFFFFF" acento="#60A5FA" />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 0.85, color: '#FFFFFF' }}>Butaca</span>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', color: '#9FC0FF', lineHeight: 1 }}>EN LÍNEA</span>
          </span>
        </a>

        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32, maxWidth: 460 }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(34px,4vw,52px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, textWrap: 'balance' }}>
            Tus boletos y kilómetros, siempre contigo
          </h1>

          <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: 20, boxShadow: '0 24px 60px rgba(4,16,48,.35)', overflow: 'hidden', maxWidth: 340, transform: 'rotate(-2deg)' }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #EEF2F9' }}>
              <Isotipo size={18} trazo={5} fondo="claro" />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Boleto electrónico</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: '#E7F6EC', color: '#166534' }}>Válido</span>
            </div>
            <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>20:30</span><span style={{ fontSize: 12, color: '#475569' }}>San Cristóbal</span></span>
              <span style={{ display: 'flex', alignItems: 'center', paddingBottom: 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #2563EB', boxSizing: 'border-box' }} />
                <span style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg,#9FC0FF 0 5px,transparent 5px 10px)' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB' }} />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}><span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>06:15</span><span style={{ fontSize: 12, color: '#475569' }}>Caracas</span></span>
            </div>
            <div style={{ padding: '10px 16px 14px', borderTop: '2px dashed #DCE3EE', display: 'flex', gap: 14, fontSize: 12, color: '#7C8AA5' }}>
              <span>Puesto <strong style={{ color: '#2563EB' }}>04</strong></span>
              <span>Vie 21 ago</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#2563EB' }}>+820 km</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {PUNTOS.map((p) => (
              <div key={p.txt} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, color: '#C7D9FB' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', boxSizing: 'border-box', ...(p.lleno ? { background: '#60A5FA' } : { border: '2.5px solid #60A5FA' }) }} />
                {p.txt}
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className={css.main} style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column', padding: '28px 40px 40px', boxSizing: 'border-box', background: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <a className={css.enlace} href="/" style={{ fontSize: 15, fontWeight: 600 }} onClick={(e) => { e.preventDefault(); navigate('/'); }}>← Volver al inicio</a>
          <a className={css.marcaMovil} href="/" aria-label="Butaca En Línea" style={{ marginLeft: 'auto', alignItems: 'center', gap: 8 }}>
            <Isotipo size={28} trazo={5} fondo="claro" />
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.04em', color: '#0F172A' }}>Butaca</span>
          </a>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
          <form onSubmit={enviar} noValidate style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div role="tablist" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 4, borderRadius: 14, background: '#F4F7FC', border: '1px solid #E6EBF4' }}>
              <button type="button" role="tab" aria-selected={!reg} onClick={() => ir('/ingresar')} style={tab(!reg)}>Ingresar</button>
              <button type="button" role="tab" aria-selected={reg} onClick={() => ir('/registro')} style={tab(reg)}>Crear cuenta</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 36, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05 }}>{reg ? 'Crea tu cuenta' : 'Hola de nuevo'}</h2>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: '#475569', textWrap: 'pretty' }}>
                {reg
                  ? 'Guarda tus boletos y métodos de pago para comprar más rápido. Empiezas a sumar kilómetros desde el primer viaje.'
                  : 'Entra para ver tus boletos, tus kilómetros y comprar más rápido.'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {reg && (
                <label style={etiqueta}>
                  <span style={rotulo}>Nombre y apellido</span>
                  <input className={css.campo} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Yorman Peña" autoComplete="name" autoFocus />
                </label>
              )}
              <label style={etiqueta}>
                <span style={rotulo}>{reg ? 'Correo' : 'Usuario o correo'}</span>
                <input
                  className={css.campo}
                  type={reg ? 'email' : 'text'}
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="tucorreo@gmail.com"
                  autoComplete={reg ? 'email' : 'username'}
                  autoCapitalize="none"
                  autoFocus={!reg}
                />
              </label>
              <label style={etiqueta}>
                <span style={rotulo}>{reg ? 'Contraseña (mínimo 6 caracteres)' : 'Contraseña'}</span>
                <span style={{ position: 'relative', display: 'flex' }}>
                  <input
                    className={css.campo}
                    style={{ paddingRight: 54 }}
                    type={ver ? 'text' : 'password'}
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={reg ? 'new-password' : 'current-password'}
                  />
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
              {reg && (
                <div style={{ display: 'flex', gap: 6 }} aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => <span key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: i < score ? colorFuerza : '#E6EBF4' }} />)}
                </div>
              )}
            </div>

            {error && <div role="alert" style={{ fontSize: 14, color: '#8F1D1D', background: '#FDE7E7', borderRadius: 12, padding: '12px 14px', marginTop: -12 }}>{error}</div>}

            <button
              type="submit"
              className={css.cta}
              disabled={!ok || cargando}
              style={{ height: 56, border: 'none', borderRadius: 14, fontFamily: 'inherit', fontSize: 17, fontWeight: 700, background: ok ? '#2563EB' : '#B9CDF8', color: '#FFFFFF', cursor: ok && !cargando ? 'pointer' : 'default', boxShadow: ok ? '0 10px 24px rgba(37,99,235,.28)' : 'none' }}
            >
              {cargando ? (reg ? 'Creando cuenta…' : 'Ingresando…') : reg ? 'Crear cuenta' : 'Ingresar'}
            </button>

            <div style={{ fontSize: 15, color: '#475569', textAlign: 'center' }}>
              {reg ? '¿Ya tienes cuenta?' : '¿Primera vez?'}{' '}
              <a className={css.enlace} href={reg ? '/ingresar' : '/registro'} onClick={(e) => { e.preventDefault(); ir(reg ? '/ingresar' : '/registro'); }} style={{ fontWeight: 700 }}>
                {reg ? 'Ingresar' : 'Crea tu cuenta de pasajero'}
              </a>
            </div>

          </form>
        </div>
      </main>
    </div>
  );
}
