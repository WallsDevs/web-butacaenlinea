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
  tarifas: { claseServicio: string; precioUsd: string }[];
  /** Ida y vuelta: una sola ruta; el sistema mantiene la vuelta y el sentido se elige al programar. */
  idaYVuelta: boolean;
  /** Precio del pasaje de la vuelta si es distinto al de la ida ('' = el mismo). */
  precioVuelta: string;
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
  const fijarPrecioIda = (v: string) =>
    cambiar({
      tarifas: form.tarifas.some((t) => t.claseServicio === 'estandar')
        ? form.tarifas.map((t) => (t.claseServicio === 'estandar' ? { ...t, precioUsd: v } : t))
        : [{ claseServicio: 'estandar', precioUsd: v }, ...form.tarifas],
    });
  const fijarDuracion = (h: string, m: string) => {
    const total = (Number(h) || 0) * 60 + (Number(m) || 0);
    cambiar({ duracionMin: total > 0 ? String(total) : '' });
  };
  const especiales = form.tarifas.map((t, i) => ({ t, i })).filter(({ t }) => t.claseServicio !== 'estandar');
  const escritoSinLista = !avisoCiudades && [form.origen, form.destino].some((c) => c.trim() && !ciudadOficial(c));
  const listo = Boolean(origen && destino && Number(precioIda) > 0);
  const pista = !origen || !destino ? 'Elige el origen y el destino.' : !(Number(precioIda) > 0) ? 'Ponle precio al pasaje.' : null;

  const tramoIda = origen && destino ? `${origen} → ${destino}` : 'Ida';
  const tramoVuelta = origen && destino ? `${destino} → ${origen}` : 'Vuelta';
  const duracion = duracionTexto(Number(form.duracionMin) || 0);
  const vuelta = Number(form.precioVuelta) > 0 ? form.precioVuelta : precioIda;

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
                onClick={() => cambiar({ idaYVuelta: !form.idaYVuelta, precioVuelta: form.idaYVuelta ? '' : form.precioVuelta })}
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

        {/* El precio, una fila por sentido; la vuelta repite el de la ida si no se cambia */}
        <section className={styles.seccion}>
          <div className={styles.rotulo}>Precio del pasaje · USD</div>
          <div className={styles.tarifa}>
            <div className={styles.fila}>
              <span className={styles.filaTramo}>
                {tramoIda}
                <span className={styles.filaSub}>Todos los puestos</span>
              </span>
              <label className={styles.monto}>
                <span>$</span>
                <input className={ui.fieldInput} type="number" min={0} placeholder="12" aria-label={`Precio ${tramoIda}`} value={precioIda} onChange={(e) => fijarPrecioIda(e.target.value)} />
              </label>
            </div>
            {form.idaYVuelta && (
              <div className={styles.fila}>
                <span className={styles.filaTramo}>
                  {tramoVuelta}
                  <span className={styles.filaSub}>{Number(form.precioVuelta) > 0 ? 'Precio propio de la vuelta' : 'El mismo de la ida · escribe otro si cambia'}</span>
                </span>
                <label className={styles.monto}>
                  <span>$</span>
                  <input
                    className={ui.fieldInput}
                    type="number"
                    min={0}
                    placeholder={precioIda || '12'}
                    aria-label={`Precio ${tramoVuelta}`}
                    value={form.precioVuelta}
                    onChange={(e) => cambiar({ precioVuelta: e.target.value })}
                  />
                </label>
              </div>
            )}
            {especiales.map(({ t, i }) => (
              <div key={i} className={styles.especial}>
                <select
                  className={ui.fieldInput}
                  aria-label="Clase de asiento"
                  value={t.claseServicio}
                  onChange={(e) => cambiar({ tarifas: form.tarifas.map((x, j) => (j === i ? { ...x, claseServicio: e.target.value } : x)) })}
                >
                  <option value="">Clase de asiento…</option>
                  {CLASES.map((c) => (
                    <option key={c.valor} value={c.valor}>{c.nombre}</option>
                  ))}
                </select>
                <label className={styles.monto}>
                  <span>$</span>
                  <input
                    className={ui.fieldInput}
                    type="number"
                    min={0}
                    aria-label="Precio de la clase"
                    value={t.precioUsd}
                    onChange={(e) => cambiar({ tarifas: form.tarifas.map((x, j) => (j === i ? { ...x, precioUsd: e.target.value } : x)) })}
                  />
                </label>
                <button type="button" className={styles.quitar} aria-label="Quitar la clase" onClick={() => cambiar({ tarifas: form.tarifas.filter((_, j) => j !== i) })}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className={styles.agregar} onClick={() => cambiar({ tarifas: [...form.tarifas, { claseServicio: '', precioUsd: '' }] })}>
            + Precio para una clase especial (VIP, cama)
          </button>
          <div className={styles.nota}>Las unidades con clases especiales cobran su precio en esos puestos; el resto, el del pasaje.</div>
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
