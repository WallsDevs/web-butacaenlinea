/**
 * Formatos de moneda del handoff (regla del prototipo):
 *   Bs con miles `.` y decimales `,` → "Bs 1.421,20"
 *   USD → "$ 34,00"
 *   COP entero → "$ 137.700 COP"
 * La tarifa base SIEMPRE está en USD; la conversión la hace el sistema.
 */

export type Moneda = 'Bs' | 'USD' | 'COP';

export interface Tasas {
  bcv: number;
  cop: number;
}

export function formatearMonto(usd: number, moneda: Moneda, tasas: Tasas): string {
  switch (moneda) {
    case 'USD':
      return '$ ' + usd.toFixed(2).replace('.', ',');
    case 'Bs':
      return (
        'Bs ' +
        (usd * tasas.bcv).toLocaleString('es-VE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    case 'COP':
      return '$ ' + Math.round(usd * tasas.cop).toLocaleString('es-CO') + ' COP';
  }
}

/** Línea de equivalencia bajo el total (regla del prototipo). */
export function equivalencia(usd: number, moneda: Moneda, tasas: Tasas): string {
  return moneda === 'USD'
    ? formatearMonto(usd, 'Bs', tasas)
    : 'equivale a ' + formatearMonto(usd, 'USD', tasas);
}

/** "BCV 41,80" del chrome (la tasa del día, con 2 decimales). */
export function formatearTasaBcv(bcv: number): string {
  return bcv.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
