import { useState } from 'react';
import { useNavigate } from 'react-router';
import { registrarCliente, getMe } from '../../lib/api/endpoints';
import { useAuth } from '../../stores/auth';
import { Field } from '../../components/ui/Field';
import ui from '../../components/ui/ui.module.css';

/** Registro de clientes (compradores). El rol `cliente` se asigna solo. */
export default function Registro() {
  const navigate = useNavigate();
  const iniciarSesion = useAuth((s) => s.iniciarSesion);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const registrar = async () => {
    setCargando(true);
    setError(null);
    try {
      const username = email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '') || `cliente${Date.now()}`;
      const r = await registrarCliente({ username, email, password });
      iniciarSesion(r.jwt, r.user);
      const yo = await getMe();
      iniciarSesion(r.jwt, { ...yo, nombreCorto: yo.nombreCorto ?? nombre });
      navigate('/cuenta');
    } catch (e) {
      setError('No se pudo crear la cuenta. ¿Ya existe ese correo?');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: '0 auto', padding: '40px 16px 56px' }}>
      <button className={ui.btnGhost} onClick={() => navigate('/')} style={{ marginBottom: 14 }}>
        ← Volver al inicio
      </button>
      <div className={ui.card} style={{ padding: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Crea tu cuenta</h2>
        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>
          Guarda tus boletos y tus métodos de pago para comprar más rápido.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
          <Field label="Nombre y apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          <Field label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field
            label="Contraseña (mínimo 6 caracteres)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && registrar()}
          />
          {error && <div style={{ fontSize: 13, color: 'var(--bad-text)' }}>{error}</div>}
          <button
            className={`${ui.btnPrimary} ${ui.btnPrimaryLg}`}
            disabled={cargando || !email.includes('@') || password.length < 6}
            onClick={registrar}
          >
            {cargando ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
          <div style={{ fontSize: 13, color: 'var(--text-soft)', textAlign: 'center' }}>
            ¿Ya tienes cuenta? <a href="/ingresar">Ingresar</a>
          </div>
        </div>
      </div>
    </div>
  );
}
