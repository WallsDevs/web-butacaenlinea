import { useSearchParams } from 'react-router';
import { useModulos } from '../../lib/useModulos';
import { EncabezadoPantalla } from '../../components/ui/EncabezadoPantalla';
import FlotaLista from '../flota/FlotaLista';
import FlotaEnVivo from './FlotaEnVivo';
import MantenimientoFlota from '../flota/mant/MantenimientoFlota';
import styles from '../flota/flota.module.css';

type Pestana = 'vivo' | 'unidades' | 'mantenimiento';

/**
 * Toda la flota en una sola pantalla: el mapa en vivo primero (es lo que el
 * dueño mira a diario), las unidades (ficha de cada una) y el mantenimiento
 * de toda la flota (tablero e inventario de repuestos). Qué pestañas hay
 * depende del contrato: sin Flota no hay unidades que editar; sin
 * Mantenimiento ni Urbano no hay GPS; sin Mantenimiento no hay tablero.
 */
export default function EmpresaFlota() {
  const { tiene } = useModulos();
  const [params, setParams] = useSearchParams();
  const conUnidades = tiene('flota');
  const conVivo = tiene('mantenimiento') || tiene('urbano');
  const conMant = tiene('mantenimiento');
  const pedida = params.get('tab');
  const activa: Pestana =
    conMant && pedida === 'mantenimiento' ? 'mantenimiento' : !conVivo || (conUnidades && pedida === 'unidades') ? 'unidades' : 'vivo';
  const items = [
    ...(conVivo ? [{ id: 'vivo' as const, label: 'En vivo' }] : []),
    ...(conUnidades ? [{ id: 'unidades' as const, label: 'Unidades' }] : []),
    ...(conMant ? [{ id: 'mantenimiento' as const, label: 'Mantenimiento' }] : []),
  ];
  const descripcion = {
    vivo: 'Dónde está cada unidad ahora mismo; la app del conductor reporta mientras tiene un turno abierto.',
    unidades: 'Las unidades de la línea: ficha, asientos, documentos y mantenimiento.',
    mantenimiento: 'Qué atender en toda la flota, quién está en el taller y el almacén de repuestos.',
  }[activa];

  return (
    <>
      <div className={styles.contenido} style={{ paddingBottom: 0 }}>
        <EncabezadoPantalla<Pestana>
          titulo="Flota"
          descripcion={descripcion}
          pestanas={items.length > 1 ? { items, value: activa, onChange: (id) => setParams(id === 'vivo' ? {} : { tab: id }, { replace: true }) } : undefined}
        />
      </div>
      {activa === 'vivo' ? <FlotaEnVivo /> : activa === 'mantenimiento' ? <MantenimientoFlota /> : <FlotaLista />}
    </>
  );
}
