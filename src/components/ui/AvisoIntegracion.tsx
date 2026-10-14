/** Lo que ve la empresa cuando su propio sistema de boletería carga el catálogo por la API. */
export function AvisoIntegracion({ que }: { que: string }) {
  return (
    <div style={{ fontSize: 13, color: 'var(--blue-700)', background: 'var(--tint-50)', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
      Tus {que} las carga tu sistema de boletería por la API de Butaca, así que aquí se ven pero no se editan. Si algo no cuadra, corrígelo en tu sistema.
    </div>
  );
}
