/**
 * Navegación de secciones por módulo: el MISMO patrón para todos los roles —
 * una sola barra (chrome) con pastillas. Aquí vive el mapa completo.
 */
import type { ClaveModulo } from '../lib/api/endpoints';

export interface SeccionModulo {
  id: string;
  label: string;
  ruta: string;
  /**
   * Módulos contratables que dan sentido a la sección: se muestra si la línea
   * tiene AL MENOS uno. Sin esta propiedad, la sección es del núcleo y se ve
   * siempre. (Solo oculta; la compuerta real está en el backend.)
   */
  modulos?: ClaveModulo[];
}

export const SECCIONES_ADMIN: SeccionModulo[] = [
  { id: 'dashboard', label: 'Dashboard', ruta: '/admin' },
  { id: 'empresas', label: 'Empresas', ruta: '/admin/empresas' },
  { id: 'contratos', label: 'Contratos', ruta: '/admin/contratos' },
  { id: 'integraciones', label: 'Integraciones', ruta: '/admin/integraciones' },
  { id: 'liquidaciones', label: 'Liquidaciones', ruta: '/admin/liquidaciones' },
  { id: 'facturas', label: 'Facturas', ruta: '/admin/facturas' },
  { id: 'tasas', label: 'Tasas', ruta: '/admin/tasas' },
  { id: 'auditoria', label: 'Auditoría', ruta: '/admin/auditoria' },
  { id: 'wallet', label: 'Wallet', ruta: '/admin/wallet' },
  { id: 'seguridad', label: 'Seguridad', ruta: '/admin/seguridad' },
];

export const SECCIONES_EMPRESA: SeccionModulo[] = [
  { id: 'dashboard', label: 'Dashboard', ruta: '/empresa' },
  { id: 'salidas', label: 'Salidas', ruta: '/empresa/salidas', modulos: ['boleteria'] },
  { id: 'rutas', label: 'Rutas', ruta: '/empresa/rutas', modulos: ['boleteria', 'urbano'] },
  { id: 'unidades', label: 'Unidades', ruta: '/empresa/unidades' },
  { id: 'flota-vivo', label: 'Flota en vivo', ruta: '/empresa/flota-en-vivo', modulos: ['mantenimiento', 'urbano'] },
  { id: 'personal', label: 'Personal', ruta: '/empresa/personal' },
  { id: 'pagos', label: 'Pagos', ruta: '/empresa/pagos', modulos: ['boleteria'] },
  { id: 'boletos', label: 'Boletos', ruta: '/empresa/boletos', modulos: ['boleteria'] },
  { id: 'reportes', label: 'Reportes', ruta: '/empresa/reportes', modulos: ['boleteria', 'urbano'] },
  { id: 'facturas', label: 'Facturas', ruta: '/empresa/facturas' },
  { id: 'configuracion', label: 'Configuración', ruta: '/empresa/configuracion' },
];

export const SECCIONES_POS: SeccionModulo[] = [
  { id: 'vender', label: 'Vender', ruta: '/pos' },
  { id: 'ventas', label: 'Mis ventas', ruta: '/pos/ventas' },
  { id: 'pagos', label: 'Pagos web', ruta: '/pos/pagos' },
  { id: 'tasas', label: 'Tasas', ruta: '/pos/tasas' },
  { id: 'reportes', label: 'Reportes', ruta: '/pos/reportes' },
  { id: 'cierre', label: 'Cierre de turno', ruta: '/pos/cierre' },
];

export const SECCIONES_CHOFER: SeccionModulo[] = [
  { id: 'escaner', label: 'Escáner', ruta: '/chofer' },
  { id: 'manifiesto', label: 'Manifiesto', ruta: '/chofer/manifiesto' },
  { id: 'unidad', label: 'Mi unidad', ruta: '/chofer/unidad' },
];

export const SECCIONES_COLECTOR: SeccionModulo[] = [
  { id: 'cobros', label: 'Cobros en vivo', ruta: '/colector' },
];

export const SECCIONES_CUENTA: SeccionModulo[] = [
  { id: 'wallet', label: 'Mi wallet', ruta: '/cuenta/wallet' },
  { id: 'boletos', label: 'Mis boletos', ruta: '/cuenta' },
  { id: 'metodos', label: 'Métodos de pago', ruta: '/cuenta/metodos' },
];

/** Las secciones que aplican a una línea según sus módulos (`null` = todas). */
export function seccionesVisibles(secciones: SeccionModulo[], modulos: ClaveModulo[] | null): SeccionModulo[] {
  if (modulos === null) return secciones;
  return secciones.filter((s) => !s.modulos || s.modulos.some((m) => modulos.includes(m)));
}

export function seccionDe(secciones: SeccionModulo[], pathname: string): string {
  const encontrada = [...secciones]
    .sort((a, b) => b.ruta.length - a.ruta.length)
    .find((s) => pathname.startsWith(s.ruta));
  return encontrada?.id ?? secciones[0].id;
}
