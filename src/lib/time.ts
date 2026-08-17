/** Formateo de fechas/horas en es-VE (el diseño usa "Vie 21 ago", "20:30", "9 h 45"). */

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "20:30" */
export function hora(isoDate: string): string {
  const d = new Date(isoDate);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Vie 21 ago" */
export function fechaCorta(isoDate: string): string {
  const d = new Date(isoDate);
  return `${cap(DIAS[d.getDay()])} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** "Viernes 21 de agosto" */
export function fechaLarga(isoDate: string): string {
  const d = new Date(isoDate);
  return `${cap(DIAS_LARGO[d.getDay()])} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`;
}

/** "9 h 45" */
export function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** Input date "2026-08-21" → inicio y fin de día en ISO (filtros de búsqueda). */
export function rangoDia(fecha: string): { desde: string; hasta: string } {
  const d = new Date(`${fecha}T00:00:00`);
  const fin = new Date(`${fecha}T23:59:59.999`);
  return { desde: d.toISOString(), hasta: fin.toISOString() };
}

/** Fecha local de hoy en formato input date. */
export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
