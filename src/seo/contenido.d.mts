export const DOMINIO: string;
export const MARCA: string;
export function slug(t: string): string;
export function rutaCiudad(c: string): string;
export function rutaPar(o: string, d: string): string;
export function separarPar(texto: string, slugs: Set<string>): [string, string] | null;
export interface Pregunta { p: string; r: string }
export interface Textos { titulo: string; descripcion: string; h1: string; intro: string; preguntas?: Pregunta[]; datos?: { k: string; v: string }[] }
export function textosCiudad(ciudad: string, estado: string | null | undefined, rutas?: { desde?: { destino: string }[]; hacia?: { origen: string }[] }): Textos & { preguntas: Pregunta[] };
export const ZONA: string;
export function horaVe(iso: string): string;
export function fechaVe(iso: string): string;
export interface SalidaPublica { documentId?: string | null; fechaHoraSalida: string; fechaHoraLlegada?: string | null; preciosUsd?: Record<string, number> | null; linea?: { nombre?: string | null; slug?: string | null } | null }
export interface FilaSalida { id: string | null | undefined; salida: string; llegada: string | null; fecha: string; hora: string; horaLlegada: string | null; linea: string | null; lineaSlug: string | null; clases: string[]; desdeUsd: number | null; desdeBs: number | null }
export function filasSalidas(salidas: SalidaPublica[] | null | undefined, tasaBcv: number | null): FilaSalida[];
export interface ResumenPar { desdeUsd: number | null; desdeBs: number | null; salidasSemana: number; primera: string | null; ultima: string | null; lineaBarata: { nombre: string; desdeUsd: number } | null; lineas: string[] }
export function resumenPar(filas: FilaSalida[], opciones?: { precioDesde?: number | null; tasaBcv?: number | null }): ResumenPar;
export function textosPar(origen: string, destino: string, info?: { precioDesde?: number | null; duracionMin?: number | null; distanciaKm?: number | null; lineas?: string[]; resumen?: ResumenPar | null; terminalSalida?: string | null; terminalLlegada?: string | null }): Textos & { respuesta: string | null; preguntas: Pregunta[]; datos: { k: string; v: string }[] };
export function textosIndice(): Textos;
export interface ViajeLd extends FilaSalida { origen: string; destino: string; terminalSalida?: string | null; terminalLlegada?: string | null }
export function datosEstructurados(ruta: string, migas: { nombre: string; ruta: string }[], preguntas?: Pregunta[], viajes?: ViajeLd[]): object[];
export function rutaLinea(slugLinea: string): string;
export const RUTA_PRECIOS: string;
export function textosLinea(nombre: string, info?: { rutas?: { destino: string; precio: number | null }[]; salidasSemana?: number; terminalBase?: string | null }): Textos & { respuesta: string | null; preguntas: Pregunta[] };
export function textosPrecios(fecha: string, cantidad: number): Textos & { preguntas: Pregunta[] };
export interface Temporada { slug: string; nombre: string; titulo: string; desde: string; hasta: string; anio: number }
export const TEMPORADAS: Temporada[];
export function rutaTemporada(slugTemporada: string): string;
export function textosTemporada(t: Temporada, info?: { salidas?: number; rutas?: { precio: number | null }[] }): Textos & { respuesta: string; preguntas: Pregunta[] };
export declare const MAX_DESCRIPCION: number;
export declare function descripcionDe(...partes: (string | false | null | undefined | 0)[]): string;
