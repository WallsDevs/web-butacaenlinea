import { useAuth } from '../../stores/auth';

/** Marco de la cuenta del cliente: el título. Las secciones viven en la barra del rol y el cierre de sesión en Perfil. */
export function CuentaLayout({ children }: { activa?: 'boletos' | 'metodos'; children: React.ReactNode }) {
  const usuario = useAuth((s) => s.usuario);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 16px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Mi cuenta</h2>
          <div style={{ fontSize: 14, color: 'var(--text-soft)', marginTop: 2 }}>
            {usuario?.nombreCorto ?? usuario?.username} · {usuario?.email}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 18 }}>{children}</div>
    </div>
  );
}
