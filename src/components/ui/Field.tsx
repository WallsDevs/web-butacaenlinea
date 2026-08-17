import { useState } from 'react';
import styles from './ui.module.css';

const OjoAbierto = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const OjoTachado = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export function Field({
  label,
  size = 'web',
  ...inputProps
}: { label: string; size?: 'web' | 'pos' } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size'
>) {
  // Toda contraseña trae su ojo para verla — en todos los formularios
  const esClave = inputProps.type === 'password';
  const [visible, setVisible] = useState(false);
  const clase = `${styles.fieldInput} ${size === 'pos' ? styles.fieldInputPos : ''} ${inputProps.className ?? ''}`;

  if (!esClave) {
    return (
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{label}</span>
        <input {...inputProps} className={clase} />
      </label>
    );
  }

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span style={{ position: 'relative', display: 'block' }}>
        <input
          {...inputProps}
          type={visible ? 'text' : 'password'}
          className={clase}
          style={{ width: '100%', paddingRight: 44, ...inputProps.style }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={visible ? 'Ocultar contraseña' : 'Ver contraseña'}
          onClick={() => setVisible((v) => !v)}
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--text-faint)',
            background: 'transparent',
            border: 0,
            outline: 'none',
            padding: 4,
            cursor: 'pointer',
          }}
        >
          {visible ? OjoTachado : OjoAbierto}
        </button>
      </span>
    </label>
  );
}
