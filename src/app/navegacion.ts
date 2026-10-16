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

/** Varias secciones bajo una sola etiqueta: se despliega como un submenú. */
export interface GrupoNav {
  id: string;
  label: string;
  items: SeccionModulo[];
}
export type EntradaNav = SeccionModulo | GrupoNav;
export const esGrupo = (e: EntradaNav): e is GrupoNav => 'items' in e;

const sec = (label: string, ruta: string, modulos?: ClaveModulo[]): SeccionModulo => ({ id: ruta, label, ruta, modulos });

/** Superadmin: UN solo menú. 11 secciones agrupadas por lo que el dueño hace con ellas. */
export const MENU_ADMIN: EntradaNav[] = [
  sec('Dashboard', '/admin'),
  {
    id: 'clientes',
    label: 'Clientes',
    items: [sec('Empresas', '/admin/empresas'), sec('Pasajeros', '/admin/pasajeros'), sec('Contratos', '/admin/contratos'), sec('Integraciones', '/admin/integraciones'), sec('Conectores', '/admin/conectores')],
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    items: [sec('Liquidaciones', '/admin/liquidaciones'), sec('Facturas', '/admin/facturas'), sec('Tasas', '/admin/tasas'), sec('Wallet', '/admin/wallet')],
  },
  { id: 'sistema', label: 'Sistema', items: [sec('Auditoría', '/admin/auditoria'), sec('Seguridad', '/admin/seguridad')] },
];

/**
 * Empresa: UN solo menú para todo lo que su administrador puede hacer —gestión,
 * taquilla y abordaje—. Antes eran tres barras distintas y el cambio entre
 * ellas se escondía en el menú del avatar.
 */
export const MENU_EMPRESA: EntradaNav[] = [
  sec('Dashboard', '/empresa'),
  // Una sola pantalla: unidades y mapa en vivo como pestañas (cualquiera de esos módulos la abre)
  sec('Flota', '/empresa/flota', ['flota', 'mantenimiento', 'urbano']),
  {
    id: 'ventas',
    label: 'Ventas',
    items: [
      // Una sola pantalla con pestañas Salidas / Rutas (/empresa/rutas redirige a la pestaña)
      sec('Salidas y rutas', '/empresa/salidas', ['boleteria', 'urbano']),
      // Una sola pantalla con pestañas Boletos / Pagos / Reportes (/empresa/pagos y /empresa/reportes redirigen)
      sec('Boletos, pagos y reportes', '/empresa/boletos', ['boleteria', 'urbano']),
    ],
  },
  {
    id: 'taquilla',
    label: 'Taquilla',
    items: [
      sec('Vender', '/pos', ['taquilla']),
      sec('Mis ventas', '/pos/ventas', ['taquilla']),
      sec('Pagos web', '/pos/pagos', ['taquilla']),
      sec('Tasas', '/pos/tasas', ['taquilla']),
      sec('Reportes de turno', '/pos/reportes', ['taquilla']),
      sec('Cierre de turno', '/pos/cierre', ['taquilla']),
    ],
  },
  {
    id: 'abordaje',
    label: 'Abordaje',
    items: [sec('Escáner', '/chofer', ['boleteria']), sec('Manifiesto', '/chofer/manifiesto', ['boleteria']), sec('Mi unidad', '/chofer/unidad', ['mantenimiento']), sec('Cobros urbanos', '/colector', ['urbano'])],
  },
  { id: 'cuenta', label: 'Administración', items: [sec('Personal', '/empresa/personal', ['flota']), sec('Facturas', '/empresa/facturas'), sec('Configuración', '/empresa/configuracion')] },
];

/** Rutas donde el administrador de la empresa ve su menú completo. */
export const AREAS_EMPRESA = ['/empresa', '/flota', '/pos', '/chofer', '/colector'];

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
  { id: 'busetas', label: 'Busetas', ruta: '/busetas' },
  { id: 'metodos', label: 'Métodos de pago', ruta: '/cuenta/metodos' },
];
/** Páginas públicas que, con sesión de pasajero, siguen siendo «su área» (la barra del pasajero se queda). */
export const AREAS_PASAJERO = ['/cuenta', '/busetas', '/mapa', '/pagar'];

/** Las secciones que aplican a una línea según sus módulos (`null` = todas). */
export function seccionesVisibles(secciones: SeccionModulo[], modulos: ClaveModulo[] | null): SeccionModulo[] {
  if (modulos === null) return secciones;
  return secciones.filter((s) => !s.modulos || s.modulos.some((m) => modulos.includes(m)));
}

/** Lo mismo sobre un menú con grupos: los grupos que se quedan sin secciones desaparecen. */
export function menuVisible(menu: EntradaNav[], modulos: ClaveModulo[] | null): EntradaNav[] {
  const salida: EntradaNav[] = [];
  for (const e of menu) {
    if (!esGrupo(e)) {
      if (seccionesVisibles([e], modulos).length) salida.push(e);
      continue;
    }
    const items = seccionesVisibles(e.items, modulos);
    if (items.length) salida.push({ ...e, items });
  }
  return salida;
}

export const planoDe = (menu: EntradaNav[]): SeccionModulo[] => menu.flatMap((e) => (esGrupo(e) ? e.items : [e]));

/** La sección que corresponde a la URL: la ruta más específica que la contiene. */
export function seccionDe(secciones: SeccionModulo[], pathname: string): string {
  const encontrada = [...secciones]
    .sort((a, b) => b.ruta.length - a.ruta.length)
    .find((s) => pathname === s.ruta || pathname.startsWith(s.ruta + '/'));
  // Sin coincidencia (p. ej. /perfil) no se marca ninguna: antes caía en la primera
  return encontrada?.id ?? '';
}
