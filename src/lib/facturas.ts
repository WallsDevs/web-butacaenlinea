import type { EstadoFactura } from './api/endpoints';
import type { TonoChip } from '../components/ui/StatusChip';

/** '2026-09' → 'septiembre de 2026'. */
export const nombreDePeriodo = (periodo: string) =>
  new Date(`${periodo}-15T12:00:00`).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });

export const CHIP_ESTADO: Record<EstadoFactura, { tono: TonoChip; texto: string }> = {
  pendiente: { tono: 'warn', texto: 'Pendiente' },
  por_verificar: { tono: 'info', texto: 'Por verificar' },
  pagada: { tono: 'ok', texto: 'Pagada' },
  vencida: { tono: 'bad', texto: 'Vencida' },
};
