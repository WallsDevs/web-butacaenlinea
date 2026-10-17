/**
 * Tarifa por tramos de una ruta urbana — espejo del cálculo del servidor
 * (api/src/urbano/tramos.ts), solo para mostrar el precio antes de pagar. Lo
 * que se cobra siempre lo decide el servidor.
 */
export interface Tramo {
  /** Orden de la parada donde termina el tramo; el primero arranca en la primera parada. */
  hastaOrden: number;
  precioBs: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Lo que paga quien sube en `desde` y se baja en `hasta` (órdenes de parada).
 * En circuito la buseta siempre avanza: si la bajada está antes de la subida,
 * se pasa por el origen (el regreso va dentro del último tramo).
 */
export function precioTramo(tramos: Tramo[], tarifaPlanaBs: number, ordenes: number[], desde: number, hasta: number, circuito = false): number {
  if (!tramos.length) return r2(tarifaPlanaBs);
  const primera = Math.min(...ordenes);
  const ultima = Math.max(...ordenes);
  const intervalos: { inicio: number; fin: number; precioBs: number }[] = [];
  let inicio = primera;
  tramos.forEach((t, i) => {
    const esUltimo = i === tramos.length - 1;
    const fin = esUltimo ? Math.max(t.hastaOrden, ultima) + (circuito ? 1 : 0) : t.hastaOrden;
    intervalos.push({ inicio, fin, precioBs: t.precioBs });
    inicio = fin;
  });
  const cruzados = new Set<number>();
  const marcar = (a: number, b: number) => intervalos.forEach((t, i) => { if (Math.max(t.inicio, a) < Math.min(t.fin, b)) cruzados.add(i); });
  if (circuito && hasta < desde) {
    marcar(desde, ultima + 1);
    marcar(primera, hasta);
  } else {
    marcar(Math.min(desde, hasta), Math.max(desde, hasta));
  }
  return r2([...cruzados].reduce((s, i) => s + intervalos[i].precioBs, 0));
}

/** El pasaje más barato y el más caro posibles. */
export function rangoTramos(tramos: Tramo[], tarifaPlanaBs: number): { desdeBs: number; hastaBs: number } {
  if (!tramos.length) return { desdeBs: r2(tarifaPlanaBs), hastaBs: r2(tarifaPlanaBs) };
  return { desdeBs: Math.min(...tramos.map((t) => t.precioBs)), hastaBs: r2(tramos.reduce((s, t) => s + t.precioBs, 0)) };
}
