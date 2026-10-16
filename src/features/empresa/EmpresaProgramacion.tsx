import { useSearchParams } from 'react-router';
import { useModulos } from '../../lib/useModulos';
import { EncabezadoPantalla } from '../../components/ui/EncabezadoPantalla';
import EmpresaSalidas from './EmpresaSalidas';
import EmpresaRutas from './EmpresaRutas';
import styles from '../flota/flota.module.css';

type Pestana = 'salidas' | 'rutas';

/** Salidas y rutas en un solo lugar: se programa y se edita sin cambiar de sección. */
export default function EmpresaProgramacion() {
  const { tiene } = useModulos();
  const [params, setParams] = useSearchParams();
  // Una línea solo urbana no tiene salidas: solo ve las rutas
  const conSalidas = tiene('boleteria');
  const activa: Pestana = !conSalidas || params.get('tab') === 'rutas' ? 'rutas' : 'salidas';

  return (
    <>
      <div className={styles.contenido} style={{ paddingBottom: 0 }}>
        <EncabezadoPantalla<Pestana>
          titulo="Salidas y rutas"
          descripcion={conSalidas ? 'Programa las salidas que vende la taquilla y la web, y mantén las rutas con sus tarifas por clase.' : 'Las rutas urbanas que cobran por QR, con su tarifa y su recorrido.'}
          pestanas={conSalidas ? { items: [{ id: 'salidas', label: 'Salidas' }, { id: 'rutas', label: 'Rutas' }], value: activa, onChange: (id) => setParams(id === 'rutas' ? { tab: 'rutas' } : {}, { replace: true }) } : undefined}
        />
      </div>
      {activa === 'salidas' ? <EmpresaSalidas /> : <EmpresaRutas />}
    </>
  );
}
