import styles from './ui.module.css';

export type TonoChip = 'ok' | 'warn' | 'bad' | 'neutral' | 'info';

const clasePorTono: Record<TonoChip, string> = {
  ok: styles.chipOk,
  warn: styles.chipWarn,
  bad: styles.chipBad,
  neutral: styles.chipNeutral,
  info: styles.chipInfo,
};

export function StatusChip({
  tono,
  children,
  size = 'md',
  dot = false,
}: {
  tono: TonoChip;
  children: React.ReactNode;
  size?: 'sm' | 'md';
  dot?: boolean;
}) {
  return (
    <span className={`${styles.chip} ${clasePorTono[tono]} ${size === 'sm' ? styles.chipSm : ''}`}>
      {dot && <span className={styles.chipDot} />}
      {children}
    </span>
  );
}
