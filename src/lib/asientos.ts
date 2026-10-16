/**
 * Expansión CLIENTE de la configuración de asientos — espejo del generador
 * del servidor (api/src/utils/asientos.ts), usado solo para la VISTA PREVIA
 * al crear una unidad. La verdad operativa siempre la expande el servidor.
 */
import type { ConfiguracionAsientos, FilaMapa, PisoMapa } from './api/types';

export function expandirConfiguracion(config: ConfiguracionAsientos): PisoMapa[] {
  const pad = config.padDigitos ?? 2;
  return (config.pisos ?? []).map((p) => {
    let n = p.asientoInicial;
    const filas: FilaMapa[] = p.filas.map((fila) => {
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
    const trasera = p.filaTrasera ?? 0;
    if (trasera > 0) {
      const ultima = p.filas[p.filas.length - 1] ?? '';
      const i = ABECEDARIO.indexOf(ultima.toUpperCase());
      const fila = i >= 0 && i < 25 ? ABECEDARIO[i + 1] : `${ultima}T`;
      const asientos = Array.from({ length: trasera }, () => ({ id: String(n++).padStart(pad, '0'), estado: 'libre' as const }));
      filas.push({ fila, izquierda: asientos.slice(0, Math.ceil(trasera / 2)), derecha: asientos.slice(Math.ceil(trasera / 2)), completa: true });
    }
    return {
      numero: p.numero,
      nombre: p.nombre,
      claseServicio: p.claseServicio,
      layout: p.layout,
      totalAsientos: capacidadPiso(p),
      filas,
    };
  });
}

const ABECEDARIO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Puestos de un piso: filas × (izquierda + derecha) más la fila trasera corrida. */
export function capacidadPiso(p: { filas: string[]; layout: { izquierda: number; derecha: number }; filaTrasera?: number }): number {
  return p.filas.length * (p.layout.izquierda + p.layout.derecha) + (p.filaTrasera ?? 0);
}

export interface PisoBuilder {
  nombre: string;
  claseServicio: string;
  layout: '1+1' | '2+1' | '2+2';
  filas: number;
  /** Puestos de la fila trasera corrida; 0 = sin fila trasera. */
  filaTrasera: number;
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
        ...(p.filaTrasera > 0 ? { filaTrasera: p.filaTrasera } : {}),
      };
      asiento += p.filas * (izq + der) + (p.filaTrasera > 0 ? p.filaTrasera : 0);
      return config;
    }),
  };
}
