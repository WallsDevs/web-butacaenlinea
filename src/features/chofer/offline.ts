/**
 * Soporte offline del chófer: manifiesto y clave pública precargados en
 * IndexedDB, validación en frío, y cola (outbox) de validaciones que se
 * sincroniza con reintentos al recuperar señal. Los POST son idempotentes
 * (el servidor deduplica por idempotencyKey): reenviar es inocuo.
 */
import { openDB, type IDBPDatabase } from 'idb';
import { getClavePublica, sincronizarValidaciones } from '../../lib/api/endpoints';
import { importarClavePublica, verificarJwsLocal } from '../../lib/qrLocal';
import type { Manifiesto, RespuestaValidacion } from '../../lib/api/types';

export interface FilaManifiestoLocal {
  salidaId: string;
  qrId: string;
  folio: string;
  asientoId: string;
  piso: number;
  pasajeroNombre: string;
  pasajeroDocumento?: string;
  estado: 'abordado' | 'pendiente' | 'no_show';
  equipajePiezas: number;
  equipajeNota?: string;
  origenLocal?: boolean; // marcado abordado sin señal, pendiente de sincronizar
}

interface EntradaOutbox {
  idempotencyKey: string;
  qr?: string;
  qrId?: string;
  salidaId: string;
  escaneadoEn: string;
  dispositivoId: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB('bel-chofer', 1, {
      upgrade(d) {
        d.createObjectStore('viajes', { keyPath: 'salidaId' });
        const m = d.createObjectStore('manifiesto', { keyPath: ['salidaId', 'qrId'] });
        m.createIndex('porSalida', 'salidaId');
        d.createObjectStore('outbox', { keyPath: 'idempotencyKey' });
        d.createObjectStore('config');
      },
    });
  }
  return dbPromise;
}

export const DISPOSITIVO_ID = (() => {
  const clave = 'bel-dispositivo';
  let id = localStorage.getItem(clave);
  if (!id) {
    id = `tab-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(clave, id);
  }
  return id;
})();

/** Precarga (con red): manifiesto completo + clave pública de validación. */
export async function precargarViaje(salidaId: string, manifiesto: Manifiesto): Promise<void> {
  const d = await db();
  const tx = d.transaction(['viajes', 'manifiesto'], 'readwrite');
  await tx.objectStore('viajes').put({
    salidaId,
    salida: manifiesto.salida,
    fetchedAt: new Date().toISOString(),
  });
  for (const p of manifiesto.pasajeros) {
    // No pisar marcas locales aún no sincronizadas
    const previa = (await tx.objectStore('manifiesto').get([salidaId, p.qrId])) as
      | FilaManifiestoLocal
      | undefined;
    if (previa?.origenLocal && p.estado === 'pendiente') continue;
    await tx.objectStore('manifiesto').put({ salidaId, ...p, origenLocal: false });
  }
  await tx.done;

  try {
    const clave = await getClavePublica();
    await (await db()).put('config', clave.pem, 'clavePem');
  } catch {
    /* sin red: se usa la clave ya guardada */
  }
}

export async function manifiestoLocal(salidaId: string): Promise<FilaManifiestoLocal[]> {
  const filas = (await (await db()).getAllFromIndex('manifiesto', 'porSalida', salidaId)) as FilaManifiestoLocal[];
  return filas.sort((a, b) => a.asientoId.localeCompare(b.asientoId));
}

/** Validación sin red: firma (WebCrypto) → manifiesto local → outbox. */
export async function validarLocal(params: {
  qr?: string;
  qrId?: string;
  salidaId: string;
}): Promise<RespuestaValidacion> {
  const d = await db();
  let qrId = params.qrId ?? null;

  if (params.qr) {
    const pem = (await d.get('config', 'clavePem')) as string | undefined;
    if (pem) {
      const clave = await importarClavePublica(pem);
      const v = await verificarJwsLocal(params.qr, clave);
      if (!v.ok) {
        return {
          resultado: v.error === 'vencido' ? 'vencido' : 'no_encontrado',
          repetida: false,
          boleto: null,
        };
      }
      if (v.claims.s !== params.salidaId) {
        return { resultado: 'salida_incorrecta', repetida: false, boleto: null };
      }
      qrId = v.claims.jti;
    } else {
      // Sin clave precargada: no se puede verificar en frío
      return { resultado: 'no_encontrado', repetida: false, boleto: null };
    }
  }
  if (!qrId) return { resultado: 'no_encontrado', repetida: false, boleto: null };

  const fila = (await d.get('manifiesto', [params.salidaId, qrId])) as FilaManifiestoLocal | undefined;
  if (!fila) return { resultado: 'no_encontrado', repetida: false, boleto: null };
  if (fila.estado === 'abordado') {
    return { resultado: 'duplicado', repetida: false, boleto: filaABoleto(fila) };
  }

  const ahora = new Date().toISOString();
  await d.put('manifiesto', { ...fila, estado: 'abordado', origenLocal: true });
  await d.put('outbox', {
    idempotencyKey: crypto.randomUUID(),
    qr: params.qr,
    qrId: params.qr ? undefined : qrId,
    salidaId: params.salidaId,
    escaneadoEn: ahora,
    dispositivoId: DISPOSITIVO_ID,
  } satisfies EntradaOutbox);

  return { resultado: 'valido', repetida: false, boleto: filaABoleto(fila) };
}

const filaABoleto = (f: FilaManifiestoLocal): RespuestaValidacion['boleto'] => ({
  folio: f.folio,
  qrId: f.qrId,
  asientoId: f.asientoId,
  piso: f.piso,
  claseServicio: '',
  pasajeroNombre: f.pasajeroNombre,
  pasajeroDocumento: f.pasajeroDocumento,
  equipajePiezas: f.equipajePiezas,
  equipajeNota: f.equipajeNota,
});

export async function pendientesDeSincronizar(): Promise<number> {
  return (await db()).count('outbox');
}

/** Drena la outbox (evento online, arranque, intervalo). Idempotente. */
export async function sincronizarOutbox(): Promise<{ enviadas: number; restantes: number }> {
  const d = await db();
  const entradas = (await d.getAll('outbox')) as EntradaOutbox[];
  if (!entradas.length) return { enviadas: 0, restantes: 0 };
  try {
    const r = await sincronizarValidaciones(entradas);
    const tx = d.transaction(['manifiesto', 'outbox'], 'readwrite');
    for (const res of r.resultados) {
      await tx.objectStore('outbox').delete(res.idempotencyKey);
    }
    // Las filas locales quedan confirmadas por el servidor
    const filas = (await tx.objectStore('manifiesto').getAll()) as FilaManifiestoLocal[];
    for (const f of filas) {
      if (f.origenLocal) await tx.objectStore('manifiesto').put({ ...f, origenLocal: false });
    }
    await tx.done;
    return { enviadas: entradas.length, restantes: await d.count('outbox') };
  } catch {
    return { enviadas: 0, restantes: entradas.length };
  }
}
