import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMapaAsientos, getVentasSalida } from '../../lib/api/endpoints';
import { SeatMap } from '../../components/seat-map/SeatMap';
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
  // El mapa del bus con lo vendido y lo que se está comprando, también en vivo
  const { data: mapa } = useQuery({
    queryKey: ['mapa', salida.documentId],
    queryFn: () => getMapaAsientos(salida.documentId),
    refetchInterval: CADA_MS,
    enabled: Boolean(salida.unidad),
  });
  const [pisoActivo, setPisoActivo] = useState(1);
  const [resaltado, setResaltado] = useState<string | null>(null);
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
  // Qué es cada puesto en el mapa y qué dice al pasar encima
  const marcas: Record<string, 'vendido' | 'apartado'> = {};
  const titulos: Record<string, string> = {};
  for (const c of data?.enProceso ?? []) for (const a of c.asientos) {
    marcas[a] = 'apartado';
    titulos[a] = `Comprándose · ${c.quien ?? 'pasajero'} (${queda(c.expira, ahora)})`;
  }
  for (const b of data?.boletos ?? []) if (b.asiento && b.estado !== 'anulado') {
    marcas[b.asiento] = 'vendido';
    titulos[b.asiento] = `${b.pasajero ?? 'Vendido'}${b.documento ? ` · ${b.documento}` : ''}`;
  }
  const piso = mapa?.pisos.find((x) => x.numero === pisoActivo) ?? mapa?.pisos[0];
  const irABoleto = (asiento: string) => {
    const el = document.getElementById(`boleto-${salida.documentId}-${asiento}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setResaltado(asiento);
    setTimeout(() => setResaltado((x) => (x === asiento ? null : x)), 2200);
  };
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

          {salida.unidad && (
            <section className={styles.seccion}>
              <div className={styles.mapaCabeza}>
                <div className={styles.rotulo}>Mapa del bus · {salida.unidad.numero}</div>
                {mapa && mapa.pisos.length > 1 && (
                  <div className={styles.segmento} role="radiogroup" aria-label="Piso">
                    {mapa.pisos.map((x) => (
                      <button key={x.numero} type="button" role="radio" aria-checked={piso?.numero === x.numero} className={piso?.numero === x.numero ? styles.segActivo : ''} onClick={() => setPisoActivo(x.numero)}>
                        Piso {x.numero}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.leyendaMapa}>
                <span><i className={styles.lVendido} /> Vendido</span>
                <span><i className={styles.lApartado} /> Comprándose</span>
                <span><i className={styles.lLibre} /> Libre</span>
              </div>
              <div className={styles.mapaBus}>
                {piso ? <SeatMap piso={piso} seleccionados={[]} size="movil" marcas={marcas} titulos={titulos} onVer={irABoleto} /> : <div className={styles.nota}>Cargando el mapa…</div>}
              </div>
            </section>
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
                  <li
                    key={b.documentId}
                    id={b.asiento && b.estado !== 'anulado' ? `boleto-${salida.documentId}-${b.asiento}` : undefined}
                    className={`${styles.boleto} ${nuevos.has(b.documentId) || (resaltado && resaltado === b.asiento && b.estado !== 'anulado') ? styles.boletoNuevo : ''} ${b.estado === 'anulado' ? styles.boletoAnulado : ''}`}
                  >
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
