import type { ReactNode } from 'react';
import { ApiError } from '../../../lib/api/client';
import styles from '../flota.module.css';

export const km = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('es-VE'));
export const usd = (n: number | null | undefined) =>
  n == null ? '—' : `$ ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const cantidad = (n: number) => n.toLocaleString('es-VE', { maximumFractionDigits: 2 });
const MEDIDA_CORTA: Record<string, [string, string]> = { unidad: ['unid.', 'unid.'], litro: ['litro', 'litros'], galon: ['galón', 'galones'], kg: ['kg', 'kg'], metro: ['m', 'm'], juego: ['juego', 'juegos'], caja: ['caja', 'cajas'] };
/** «40 litros», «1 juego», «3 unid.» */
export const conMedida = (n: number, medida: string) => `${cantidad(n)} ${(MEDIDA_CORTA[medida] ?? [medida, medida])[n === 1 ? 0 : 1]}`;
/** Fecha de hoy en Venezuela (UTC−4), como la guarda el servidor. */
export const hoyVe = () => new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
export const fechaCortaVe = (iso?: string | null) => {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
/** «lun 21 oct» de una fecha AAAA-MM-DD. */
export const diaLargo = (fecha: string) => {
  const d = new Date(`${fecha}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
};
/** Acepta coma o punto decimal; vacío o inválido → null. */
export const numeroDe = (s: string): number | null => {
  if (!s.trim()) return null;
  // «1.250,5» → 1250.5; «1250.5» → 1250.5
  const limpio = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(limpio.trim());
  return Number.isFinite(n) ? n : null;
};

/** Enteros como los escribe la gente: «45.380» es cuarenta y cinco mil, no 45,38. */
export const enteroDe = (s: string): number | null => {
  const limpio = s.replace(/[.\s]/g, '').split(',')[0];
  if (!/^\d+$/.test(limpio)) return null;
  return Number(limpio);
};

/** Cuánto falta, en palabras: «Faltan 2.300 km · ≈ 12 días» o «Vencido por 800 km». */
export function cuantoFalta(s: { faltanKm: number | null; faltanDias: number | null; fechaEstimada?: string | null }) {
  const partes: string[] = [];
  if (s.faltanKm != null) partes.push(s.faltanKm <= 0 ? `Vencido por ${km(-s.faltanKm)} km` : `Faltan ${km(s.faltanKm)} km`);
  if (s.faltanDias != null) {
    if (s.faltanDias < 0) partes.push(`hace ${-s.faltanDias} día${s.faltanDias === -1 ? '' : 's'}`);
    else if (s.faltanDias === 0) partes.push('hoy');
    else partes.push(`${s.faltanKm != null ? '≈ ' : ''}${s.faltanDias} día${s.faltanDias === 1 ? '' : 's'}${s.fechaEstimada ? ` (${diaLargo(s.fechaEstimada)})` : ''}`);
  }
  return partes.join(' · ') || 'Sin datos para calcular';
}

const MENSAJES: Record<string, string | ((d: Record<string, unknown>) => string)> = {
  km_requerido: 'Escribe el kilometraje.',
  km_no_creciente: (d) => `El km tiene que ser mayor que el actual (${km(Number(d.actual))}).`,
  serial_requerido: 'Escribe el serial del caucho.',
  posicion_ocupada: (d) => `La posición ${d.posicion} ya tiene un caucho${d.serial ? ` (${d.serial})` : ''}.`,
  posicion_invalida: 'Esa posición no existe en la unidad.',
  rotacion_invalida: (d) => (d.ocupada ? `La posición ${d.posicion} está ocupada: tócala para intercambiar los dos cauchos.` : 'Ese movimiento no es posible: revisa las posiciones.'),
  caucho_no_montado: 'Ese caucho no está montado en la unidad.',
  profundidad_invalida: (d) => `La banda tiene que estar entre 0 y ${d.maximo} mm.`,
  caucho_desechado: 'Ese caucho ya está desechado.',
  no_esta_en_deposito: 'Ese caucho ya no está en el depósito.',
  sin_reencauches: (d) => `Ya tiene ${d.hechos} reencauches, el máximo para ese caucho.`,
  sin_posicion: 'Ese caucho no está montado.',
  tipo_invalido: 'Escoge si es preventivo o correctivo.',
  intervencion_requerida: 'Escribe qué se hizo o qué falla tiene.',
  fecha_invalida: 'La fecha no es válida.',
  fecha_fin_invalida: 'La fecha de salida del taller no puede ser antes de la entrada.',
  orden_cerrada: 'Esa orden ya estaba cerrada.',
  costo_invalido: 'El costo no puede ser negativo.',
  servicio_no_encontrado: 'Uno de los servicios marcados ya no existe; recarga la página.',
  repuestos_invalidos: 'Revisa los repuestos: cada uno necesita una cantidad mayor que cero.',
  repuesto_no_encontrado: 'Uno de los repuestos ya no está en el inventario.',
  stock_insuficiente: (d) => `No hay suficiente ${d.repuesto}: quedan ${cantidad(Number(d.stock))} y pediste ${cantidad(Number(d.pedido))}.`,
  nombre_requerido: 'Escribe el nombre.',
  codigo_repetido: (d) => `Ya tienes un repuesto con el código ${d.codigo}.`,
  unidad_medida_invalida: 'Escoge una unidad de medida de la lista.',
  cantidad_invalida: 'La cantidad tiene que ser mayor que cero.',
  costo_requerido: 'Escribe el costo por unidad.',
  nota_requerida: 'Explica el ajuste (por ejemplo «conteo de fin de mes»).',
  solo_empresa: 'Esto lo hace la empresa desde su cuenta.',
  control_invalido: 'Escoge cómo se controla: por km, por fecha o ambos.',
};

/** Mensaje para la persona: qué pasó y qué hacer. */
export function mensajeError(e: unknown): string {
  if (e instanceof ApiError) {
    const m = MENSAJES[e.code];
    if (typeof m === 'function') return m((e.details as Record<string, unknown>) ?? {});
    if (m) return m;
    if (e.status === 0 || e.status >= 500) return 'No hubo respuesta del servidor. Revisa tu conexión e intenta de nuevo.';
  }
  return 'No se pudo guardar. Intenta de nuevo.';
}

export function Modal({ titulo, nota, children, ancho, onCerrar }: { titulo: string; nota?: ReactNode; children: ReactNode; ancho?: number; onCerrar: () => void }) {
  return (
    <div className={styles.velo} onClick={onCerrar} role="presentation">
      <div className={styles.modal} style={ancho ? { width: ancho } : undefined} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={titulo}>
        <h3 style={{ fontSize: 20, fontWeight: 700 }}>{titulo}</h3>
        {nota && <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4, lineHeight: 1.5 }}>{nota}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>{children}</div>
      </div>
    </div>
  );
}

export function ErrorLinea({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <div role="alert" style={{ fontSize: 13, color: 'var(--bad-text)', background: 'var(--bad-bg)', padding: '10px 12px', borderRadius: 12 }}>
      {texto}
    </div>
  );
}
