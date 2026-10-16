/** Marco de las secciones del pasajero: el título de la sección. Los datos y el cierre de sesión viven en Perfil. */
const TITULO: Record<'boletos' | 'metodos', { titulo: string; sub: string }> = {
  boletos: { titulo: 'Mis boletos', sub: 'Los pasajes que compraste con esta cuenta.' },
  metodos: { titulo: 'Métodos de pago', sub: 'Tu Pago Móvil o Zelle guardados para precargar el checkout.' },
};

export function CuentaLayout({ activa = 'boletos', children }: { activa?: 'boletos' | 'metodos'; children: React.ReactNode }) {
  const t = TITULO[activa];
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 16px 64px' }}>
      <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>{t.titulo}</h2>
      <div style={{ fontSize: 14, color: 'var(--text-soft)', marginTop: 2 }}>{t.sub}</div>
      <div style={{ marginTop: 18 }}>{children}</div>
    </div>
  );
}
