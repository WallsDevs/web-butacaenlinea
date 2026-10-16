import { useSearchParams } from 'react-router';
import { useModulos } from '../../lib/useModulos';
import { PillTabs } from '../../components/ui/PillTabs';
import FlotaLista from '../flota/FlotaLista';
import FlotaEnVivo from './FlotaEnVivo';
import styles from '../flota/flota.module.css';

type Pestana = 'vivo' | 'unidades';

/**
 * Toda la flota en una sola pantalla: el mapa en vivo primero (es lo que el
 * dueño mira a diario) y las unidades (ficha, mantenimiento) como segunda
 * pestaña. Qué pestañas hay depende del contrato: sin Flota no hay unidades
 * que editar; sin Mantenimiento ni Urbano no hay GPS.
 */
export default function EmpresaFlota() {
  const { tiene } = useModulos();
  const [params, setParams] = useSearchParams();
  const conUnidades = tiene('flota');
  const conVivo = tiene('mantenimiento') || tiene('urbano');
  const activa: Pestana = !conVivo || (conUnidades && params.get('tab') === 'unidades') ? 'unidades' : 'vivo';

  return (
    <>
      {conUnidades && conVivo && (
        <div className={styles.contenido} style={{ paddingBottom: 0 }}>
          <PillTabs
            variant="loose"
            items={[
              { id: 'vivo', label: 'En vivo' },
              { id: 'unidades', label: 'Unidades' },
            ]}
            value={activa}
            onChange={(id) => setParams(id === 'unidades' ? { tab: 'unidades' } : {}, { replace: true })}
          />
        </div>
      )}
      {activa === 'vivo' ? <FlotaEnVivo /> : <FlotaLista />}
    </>
  );
}
