import { useSearchParams } from 'react-router';
import { useModulos } from '../../lib/useModulos';
import { PillTabs } from '../../components/ui/PillTabs';
import FlotaLista from '../flota/FlotaLista';
import FlotaEnVivo from './FlotaEnVivo';
import styles from '../flota/flota.module.css';

type Pestana = 'unidades' | 'vivo';

/**
 * Toda la flota en una sola pantalla: las unidades (ficha, mantenimiento) y
 * el mapa en vivo, como pestañas. Qué pestañas hay depende del contrato: sin
 * Flota no hay unidades que editar; sin Mantenimiento ni Urbano no hay GPS.
 */
export default function EmpresaFlota() {
  const { tiene } = useModulos();
  const [params, setParams] = useSearchParams();
  const conUnidades = tiene('flota');
  const conVivo = tiene('mantenimiento') || tiene('urbano');
  const activa: Pestana = !conUnidades || (conVivo && params.get('tab') === 'vivo') ? 'vivo' : 'unidades';

  return (
    <>
      {conUnidades && conVivo && (
        <div className={styles.contenido} style={{ paddingBottom: 0 }}>
          <PillTabs
            variant="loose"
            items={[
              { id: 'unidades', label: 'Unidades' },
              { id: 'vivo', label: 'En vivo' },
            ]}
            value={activa}
            onChange={(id) => setParams(id === 'vivo' ? { tab: 'vivo' } : {}, { replace: true })}
          />
        </div>
      )}
      {activa === 'vivo' ? <FlotaEnVivo /> : <FlotaLista />}
    </>
  );
}
