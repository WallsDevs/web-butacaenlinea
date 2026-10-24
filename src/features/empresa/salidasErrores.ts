import { ApiError, esSinConexion } from '../../lib/api/client';
import { fechaCorta, hora } from '../../lib/time';

type Detalles = {
  faltantes?: string[];
  afectados?: number;
  conflicto?: { fechaHoraSalida?: string; destino?: string };
  ubicacion?: string;
  llegaAlli?: string;
  origenRuta?: string;
  proximoOrigen?: string;
  proximaSalida?: string;
  destinoRuta?: string;
  capacidad?: number;
  vendidos?: number;
  unidad?: string;
  asientos?: string[];
  maximo?: number;
  fechaHoraSalida?: string;
  motivo?: string;
  detalles?: Detalles;
};

const cuando = (iso?: string) => (iso ? `el ${fechaCorta(iso)} a las ${hora(iso)}` : '');

/** Por qué no se pudo programar o cambiar una salida, dicho para la línea. */
export function explicarSalida(codigo: string, d: Detalles = {}): string {
  switch (codigo) {
    case 'tarifas_incompletas':
      return `La ruta no tiene precio para los puestos «${(d.faltantes ?? []).join(', ')}» de ese bus. Edita la ruta y ponle el precio del pasaje (vale para todos) o uno para esa clase.`;
    case 'fecha_invalida':
      return 'Esa fecha y hora ya pasaron. Programa una salida futura.';
    case 'fecha_pasada':
      return 'Con esa hora la salida quedaría en el pasado.';
    case 'tiene_boletos':
      return `Ya tiene ${d.vendidos ?? d.afectados ?? 'puestos'} ${Number(d.vendidos ?? d.afectados) === 1 ? 'puesto vendido' : 'puestos vendidos'}: cámbiala sola, avisando antes a los pasajeros.`;
    case 'estado_invalido':
      return 'Ya partió, terminó o estaba cancelada.';
    case 'unidad_ocupada':
      return `Ese bus ya tiene un viaje ${cuando(d.conflicto?.fechaHoraSalida)}${d.conflicto?.destino ? ` hacia ${d.conflicto.destino}` : ''} y estará ocupado a esa hora.`;
    case 'unidad_en_otra_ciudad':
      return `A esa hora el bus estará en ${d.ubicacion}${d.llegaAlli ? ` (llega ${cuando(d.llegaAlli)})` : ''}, así que no puede salir desde ${d.origenRuta}.`;
    case 'descuadra_itinerario':
      return `Ese viaje deja el bus en ${d.destinoRuta}, pero tiene una salida desde ${d.proximoOrigen} ${cuando(d.proximaSalida)}.`;
    case 'conductor_ocupado':
      return `Ese conductor ya tiene un viaje ${cuando(d.conflicto?.fechaHoraSalida)}.`;
    case 'unidad_fuera_de_servicio':
      return 'Ese bus está fuera de servicio.';
    case 'unidad_sin_cupo':
      return `El bus ${d.unidad ?? ''} tiene ${d.capacidad} puestos y ya hay ${d.vendidos} vendidos. Escoge un bus de ${d.vendidos} puestos o más.`;
    case 'asientos_inexistentes':
      return `El bus ${d.unidad ?? ''} no tiene los puestos ${(d.asientos ?? []).join(', ')}, que ya están vendidos. Escoge otro bus o cambia esos pasajeros de puesto.`;
    case 'salida_con_ventas':
      return `No se le puede quitar el bus: ya hay ${d.vendidos} puestos vendidos.`;
    case 'serie_muy_larga':
      return `Son demasiadas salidas de una vez (máximo ${d.maximo}). Divide la programación en partes.`;
    case 'estado_invalido':
      return 'Esa salida ya salió o terminó: no se puede cambiar.';
    default:
      return `No se pudo (${codigo}).`;
  }
}

/** El mensaje de un error de la API; en una serie dice además qué salida falló. */
export function mensajeDeError(e: unknown): string {
  if (esSinConexion(e) || !(e instanceof ApiError)) return 'Sin conexión con el servidor.';
  const d = (e.details ?? {}) as Detalles;
  if (e.code === 'serie_invalida' && d.motivo) {
    return `La salida del ${cuando(d.fechaHoraSalida).replace(/^el /, '')} no se puede: ${explicarSalida(d.motivo, d.detalles)} No se programó ninguna; corrige esa y vuelve a intentar.`;
  }
  return explicarSalida(e.code, d);
}
