/** Funciones por recurso — el único lugar que conoce las rutas de Strapi. */
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
}) => {
  const q = new URLSearchParams({
    'populate[ruta]': 'true',
    'populate[unidad]': 'true',
    'populate[linea]': 'true',
    sort: params?.orden ?? 'fechaHoraSalida',
    'pagination[pageSize]': '50',
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
  rol: 'cajero' | 'chofer' | 'empresa';
  taquillaId?: string;
  cedula?: string;
  email?: string;
}) => api<{ id: number }>('/api/empresa/usuarios', { method: 'POST', body: datos });
export const actualizarUsuarioEmpresa = (
  id: number,
  datos: {
    nombreCorto?: string;
    password?: string;
    rol?: 'cajero' | 'chofer' | 'empresa';
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
}) => api<{ documentId: string }>('/api/empresa/salidas', { method: 'POST', body: datos });

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
  unidadFija: { numero: string; marcaModelo: string } | null;
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
    `/api/rutas?populate[tarifas]=true&sort=codigo&pagination[pageSize]=100${lineaSlug ? `&filters[linea][slug][$eq]=${lineaSlug}` : ''}`
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
export const crearEmpresa = (datos: {
  nombre: string;
  rif?: string;
  razonSocial?: string;
  terminalBase?: string;
  telefono?: string;
  comisionPct?: number;
  logoId?: number;
  admin: { username: string; password: string; nombreCorto?: string };
}) => api<{ documentId: string; slug: string }>('/api/admin/empresas', { method: 'POST', body: datos });
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

/** Sube un archivo al media library de Strapi y devuelve su id. */
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
