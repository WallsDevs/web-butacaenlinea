/**
 * El cartel del parabrisas de la buseta («5ta Avenida · Centro · Terminal ·
 * Directo»): etiquetas cortas en mayúsculas sobre fondo blanco, como las que
 * cualquiera reconoce en la calle. Se usa igual en la lista de busetas, el
 * mapa, la pantalla de pago y el panel de la línea.
 */
export function Letrero({ letreros, tamano = 'md' }: { letreros?: string[] | null; tamano?: 'sm' | 'md' }) {
  if (!letreros?.length) return null;
  const chico = tamano === 'sm';
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: chico ? 4 : 6 }} aria-label={`Letrero: ${letreros.join(', ')}`}>
      {letreros.map((l) => (
        <span
          key={l}
          style={{
            display: 'inline-block',
            padding: chico ? '2px 6px' : '3px 8px',
            borderRadius: 4,
            background: '#FFFFFF',
            border: '1.5px solid var(--navy)',
            color: 'var(--navy)',
            fontSize: chico ? 10 : 11,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
          }}
        >
          {l}
        </span>
      ))}
    </span>
  );
}
