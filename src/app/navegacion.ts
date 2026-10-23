/**
 * Navegación de secciones por módulo: el MISMO patrón para todos los roles —
 * una sola barra (chrome) con pastillas. Aquí vive el mapa completo.
 */
import type { ClaveModulo } from '../lib/api/endpoints';

export interface SeccionModulo {
  id: string;
  label: string;
  ruta: string;
  /** No va en la barra de abajo del teléfono (no cabe): se llega por otro lado. */
  soloEscritorio?: boolean;
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
  { id: 'sistema', label: 'Sistema', items: [sec('Ciudades', '/admin/ciudades'), sec('Auditoría', '/admin/auditoria'), sec('Seguridad', '/admin/seguridad')] },
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
      sec('Boletos', '/empresa/boletos', ['boleteria']),
      sec('Pagos', '/empresa/pagos', ['boleteria']),
      sec('Reportes', '/empresa/reportes', ['boleteria', 'urbano']),
    ],
  },
  { id: 'cuenta', label: 'Administración', items: [sec('Personal', '/empresa/personal', ['flota']), sec('Wallet', '/empresa/wallet'), sec('Facturas', '/empresa/facturas'), sec('Configuración', '/empresa/configuracion')] },
];

/**
 * Rutas donde el administrador de la empresa ve su menú. El administrador
 * gestiona y delega: no vende en taquilla, no escanea ni cobra a bordo; eso
 * es del cajero, el conductor y el colector, con sus propios accesos.
 */
export const AREAS_EMPRESA = ['/empresa', '/flota'];

export const SECCIONES_POS: SeccionModulo[] = [
  { id: 'vender', label: 'Vender', ruta: '/pos' },
  { id: 'ventas', label: 'Mis ventas', ruta: '/pos/ventas' },
  { id: 'tasas', label: 'Tasas', ruta: '/pos/tasas' },
  { id: 'reportes', label: 'Reportes', ruta: '/pos/reportes' },
  // El cierre no es una sección: se llega desde «Cerrar turno» en la caja y lo cerrado queda en Reportes
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
  // Lo primero: buscar y comprar el pasaje (con el próximo viaje y el saldo)
  { id: 'viajar', label: 'Viajar', ruta: '/cuenta' },
  { id: 'boletos', label: 'Mis boletos', ruta: '/cuenta/boletos' },
  { id: 'wallet', label: 'Mi wallet', ruta: '/cuenta/wallet' },
  { id: 'busetas', label: 'Busetas', ruta: '/busetas' },
  // En el teléfono no cabe en la barra de abajo: se llega desde Perfil y desde la wallet
  { id: 'metodos', label: 'Métodos de pago', ruta: '/cuenta/metodos', soloEscritorio: true },
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

// ── Menú lateral (escritorio) ────────────────────────────────────────────────
// En pantalla grande el menú del rol es una barra lateral con secciones y
// ítems planos; un ítem puede tener hijos que se despliegan debajo cuando
// está activo (Taquilla → Vender, Mis ventas…). En celular sigue la barra
// inferior con el modelo de grupos de arriba.

export interface ItemLateral extends SeccionModulo {
  /** Clave del icono (ver iconos.tsx); sin ella se busca por la etiqueta. */
  icono?: string;
  hijos?: SeccionModulo[];
}
export interface SeccionLateral {
  id: string;
  label: string;
  items: ItemLateral[];
}

const item = (label: string, ruta: string, icono: string, modulos?: ClaveModulo[], hijos?: SeccionModulo[]): ItemLateral => ({ id: ruta, label, ruta, icono, modulos, hijos });

export const LATERAL_EMPRESA: SeccionLateral[] = [
  { id: 'general', label: 'General', items: [item('Inicio', '/empresa', 'dashboard')] },
  {
    id: 'ventas',
    label: 'Ventas',
    items: [
      item('Salidas y rutas', '/empresa/salidas', 'ventas', ['boleteria', 'urbano']),
      item('Boletos', '/empresa/boletos', 'boletos', ['boleteria']),
      item('Pagos', '/empresa/pagos', 'pagos', ['boleteria']),
      item('Reportes', '/empresa/reportes', 'reportes', ['boleteria', 'urbano']),
    ],
  },
  {
    id: 'operacion',
    label: 'Operación',
    items: [item('Flota', '/empresa/flota', 'flota', ['flota', 'mantenimiento', 'urbano'])],
  },
  {
    id: 'administracion',
    label: 'Administración',
    items: [item('Personal', '/empresa/personal', 'clientes', ['flota']), item('Wallet', '/empresa/wallet', 'wallet'), item('Facturas', '/empresa/facturas', 'finanzas'), item('Configuración', '/empresa/configuracion', 'sistema')],
  },
];

/** El menú de grupos de un rol, como lateral: cada grupo es una sección; lo suelto va en «General». */
export function lateralDesdeMenu(menu: EntradaNav[]): SeccionLateral[] {
  const generales: ItemLateral[] = [];
  const secciones: SeccionLateral[] = [];
  for (const e of menu) {
    if (esGrupo(e)) secciones.push({ id: e.id, label: e.label, items: e.items.map((s) => ({ ...s, icono: s.id.startsWith('/') ? undefined : s.id })) });
    else generales.push({ ...e, icono: e.id.startsWith('/') ? undefined : e.id });
  }
  return generales.length ? [{ id: 'general', label: 'General', items: generales }, ...secciones] : secciones;
}

/** Filtra el lateral por los módulos contratados; un ítem con hijos vive mientras le quede alguno. */
export function lateralVisible(secciones: SeccionLateral[], modulos: ClaveModulo[] | null): SeccionLateral[] {
  const visible = (x: SeccionModulo) => modulos === null || !x.modulos || x.modulos.some((m) => modulos.includes(m));
  return secciones
    .map((s) => ({
      ...s,
      items: s.items
        .filter(visible)
        .map((i): ItemLateral => (i.hijos ? { ...i, hijos: i.hijos.filter(visible) } : i))
        .filter((i) => !i.hijos || i.hijos.length > 0),
    }))
    .filter((s) => s.items.length > 0);
}

/** Ids del ítem y del hijo activos para una ruta (coincidencia más larga). */
export function activoLateral(secciones: SeccionLateral[], pathname: string): { item: string; hijo: string } {
  const planos: { item: string; hijo: string; ruta: string }[] = [];
  for (const s of secciones)
    for (const i of s.items) {
      planos.push({ item: i.id, hijo: '', ruta: i.ruta });
      for (const h of i.hijos ?? []) planos.push({ item: i.id, hijo: h.id, ruta: h.ruta });
    }
  const encontrado = planos.sort((a, b) => b.ruta.length - a.ruta.length).find((p) => pathname === p.ruta || pathname.startsWith(p.ruta + '/'));
  return { item: encontrado?.item ?? '', hijo: encontrado?.hijo ?? '' };
}

/** La sección del lateral a la que pertenece una ruta («Ventas», «Operación»…), para el antetítulo de la pantalla. */
export function seccionLateralDe(rol: string | undefined, pathname: string): string | null {
  const lateral = rol === 'empresa' ? LATERAL_EMPRESA : rol === 'superadmin' ? lateralDesdeMenu(MENU_ADMIN) : null;
  if (!lateral) return null;
  const activo = activoLateral(lateral, pathname);
  const seccion = lateral.find((s) => s.items.some((i) => i.id === activo.item));
  return seccion && seccion.id !== 'general' ? seccion.label : null;
}
