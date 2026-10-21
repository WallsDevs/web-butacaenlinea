/** Funciones por recurso — el único lugar que conoce las rutas del backend. */
import { api, API_URL } from './client';
import type {
  Alerta,
  Arqueo,
  BoletoPublico,
  CierreTurno,
  DiagramaCauchos,
  Manifiesto,
  MapaAsientos,
  MetodoPago,
  OrdenMantenimientoDto,
  PasajeroEmision,
  RespuestaValidacion,
  ReservaCreada,
  ResultadoEmision,
  ResumenMantenimiento,
  SalidaDto,
  TasasVigentes,
  TurnoDto,
  UnidadDto,
  UsuarioSesion,
} from './types';

// ── Público ──────────────────────────────────────────────────────────────────
export const getTasas = () => api<TasasVigentes>('/api/tasas/vigentes');

export const getLineas = () =>
  api<import('./types').LineaDto[]>(
    '/api/lineas?filters[activa][$eq]=true&sort=nombre&pagination[pageSize]=100'
  );

export const getSalidas = (params?: {
  origen?: string;
  destino?: string;
  desde?: string;
  hasta?: string;
  lineaSlug?: string;
  estados?: string[];
  unidadId?: string;
  orden?: string;
  /** Tope de resultados (el API corta en 100). */
  limite?: number;
}) => {
  const q = new URLSearchParams({
    'populate[ruta]': 'true',
    'populate[unidad]': 'true',
    'populate[linea]': 'true',
    sort: params?.orden ?? 'fechaHoraSalida',
    'pagination[pageSize]': String(params?.limite ?? 50),
  });
  (params?.estados ?? ['programada', 'abordando']).forEach((e, i) => q.set(`filters[estado][$in][${i}]`, e));
  if (params?.unidadId) q.set('filters[unidad][documentId][$eq]', params.unidadId);
  if (params?.lineaSlug) q.set('filters[linea][slug][$eq]', params.lineaSlug);
  if (params?.origen) q.set('filters[ruta][origen][$eq]', params.origen);
  if (params?.destino) q.set('filters[ruta][destino][$eq]', params.destino);
  if (params?.desde) q.set('filters[fechaHoraSalida][$gte]', params.desde);
  if (params?.hasta) q.set('filters[fechaHoraSalida][$lte]', params.hasta);
  return api<SalidaDto[]>(`/api/salidas?${q}`);
};

export const getSalida = (documentId: string) =>
  api<SalidaDto>(`/api/salidas/${documentId}?populate[ruta]=true&populate[unidad]=true`);

export const getOcupacionSalidas = (ids: string[]) =>
  api<Record<string, number>>(`/api/salidas/ocupacion?ids=${ids.join(',')}`);

export const getMapaAsientos = (salidaId: string) =>
  api<MapaAsientos>(`/api/salidas/${salidaId}/mapa-asientos`);

export const crearReserva = (salidaId: string, asientos: string[]) =>
  api<ReservaCreada>('/api/reservas', { method: 'POST', body: { salidaId, asientos } });

export const liberarReserva = (token: string) =>
  api<{ liberada: boolean }>(`/api/reservas/${token}`, { method: 'DELETE' });

export const emitirBoletos = (payload: {
  reservaToken: string;
  pasajeros: PasajeroEmision[];
  pago: { metodoPago: MetodoPago; monedaPago: 'USD' | 'BS' | 'COP'; referencia?: string };
  turnoId?: string | null;
}) => api<ResultadoEmision>('/api/boletos/emitir', { method: 'POST', body: payload });

export const getBoletoPorCodigo = (qrId: string) =>
  api<BoletoPublico>(`/api/boletos/codigo/${qrId}`);

// ── Auth (users-permissions) ─────────────────────────────────────────────────
export const login = (identifier: string, password: string) =>
  api<{ jwt: string; user: UsuarioSesion }>('/api/auth/local', {
    method: 'POST',
    body: { identifier, password },
    auth: false,
  });

export const getMe = () => api<UsuarioSesion>('/api/sesion');

export const registrarCliente = (datos: { username: string; email: string; password: string }) =>
  api<{ jwt: string; user: UsuarioSesion }>('/api/auth/local/register', {
    method: 'POST',
    body: datos,
    auth: false,
  });

// ── Cuenta del cliente ───────────────────────────────────────────────────────
export const getMisBoletos = () => api<import('./types').BoletoMio[]>('/api/mis-boletos');
export const getMetodosPago = () =>
  api<import('./types').MetodoPagoCliente[]>('/api/metodos-pago');
export const guardarMetodoPago = (m: Partial<import('./types').MetodoPagoCliente>) =>
  api<{ documentId: string }>('/api/metodos-pago', { method: 'POST', body: m });
export const eliminarMetodoPago = (documentId: string) =>
  api<{ eliminado: boolean }>(`/api/metodos-pago/${documentId}`, { method: 'DELETE' });

// ── Cajero ───────────────────────────────────────────────────────────────────
export const getMisVentas = (fecha?: string) =>
  api<import('./types').VentasCajero>(`/api/boletos/mis-ventas${fecha ? `?fecha=${fecha}` : ''}`);
export const getMisTurnos = () => api<import('./types').TurnoMio[]>('/api/turnos/mios');

// ── POS ──────────────────────────────────────────────────────────────────────
export const crearTaquilla = (datos: { nombre: string; serieFolio: string; terminal?: string }) =>
  api<{ documentId: string; nombre: string; serieFolio: string }>('/api/taquillas', {
    method: 'POST',
    body: { data: { ...datos, activa: true } },
  });
export const getTaquillas = () => api<{ documentId: string; nombre: string; serieFolio: string; terminal: string }[]>(
  '/api/taquillas?filters[activa][$eq]=true'
);
export const abrirTurno = (taquillaId: string) =>
  api<TurnoDto>('/api/turnos/abrir', { method: 'POST', body: { taquillaId } });
export const getTurnoActual = () => api<TurnoDto | null>('/api/turnos/actual');
export const getArqueo = (turnoId: string) => api<Arqueo>(`/api/turnos/${turnoId}/arqueo`);
export const cerrarTurno = (turnoId: string) =>
  api<{ cierre: CierreTurno }>(`/api/turnos/${turnoId}/cerrar`, { method: 'POST' });
export const getBoletosPorVerificar = () =>
  api<import('./types').BoletoPorVerificar[]>('/api/boletos/por-verificar');
export const verificarPago = (boletoId: string, aprobar: boolean, nota?: string) =>
  api<{ estadoPago: string }>(`/api/boletos/${boletoId}/verificar-pago`, {
    method: 'POST',
    body: { aprobar, nota },
  });
export const anularBoleto = (
  boletoId: string,
  motivo: string,
  supervisor?: { identifier: string; password: string }
) => api<{ folio: string; estado: string }>(`/api/boletos/${boletoId}/anular`, {
  method: 'POST',
  body: { motivo, supervisor },
});

// ── Chófer ───────────────────────────────────────────────────────────────────
export const validarQr = (payload: {
  qr?: string;
  qrId?: string; // validación manual (sin QR legible)
  salidaId: string;
  dispositivoId?: string;
  escaneadoEn?: string;
  idempotencyKey?: string;
}) => api<RespuestaValidacion>('/api/abordaje/validar', { method: 'POST', body: payload });

export const sincronizarValidaciones = (validaciones: object[]) =>
  api<{ resultados: { idempotencyKey: string; resultado: string; folio: string | null }[] }>(
    '/api/abordaje/sincronizar',
    { method: 'POST', body: { validaciones } }
  );

export const getClavePublica = () =>
  api<{ algoritmo: string; pem: string }>('/api/abordaje/clave-publica');

export const getManifiesto = (salidaId: string) =>
  api<Manifiesto>(`/api/salidas/${salidaId}/manifiesto`);

export const cerrarAbordaje = (salidaId: string, kmActual?: number) =>
  api<{ reporte: object }>(`/api/salidas/${salidaId}/cerrar-abordaje`, {
    method: 'POST',
    body: { kmActual },
  });

// ── Flota ────────────────────────────────────────────────────────────────────
export const getUnidades = (lineaSlug?: string) =>
  api<UnidadDto[]>(
    `/api/unidades?populate[choferAsignado]=true&populate[documentos]=true&sort=numero${lineaSlug ? `&filters[linea][slug][$eq]=${lineaSlug}` : ''}`
  );
export const getUnidad = (documentId: string) =>
  api<UnidadDto>(`/api/unidades/${documentId}?populate[choferAsignado]=true&populate[documentos]=true`);
export const getCauchos = (unidadId: string) => api<DiagramaCauchos>(`/api/unidades/${unidadId}/cauchos`);
export const getAlertas = (unidadId: string) => api<Alerta[]>(`/api/unidades/${unidadId}/alertas`);
export const getResumenMantenimiento = (unidadId: string) =>
  api<ResumenMantenimiento>(`/api/unidades/${unidadId}/resumen-mantenimiento`);
export const getOrdenes = (unidadDocumentId: string) =>
  api<OrdenMantenimientoDto[]>(
    `/api/ordenes-mantenimiento?filters[unidad][documentId][$eq]=${unidadDocumentId}&sort=fecha:desc&pagination[pageSize]=25`
  );
export const actualizarEstadoUnidad = (documentId: string, estado: string) =>
  api<UnidadDto>(`/api/unidades/${documentId}`, { method: 'PUT', body: { data: { estado } } });
export const rotarCauchos = (movimientos: { cauchoId: string; posicionNueva: string }[]) =>
  api<{ rotado: boolean }>('/api/cauchos/rotar', { method: 'POST', body: { movimientos } });
export const reemplazarCaucho = (
  cauchoId: string,
  datos: { serialNuevo: string; marca?: string; medida?: string; profundidadNuevaMm?: number }
) => api<{ caucho: string; posicion: string }>(`/api/cauchos/${cauchoId}/reemplazar`, {
  method: 'POST',
  body: datos,
});


// ── Módulo Empresa ───────────────────────────────────────────────────────────
export interface DashboardEmpresa {
  hoy: { boletos: number; anulados: number; totalUsd: number; comisionUsd: number; porCanal: Record<string, { boletos: number; totalUsd: number }> };
  porVerificar: number;
  proximasSalidas: {
    documentId: string;
    fechaHoraSalida: string;
    destino?: string;
    unidad?: string;
    rampa?: string;
    estado: string;
    ocupacion: { vendidos: number; total: number };
  }[];
  liquidacionesPendientes: { documentId: string; fecha: string; comisionUsd: number; boletos: number }[];
}
export const getDashboardEmpresa = () => api<DashboardEmpresa>('/api/empresa/dashboard');

export interface ReportesEmpresa {
  desde: string;
  hasta: string;
  totales: { boletos: number; anulados: number; totalUsd: number; comisionUsd: number };
  porDia: { clave: string; boletos: number; totalUsd: number }[];
  porCanal: { clave: string; boletos: number; totalUsd: number }[];
  porMetodo: { clave: string; boletos: number; totalUsd: number }[];
  porCajero: { clave: string; boletos: number; totalUsd: number }[];
  liquidaciones: { documentId: string; fecha: string; boletos: number; ventasUsd: number; comisionUsd: number; estado: string }[];
}
export const getReportesEmpresa = (desde?: string, hasta?: string) => {
  const q = new URLSearchParams();
  if (desde) q.set('desde', desde);
  if (hasta) q.set('hasta', hasta);
  return api<ReportesEmpresa>(`/api/empresa/reportes?${q}`);
};

export interface UsuarioEmpresa {
  id: number;
  username: string;
  email: string;
  nombreCorto?: string;
  rol?: string;
  rolNombre?: string;
  taquilla?: string | null;
  taquillaId?: string | null;
  cedula?: string | null;
  bloqueado: boolean;
}
export const getUsuariosEmpresa = () => api<UsuarioEmpresa[]>('/api/empresa/usuarios');
export const crearUsuarioEmpresa = (datos: {
  username: string;
  password: string;
  nombreCorto: string;
  rol: 'cajero' | 'chofer' | 'colector' | 'empresa';
  taquillaId?: string;
  cedula?: string;
  email?: string;
}) => api<{ id: number }>('/api/empresa/usuarios', { method: 'POST', body: datos });
export const actualizarUsuarioEmpresa = (
  id: number,
  datos: {
    nombreCorto?: string;
    password?: string;
    rol?: 'cajero' | 'chofer' | 'colector' | 'empresa';
    taquillaId?: string | null;
    cedula?: string;
  }
) => api<{ id: number; actualizado: boolean }>(`/api/empresa/usuarios/${id}`, { method: 'PUT', body: datos });
export const bloquearUsuarioEmpresa = (id: number, bloqueado: boolean) =>
  api<{ id: number; bloqueado: boolean }>(`/api/empresa/usuarios/${id}/bloquear`, {
    method: 'PUT',
    body: { bloqueado },
  });

export const programarSalida = (datos: {
  rutaId: string;
  unidadId: string;
  choferId?: string;
  fechaHoraSalida: string;
  rampa?: string;
  /** Regreso vacío u otro viaje sin pasajeros: no sale a la venta. */
  sinPasajeros?: boolean;
}) => api<{ documentId: string }>('/api/empresa/salidas', { method: 'POST', body: datos });

/** Ciudades comunes a todas las líneas: el origen y el destino de las rutas salen de aquí. */
export interface Ciudad {
  id: number;
  nombre: string;
  estado: string | null;
  /** Centro de la ciudad en el mapa (null si aún no se ubicó). */
  lat?: number | null;
  lng?: number | null;
}
/** Un sitio del mapa con la ciudad del catálogo a la que pertenece (null = lejos de todas; `cercana` sugiere). */
export interface LugarMapa {
  nombre: string | null;
  detalle: string;
  lat: number;
  lng: number;
  ciudad: string | null;
  cercana?: string | null;
}
export const buscarLugares = (q: string) => api<{ lugares: LugarMapa[]; buscador: boolean }>(`/api/lugares?q=${encodeURIComponent(q)}`);
export const lugarEn = (lat: number, lng: number) => api<LugarMapa>(`/api/lugares/en?lat=${lat}&lng=${lng}`);
export const getCiudades = () => api<Ciudad[]>('/api/ciudades', { auth: false });
export const crearCiudad = (c: { nombre: string; estado?: string }) => api<Ciudad>('/api/admin/ciudades', { method: 'POST', body: c });
export const editarCiudad = (id: number, c: { nombre?: string; estado?: string }) => api<Ciudad>(`/api/admin/ciudades/${id}`, { method: 'PUT', body: c });
export const borrarCiudad = (id: number) => api<{ borrada: boolean }>(`/api/admin/ciudades/${id}`, { method: 'DELETE' });

export const cancelarSalida = (documentId: string, force = false) =>
  api<{ afectados: number; reembolsosPendientes: number }>(
    `/api/empresa/salidas/${documentId}/cancelar`,
    { method: 'POST', body: { force } }
  );

export const marcarLlegada = (salidaId: string) =>
  api<{ ubicacion: string | null }>(`/api/salidas/${salidaId}/llegada`, { method: 'POST', body: {} });

export const asignarChoferUnidad = (unidadId: string, choferId: string | null) =>
  api<{ asignado: string | null }>(`/api/unidades/${unidadId}/asignar-chofer`, {
    method: 'POST',
    body: { choferId },
  });

export interface HistorialConductor {
  chofer: { nombre: string; cedula?: string | null };
  unidadesACargo: { numero: string; marcaModelo: string; estado: string }[];
  viajes: {
    documentId: string;
    fechaHoraSalida: string;
    fechaHoraLlegadaReal?: string | null;
    estado: string;
    ruta?: { origen: string; destino: string } | null;
    unidad?: { numero: string } | null;
    abordados?: number | null;
  }[];
}
export const getHistorialConductor = (userId: number) =>
  api<HistorialConductor>(`/api/empresa/usuarios/${userId}/historial`);
export const marcarEquipaje = (qrId: string, delta: number, nota?: string) =>
  api<{ piezas: number }>('/api/boletos/equipaje', { method: 'POST', body: { qrId, delta, nota } });
export const getReembolsos = () =>
  api<import('./types').BoletoReembolso[]>('/api/boletos/reembolsos');
export const marcarReembolsado = (boletoId: string) =>
  api<{ reembolsado: boolean }>(`/api/boletos/${boletoId}/reembolsar`, { method: 'POST', body: {} });

export const actualizarConfiguracionEmpresa = (datos: Record<string, unknown>) =>
  api<{ actualizada: boolean }>('/api/empresa/configuracion', { method: 'PUT', body: datos });

export const getRutas = (lineaSlug?: string) =>
  api<import('./types').RutaDto[]>(
    `/api/rutas?populate[tarifas]=true&populate[paradas]=true&sort=codigo&pagination[pageSize]=100${lineaSlug ? `&filters[linea][slug][$eq]=${lineaSlug}` : ''}`
  );
export const guardarRuta = (documentId: string | null, data: Record<string, unknown>) =>
  documentId
    ? api<import('./types').RutaDto>(`/api/rutas/${documentId}`, { method: 'PUT', body: { data } })
    : api<import('./types').RutaDto>('/api/rutas', { method: 'POST', body: { data } });
export const eliminarRuta = (documentId: string) =>
  api<unknown>(`/api/rutas/${documentId}`, { method: 'DELETE' });

export const getChoferes = () =>
  api<{ documentId: string; nombre: string; cedula?: string }[]>(
    '/api/choferes?sort=nombre&pagination[pageSize]=100'
  );

export const buscarBoletos = (params: { folio?: string; fecha?: string }) => {
  const q = new URLSearchParams({
    'populate[salida][populate][ruta]': 'true',
    sort: 'createdAt:desc',
    'pagination[pageSize]': '30',
  });
  if (params.folio) q.set('filters[folio][$containsi]', params.folio);
  if (params.fecha) {
    q.set('filters[createdAt][$gte]', `${params.fecha}T00:00:00.000Z`);
    q.set('filters[createdAt][$lte]', `${params.fecha}T23:59:59.999Z`);
  }
  return api<import('./types').BoletoAdmin[]>(`/api/boletos?${q}`);
};

// ── Plataforma (superadmin) ──────────────────────────────────────────────────
export interface AdminEmpresaResumen {
  documentId: string;
  nombre: string;
  slug: string;
  comisionPct: number;
  activa: boolean;
  boletosHoy: number;
  ventasUsdHoy: number;
  comisionUsdHoy: number;
  pendienteUsd: number;
}
export interface AdminDashboard {
  empresas: number;
  empresasActivas: number;
  boletosHoy: number;
  ventasUsdHoy: number;
  comisionUsdHoy: number;
  comisionPendienteUsd: number;
  porEmpresa: AdminEmpresaResumen[];
}
export interface AdminEmpresa {
  documentId: string;
  nombre: string;
  slug: string;
  rif?: string | null;
  razonSocial?: string | null;
  terminalBase?: string | null;
  telefono?: string | null;
  comisionPct: number;
  activa: boolean;
  usuarios: number;
  logoUrl?: string | null;
  creadaEn: string;
}
export interface AdminLiquidacion {
  documentId: string;
  fecha: string;
  linea?: { nombre: string; slug: string } | null;
  boletos: number;
  anulados: number;
  ventasUsd: number;
  comisionUsd: number;
  comisionPct: number;
  estado: 'pendiente' | 'cobrada';
  cobradaEn?: string | null;
  notaCobro?: string | null;
}
export interface AdminEvento {
  id: number;
  tipo: string;
  fecha: string;
  linea?: string | null;
  usuario?: string | null;
  entidad?: string | null;
  entidadId?: string | null;
  monto?: number | null;
  moneda?: string | null;
  datos?: Record<string, unknown> | null;
}
export interface AdminTasas {
  vigentes: TasasVigentes;
  historial: { moneda: string; valor: number; fuente: string; vigenteDesde: string; registradaPor?: string | null }[];
}

export const getAdminDashboard = () => api<AdminDashboard>('/api/admin/dashboard');
export const getAdminEmpresas = () => api<AdminEmpresa[]>('/api/admin/empresas');

/** Pasajero registrado visto desde Plataforma (solo lectura). */
export interface AdminPasajero {
  documentId: string;
  username: string;
  nombreCorto?: string | null;
  email?: string | null;
  telefono?: string | null;
  documento?: string | null;
  confirmado: boolean;
  bloqueado: boolean;
  registradoEn: string | null;
  saldoBs: number;
  recargadoBs: number;
  recargasPendientes: number;
  pasajesUrbanos: number;
  boletos: number;
  ultimoMovimiento: string | null;
}
export interface AdminPasajeroFicha extends Omit<AdminPasajero, 'saldoBs' | 'recargadoBs' | 'recargasPendientes' | 'pasajesUrbanos' | 'boletos' | 'ultimoMovimiento'> {
  wallet: { saldoBs: number; movimientos: MovimientoWallet[] };
  boletos: (import('./types').BoletoMio & { compradoEn: string | null })[];
}
export const getAdminPasajeros = (buscar?: string) =>
  api<AdminPasajero[]>(`/api/admin/pasajeros${buscar ? `?buscar=${encodeURIComponent(buscar)}` : ''}`);
export const getAdminPasajero = (documentId: string) => api<AdminPasajeroFicha>(`/api/admin/pasajeros/${documentId}`);
export const crearEmpresa = (datos: {
  nombre: string;
  rif?: string;
  razonSocial?: string;
  terminalBase?: string;
  telefono?: string;
  logoId?: number;
  admin: { username: string; password: string; nombreCorto?: string };
}) => api<{ documentId: string; slug: string; contrato: null }>('/api/admin/empresas', { method: 'POST', body: datos });
export const actualizarEmpresa = (documentId: string, datos: Record<string, unknown>) =>
  api<{ actualizada: boolean }>(`/api/admin/empresas/${documentId}`, { method: 'PUT', body: datos });
export const getAdminLiquidaciones = (estado: string) =>
  api<AdminLiquidacion[]>(`/api/admin/liquidaciones?estado=${estado}`);
export const cobrarLiquidacion = (documentId: string, nota?: string) =>
  api<{ cobrada: boolean }>(`/api/admin/liquidaciones/${documentId}/cobrar`, { method: 'PUT', body: { nota } });
export const getAdminEventos = (params?: { tipo?: string; linea?: string }) => {
  const q = new URLSearchParams();
  if (params?.tipo) q.set('tipo', params.tipo);
  if (params?.linea) q.set('linea', params.linea);
  return api<AdminEvento[]>(`/api/admin/eventos?${q}`);
};
export const getAdminTasas = () => api<AdminTasas>('/api/admin/tasas');
export const setTasaManual = (moneda: 'BS' | 'COP', valor: number) =>
  api<{ registrada: boolean }>('/api/admin/tasas', { method: 'POST', body: { moneda, valor } });
export const refrescarBcv = () =>
  api<{ actualizada: boolean; valor?: number }>('/api/admin/tasas/refrescar-bcv', { method: 'POST', body: {} });

export const accesoPlataforma = (identifier: string, password: string, codigo?: string) =>
  api<{ requiere2fa?: true; jwt?: string; usuario?: UsuarioSesion }>('/api/plataforma/acceso', {
    method: 'POST',
    body: { identifier, password, codigo },
    auth: false,
  });
export const getSeguridad = () => api<{ totpHabilitado: boolean }>('/api/admin/seguridad');
export const generar2fa = () =>
  api<{ secreto: string; otpauthUri: string }>('/api/admin/seguridad/2fa/generar', { method: 'POST', body: {} });
export const activar2fa = (codigo: string) =>
  api<{ totpHabilitado: boolean }>('/api/admin/seguridad/2fa/activar', { method: 'POST', body: { codigo } });
export const desactivar2fa = (codigo: string) =>
  api<{ totpHabilitado: boolean }>('/api/admin/seguridad/2fa/desactivar', { method: 'POST', body: { codigo } });

/** Sube un archivo (`POST /api/upload`) y devuelve su id y su url. */
export const subirArchivo = async (archivo: File): Promise<{ id: number; url: string }> => {
  const fd = new FormData();
  fd.append('files', archivo);
  const jwt = (await import('../../stores/auth')).useAuth.getState().jwt;
  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
    body: fd,
  });
  if (!res.ok) throw new Error('upload_fallo');
  const [f] = await res.json();
  return { id: f.id, url: f.url };
};

// ── Tasas de la empresa (administrador y cajero) ─────────────────────────────
export interface TasaLineaDetalle {
  valor: number;
  propia: boolean;
  fuente?: string | null;
  vigenteDesde?: string | null;
  plataforma: number;
}
export const getTasasLinea = () =>
  api<{ bs: TasaLineaDetalle; cop: TasaLineaDetalle }>('/api/empresa/tasas');
export const fijarTasaLinea = (moneda: 'BS' | 'COP', valor: number) =>
  api<{ registrada: boolean }>('/api/empresa/tasas', { method: 'POST', body: { moneda, valor } });
export const usarTasaPlataforma = (moneda: 'BS' | 'COP') =>
  api<{ propia: boolean }>(`/api/empresa/tasas/${moneda}`, { method: 'DELETE' });

// ── Wallet (pasajes urbanos) ─────────────────────────────────────────────────
export interface MovimientoWallet {
  documentId: string;
  tipo: string;
  estado: 'pendiente' | 'confirmado' | 'rechazado';
  montoBs: number;
  direccion: 'entrada' | 'salida';
  referencia?: string | null;
  contraparte?: string | null;
  unidad?: string | null;
  fecha: string;
  nota?: string | null;
}
export const getWallet = () =>
  api<{ saldoBs: number; movimientos: MovimientoWallet[] }>('/api/wallet');
/** Con `comprobante` (captura del pago) va como multipart; sin él, JSON. */
export const reportarRecarga = (montoBs: number, referencia: string, banco?: string, comprobante?: File | null) => {
  let body: unknown = { montoBs, referencia, banco };
  if (comprobante) {
    const fd = new FormData();
    fd.append('montoBs', String(montoBs));
    fd.append('referencia', referencia);
    if (banco) fd.append('banco', banco);
    fd.append('comprobante', comprobante);
    body = fd;
  }
  return api<{ movimientoId: string; estado: string }>('/api/wallet/recargas', { method: 'POST', body });
};
/** A dónde transfiere el pasajero para recargar: lo fija el superadmin; `null` si aún no lo publicó. */
export interface PagoMovilPlataforma {
  banco: string;
  telefono: string;
  documento: string;
  titular: string | null;
  nota: string | null;
}
export const getPagoMovilPlataforma = () => api<PagoMovilPlataforma | null>('/api/ajustes/pago-movil', { auth: false });
export const fijarPagoMovilPlataforma = (datos: { banco: string; telefono: string; documento: string; titular?: string; nota?: string }) =>
  api<PagoMovilPlataforma>('/api/admin/ajustes/pago-movil', { method: 'PUT', body: datos });

export interface RecargaPendiente {
  documentId: string;
  montoBs: number;
  referencia?: string | null;
  banco?: string | null;
  /** Captura del pago que subió el pasajero, relativa al API (`/uploads/…`). */
  comprobanteUrl?: string | null;
  fecha: string;
  pasajero?: string | null;
  telefono?: string | null;
}
export const getRecargasPendientes = () =>
  api<RecargaPendiente[]>('/api/admin/wallet/recargas');
export const verificarRecarga = (movimientoId: string, aprobar: boolean, nota?: string) =>
  api<{ estado: string }>(`/api/admin/wallet/recargas/${movimientoId}/verificar`, {
    method: 'POST',
    body: { aprobar, nota },
  });
export interface Conciliacion {
  custodiaEsperadaBs: number;
  porTipo: Record<string, number>;
  recargasPendientes: number;
  cuentas: { documentId: string; tipo: string; nombre: string; saldoBs: number }[];
}
export const getConciliacion = () => api<Conciliacion>('/api/admin/wallet/conciliacion');

// ── Pasaje urbano ────────────────────────────────────────────────────────────
export interface UnidadUrbana {
  unidad: { documentId: string; numero: string };
  linea: { nombre: string };
  /** `null` = la unidad no tiene ruta urbana guardada: no cobra. */
  ruta: {
    documentId?: string;
    nombre: string;
    tarifaBs: number;
    /** Con tramos, el pasajero elige desde qué parada hasta cuál va. */
    tramos: import('../urbano').Tramo[];
    /** La ruta da la vuelta y regresa al origen. */
    circuito?: boolean;
    /** El cartel del parabrisas: por dónde pasa la buseta. */
    letreros?: string[];
    paradas: { orden: number; nombre: string; lat: number; lng: number }[];
    /** Parada más cercana a la buseta ahora: la propuesta para subirse. */
    paradaSugerida: number | null;
  } | null;
  enServicio: boolean;
}
export const getUnidadUrbana = (documentId: string) =>
  api<UnidadUrbana>(`/api/urbano/unidad/${documentId}`, { auth: false });
export interface ParadaTramo {
  orden: number;
  nombre: string;
}
export const pagarPasajeUrbano = (unidadId: string, tramo?: { desdeOrden: number; hastaOrden: number }) =>
  api<{ pagado: boolean; tarifaBs: number; ruta: string; unidad: string; linea: string; desde: ParadaTramo | null; hasta: ParadaTramo | null; hora: string; saldoBs: number }>(
    '/api/urbano/pagar',
    { method: 'POST', body: { unidadId, ...(tramo ?? {}) } }
  );
export interface CobrosUrbanos {
  unidad: string;
  ruta: string | null;
  tarifaBs: number;
  porTramos?: boolean;
  pagos: { documentId: string; hora: string; pasajero: string; montoBs: number; desde?: ParadaTramo | null; hasta?: ParadaTramo | null }[];
  totalHoy: number;
  recaudoHoyBs: number;
}
export const getCobrosUrbanos = (unidad: string) =>
  api<CobrosUrbanos>(`/api/urbano/cobros?unidad=${unidad}`);
export interface MapaRutaUrbana {
  nombre: string;
  linea: string;
  tarifaBs: number;
  tramos?: import('../urbano').Tramo[];
  letreros?: string[];
  recorrido: [number, number][];
  /** Dónde para la buseta: la primera es el origen y la última el destino. */
  paradas?: { nombre: string; orden: number; lat: number; lng: number }[];
  unidades: { documentId: string; numero: string; lat: number; lng: number; hora: string }[];
}
/** Ruta urbana en el listado público: lo que ve quien espera en la parada. */
export interface RutaUrbanaPublica {
  documentId: string;
  nombre: string;
  linea: string | null;
  tarifaBs: number;
  /** Con tramos: el pasaje más caro (tarifaBs es el más barato). */
  tarifaHastaBs?: number;
  porTramos?: boolean;
  /** El cartel del parabrisas. */
  letreros?: string[];
  origen: string | null;
  destino: string | null;
  paradas: number;
  busetasEnCamino: number;
  kmALaParadaMasCercana: number | null;
}
/** Público: no hace falta escanear ningún QR ni tener sesión. */
export const getRutasUrbanasPublicas = (opts?: { buscar?: string; lat?: number; lng?: number }) => {
  const q = new URLSearchParams();
  if (opts?.buscar) q.set('buscar', opts.buscar);
  if (opts?.lat != null && opts?.lng != null) {
    q.set('lat', String(opts.lat));
    q.set('lng', String(opts.lng));
  }
  const cola = q.toString();
  return api<RutaUrbanaPublica[]>(`/api/urbano/rutas${cola ? `?${cola}` : ''}`, { auth: false });
};

export const getMapaRutaUrbana = (rutaId: string) =>
  api<MapaRutaUrbana>(`/api/urbano/rutas/${rutaId}/mapa`, { auth: false });

// Rutas urbanas (empresa)
/** Parada de una ruta urbana: la primera es el origen y la última el destino. */
export interface ParadaUrbana {
  nombre: string;
  orden: number;
  lat: number;
  lng: number;
  /** Solo en el editor: precio del tramo que termina aquí (si esta parada es un corte de tarifa). */
  cortePrecioBs?: string;
}
export interface RutaUrbanaDto {
  documentId: string;
  nombre: string;
  tarifaBs: number;
  /** Cortes de tarifa; vacío = tarifa plana. */
  tramos?: import('../urbano').Tramo[];
  /** Sale y vuelve al mismo punto: el recorrido cierra de la última parada al origen. */
  circuito?: boolean;
  /** El cartel del parabrisas («5ta Avenida», «Centro», «Directo»…). */
  letreros?: string[];
  activa: boolean;
  /** Trazo sobre las calles (lo calcula el editor entre paradas). */
  recorrido?: [number, number][] | null;
  paradas?: ParadaUrbana[];
}
/** Catálogo de etiquetas de rutas de la línea («5ta Avenida», «Centro», «Directo»). */
export const getEtiquetasRutas = () => api<string[]>('/api/empresa/etiquetas-rutas');
export const guardarEtiquetaRuta = (texto: string) => api<string[]>('/api/empresa/etiquetas-rutas', { method: 'POST', body: { texto } });
export const borrarEtiquetaRuta = (texto: string) => api<string[]>(`/api/empresa/etiquetas-rutas/${encodeURIComponent(texto)}`, { method: 'DELETE' });
export const getRutasUrbanas = () =>
  api<RutaUrbanaDto[]>(
    '/api/rutas-urbanas?populate[paradas]=true&sort=nombre&pagination[pageSize]=100'
  );
export const guardarRutaUrbana = (documentId: string | null, data: Record<string, unknown>) =>
  documentId
    ? api<RutaUrbanaDto>(`/api/rutas-urbanas/${documentId}`, { method: 'PUT', body: { data } })
    : api<RutaUrbanaDto>('/api/rutas-urbanas', { method: 'POST', body: { data } });
export const eliminarRutaUrbana = (documentId: string) =>
  api<unknown>(`/api/rutas-urbanas/${documentId}`, { method: 'DELETE' });

// Servicio urbano por unidad (empresa)
export interface ServicioUrbanoUnidad {
  /** Catálogo: las rutas que esta unidad PUEDE hacer. */
  rutasUrbanaIds: string[];
  /** El turno es del CONDUCTOR: quién maneja, qué ruta hace y desde cuándo. */
  turnoEnCurso: {
    documentId: string;
    conductor: string;
    ruta: string | null;
    rutaId: string | null;
    abiertoEn: string;
    modo: 'urbano' | 'largo';
  } | null;
  /** La unidad quedó marcada en servicio sin turno que lo respalde. */
  desincronizada: boolean;
  repartoUrbano: { lineaPct: number; propietarioPct: number; conductorPct: number };
  propietarioUsuarioId: number | null;
}
/** Destraba un turno que quedó abierto y limpia las banderas de la unidad. */
export const cerrarTurnoDeUnidad = (unidadId: string) =>
  api<{ cerrado: boolean }>(`/api/unidades/${unidadId}/cerrar-turno`, { method: 'POST' });
export const getServicioUrbano = (unidadId: string) =>
  api<ServicioUrbanoUnidad>(`/api/unidades/${unidadId}/servicio-urbano`);
export const guardarServicioUrbano = (
  unidadId: string,
  datos: {
    rutasUrbanaIds: string[];
    repartoUrbano: { lineaPct: number; propietarioPct: number; conductorPct: number };
    propietarioUsuarioId: number | null;
  }
) => api<{ guardado: boolean }>(`/api/unidades/${unidadId}/servicio-urbano`, { method: 'POST', body: datos });

// ── Etiquetas físicas de equipaje por unidad ─────────────────────────────────
export interface ResumenEtiquetas {
  total: number;
  libres: number;
  usadas: number;
  rangos: string[];
}
export const getResumenEtiquetas = (unidadId: string) =>
  api<ResumenEtiquetas>(`/api/unidades/${unidadId}/etiquetas/resumen`);
export const cargarEtiquetas = (
  unidadId: string,
  datos: { prefijo: string; desde: number; hasta: number }
) =>
  api<{ creadas: number; repetidas: number }>(`/api/unidades/${unidadId}/etiquetas`, {
    method: 'POST',
    body: datos,
  });

// ── Cobro de la pieza de equipaje extra (wallet del pasajero) ────────────────
export interface CobroEquipaje {
  codigo: string;
  montoBs: number;
  estado: 'pendiente' | 'pagada' | 'vencido';
  pasajero: string | null;
  asientoId: string | null;
  linea: string | null;
  unidad: string | null;
  viaje: string | null;
}
/** Público: el pasajero escanea el QR del conductor y ve qué le cobran. */
export const getCobroEquipaje = (token: string) =>
  api<CobroEquipaje>(`/api/equipaje/cobro/${token}`);
export const pagarCobroEquipaje = (token: string) =>
  api<{ montoBs: number; saldoBs: number; repetido: boolean }>(
    `/api/equipaje/cobro/${token}/pagar`,
    { method: 'POST' }
  );

// ── Bodega de equipaje de una salida ─────────────────────────────────────────
export interface PiezaBodega {
  documentId: string;
  codigo: string;
  origenEtiqueta: 'empresa' | 'app';
  esExtra: boolean;
  cobroBs: number;
  estadoCobro: 'incluida' | 'cobrada' | 'pendiente' | 'exonerada';
  estado: 'a_bordo' | 'entregada' | 'no_reclamada';
  fragil: boolean;
  nota: string | null;
  entregadaEn: string | null;
  pasajero: string | null;
  asientoId: string | null;
  bajaEn: string | null;
}
export const getBodega = (salidaId: string) =>
  api<{
    piezas: PiezaBodega[];
    resumen: {
      total: number;
      aBordo: number;
      entregadas: number;
      extrasPendientes: number;
      montoPendienteBs: number;
    };
  }>(`/api/salidas/${salidaId}/bodega`);

// ── Cobro wallet por QR fijo de taquilla ─────────────────────────────────────
export interface ResumenCobro {
  lineaNombre: string;
  taquillaNombre: string;
  terminal?: string | null;
  origen?: string | null;
  destino?: string | null;
  fechaHoraSalida: string;
  unidadNumero?: string | null;
  asientos: string[];
  pasajeros: { asientoId: string; nombre: string }[];
  totalUsd: number;
  totalBs: number;
  tasaBcv: number;
}
export interface CobroTaquilla {
  documentId: string;
  estado: 'pendiente' | 'pagando' | 'pagado' | 'cancelado' | 'expirado';
  expiraEn: string;
  totalBs: number;
  resultado?: { boletos: unknown[]; resumen: ResumenCobro } | null;
}
export const crearCobroTaquilla = (datos: {
  reservaToken: string;
  pasajeros: { asientoId: string; nombre: string; documento?: string }[];
  turnoId: string;
}) =>
  api<{ documentId: string; totalBs: number; expiraEn: string }>('/api/cobros-taquilla', {
    method: 'POST',
    body: datos,
  });
export const getCobroTaquilla = (documentId: string) =>
  api<CobroTaquilla>(`/api/cobros-taquilla/${documentId}`);
export const cancelarCobroTaquilla = (documentId: string) =>
  api<{ cancelado: boolean }>(`/api/cobros-taquilla/${documentId}/cancelar`, { method: 'POST' });
export const getCobroDeTaquilla = (taquillaId: string) =>
  api<{
    taquilla: { nombre: string; terminal?: string | null; linea: string };
    cobro: { documentId: string; estado: string; expiraEn: string; resumen: ResumenCobro; totalBs: number } | null;
  }>(`/api/cobros-taquilla/taquilla/${taquillaId}`, { auth: false });
export const pagarCobroTaquilla = (documentId: string) =>
  api<{
    pagado: boolean;
    folios: string[];
    boletos: { folio: string; qrId: string; asientoId: string; pasajeroNombre: string }[];
    totalBs: number;
    saldoBs: number;
  }>(`/api/cobros-taquilla/${documentId}/pagar`, { method: 'POST' });

// Retiros
export const solicitarRetiro = (montoBs: number, datosPago: string) =>
  api<{ movimientoId: string }>('/api/wallet/retiros', { method: 'POST', body: { montoBs, datosPago } });
export const getWalletLinea = () => api<{ saldoBs: number; movimientos: MovimientoWallet[] }>('/api/empresa/wallet');
/** Cuenta bancaria o pago móvil de la línea para recibir retiros; se guarda una vez. */
export interface CuentaRetiro {
  id: string;
  tipo: 'pago_movil' | 'transferencia';
  alias: string | null;
  banco: string;
  numero: string;
  titular: string;
  documento: string | null;
  predeterminada: boolean;
}
export const getCuentasRetiro = () => api<CuentaRetiro[]>('/api/empresa/cuentas-retiro');
export const guardarCuentaRetiro = (c: Partial<CuentaRetiro> & { tipo: CuentaRetiro['tipo']; banco: string; numero: string; titular: string }) =>
  api<CuentaRetiro>('/api/empresa/cuentas-retiro', { method: 'POST', body: c });
export const eliminarCuentaRetiro = (id: string) => api<{ eliminado: boolean }>(`/api/empresa/cuentas-retiro/${id}`, { method: 'DELETE' });
export const retiroLinea = (montoBs: number, cuentaId: string) =>
  api<{ movimientoId: string }>('/api/empresa/wallet/retiros', { method: 'POST', body: { montoBs, cuentaId } });
export interface RetiroPendiente {
  documentId: string;
  montoBs: number;
  titular?: string | null;
  tipoTitular?: string | null;
  datosPago?: string | null;
  fecha: string;
}
export const getRetirosPendientes = () => api<RetiroPendiente[]>('/api/admin/wallet/retiros');
export const resolverRetiro = (movimientoId: string, aprobar: boolean, referencia?: string) =>
  api<{ resuelto: boolean }>(`/api/admin/wallet/retiros/${movimientoId}/resolver`, {
    method: 'POST',
    body: { aprobar, referencia },
  });

// ── Contratos y módulos — viven en el servidor nuevo (Nest) ──────────────────
export type ClaveModulo = 'flota' | 'mantenimiento' | 'boleteria' | 'taquilla' | 'equipaje' | 'urbano';
export interface ModuloCatalogo {
  clave: ClaveModulo;
  nombre: string;
  descripcion: string;
  depende: ClaveModulo[];
  cobro: 'comision' | 'por_bus' | 'ninguno';
}
/** Cómo se vende la plataforma: un plan preajusta los módulos y su forma de cobro. */
export type ClavePlan = 'mantenimiento' | 'venta' | 'completo' | 'personalizado';
export interface PlanCatalogo {
  clave: Exclude<ClavePlan, 'personalizado'>;
  nombre: string;
  descripcion: string;
  modulos: ClaveModulo[];
  cobro: 'por_bus' | 'comision';
}
export type EstadoContrato = 'vigente' | 'por_vencer' | 'vencido';
export interface Contrato {
  documentId: string;
  linea: { documentId: string; nombre: string; slug: string };
  version: number;
  plan: ClavePlan;
  modulos: ClaveModulo[];
  comisionPct: number;
  montoBusUsd: number;
  diasGracia: number;
  vigenteDesde: string;
  vigenteHasta: string | null;
  /** Plazo en meses; `venceEn` es el último día en que rige (inclusive). Sin plazo = indefinido. */
  plazoMeses: number | null;
  venceEn: string | null;
  estado: EstadoContrato;
  diasRestantes: number | null;
  notas: string | null;
  creadoEn: string;
}
export interface ResumenContratoLinea {
  linea: { documentId: string; nombre: string; slug: string; activa: boolean };
  contrato: Contrato | null;
}
/** Lo que ve el personal de una línea: `sinContrato` y `vencido` = nada abierto. */
export interface MiContrato {
  sinContrato: boolean;
  /** La boletería de la línea carga rutas y salidas por la API: el panel queda en solo lectura. */
  integracionActiva?: boolean;
  vencido: boolean;
  modulos: ClaveModulo[];
  contrato: Contrato | null;
}
export const getCatalogoModulos = () => api<ModuloCatalogo[]>('/api/admin/contratos/modulos');
export const getCatalogoPlanes = () => api<PlanCatalogo[]>('/api/admin/contratos/planes');
export const getAdminContratos = () => api<ResumenContratoLinea[]>('/api/admin/contratos');
export const getHistorialContratos = (lineaId: string) => api<Contrato[]>(`/api/admin/contratos/linea/${lineaId}`);
export const crearContrato = (datos: {
  lineaId: string;
  plan?: ClavePlan;
  modulos: ClaveModulo[];
  comisionPct: number;
  montoBusUsd: number;
  diasGracia: number;
  vigenteDesde?: string;
  plazoMeses?: number | null;
  notas?: string;
}) => api<Contrato>('/api/admin/contratos', { method: 'POST', body: datos });
export const getMiContrato = () => api<MiContrato>('/api/contratos/mio');

// ── Facturas por bus ────────────────────────────────────────────────────────
export type EstadoFactura = 'pendiente' | 'por_verificar' | 'pagada' | 'vencida';
export interface Factura {
  documentId: string;
  linea: { documentId: string; nombre: string; slug: string };
  contratoDocumentId: string;
  periodo: string;
  buses: number;
  montoBusUsd: number;
  montoUsd: number;
  tasaBs: number;
  montoBs: number;
  estado: EstadoFactura;
  emitidaEn: string;
  venceEn: string;
  referencia: string | null;
  banco: string | null;
  pagoReportadoEn: string | null;
  verificadaEn: string | null;
  notaRechazo: string | null;
  detalle: { documentId: string; numero: string; placa: string | null; estado: string }[] | null;
}
export const getAdminFacturas = (params?: { estado?: string; linea?: string }) => {
  const q = new URLSearchParams();
  if (params?.estado) q.set('estado', params.estado);
  if (params?.linea) q.set('linea', params.linea);
  return api<Factura[]>(`/api/admin/facturas?${q}`);
};
export const generarFacturas = (periodo?: string) =>
  api<{ periodo: string; generadas: Factura[]; omitidas: number }>('/api/admin/facturas/generar', {
    method: 'POST',
    body: periodo ? { periodo } : {},
  });
export const vencerFacturas = () =>
  api<{ vencidas: number }>('/api/admin/facturas/vencer', { method: 'POST', body: {} });
export const verificarFactura = (documentId: string, aprobada: boolean, nota?: string) =>
  api<Factura>(`/api/admin/facturas/${documentId}/verificar`, { method: 'POST', body: { aprobada, nota } });
export const getMisFacturas = () => api<Factura[]>('/api/empresa/facturas');
export const reportarPagoFactura = (documentId: string, referencia: string, banco?: string) =>
  api<Factura>(`/api/empresa/facturas/${documentId}/pagar`, { method: 'POST', body: { referencia, banco } });

// ── Rastreo de la flota (Mantenimiento y Urbano) ─────────────────────────────
export interface UnidadEnVivo {
  documentId: string;
  numero: string;
  placa: string | null;
  estado: string | null;
  chofer: string | null;
  posicion: { lat: number; lng: number; hora: string | null; haceSeg: number | null; viva: boolean } | null;
  jornada: { modo: 'urbano' | 'largo' | 'jornada'; abiertoEn: string | null } | null;
  /** La ruta urbana que hace (o la primera de su catálogo), para dibujarla de fondo. */
  ruta: { documentId: string; nombre: string } | null;
}
export interface Recorrido {
  unidad: string;
  desde: string;
  hasta: string;
  total: number;
  puntos: { lat: number; lng: number; hora: string; velocidadKmh: number | null }[];
}
export const getFlotaEnVivo = () => api<UnidadEnVivo[]>('/api/empresa/flota-en-vivo');
export const getRecorrido = (unidadId: string, desde?: string, hasta?: string) => {
  const q = new URLSearchParams();
  if (desde) q.set('desde', desde);
  if (hasta) q.set('hasta', hasta);
  return api<Recorrido>(`/api/unidades/${unidadId}/recorrido${q.size ? `?${q}` : ''}`);
};

// ── Integraciones (API externa de la boletería de la línea) ──────────────────
export interface Integracion {
  documentId: string;
  linea: { documentId: string; nombre: string };
  nombre: string;
  clavePrefijo: string;
  webhookUrl: string | null;
  webhookConfigurado: boolean;
  activa: boolean;
  ultimoUsoEn: string | null;
  claveRotadaEn: string | null;
  creadaEn: string | null;
}
/** Solo al crear o rotar: la clave y el secreto se muestran UNA vez. */
export type IntegracionConSecretos = Integracion & { clave?: string; webhookSecreto?: string };
export interface EntregaWebhook {
  documentId: string;
  tipo: string;
  entidadId: string | null;
  estado: 'pendiente' | 'entregado' | 'fallido';
  intentos: number;
  ultimoStatus: number | null;
  ultimoError: string | null;
  proximoIntentoEn: string | null;
  entregadoEn: string | null;
  creadoEn: string | null;
}
export const getIntegraciones = () => api<Integracion[]>('/api/admin/integraciones');
export const crearIntegracion = (datos: { lineaId: string; nombre: string; webhookUrl?: string }) =>
  api<IntegracionConSecretos>('/api/admin/integraciones', { method: 'POST', body: datos });
export const actualizarIntegracion = (id: string, datos: { nombre?: string; webhookUrl?: string | null; activa?: boolean }) =>
  api<IntegracionConSecretos>(`/api/admin/integraciones/${id}`, { method: 'PUT', body: datos });
export const rotarClaveIntegracion = (id: string) => api<IntegracionConSecretos>(`/api/admin/integraciones/${id}/rotar-clave`, { method: 'POST', body: {} });
export const rotarSecretoIntegracion = (id: string) => api<IntegracionConSecretos>(`/api/admin/integraciones/${id}/rotar-secreto`, { method: 'POST', body: {} });
export const getEntregasIntegracion = (id: string, estado?: string) => api<EntregaWebhook[]>(`/api/admin/integraciones/${id}/entregas${estado ? `?estado=${estado}` : ''}`);
export const reintentarEntrega = (id: string, eventoId: string) => api<{ ok: boolean }>(`/api/admin/integraciones/${id}/entregas/${eventoId}/reintentar`, { method: 'POST', body: {} });
export const probarWebhook = (id: string) => api<{ documentId: string }>(`/api/admin/integraciones/${id}/probar`, { method: 'POST', body: {} });

// ── Conectores (Solo boletería: Butaca consume la API de la línea) ──────────
export interface Conector {
  documentId: string;
  linea: { documentId: string; nombre: string };
  tipo: string;
  nombre: string;
  activo: boolean;
  ultimaSyncEn: string | null;
  ultimoError: string | null;
  creadoEn: string | null;
}
export interface ResultadoSync {
  rutas: number;
  unidades: number;
  salidasNuevas: number;
  salidasActualizadas: number;
}
export const getConectores = () => api<Conector[]>('/api/admin/conectores');
export const crearConector = (datos: { lineaId: string; tipo: string; nombre: string; config: unknown }) =>
  api<Conector>('/api/admin/conectores', { method: 'POST', body: datos });
export const actualizarConector = (id: string, datos: { activo?: boolean; nombre?: string; config?: unknown }) =>
  api<Conector>(`/api/admin/conectores/${id}`, { method: 'PUT', body: datos });
export const sincronizarConector = (id: string) => api<ResultadoSync>(`/api/admin/conectores/${id}/sincronizar`, { method: 'POST', body: {} });
