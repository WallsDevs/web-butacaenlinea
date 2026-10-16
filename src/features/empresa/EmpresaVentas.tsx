import { useSearchParams } from 'react-router';
import { useModulos } from '../../lib/useModulos';
import { PillTabs } from '../../components/ui/PillTabs';
import EmpresaBoletos from './EmpresaBoletos';
import EmpresaReportes from './EmpresaReportes';
import VerificacionPagos from '../pos/VerificacionPagos';
import styles from '../flota/flota.module.css';

type Pestana = 'boletos' | 'pagos' | 'reportes';

/**
 * Lo vendido, en una sola pantalla: los boletos (buscar y anular), los pagos
 * manuales de la venta web por confirmar contra el banco, y los reportes del
 * período con las liquidaciones de comisión. Sin Boletería solo quedan los
 * reportes (ventas urbanas por QR).
 */
export default function EmpresaVentas() {
  const { tiene } = useModulos();
  const [params, setParams] = useSearchParams();
  const pestanas: { id: Pestana; label: string }[] = [
    ...(tiene('boleteria') ? [{ id: 'boletos' as const, label: 'Boletos' }, { id: 'pagos' as const, label: 'Pagos' }] : []),
    { id: 'reportes' as const, label: 'Reportes' },
  ];
  const pedida = params.get('tab') as Pestana | null;
  const activa: Pestana = pestanas.some((p) => p.id === pedida) ? pedida! : pestanas[0].id;

  return (
    <>
      {pestanas.length > 1 && (
        <div className={styles.contenido} style={{ paddingBottom: 0 }}>
          <PillTabs<Pestana> variant="loose" items={pestanas} value={activa} onChange={(id) => setParams(id === pestanas[0].id ? {} : { tab: id }, { replace: true })} />
        </div>
      )}
      {activa === 'boletos' ? <EmpresaBoletos /> : activa === 'pagos' ? <VerificacionPagos /> : <EmpresaReportes />}
    </>
  );
}
