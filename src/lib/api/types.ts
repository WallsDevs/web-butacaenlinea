/** Contratos TS de la API — espejo de los endpoints del backend (api/). */

// ── Tasas ────────────────────────────────────────────────────────────────────
export interface TasasVigentes {
  bcv: number;
  cop: number;
  bsPropia?: boolean;
  vigenteDesde: string | null;
  serverTime: string;
}

// ── Empresas (líneas) ────────────────────────────────────────────────────────
export interface LineaDto {
  documentId: string;
  nombre: string;
  slug: string;
  razonSocial?: string;
  rif?: string;
  terminalBase?: string;
  telefono?: string;
  tasaTerminalUsd: number;
  seguroViajeUsd: number;
  /** Equipaje del turno largo: etiquetas del talonario de la empresa o generadas por la app. */
  modoEtiquetaEquipaje?: 'empresa' | 'app';
  piezasIncluidasPorBoleto?: number;
  tarifaPiezaExtraUsd?: number;
}

// ── Salidas (listado paginado, sintaxis REST heredada) ───────────────────────
/** Parada intermedia del itinerario: donde el conductor puede dejar pasajeros. */
export interface ParadaRuta {
  nombre: string;
  ciudad?: string | null;
  orden: number;
  minutosDesdeOrigen?: number | null;
  minutosDeParada?: number | null;
}

export interface LugarRuta {
  nombre: string | null;
  lat: number;
  lng: number;
}

export interface RutaDto {
  /** Id numérico: sirve para enlazar la ida con su vuelta (inversaId). */
  id: number;
  documentId: string;
  codigo: string;
  nombre: string;
  origen: string;
  destino: string;
  duracionMin: number;
  distanciaKm: number;
  /** Ida y vuelta: id (numérico) de la ruta de vuelta enlazada; la línea las ve como una sola. */
  inversaId?: number | null;
  idaYVuelta?: boolean;
  /** Sitio exacto de salida y de llegada (terminal) marcado en el mapa. */
  origenLugar?: LugarRuta | null;
  destinoLugar?: LugarRuta | null;
  tarifas?: { claseServicio: string; precioUsd: number }[];
  paradas?: ParadaRuta[];
}

export interface UnidadResumenDto {
  documentId: string;
  numero: string;
  marcaModelo: string;
  amenidades?: string[];
  configuracionAsientos?: ConfiguracionAsientos;
  estado?: string;
}

export interface SalidaDto {
  documentId: string;
  fechaHoraSalida: string;
  fechaHoraLlegada: string;
  rampa: string;
  estado: 'programada' | 'abordando' | 'en_ruta' | 'finalizada' | 'cancelada';
  fechaHoraLlegadaReal?: string | null;
  preciosUsd: Record<string, number>;
  /** El bus viaja sin pasajeros (p. ej. regreso vacío): no se vende. */
  sinPasajeros?: boolean;
  ruta?: RutaDto;
  unidad?: UnidadResumenDto;
  linea?: { documentId: string; nombre: string; slug: string };
  reporteSalida?: ReporteSalida | null;
}

export interface ReporteSalida {
  abordados: number;
  ausentes: number;
  piezasEquipaje: number;
  cerradoPor: string;
  hora: string;
}

// ── Configuración de asientos (unidad) ───────────────────────────────────────
export interface PisoConfig {
  numero: number;
  nombre: string;
  claseServicio: string;
  layout: { izquierda: number; derecha: number };
  filas: string[];
  asientoInicial: number;
  /** Puestos de la fila trasera corrida (sin pasillo); 0 o ausente: no hay. */
  filaTrasera?: number;
}
export interface ConfiguracionAsientos {
  pisos: PisoConfig[];
  padDigitos?: number;
}

// ── Mapa de asientos ─────────────────────────────────────────────────────────
export type EstadoAsiento = 'libre' | 'ocupado' | 'reservado';

export interface AsientoMapa {
  id: string;
  estado: EstadoAsiento;
}
export interface FilaMapa {
  fila: string;
  izquierda: AsientoMapa[];
  derecha: AsientoMapa[];
  /** Fila trasera corrida: se pinta sin pasillo. */
  completa?: boolean;
}
export interface PisoMapa {
  numero: number;
  nombre: string;
  claseServicio: string;
  layout: { izquierda: number; derecha: number };
  totalAsientos: number;
  filas: FilaMapa[];
}
export interface MapaAsientos {
  salida: {
    documentId: string;
    estado: SalidaDto['estado'];
    fechaHoraSalida: string;
    fechaHoraLlegada: string;
    rampa: string;
    ruta?: { origen: string; destino: string; duracionMin: number };
    unidad?: { numero: string; marcaModelo: string; amenidades?: string[] };
    linea?: { nombre: string; slug: string };
  };
  pisos: PisoMapa[];
  resumen: { total: number; libres: number; ocupados: number; reservados: number };
  preciosUsd: Record<string, number>;
  recargosUsd: { tasaTerminal: number; seguro: number };
  tasas: { bcv: number; cop: number; vigenteDesde: string | null };
  serverTime: string;
}

// ── Reserva TTL ──────────────────────────────────────────────────────────────
export interface ReservaCreada {
  ok: true;
  token: string;
  expiraEn: string;
  ttlSegundos: number;
  serverTime: string;
  asientos: string[];
}

// ── Emisión ──────────────────────────────────────────────────────────────────
export interface PasajeroEmision {
  asientoId: string;
  nombre: string;
  documento?: string;
  telefono?: string;
  equipajePiezas?: number;
  equipajeNota?: string;
}

export type MetodoPago =
  | 'efectivo_bs'
  | 'efectivo_usd'
  | 'pago_movil'
  | 'transferencia'
  | 'punto_venta'
  | 'tarjeta_cop'
  | 'zelle'
  | 'wallet';

export type EstadoPago = 'verificado' | 'por_verificar' | 'rechazado';

export interface BoletoEmitido {
  documentId: string;
  folio: string;
  estadoPago: EstadoPago;
  qrId: string;
  qr: string;
  asientoId: string;
  piso: number;
  claseServicio: string;
  pasajeroNombre: string;
  pasajeroDocumento?: string;
  precioUsd: number;
  totalUsd: number;
  totalPagado: { moneda: 'USD' | 'BS' | 'COP'; monto: number; tasa: number };
}

export interface ResultadoEmision {
  ok: true;
  boletos: BoletoEmitido[];
  resumen: { cantidad: number; totalUsd: number };
}

// ── Boleto público ("Mi boleto") ─────────────────────────────────────────────
export interface BoletoPublico {
  folio: string;
  qrId: string;
  qr: string;
  estado: 'emitido' | 'abordado' | 'no_show' | 'anulado';
  estadoPago: EstadoPago;
  asientoId: string;
  piso: number;
  claseServicio: string;
  pasajeroNombre: string;
  pasajeroDocumento?: string;
  equipajePiezas: number;
  totalUsd: number;
  monedaPago: 'USD' | 'BS' | 'COP';
  montoCobrado: number;
  linea?: { nombre: string; slug: string };
  salida: {
    documentId: string;
    fechaHoraSalida: string;
    fechaHoraLlegada: string;
    rampa: string;
    ruta?: { origen: string; destino: string };
    unidad?: { numero: string };
  };
}

// ── Validación de abordaje ───────────────────────────────────────────────────
export type ResultadoValidacion =
  | 'valido'
  | 'duplicado'
  | 'vencido'
  | 'anulado'
  | 'salida_incorrecta'
  | 'no_encontrado';

export interface RespuestaValidacion {
  resultado: ResultadoValidacion;
  repetida: boolean;
  boleto: {
    folio: string;
    qrId: string;
    asientoId: string;
    piso: number;
    claseServicio: string;
    pasajeroNombre: string;
    pasajeroDocumento?: string;
    equipajePiezas: number;
    equipajeNota?: string;
    abordadoEn?: string;
    pagoPorVerificar?: boolean;
  } | null;
}

// ── Verificación manual de pagos (la línea confirma contra su banco) ─────────
export interface BoletoPorVerificar {
  documentId: string;
  folio: string;
  creadoEn: string;
  pasajeroNombre: string;
  pasajeroDocumento?: string;
  asientoId: string;
  metodoPago: MetodoPago;
  monedaPago: 'USD' | 'BS' | 'COP';
  montoCobrado: number;
  totalUsd: number;
  referenciaPago?: string;
  salida?: { fechaHoraSalida: string; destino?: string };
}

// ── Cuenta del cliente ───────────────────────────────────────────────────────
export interface BoletoMio {
  qrId: string;
  folio: string;
  estado: 'emitido' | 'abordado' | 'no_show' | 'anulado';
  estadoPago: EstadoPago;
  asientoId: string;
  pasajeroNombre: string;
  totalUsd: number;
  linea?: { nombre: string; slug: string };
  salida?: {
    fechaHoraSalida: string;
    fechaHoraLlegada: string;
    ruta?: { origen: string; destino: string };
    unidad?: { numero: string };
  };
}

export interface MetodoPagoCliente {
  documentId: string;
  tipo: 'pago_movil' | 'transferencia' | 'zelle' | 'tarjeta_cop';
  alias?: string;
  banco?: string;
  telefonoPago?: string;
  titular?: string;
  documentoTitular?: string;
  predeterminado: boolean;
}

export interface VentasCajero {
  fecha: string;
  boletos: {
    documentId: string;
    folio: string;
    hora: string;
    pasajeroNombre: string;
    asientoId: string;
    destino?: string;
    metodoPago: MetodoPago;
    monedaPago: 'USD' | 'BS' | 'COP';
    montoCobrado: number;
    totalUsd: number;
    estado: string;
    estadoPago: EstadoPago;
  }[];
  resumen: { emitidos: number; anulados: number; totalUsd: number };
}

export interface TurnoMio {
  documentId: string;
  estado: 'abierto' | 'cerrado';
  abiertoEn: string;
  cerradoEn?: string;
  taquilla?: { nombre: string; serieFolio: string };
  cierre: CierreTurno | null;
}

// ── Boletos (vista de la empresa vía CRUD core tenantizado) ──────────────────
export interface BoletoAdmin {
  documentId: string;
  folio: string;
  createdAt: string;
  canal: 'web' | 'pos';
  asientoId: string;
  pasajeroNombre: string;
  pasajeroDocumento?: string;
  metodoPago: MetodoPago;
  monedaPago: 'USD' | 'BS' | 'COP';
  montoCobrado: number;
  totalUsd: number;
  estado: 'emitido' | 'abordado' | 'no_show' | 'anulado';
  estadoPago: EstadoPago;
  referenciaPago?: string;
  salida?: { fechaHoraSalida: string; ruta?: { destino: string } };
}

// ── Manifiesto ───────────────────────────────────────────────────────────────
export interface PiezaEquipaje {
  codigo: string;
  estado: 'a_bordo' | 'entregada' | 'no_reclamada';
  esExtra: boolean;
  estadoCobro: 'incluida' | 'cobrada' | 'pendiente' | 'exonerada';
}
export interface PasajeroManifiesto {
  documentId?: string;
  folio: string;
  qrId: string;
  asientoId: string;
  piso: number;
  pasajeroNombre: string;
  pasajeroDocumento?: string;
  /** `descendido` = subió y ya se bajó. Distinto de `no_show`, que nunca subió. */
  estado: 'abordado' | 'pendiente' | 'no_show' | 'descendido';
  equipajePiezas: number;
  equipajeNota?: string;
  piezas?: PiezaEquipaje[];
  piezasEnBodega?: number;
  abordadoEn?: string;
  descendidoEn?: string | null;
  descendidoLugar?: { tipo: string; nombre: string | null; lat: number | null; lng: number | null } | null;
}
export interface Manifiesto {
  salida: {
    documentId: string;
    estado: SalidaDto['estado'];
    fechaHoraSalida: string;
    rampa: string;
    ruta?: {
      documentId?: string;
      origen: string;
      destino: string;
      paradas?: ParadaRuta[];
    };
    unidad?: { numero: string };
    reporteSalida: ReporteSalida | null;
  };
  pasajeros: PasajeroManifiesto[];
  resumen: {
    total: number;
    abordados: number;
    aBordo?: number;
    descendidos?: number;
    pendientes: number;
    ausentes: number;
    piezas: number;
    piezasEnBodega?: number;
    piezasEntregadas?: number;
  };
}

// ── Turnos ───────────────────────────────────────────────────────────────────
export interface TurnoDto {
  documentId: string;
  estado: 'abierto' | 'cerrado';
  abiertoEn: string;
  cerradoEn?: string;
  cierre: CierreTurno | null;
  taquilla?: { documentId: string; nombre: string; terminal: string; serieFolio: string };
  cajero?: { nombreCorto: string };
}
export interface CierreTurno {
  folios: { desde: string | null; hasta: string | null; emitidos: number };
  porMetodo: { metodoPago: MetodoPago; moneda: 'USD' | 'BS' | 'COP'; monto: number; boletos: number }[];
  totalUsd: number;
  anulaciones: { cantidad: number; montoUsd: number };
  cajero?: string;
  abiertoEn?: string;
  cerradoEn?: string;
}
export interface Arqueo extends CierreTurno {
  estado: 'abierto' | 'cerrado';
  cierrePersistido: CierreTurno | null;
}

// ── Flota ────────────────────────────────────────────────────────────────────
export interface UnidadDto {
  documentId: string;
  numero: string;
  placa: string;
  marcaModelo: string;
  anio: number;
  estado: 'disponible' | 'en_ruta' | 'en_mantenimiento' | 'fuera_de_servicio';
  ubicacionActual?: string | null;
  configuracionAsientos: ConfiguracionAsientos;
  configuracionEjes: { ejes: { numero: number; nombre: string; tipo: string; porLado: number }[] };
  amenidades?: string[];
  kilometraje: number;
  promedioKmSemana?: number;
  kmUltimoCambioAceite?: number;
  fechaUltimoCambioAceite?: string;
  intervaloAceiteKm?: number;
  documentos?: { tipo: string; numero?: string; vence?: string }[];
  choferAsignado?: { documentId: string; nombre: string; cedula: string; licenciaGrado: string; licenciaVence: string };
}

export interface CauchoDto {
  documentId: string;
  serial: string;
  marca: string;
  medida: string;
  posicion: string;
  fechaInstalacion: string;
  kmInstalacion: number;
  recorridoKm: number;
  profundidadMm: number;
  profundidadNuevaMm: number;
  desgastePct: number | null;
  reencauches: number;
  maxReencauches: number;
  estado: 'sano' | 'rotacion_sugerida' | 'reemplazo_vencido' | 'en_deposito' | 'desechado';
}
export interface DiagramaCauchos {
  unidad: { numero: string; kilometraje: number };
  ejes: {
    numero: number;
    nombre: string;
    tipo: string;
    izquierda: { posicion: string; caucho: CauchoDto | null }[];
    derecha: { posicion: string; caucho: CauchoDto | null }[];
  }[];
  totalPosiciones: number;
}

export interface Alerta {
  titulo: string;
  nota: string;
  tono: 'ok' | 'warn' | 'bad';
}

export interface OrdenMantenimientoDto {
  documentId: string;
  fecha: string;
  tipo: 'preventivo' | 'correctivo';
  intervencion: string;
  detalle?: string;
  km: number;
  taller: string;
  costoUsd: number;
  diasFueraServicio: number;
}

export interface ResumenMantenimiento {
  anio: number;
  costoAnioUsd: number;
  costoPorKmUsd: number | null;
  diasFueraServicio: number;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export interface UsuarioSesion {
  id: number;
  username: string;
  email: string;
  nombreCorto?: string;
  telefono?: string;
  documento?: string;
  role?: { type: string; name: string };
  linea?: { documentId: string; nombre: string; slug: string };
  taquilla?: { documentId: string; nombre: string; serieFolio: string };
}

export interface BoletoReembolso {
  documentId: string;
  folio: string;
  anuladoEn: string | null;
  pasajeroNombre: string;
  pasajeroDocumento: string;
  pasajeroTelefono?: string | null;
  metodoPago: string;
  monedaPago: string;
  montoCobrado: number;
  totalUsd: number;
  referenciaPago?: string | null;
  salida?: { fechaHoraSalida: string; destino?: string } | null;
}
