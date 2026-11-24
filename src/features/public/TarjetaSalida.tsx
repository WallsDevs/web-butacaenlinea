import { Money } from '../../components/ui/Money';
import type { SalidaDto } from '../../lib/api/types';
import { duracion, fechaCorta, hora } from '../../lib/time';
import css from './TarjetaSalida.module.css';

interface Props {
  salida: SalidaDto;
  libres?: number;
  abierta?: boolean;
  mostrarFecha?: boolean;
  alElegir: () => void;
}

export function TarjetaSalida({ salida, libres, abierta, mostrarFecha, alElegir }: Props) {
  const { ruta, unidad, linea } = salida;
  const precios = Object.values(salida.preciosUsd ?? {}).filter(Number.isFinite);
  const catalogo = abierta === undefined;
  const pisos = unidad?.configuracionAsientos?.pisos ?? [];
  const clases = [...new Set(pisos.map(p => p.nombre).filter(Boolean))];
  const servicio = [
    unidad?.marcaModelo,
    unidad?.numero && `Unidad ${unidad.numero}`,
    catalogo && pisos.length > 0 && (pisos.length > 1 ? 'Doble piso' : 'Piso sencillo'),
    catalogo && clases.join(' + '),
  ].filter(Boolean).join(' · ');
  const estado = salida.estado === 'abordando' ? 'Abordando' : 'Programada';

  return (
    <button type="button" className={css.tarjeta} aria-expanded={abierta} onClick={alElegir}>
      <span className={css.horario}>
        <span>Salida{mostrarFecha && ` · ${fechaCorta(salida.fechaHoraSalida)}`}</span>
        <strong>{hora(salida.fechaHoraSalida)}</strong>
        <span>Llega {hora(salida.fechaHoraLlegada)}</span>
      </span>
      <span className={css.viaje}>
        <strong className={css.destino}>{ruta?.destino || 'Destino por confirmar'}</strong>
        {ruta && <span>Desde {ruta.origen}{ruta.duracionMin > 0 && ` · ${duracion(ruta.duracionMin)}`}</span>}
        {linea?.nombre && <b className={css.linea}>{linea.nombre}</b>}
        {servicio && <span>{servicio}</span>}
        {catalogo && !!unidad?.amenidades?.length && <span>{unidad.amenidades.join(' · ')}</span>}
      </span>
      <span className={css.disponibilidad}>
        <b className={css.estado} data-abordando={salida.estado === 'abordando'}>{estado}</b>
        {libres != null && <span>{libres} {libres === 1 ? 'puesto libre' : 'puestos libres'}</span>}
      </span>
      <span className={css.compra}>
        <span>
          {precios.length ? (
            <>
              <strong className={css.precio}>
                {new Set(precios).size > 1 && <small>Desde </small>}
                <Money usd={Math.min(...precios)} />
              </strong>
              <span>por pasajero</span>
            </>
          ) : <strong>Tarifa por confirmar</strong>}
        </span>
        <span className={css.accion}>
          {catalogo ? 'Escoger puesto' : abierta ? 'Ocultar puestos' : 'Ver puestos'}
          <span aria-hidden="true">{catalogo ? '→' : abierta ? '−' : '+'}</span>
        </span>
      </span>
    </button>
  );
}
