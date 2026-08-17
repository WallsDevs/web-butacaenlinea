/**
 * Navegación de secciones por módulo: el MISMO patrón para todos los roles —
 * una sola barra (chrome) con pastillas. Aquí vive el mapa completo.
 */
export interface SeccionModulo {
  id: string;
  label: string;
  ruta: string;
}

export const SECCIONES_ADMIN: SeccionModulo[] = [
  { id: 'dashboard', label: 'Dashboard', ruta: '/admin' },
  { id: 'empresas', label: 'Empresas', ruta: '/admin/empresas' },
  { id: 'liquidaciones', label: 'Liquidaciones', ruta: '/admin/liquidaciones' },
  { id: 'tasas', label: 'Tasas', ruta: '/admin/tasas' },
  { id: 'auditoria', label: 'Auditoría', ruta: '/admin/auditoria' },
  { id: 'seguridad', label: 'Seguridad', ruta: '/admin/seguridad' },
];

export const SECCIONES_EMPRESA: SeccionModulo[] = [
  { id: 'dashboard', label: 'Dashboard', ruta: '/empresa' },
  { id: 'salidas', label: 'Salidas', ruta: '/empresa/salidas' },
  { id: 'rutas', label: 'Rutas', ruta: '/empresa/rutas' },
  { id: 'unidades', label: 'Unidades', ruta: '/empresa/unidades' },
  { id: 'personal', label: 'Personal', ruta: '/empresa/personal' },
  { id: 'pagos', label: 'Pagos', ruta: '/empresa/pagos' },
  { id: 'boletos', label: 'Boletos', ruta: '/empresa/boletos' },
  { id: 'reportes', label: 'Reportes', ruta: '/empresa/reportes' },
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

export const SECCIONES_CUENTA: SeccionModulo[] = [
  { id: 'boletos', label: 'Mis boletos', ruta: '/cuenta' },
  { id: 'metodos', label: 'Métodos de pago', ruta: '/cuenta/metodos' },
];

export function seccionDe(secciones: SeccionModulo[], pathname: string): string {
  const encontrada = [...secciones]
    .sort((a, b) => b.ruta.length - a.ruta.length)
    .find((s) => pathname.startsWith(s.ruta));
  return encontrada?.id ?? secciones[0].id;
}
