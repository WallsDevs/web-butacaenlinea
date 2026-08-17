/**
 * Expansión CLIENTE de la configuración de asientos — espejo del generador
 * del servidor (api/src/utils/asientos.ts), usado solo para la VISTA PREVIA
 * al crear una unidad. La verdad operativa siempre la expande el servidor.
 */
import type { ConfiguracionAsientos, PisoMapa } from './api/types';

export function expandirConfiguracion(config: ConfiguracionAsientos): PisoMapa[] {
  const pad = config.padDigitos ?? 2;
  return (config.pisos ?? []).map((p) => {
    let n = p.asientoInicial;
    const filas = p.filas.map((fila) => {
      const izquierda = Array.from({ length: p.layout.izquierda }, () => ({
        id: String(n++).padStart(pad, '0'),
        estado: 'libre' as const,
      }));
      const derecha = Array.from({ length: p.layout.derecha }, () => ({
        id: String(n++).padStart(pad, '0'),
        estado: 'libre' as const,
      }));
      return { fila, izquierda, derecha };
    });
    return {
      numero: p.numero,
      nombre: p.nombre,
      claseServicio: p.claseServicio,
      layout: p.layout,
      totalAsientos: p.filas.length * (p.layout.izquierda + p.layout.derecha),
      filas,
    };
  });
}

const ABECEDARIO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface PisoBuilder {
  nombre: string;
  claseServicio: string;
  layout: '1+1' | '2+1' | '2+2';
  filas: number;
}

/** Construye la configuración real desde el armador simple (filas y numeración continuas). */
export function construirConfiguracion(pisos: PisoBuilder[]): ConfiguracionAsientos {
  let letra = 0;
  let asiento = 1;
  return {
    padDigitos: 2,
    pisos: pisos.map((p, i) => {
      const [izq, der] = p.layout.split('+').map(Number);
      const filas = Array.from({ length: p.filas }, () => ABECEDARIO[letra++ % 26]);
      const config = {
        numero: i + 1,
        nombre: p.nombre,
        claseServicio: p.claseServicio,
        layout: { izquierda: izq, derecha: der },
        filas,
        asientoInicial: asiento,
      };
      asiento += p.filas * (izq + der);
      return config;
    }),
  };
}
