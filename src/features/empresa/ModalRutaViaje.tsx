import type { ReactNode } from 'react';
import type { Ciudad } from '../../lib/api/endpoints';
import { SelectorCiudad } from '../../components/ui/SelectorCiudad';
import { Field } from '../../components/ui/Field';
import ui from '../../components/ui/ui.module.css';
import styles from './ModalRutaViaje.module.css';

export interface FormRuta {
  documentId: string | null;
  codigo: string;
  origen: string;
  destino: string;
  duracionMin: string;
  distanciaKm: string;
  /** Precio por clase de asiento; `precioVuelta` es el de la vuelta si cambia ('' = el mismo de la ida). */
  tarifas: { claseServicio: string; precioUsd: string; precioVuelta?: string }[];
  /** Ida y vuelta: una sola ruta; el sistema mantiene la vuelta y el sentido se elige al programar. */
  idaYVuelta: boolean;
}

const CLASES = [
  { valor: 'semicama', nombre: 'Semicama' },
  { valor: 'vip', nombre: 'VIP Cama' },
  { valor: 'cama_ejecutivo', nombre: 'Cama Ejecutivo' },
];

const horasDe = (min: string) => (Number(min) > 0 ? String(Math.floor(Number(min) / 60)) : '');
const minutosDe = (min: string) => (Number(min) > 0 ? String(Number(min) % 60) : '');
const duracionTexto = (min: number) => (min > 0 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}` : '');

/**
 * Nueva ruta de viaje (o su edición). Se lee como un boleto que se llena: el
 * trayecto con el interruptor de sentido sobre la línea, cuánto tarda y el
 * precio por sentido; abajo, siempre visible, el resumen de lo que se guarda.
 */
export function ModalRutaViaje({
  form,
  setForm,
  ciudades,
  ciudadOficial,
  avisoCiudades,
  selectorTipo,
  error,
  guardando,
  onCancelar,
  onGuardar,
}: {
  form: FormRuta;
  setForm: (f: (actual: FormRuta | null) => FormRuta | null) => void;
  ciudades: Ciudad[];
  ciudadOficial: (t: string) => string | null;
  /** Si la lista de ciudades no cargó: el aviso con «Reintentar». */
  avisoCiudades?: ReactNode;
  selectorTipo?: ReactNode;
  error?: string | null;
  guardando: boolean;
  onCancelar: () => void;
  onGuardar: () => void;
}) {
  const cambiar = (cambios: Partial<FormRuta>) => setForm((f) => (f ? { ...f, ...cambios } : f));
  const origen = ciudadOficial(form.origen);
  const destino = ciudadOficial(form.destino);
  const precioIda = form.tarifas.find((t) => t.claseServicio === 'estandar')?.precioUsd ?? '';
  // El pasaje base siempre es la primera fila; las clases especiales van debajo
  const tarifas = form.tarifas.some((t) => t.claseServicio === 'estandar') ? form.tarifas : [{ claseServicio: 'estandar', precioUsd: '' }, ...form.tarifas];
  const fijar = (i: number, cambios: Partial<FormRuta['tarifas'][number]>) => cambiar({ tarifas: tarifas.map((t, j) => (j === i ? { ...t, ...cambios } : t)) });
  const fijarDuracion = (h: string, m: string) => {
    const total = (Number(h) || 0) * 60 + (Number(m) || 0);
    cambiar({ duracionMin: total > 0 ? String(total) : '' });
  };
  const escritoSinLista = !avisoCiudades && [form.origen, form.destino].some((c) => c.trim() && !ciudadOficial(c));
  const listo = Boolean(origen && destino && Number(precioIda) > 0);
  const pista = !origen || !destino ? 'Elige el origen y el destino.' : !(Number(precioIda) > 0) ? 'Ponle precio al pasaje.' : null;

  const tramoIda = origen && destino ? `${origen} → ${destino}` : 'Ida';
  const tramoVuelta = origen && destino ? `${destino} → ${origen}` : 'Vuelta';
  const duracion = duracionTexto(Number(form.duracionMin) || 0);
  const base = tarifas.find((t) => t.claseServicio === 'estandar');
  const vuelta = Number(base?.precioVuelta) > 0 ? base!.precioVuelta! : precioIda;
  const usadas = new Set(tarifas.map((t) => t.claseServicio));

  return (
    <div className={styles.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={form.documentId ? 'Editar ruta de viaje' : 'Nueva ruta'}>
      <div className={styles.cabecera}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className={styles.titulo}>{form.documentId ? 'Editar ruta de viaje' : 'Nueva ruta'}</div>
          {selectorTipo && <div style={{ marginTop: 12 }}>{selectorTipo}</div>}
        </div>
        <button type="button" className={styles.cerrar} onClick={onCancelar} aria-label="Cerrar">
          ✕
        </button>
      </div>

      <div className={styles.cuerpo}>
        {/* El trayecto: las dos ciudades unidas por la línea, y el sentido sobre ella */}
        <section className={styles.seccion}>
          <div className={styles.rotulo}>Trayecto</div>
          <div className={styles.trayecto}>
            <SelectorCiudad label="Sale de" valor={form.origen} ciudades={ciudades} excluir={destino ?? undefined} onCambio={(v) => cambiar({ origen: v })} />
            <div className={styles.conector}>
              <button
                type="button"
                className={`${styles.sentido} ${form.idaYVuelta ? styles.sentidoIdaVuelta : ''}`}
                aria-pressed={form.idaYVuelta}
                onClick={() => cambiar({ idaYVuelta: !form.idaYVuelta })}
                title={form.idaYVuelta ? 'Hace los dos sentidos: toca para que sea solo de ida' : 'Solo de ida: toca para que haga también la vuelta'}
              >
                <span className={styles.flecha} aria-hidden>{form.idaYVuelta ? '⇄' : '→'}</span>
                {form.idaYVuelta ? 'Ida y vuelta' : 'Solo ida'}
              </button>
            </div>
            <SelectorCiudad label="Llega a" valor={form.destino} ciudades={ciudades} excluir={origen ?? undefined} onCambio={(v) => cambiar({ destino: v })} />
          </div>
          {avisoCiudades}
          {escritoSinLista && <div className={styles.aviso}>Elige las ciudades de la lista: son las mismas para todas las líneas, así el pasajero encuentra tus pasajes.</div>}
          <div className={styles.nota}>
            {form.idaYVuelta
              ? 'Una sola ruta para los dos sentidos: eliges el sentido al programar cada salida.'
              : 'Solo de ida. Si el bus vuelve sin pasajeros, regístralo al programar como viaje sin pasajeros.'}
          </div>
        </section>

        {/* Cuánto tarda: en horas y minutos, como se piensa un viaje */}
        <section className={styles.seccion}>
          <div className={styles.rotulo}>Viaje</div>
          <div className={styles.datos}>
            <Field label="Horas" type="number" min={0} placeholder="5" value={horasDe(form.duracionMin)} onChange={(e) => fijarDuracion(e.target.value, minutosDe(form.duracionMin))} />
            <Field label="Minutos" type="number" min={0} max={59} placeholder="30" value={minutosDe(form.duracionMin)} onChange={(e) => fijarDuracion(horasDe(form.duracionMin), e.target.value)} />
            <Field label="Distancia (km)" type="number" min={0} placeholder="230" value={form.distanciaKm} onChange={(e) => cambiar({ distanciaKm: e.target.value })} />
            <Field label="Código (opcional)" placeholder="205" value={form.codigo} onChange={(e) => cambiar({ codigo: e.target.value })} />
          </div>
        </section>

        {/* El precio: una fila por clase de asiento y una columna por sentido.
            La vuelta repite el de la ida mientras no se escriba otro. */}
        <section className={styles.seccion}>
          <div className={styles.rotulo}>Precio del pasaje · USD</div>
          <div className={`${styles.tarifa} ${form.idaYVuelta ? styles.tarifaDoble : ''}`}>
            <div className={`${styles.fila} ${styles.filaCabeza}`}>
              <span>Puestos</span>
              <span title={tramoIda}>{form.idaYVuelta ? `Ida · ${origen ?? 'A'} →` : 'Precio'}</span>
              {form.idaYVuelta && <span title={tramoVuelta}>Vuelta · {destino ?? 'B'} →</span>}
              <span />
            </div>
            {tarifas.map((t, i) => {
              const esBase = t.claseServicio === 'estandar';
              const nombre = esBase ? 'Todos los puestos' : (CLASES.find((c) => c.valor === t.claseServicio)?.nombre ?? 'Clase especial');
              return (
                <div key={i} className={`${styles.fila} ${esBase ? '' : styles.filaEspecial}`}>
                  {esBase ? (
                    <span className={styles.filaTramo}>
                      Todos los puestos
                      <span className={styles.filaSub}>El pasaje normal</span>
                    </span>
                  ) : (
                    <select className={ui.fieldInput} aria-label="Clase de asiento" value={t.claseServicio} onChange={(e) => fijar(i, { claseServicio: e.target.value })}>
                      <option value="">Clase de asiento…</option>
                      {CLASES.filter((c) => c.valor === t.claseServicio || !usadas.has(c.valor)).map((c) => (
                        <option key={c.valor} value={c.valor}>{c.nombre}</option>
                      ))}
                    </select>
                  )}
                  <label className={styles.monto}>
                    <span>$</span>
                    <input className={ui.fieldInput} type="number" min={0} placeholder={esBase ? '12' : ''} aria-label={`${nombre}: precio de ida`} value={t.precioUsd} onChange={(e) => fijar(i, { precioUsd: e.target.value })} />
                  </label>
                  {form.idaYVuelta && (
                    <label className={styles.monto}>
                      <span>$</span>
                      <input
                        className={ui.fieldInput}
                        type="number"
                        min={0}
                        placeholder={t.precioUsd || (esBase ? '12' : '')}
                        title="Vacío = el mismo de la ida"
                        aria-label={`${nombre}: precio de vuelta`}
                        value={t.precioVuelta ?? ''}
                        onChange={(e) => fijar(i, { precioVuelta: e.target.value })}
                      />
                    </label>
                  )}
                  {esBase ? (
                    <span />
                  ) : (
                    <button type="button" className={styles.quitar} aria-label={`Quitar ${nombre}`} onClick={() => cambiar({ tarifas: tarifas.filter((_, j) => j !== i) })}>
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {CLASES.some((c) => !usadas.has(c.valor)) && (
            <button type="button" className={styles.agregar} onClick={() => cambiar({ tarifas: [...tarifas, { claseServicio: '', precioUsd: '' }] })}>
              + Precio para una clase especial (VIP, cama)
            </button>
          )}
          <div className={styles.nota}>
            Cada clase cobra su propio precio, no se suma al pasaje: solo en unidades que tengan esos puestos; el resto paga el pasaje normal.
            {form.idaYVuelta && ' Si dejas la vuelta vacía, cobra lo mismo que la ida.'}
          </div>
        </section>
      </div>

      <div className={styles.pie}>
        <div className={styles.resumen}>
          {origen && destino ? (
            <>
              <strong>
                {origen} {form.idaYVuelta ? '⇄' : '→'} {destino}
              </strong>
              {duration(duracion)}
              {Number(precioIda) > 0 ? ` · $${precioIda}${form.idaYVuelta && vuelta !== precioIda ? ` / $${vuelta}` : ''}` : ''}
            </>
          ) : (
            pista
          )}
          {error && <div className={styles.error}>{error}</div>}
          {!error && origen && destino && pista && <div className={styles.aviso}>{pista}</div>}
        </div>
        <button type="button" className={ui.btnSecondary} onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className={ui.btnPrimary} disabled={!listo || guardando} onClick={onGuardar}>
          {guardando ? 'Guardando…' : form.documentId ? 'Guardar cambios' : 'Guardar ruta'}
        </button>
      </div>
    </div>
  );
}

const duration = (d: string) => (d ? ` · ${d}` : '');
