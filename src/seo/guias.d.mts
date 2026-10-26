export interface FuentePrecio { nombre: string; fecha: string; url: string }
export interface PrecioReferencia { min: number; max: number; fuentes: string[] }
export interface Guia {
  origen: string;
  destino: string;
  km: number;
  minutos: number;
  precio: PrecioReferencia | null;
  lineas: string[];
  terminalSalida: string;
  terminalLlegada: string;
}
export interface Terminal { slug: string; nombre: string; ciudad: string; direccion: string; cubre: string }
export declare const FUENTES: Record<string, FuentePrecio>;
export declare const ALIAS: Record<string, string>;
export declare function nombreVisible(c: string): string;
export declare function terminalDe(ciudad: string, otraEstado: string | null | undefined): string;
export declare function todasLasGuias(ciudades: { nombre: string; estado: string | null }[]): Guia[];
export declare function guiaDe(origen: string, destino: string, ciudades: { nombre: string; estado: string | null }[]): Guia | null;
export declare const TERMINALES: Terminal[];
export declare function rutaTerminal(slug: string): string;
