/**
 * Fechas de una serie de salidas. El panel las calcula (en la hora local de
 * la línea) y el servidor las valida todas juntas: todo o nada.
 */

/** 'YYYY-MM-DD' de un Date local. */
export const isoDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Días entre dos fechas (incluidas) que caen en los días de semana elegidos (0 = domingo). */
export function diasSemanales(desde: string, hasta: string, semana: number[]): string[] {
  const out: string[] = [];
  if (!desde || !hasta || !semana.length) return out;
  const d = new Date(`${desde}T12:00:00`);
  const fin = new Date(`${hasta}T12:00:00`);
  for (let i = 0; d <= fin && i < 800; i++) {
    if (semana.includes(d.getDay())) out.push(isoDia(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Un día + una hora → ISO; `masDias` corre el día (regreso al día siguiente). */
export function enHora(dia: string, hora: string, masDias = 0): string {
  const d = new Date(`${dia}T${hora}:00`);
  d.setDate(d.getDate() + masDias);
  return d.toISOString();
}
