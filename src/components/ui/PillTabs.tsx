import styles from './ui.module.css';

export interface PillItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
}

/**
 * Grupo de pastillas del handoff.
 * `contained`: dentro de contenedor #F1F5FC (nav de módulos, pisos POS, estado ERP).
 * `loose`: pastillas sueltas redondas (sub-barra M1, orden de salidas).
 */
export function PillTabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'contained',
}: {
  items: PillItem<T>[];
  value: T;
  onChange: (id: T) => void;
  variant?: 'contained' | 'loose';
}) {
  if (variant === 'loose') {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            className={`${styles.pill} ${styles.pillLoose} ${value === it.id ? styles.pillLooseActive : ''}`}
          >
            {it.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className={styles.pillGroup}>
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={`${styles.pill} ${value === it.id ? styles.pillActive : ''}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
