/**
 * Iconos de la navegación: trazo mínimo y geométrico (BRAND §6), sin emoji.
 * Se buscan por el `id` de la entrada del menú; lo que no tenga icono muestra
 * su inicial en un círculo, para que ninguna pestaña quede sin dibujo.
 */
const TRAZOS: Record<string, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  flota: <><rect x="3" y="5" width="18" height="12" rx="3" /><path d="M3 11h18M7 17v2M17 17v2" /><circle cx="7.5" cy="14" r="1" /><circle cx="16.5" cy="14" r="1" /></>,
  ventas: <><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M3 10h18M8 14h3" /></>,
  taquilla: <><path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z" /><path d="M9 7v12" strokeDasharray="2 2" /></>,
  abordaje: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h3v3H8zM13 8h3v3h-3zM8 13h3v3H8zM13 13h1.5M16 13v3h-3" /></>,
  cuenta: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>,
  clientes: <><circle cx="9" cy="8" r="3" /><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" /><circle cx="17" cy="9" r="2.3" /><path d="M16 14c2.8 0 5 1.7 5 4.5" /></>,
  finanzas: <><path d="M4 19V9M10 19V5M16 19v-7M4 19h17" /></>,
  sistema: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  wallet: <><rect x="3" y="6.5" width="18" height="12" rx="3" /><path d="M3 10.5h18" /><circle cx="17" cy="14.5" r="1.2" /></>,
  boletos: <><path d="M4 7h16v3.5a2 2 0 0 0 0 3V17H4v-3.5a2 2 0 0 0 0-3z" /><path d="M14 7v10" strokeDasharray="2 2" /></>,
  metodos: <><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M3 10h18M7 14.5h4" /></>,
  vender: <><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M8 12h8M12 9v6" /></>,
  pagos: <><circle cx="12" cy="12" r="8" /><path d="M9.5 10a2.5 2 0 0 1 5 0c0 2-5 2-5 4a2.5 2 0 0 0 5 0M12 6.5v1.5M12 16v1.5" /></>,
  tasas: <><path d="M4 18 10 11l4 3 6-7" /><path d="M16 7h4v4" /></>,
  reportes: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  cierre: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 12l3 3 5-6" /></>,
  escaner: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M4 12h16" /></>,
  manifiesto: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  unidad: <><rect x="3" y="5" width="18" height="12" rx="3" /><path d="M3 11h18M7 17v2M17 17v2" /></>,
  cobros: <><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" /></>,
  perfil: <><circle cx="12" cy="9" r="3.6" /><path d="M5.5 19.5c1.2-3.2 3.6-4.6 6.5-4.6s5.3 1.4 6.5 4.6" /></>,
  empresas: <><path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 9h3a1 1 0 0 1 1 1v11M8 8h2M8 12h2M8 16h2" /></>,
  pasajeros: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  contratos: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h5M10 17h5" /></>,
  integraciones: <><path d="M9 7H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3M15 7h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3M8 12h8" /></>,
  conectores: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.9 15.8 7.1M8.2 13.1l7.6 3.8" /></>,
  liquidaciones: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18M7 15h4" /></>,
  facturas: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  auditoria: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5M8.5 11h5M11 8.5v5" /></>,
  seguridad: <><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" /><path d="M9.5 12l2 2 3.5-4" /></>,
  viajar: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.3-4.3" /></>,
  busetas: <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></>,
};

/** Algunas entradas tienen como id su ruta ('/empresa'): el icono se busca entonces por la etiqueta. */
const POR_ETIQUETA: Record<string, string> = { dashboard: 'dashboard', administracion: 'cuenta', 'metodos de pago': 'metodos', 'mi wallet': 'wallet', 'mis boletos': 'boletos', 'cobros en vivo': 'cobros', 'mi unidad': 'unidad', 'mis ventas': 'ventas', 'pagos web': 'pagos', 'cierre de turno': 'cierre', 'escaner': 'escaner', inicio: 'dashboard', ciudades: 'busetas', 'salidas y rutas': 'ventas', personal: 'clientes', configuracion: 'sistema', 'reportes de turno': 'reportes', 'cobros urbanos': 'cobros' };
const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function IconoNav({ id, label, size = 22 }: { id: string; label?: string; size?: number }) {
  const trazo = TRAZOS[id] ?? TRAZOS[POR_ETIQUETA[normalizar(label ?? '')] ?? ''];
  if (!trazo) {
    return (
      <span style={{ width: size, height: size, borderRadius: '50%', border: '1.8px solid currentColor', display: 'grid', placeItems: 'center', fontSize: size * 0.5, fontWeight: 700 }} aria-hidden>
        {(label ?? id).charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {trazo}
    </svg>
  );
}
