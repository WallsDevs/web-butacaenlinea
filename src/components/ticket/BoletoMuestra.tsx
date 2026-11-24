import type { SalidaDto } from '../../lib/api/types';
import { fechaConAnio, hora } from '../../lib/time';
import { TicketCard } from './TicketCard';

export function BoletoMuestra({ salida }: { salida?: SalidaDto }) {
  return (
    <TicketCard variant="hero" data={{
      tipo: salida ? 'Nacional' : 'Urbano',
      folio: 'BT-894562',
      origen: salida?.ruta?.origen ?? 'San Cristóbal',
      destino: salida?.ruta?.destino ?? 'Caracas',
      salidaHora: salida ? hora(salida.fechaHoraSalida) : '20:30',
      llegadaHora: salida ? hora(salida.fechaHoraLlegada) : '06:15',
      fecha: salida ? fechaConAnio(salida.fechaHoraSalida) : 'Vie 21 ago 2026',
      puestos: '04',
      piso: '1 VIP',
      lineaNombre: salida ? salida.linea?.nombre : 'AndesBus',
      unidad: salida ? salida.unidad?.numero : 'A-458',
    }}/>
  );
}
