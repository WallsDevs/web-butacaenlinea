import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getVentasSalida } from '../../lib/api/endpoints';
import type { SalidaDto } from '../../lib/api/types';
import { fechaCorta, hora } from '../../lib/time';
import styles from './EmpresaSalidas.module.css';

/** Cada cuánto se vuelve a preguntar: lo bastante seguido para verlo «en vivo». */
const CADA_MS = 5000;

const CANAL: Record<string, string> = { web: 'Web', app: 'App', taquilla: 'Taquilla', pos: 'Taquilla', externo: 'Sistema de la línea', integracion: 'Sistema de la línea' };
const PAGO: Record<string, { texto: string; tono: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  verificado: { texto: 'Pagado', tono: 'ok' },
  por_verificar: { texto: 'Por verificar', tono: 'warn' },
  pendiente: { texto: 'Sin pagar', tono: 'neutral' },
  reembolso_pendiente: { texto: 'Por reembolsar', tono: 'bad' },
  reembolsado: { texto: 'Reembolsado', tono: 'neutral' },
};

/** «hace 3 min», «hace 20 s». */
function hace(iso: string | null, ahora: number) {
  if (!iso) return '';
  const s = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000));
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  return `${fechaCorta(iso)} ${hora(iso)}`;
}
/** «4:32» que le quedan a una compra en curso. */
function queda(iso: string | null, ahora: number) {
  if (!iso) return '';
  const s = Math.max(0, Math.round((new Date(iso).getTime() - ahora) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Las ventas de una salida en vivo, para el administrador de la línea: quién
 * está comprando ahora mismo (puestos apartados mientras paga, con su cuenta
 * regresiva) y los boletos vendidos con su pasajero, puesto, canal y pago.
 * Se actualiza solo cada pocos segundos; lo nuevo se resalta al llegar.
 */
export function PanelVentas({ salida, onCerrar }: { salida: SalidaDto; onCerrar: () => void }) {
  const { data, dataUpdatedAt, isError } = useQuery({
    queryKey: ['ventas-salida', salida.documentId],
    queryFn: () => getVentasSalida(salida.documentId),
    refetchInterval: CADA_MS,
    refetchIntervalInBackground: false,
  });
  // El reloj: las cuentas regresivas y «hace X» avanzan entre consulta y consulta
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // Lo que llega nuevo después de abrir el panel se resalta
  const vistos = useRef<Set<string> | null>(null);
  const nuevos = new Set<string>();
  if (data) {
    if (!vistos.current) vistos.current = new Set(data.boletos.map((b) => b.documentId));
    else for (const b of data.boletos) if (!vistos.current.has(b.documentId)) nuevos.add(b.documentId);
  }
  // A los 6 s de llegar dejan de ser nuevos (se ata a cada consulta, no al reloj)
  const claveNuevos = [...nuevos].join(',');
  useEffect(() => {
    if (!claveNuevos) return;
    const t = setTimeout(() => claveNuevos.split(',').forEach((id) => vistos.current?.add(id)), 6000);
    return () => clearTimeout(t);
  }, [claveNuevos]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);

  const r = data?.resumen;
  const capacidad = data?.capacidad ?? salida.capacidad ?? 0;

  return (
    <div className={styles.veloLado} onClick={onCerrar}>
      <aside className={styles.lado} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Ventas de la salida">
        <header className={styles.ladoCabecera}>
          <div>
            <div className={styles.modalTitulo}>{salida.ruta?.origen} → {salida.ruta?.destino}</div>
            <div className={styles.nota}>
              {fechaCorta(salida.fechaHoraSalida)} a las {hora(salida.fechaHoraSalida)}
              {salida.unidad ? ` · ${salida.unidad.numero}` : ''}
            </div>
          </div>
          <span className={styles.enVivo} title={dataUpdatedAt ? `Actualizado ${hace(new Date(dataUpdatedAt).toISOString(), ahora)}` : undefined}>
            <i aria-hidden /> {isError ? 'Sin conexión' : 'En vivo'}
          </span>
          <button type="button" className={styles.cerrar} onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>

        <div className={styles.ladoCuerpo}>
          <div className={styles.cifras}>
            <div>
              <span>Vendidos</span>
              <b>{r?.vendidos ?? '…'}{capacidad ? <small> / {capacidad}</small> : null}</b>
            </div>
            <div className={r?.comprando ? styles.cifraViva : ''}>
              <span>Comprando ahora</span>
              <b>{r?.comprando ?? '…'}</b>
            </div>
            <div className={r?.porVerificar ? styles.cifraAviso : ''}>
              <span>Pago por verificar</span>
              <b>{r?.porVerificar ?? '…'}</b>
            </div>
            <div>
              <span>Cobrado</span>
              <b>${(r?.cobradoUsd ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</b>
            </div>
          </div>
          {capacidad > 0 && r && (
            <div className={styles.barraGrande} aria-label={`${r.vendidos} vendidos y ${r.apartados} apartados de ${capacidad}`}>
              <i style={{ width: `${Math.min(100, (r.vendidos / capacidad) * 100)}%` }} />
              <i className={styles.barraApartados} style={{ width: `${Math.min(100, (r.apartados / capacidad) * 100)}%` }} />
            </div>
          )}

          <section className={styles.seccion}>
            <div className={styles.rotulo}>Comprando ahora</div>
            {!data ? (
              <div className={styles.nota}>Cargando…</div>
            ) : !data.enProceso.length ? (
              <div className={styles.nota}>Nadie está comprando en este momento.</div>
            ) : (
              <ul className={styles.listaVivo}>
                {data.enProceso.map((c, i) => (
                  <li key={i} className={styles.compraViva}>
                    <span className={styles.pulso} aria-hidden />
                    <div>
                      <b>{c.asientos.length} puesto{c.asientos.length === 1 ? '' : 's'} · {c.asientos.join(', ')}</b>
                      <span>{c.quien ?? 'Pasajero sin cuenta'} · {CANAL[c.canal ?? ''] ?? c.canal ?? 'Web'} · empezó {hace(c.desde, ahora)}</span>
                    </div>
                    <span className={styles.queda} title="Si no paga a tiempo, los puestos se liberan">{queda(c.expira, ahora)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.seccion}>
            <div className={styles.rotulo}>Boletos vendidos · {data?.boletos.filter((b) => b.estado !== 'anulado').length ?? 0}</div>
            {data && !data.boletos.length && <div className={styles.nota}>Todavía no se ha vendido ningún boleto.</div>}
            <ul className={styles.listaVivo}>
              {(data?.boletos ?? []).map((b) => {
                const pago = PAGO[b.estadoPago ?? ''] ?? { texto: b.estadoPago ?? '—', tono: 'neutral' as const };
                return (
                  <li key={b.documentId} className={`${styles.boleto} ${nuevos.has(b.documentId) ? styles.boletoNuevo : ''} ${b.estado === 'anulado' ? styles.boletoAnulado : ''}`}>
                    <span className={styles.puesto}>{b.asiento ?? '—'}</span>
                    <div>
                      <b>{b.pasajero ?? 'Sin nombre'}{b.documento ? <small> · {b.documento}</small> : null}</b>
                      <span>
                        {CANAL[b.canal ?? ''] ?? b.canal ?? '—'} · {hace(b.vendidoEn, ahora)}
                        {b.folio ? ` · ${b.folio}` : ''}
                        {b.estado === 'anulado' ? ' · anulado' : ''}
                      </span>
                    </div>
                    <div className={styles.boletoPago}>
                      <b>${b.totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</b>
                      <span className={styles[`pago_${pago.tono}`]}>{pago.texto}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
