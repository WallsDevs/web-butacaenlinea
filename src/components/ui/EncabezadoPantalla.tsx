import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { PillTabs } from './PillTabs';
import { useAuth } from '../../stores/auth';
import { seccionLateralDe } from '../../app/navegacion';
import styles from './EncabezadoPantalla.module.css';

/**
 * La cabecera de cada pantalla del panel: la sección del menú como
 * antetítulo, el título grande, una línea que dice para qué sirve, las
 * acciones o filtros a la derecha y, si la pantalla tiene vistas, sus
 * pestañas debajo. Con esto las pantallas no necesitan botones sueltos.
 */
export function EncabezadoPantalla<T extends string = string>({
  titulo,
  descripcion,
  seccion,
  chip,
  acciones,
  pestanas,
}: {
  titulo: ReactNode;
  descripcion?: ReactNode;
  /** Antetítulo; si no se pasa, sale la sección del menú lateral a la que pertenece la ruta. */
  seccion?: string | null;
  /** Un StatusChip u otro distintivo pegado al título. */
  chip?: ReactNode;
  acciones?: ReactNode;
  pestanas?: { items: { id: T; label: string }[]; value: T; onChange: (id: T) => void };
}) {
  const { pathname } = useLocation();
  const rol = useAuth((s) => s.usuario?.role?.type);
  const antetitulo = seccion === undefined ? seccionLateralDe(rol, pathname) : seccion;
  return (
    <header className={styles.encabezado}>
      <div className={styles.fila}>
        <div className={styles.texto}>
          {antetitulo && <div className={styles.seccion}>{antetitulo}</div>}
          <h1 className={styles.titulo}>
            {titulo}
            {chip}
          </h1>
          {descripcion && <p className={styles.descripcion}>{descripcion}</p>}
        </div>
        {acciones && <div className={styles.acciones}>{acciones}</div>}
      </div>
      {pestanas && pestanas.items.length > 1 && (
        <div className={styles.pestanas}>
          <PillTabs<T> items={pestanas.items} value={pestanas.value} onChange={pestanas.onChange} />
        </div>
      )}
    </header>
  );
}
