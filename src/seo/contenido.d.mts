export const DOMINIO: string;
export const MARCA: string;
export function slug(t: string): string;
export function rutaCiudad(c: string): string;
export function rutaPar(o: string, d: string): string;
export function separarPar(texto: string, slugs: Set<string>): [string, string] | null;
export interface Pregunta { p: string; r: string }
export interface Textos { titulo: string; descripcion: string; h1: string; intro: string; preguntas?: Pregunta[]; datos?: { k: string; v: string }[] }
export function textosCiudad(ciudad: string, estado: string | null | undefined, rutas?: { desde?: { destino: string }[]; hacia?: { origen: string }[] }): Textos & { preguntas: Pregunta[] };
export function textosPar(origen: string, destino: string, info?: { precioDesde?: number | null; duracionMin?: number | null; distanciaKm?: number | null; lineas?: string[] }): Textos & { preguntas: Pregunta[]; datos: { k: string; v: string }[] };
export function textosIndice(): Textos;
export function datosEstructurados(ruta: string, migas: { nombre: string; ruta: string }[], preguntas?: Pregunta[]): object[];
