import { useNavigate } from 'react-router';
import { PillTabs } from '../../components/ui/PillTabs';
import { useAuth } from '../../stores/auth';

/** Marco de la cuenta del cliente: título + pestañas Mis boletos / Métodos de pago. */
export function CuentaLayout({
  activa,
  children,
}: {
  activa: 'boletos' | 'metodos';
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const usuario = useAuth((s) => s.usuario);
  const cerrarSesion = useAuth((s) => s.cerrarSesion);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 16px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Mi cuenta</h2>
          <div style={{ fontSize: 14, color: 'var(--text-soft)', marginTop: 2 }}>
            {usuario?.nombreCorto ?? usuario?.username} · {usuario?.email}
          </div>
        </div>
        <button
          style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: 'var(--text-soft)' }}
          onClick={() => {
            cerrarSesion();
            navigate('/');
          }}
        >
          Cerrar sesión
        </button>
      </div>
      <div style={{ margin: '18px 0' }}>
        <PillTabs
          items={[
            { id: 'boletos', label: 'Mis boletos' },
            { id: 'metodos', label: 'Métodos de pago' },
          ]}
          value={activa}
          onChange={(id) => navigate(id === 'boletos' ? '/cuenta' : '/cuenta/metodos')}
        />
      </div>
      {children}
    </div>
  );
}
