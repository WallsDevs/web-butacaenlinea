import type { ReactNode } from 'react';
import styles from './cuenta.module.css';

/**
 * Marco de las páginas del pasajero: centrado, con el mismo encabezado en
 * todas, y que en el teléfono deja sitio para la barra de abajo. Los datos y
 * el cierre de sesión viven en Perfil.
 */
export function PaginaPasajero({
  titulo,
  sub,
  acciones,
  angosta = false,
  children,
}: {
  titulo: ReactNode;
  sub?: ReactNode;
  acciones?: ReactNode;
  angosta?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`${styles.pagina} ${angosta ? styles.angosta : ''}`}>
      <header className={styles.cabecera}>
        <div style={{ minWidth: 0 }}>
          <h1 className={styles.titulo}>{titulo}</h1>
          {sub && <div className={styles.sub}>{sub}</div>}
        </div>
        {acciones && <div className={styles.acciones}>{acciones}</div>}
      </header>
      {children}
    </div>
  );
}

const TITULO: Record<'boletos' | 'metodos', { titulo: string; sub: string }> = {
  boletos: { titulo: 'Mis boletos', sub: 'Los pasajes que compraste con esta cuenta.' },
  metodos: { titulo: 'Métodos de pago', sub: 'Tu Pago Móvil o Zelle guardados para pagar más rápido.' },
};

/** Compatibilidad: las páginas viejas siguen usando este nombre. */
export function CuentaLayout({ activa = 'boletos', children }: { activa?: 'boletos' | 'metodos'; children: ReactNode }) {
  const t = TITULO[activa];
  return (
    <PaginaPasajero titulo={t.titulo} sub={t.sub} angosta>
      {children}
    </PaginaPasajero>
  );
}
