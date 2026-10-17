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

/** Lo que paga quien sube en `desde` y se baja en `hasta` (órdenes de parada). */
export function precioTramo(tramos: Tramo[], tarifaPlanaBs: number, ordenes: number[], desde: number, hasta: number): number {
  if (!tramos.length) return r2(tarifaPlanaBs);
  const a = Math.min(desde, hasta);
  const b = Math.max(desde, hasta);
  const primera = Math.min(...ordenes);
  const ultima = Math.max(...ordenes);
  let total = 0;
  let inicio = primera;
  tramos.forEach((t, i) => {
    const fin = i === tramos.length - 1 ? Math.max(t.hastaOrden, ultima) : t.hastaOrden;
    if (Math.max(inicio, a) < Math.min(fin, b)) total += t.precioBs;
    inicio = fin;
  });
  return r2(total);
}

/** El pasaje más barato y el más caro posibles. */
export function rangoTramos(tramos: Tramo[], tarifaPlanaBs: number): { desdeBs: number; hastaBs: number } {
  if (!tramos.length) return { desdeBs: r2(tarifaPlanaBs), hastaBs: r2(tarifaPlanaBs) };
  return { desdeBs: Math.min(...tramos.map((t) => t.precioBs)), hastaBs: r2(tramos.reduce((s, t) => s + t.precioBs, 0)) };
}
