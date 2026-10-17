import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useModulos } from '../../lib/useModulos';
import { EncabezadoPantalla } from '../../components/ui/EncabezadoPantalla';
import EmpresaSalidas from './EmpresaSalidas';
import EmpresaRutas from './EmpresaRutas';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

type Pestana = 'salidas' | 'rutas';

/** Salidas y rutas en un solo lugar: se programa y se edita sin cambiar de sección. */
export default function EmpresaProgramacion() {
  const { tiene } = useModulos();
  const [params, setParams] = useSearchParams();
  // Una línea solo urbana no tiene salidas: solo ve las rutas
  const conSalidas = tiene('boleteria');
  const activa: Pestana = !conSalidas || params.get('tab') === 'rutas' ? 'rutas' : 'salidas';
  // Cada clic en «Nueva ruta» (cabecera) abre el modal de Rutas; el contador es la señal
  const [nuevaRuta, setNuevaRuta] = useState(0);

  return (
    <>
      <div className={styles.contenido} style={{ paddingBottom: 0 }}>
        <EncabezadoPantalla<Pestana>
          titulo="Salidas y rutas"
          descripcion={conSalidas ? 'Programa las salidas que vende la taquilla y la web, y mantén tus rutas: de viaje entre ciudades y urbanas por QR.' : 'Las rutas urbanas que cobran por QR, con su tarifa y su recorrido.'}
          pestanas={conSalidas ? { items: [{ id: 'salidas', label: 'Salidas' }, { id: 'rutas', label: 'Rutas' }], value: activa, onChange: (id) => setParams(id === 'rutas' ? { tab: 'rutas' } : {}, { replace: true }) } : undefined}
          acciones={
            activa === 'rutas' ? (
              <button className={ui.btnPrimary} style={{ fontSize: 14, padding: '12px 20px' }} onClick={() => setNuevaRuta((n) => n + 1)}>
                + Nueva ruta
              </button>
            ) : undefined
          }
        />
      </div>
      {activa === 'salidas' ? <EmpresaSalidas /> : <EmpresaRutas abrirNueva={nuevaRuta} />}
    </>
  );
}
