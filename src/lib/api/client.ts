/**
 * Cliente HTTP hacia el backend (api/). Adjunta el JWT si hay sesión y normaliza errores
 * (incluye el `code` de negocio que devuelven los endpoints custom).
 */
import { useAuth } from '../../stores/auth';

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:1340';
/** URL pública de esta web: va dentro de los QR impresos (nunca la del equipo donde se imprimió). */
export const WEB_URL: string = (import.meta.env.VITE_WEB_URL as string | undefined)?.replace(/\/$/, '') || window.location.origin;

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, code: string, details?: unknown) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface Opciones {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean; // adjuntar JWT si existe (default true)
  signal?: AbortSignal;
}

/** El servidor no respondió (sin señal, caído, tiempo agotado): el cliente lo trae como ApiError 0 «sin_conexion». */
export const esSinConexion = (e: unknown): boolean => !(e instanceof ApiError) || e.status === 0;

export async function api<T>(path: string, opciones: Opciones = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = opciones;
  const headers: Record<string, string> = {};
  // Un FormData (subida de archivo) va tal cual: el navegador pone el boundary
  const esFormulario = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !esFormulario) headers['Content-Type'] = 'application/json';
  const jwt = useAuth.getState().jwt;
  if (auth && jwt) headers['Authorization'] = `Bearer ${jwt}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : esFormulario ? body : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    throw new ApiError(0, 'sin_conexion', e);
  }

  const texto = await res.text();
  const json = texto ? JSON.parse(texto) : {};

  if (!res.ok) {
    if (res.status === 401 && auth && jwt) useAuth.getState().cerrarSesion();
    const code = json?.error?.message ?? `http_${res.status}`;
    throw new ApiError(res.status, code, json?.error?.details);
  }
  // Si el payload trae la clave `data`, ese ES el valor — aunque sea null
  // (p. ej. "sin unidad asignada", "sin turno abierto"). `json.data ?? json`
  // convertía ese null legítimo en el objeto envoltorio y rompía los guards.
  return (Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : json) as T;
}

/** URL final de un archivo de media: absoluta (R2/S3) o relativa al API (disco local). */
export const urlMedia = (url?: string | null): string | null =>
  !url ? null : url.startsWith('http') ? url : `${API_URL}${url}`;
