import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { programarSerie } from '../../lib/api/endpoints';
import type { RutaDto, UnidadDto } from '../../lib/api/types';
import { expandirConfiguracion } from '../../lib/asientos';
import { diasSemanales, enHora, isoDia } from '../../lib/series';
import { fechaCorta, hora as horaDe, hoyISO } from '../../lib/time';
import { Field } from '../../components/ui/Field';
import { mensajeDeError } from './salidasErrores';
import ui from '../../components/ui/ui.module.css';
import styles from './EmpresaSalidas.module.css';

type Cuando = 'una' | 'calendario' | 'semanal';
const SEMANA = [
  [1, 'L', 'Lunes'],
  [2, 'M', 'Martes'],
  [3, 'M', 'Miércoles'],
  [4, 'J', 'Jueves'],
  [5, 'V', 'Viernes'],
  [6, 'S', 'Sábado'],
  [0, 'D', 'Domingo'],
] as const;
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MAX = 200;

export const puestosDe = (u?: { configuracionAsientos?: UnidadDto['configuracionAsientos'] } | null) =>
  u?.configuracionAsientos ? expandirConfiguracion(u.configuracionAsientos).reduce((s, p) => s + p.totalAsientos, 0) : 0;

/** Horas sin repetir y en orden (dos «19:08» el mismo día serían la misma salida). */
const limpias = (h: string[]) => [...new Set(h.filter(Boolean))].sort();

/** Las horas de un día: una o varias, se agregan y se quitan. */
function Horas({ valor, onCambio, etiqueta }: { valor: string[]; onCambio: (h: string[]) => void; etiqueta: string }) {
  return (
    <div className={styles.horas}>
      {valor.map((h, i) => (
        <span key={i} className={styles.hora}>
          <input className={ui.fieldInput} type="time" value={h} aria-label={`${etiqueta}: hora ${i + 1}`} onChange={(e) => onCambio(valor.map((x, j) => (j === i ? e.target.value : x)))} />
          {valor.length > 1 && (
            <button type="button" aria-label="Quitar esta hora" onClick={() => onCambio(valor.filter((_, j) => j !== i))}>✕</button>
          )}
        </span>
      ))}
      <button type="button" className={styles.enlace} onClick={() => onCambio([...valor, ''])}>+ hora</button>
    </div>
  );
}

/**
 * Programar salidas: una vez, en los días que se marquen en el calendario, o
 * semanal hasta una fecha, cada día con sus propias horas. Se programan SIN
 * bus ni conductor: un calendario lo cubren varios buses, que se asignan
 * después en la agenda (una a una o varias de una vez). El regreso no es
 * especial: son salidas desde el otro terminal (el sentido de la ruta), y al
 * asignarles bus el sistema dice cuáles estarán allí a esa hora.
 */
export function ModalProgramar({ rutas, onCerrar, onListo }: { rutas: RutaDto[]; onCerrar: () => void; onListo: (creadas: number, primerDia: string) => void }) {
  const porId = new Map(rutas.map((r) => [r.id, r]));
  const visibles = rutas.filter((r) => !r.inversaId || !porId.has(r.inversaId) || r.id < r.inversaId);
  const [rutaId, setRutaId] = useState(visibles[0]?.documentId ?? '');
  const [sentido, setSentido] = useState<'ida' | 'vuelta'>('ida');
  const [cuando, setCuando] = useState<Cuando>('semanal');
  const [dia, setDia] = useState(hoyISO());
  const [marcados, setMarcados] = useState<string[]>([]);
  const [mes, setMes] = useState(() => ({ anio: new Date().getFullYear(), mes: new Date().getMonth() }));
  // Horas: generales (una vez y calendario), por día marcado (si se cambian) y por día de la semana
  const [generales, setGenerales] = useState<string[]>(['06:00']);
  const [porDia, setPorDia] = useState<Record<string, string[]>>({});
  const [porSemana, setPorSemana] = useState<Record<number, string[]>>({ 1: ['06:00'], 3: ['06:00'], 5: ['06:00'] });
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 28);
    return isoDia(d);
  });
  const [rampa, setRampa] = useState('');
  const [sinPasajeros, setSinPasajeros] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = rutas.find((r) => r.documentId === rutaId);
  const vuelta = base?.inversaId ? porId.get(base.inversaId) : undefined;
  const ida = sentido === 'vuelta' && vuelta ? vuelta : base;
  const semana = Object.keys(porSemana).map(Number);

  // Cada día con sus horas
  const plan: { dia: string; horas: string[] }[] =
    cuando === 'una'
      ? [{ dia, horas: limpias(generales) }]
      : cuando === 'calendario'
        ? [...marcados].sort().map((d) => ({ dia: d, horas: limpias(porDia[d] ?? generales) }))
        : diasSemanales(desde, hasta, semana).map((d) => ({ dia: d, horas: limpias(porSemana[new Date(`${d}T12:00:00`).getDay()] ?? []) }));
  const clavePlan = JSON.stringify(plan);

  const { salidas, pasadas } = useMemo(() => {
    const lista: { rutaId: string; fechaHoraSalida: string }[] = [];
    let saltadas = 0;
    if (!ida) return { salidas: lista, pasadas: 0 };
    for (const { dia: d, horas } of plan) {
      for (const h of horas) {
        const sale = enHora(d, h);
        if (new Date(sale).getTime() <= Date.now()) {
          saltadas++;
          continue;
        }
        lista.push({ rutaId: ida.documentId, fechaHoraSalida: sale });
      }
    }
    return { salidas: lista.sort((a, b) => a.fechaHoraSalida.localeCompare(b.fechaHoraSalida)), pasadas: saltadas };
  }, [ida, clavePlan]); // eslint-disable-line react-hooks/exhaustive-deps

  const crear = useMutation({
    mutationFn: () => programarSerie({ salidas, rampa: rampa.trim() || undefined, sinPasajeros: sinPasajeros || undefined }),
    onSuccess: (r) => onListo(r.creadas, plan[0]?.dia ?? hoyISO()),
    onError: (e) => setError(mensajeDeError(e)),
  });

  const sinHoras = plan.some((p) => !p.horas.length);
  const pista = !ida
    ? 'Escoge la ruta.'
    : !plan.length
      ? cuando === 'calendario' ? 'Marca los días en el calendario.' : 'Escoge los días de la semana y hasta cuándo.'
      : sinHoras
        ? 'Cada día necesita al menos una hora de salida.'
        : !salidas.length
          ? 'Esas fechas y horas ya pasaron.'
          : salidas.length > MAX
            ? `Son ${salidas.length} salidas: el máximo es ${MAX} de una vez.`
            : null;

  // Calendario del mes (la semana empieza el lunes)
  const primero = new Date(mes.anio, mes.mes, 1);
  const vacios = (primero.getDay() + 6) % 7;
  const diasMes = new Date(mes.anio, mes.mes + 1, 0).getDate();
  const hoy = hoyISO();
  const cambiarMes = (n: number) =>
    setMes((m) => {
      const d = new Date(m.anio, m.mes + n, 1);
      return { anio: d.getFullYear(), mes: d.getMonth() };
    });
  const alternar = (d: string) => setMarcados((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d]));
  const alternarSemana = (n: number) =>
    setPorSemana((s) => {
      const c = { ...s };
      if (c[n]) delete c[n];
      else c[n] = [...(Object.values(s)[0] ?? ['06:00'])];
      return c;
    });

  return (
    <div className={styles.velo} onClick={onCerrar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Programar salidas">
        <div className={styles.modalCabecera}>
          <div>
            <div className={styles.modalTitulo}>Programar salidas</div>
            <div className={styles.nota}>Solo el calendario y las horas. El bus y el conductor se asignan después en la agenda. El regreso se programa igual: escoge el sentido desde el otro terminal.</div>
          </div>
          <button type="button" className={styles.cerrar} onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>

        <div className={styles.modalCuerpo}>
          <section className={styles.seccion}>
            <div className={styles.rotulo}>Ruta</div>
            <select className={ui.fieldInput} value={rutaId} onChange={(e) => { setRutaId(e.target.value); setSentido('ida'); }} aria-label="Ruta">
              <option value="">Escoge la ruta…</option>
              {visibles.map((r) => (
                <option key={r.documentId} value={r.documentId}>
                  {r.origen} {r.inversaId && porId.has(r.inversaId) ? '⇄' : '→'} {r.destino}
                </option>
              ))}
            </select>
            {base && vuelta && (
              <div className={styles.segmento} role="radiogroup" aria-label="Sentido">
                {([['ida', `${base.origen} → ${base.destino}`], ['vuelta', `${vuelta.origen} → ${vuelta.destino}`]] as const).map(([id, txt]) => (
                  <button key={id} type="button" role="radio" aria-checked={sentido === id} className={sentido === id ? styles.segActivo : ''} onClick={() => setSentido(id)}>
                    {txt}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={styles.seccion}>
            <div className={styles.rotulo}>Cuándo sale</div>
            <div className={styles.segmento} role="radiogroup" aria-label="Cuándo">
              {([['semanal', 'Semanal'], ['calendario', 'Días del calendario'], ['una', 'Una vez']] as const).map(([id, txt]) => (
                <button key={id} type="button" role="radio" aria-checked={cuando === id} className={cuando === id ? styles.segActivo : ''} onClick={() => setCuando(id)}>
                  {txt}
                </button>
              ))}
            </div>

            {cuando === 'una' && (
              <div className={styles.dosColumnas}>
                <Field label="Fecha" type="date" min={hoy} value={dia} onChange={(e) => setDia(e.target.value)} />
                <div>
                  <span className={ui.fieldLabel}>Horas de salida</span>
                  <Horas valor={generales} onCambio={setGenerales} etiqueta="Salida" />
                </div>
              </div>
            )}

            {cuando === 'semanal' && (
              <>
                <div className={styles.semana} role="group" aria-label="Días de la semana">
                  {SEMANA.map(([n, l, nombre]) => (
                    <button key={n} type="button" aria-pressed={semana.includes(n)} title={nombre} className={semana.includes(n) ? styles.semanaActivo : ''} onClick={() => alternarSemana(n)}>
                      {l}
                    </button>
                  ))}
                </div>
                {semana.length > 0 && (
                  <div className={styles.tablaHoras}>
                    {SEMANA.filter(([n]) => semana.includes(n)).map(([n, , nombre]) => (
                      <div key={n} className={styles.filaHoras}>
                        <span className={styles.filaDia}>Todos los {nombre.toLowerCase()}{nombre.endsWith('s') ? '' : 's'}</span>
                        <Horas valor={porSemana[n]} onCambio={(h) => setPorSemana((s) => ({ ...s, [n]: h }))} etiqueta={nombre} />
                      </div>
                    ))}
                  </div>
                )}
                <div className={styles.dosColumnas}>
                  <Field label="Desde" type="date" min={hoy} value={desde} onChange={(e) => setDesde(e.target.value)} />
                  <Field label="Hasta" type="date" min={desde} value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </div>
              </>
            )}

            {cuando === 'calendario' && (
              <>
                <div className={styles.calendario}>
                  <div className={styles.calMes}>
                    <button type="button" onClick={() => cambiarMes(-1)} aria-label="Mes anterior">‹</button>
                    <span>{MESES[mes.mes]} {mes.anio}</span>
                    <button type="button" onClick={() => cambiarMes(1)} aria-label="Mes siguiente">›</button>
                  </div>
                  <div className={styles.calGrilla}>
                    {SEMANA.map(([n, l]) => <span key={n} className={styles.calDiaSemana}>{l}</span>)}
                    {Array.from({ length: vacios }, (_, i) => <span key={`v${i}`} />)}
                    {Array.from({ length: diasMes }, (_, i) => {
                      const d = isoDia(new Date(mes.anio, mes.mes, i + 1));
                      const propias = porDia[d];
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={d < hoy}
                          aria-pressed={marcados.includes(d)}
                          className={`${styles.calDia} ${marcados.includes(d) ? styles.calMarcado : ''} ${d === hoy ? styles.calHoy : ''}`}
                          onClick={() => alternar(d)}
                          title={marcados.includes(d) ? `Sale a las ${limpias(propias ?? generales).join(', ')}` : undefined}
                        >
                          {i + 1}
                          {marcados.includes(d) && propias && <i className={styles.calPropia} aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                  <div className={styles.calPie}>
                    <span>{marcados.length ? `${marcados.length} día${marcados.length === 1 ? '' : 's'} marcado${marcados.length === 1 ? '' : 's'} · el punto indica hora propia` : 'Toca los días en que sale'}</span>
                    {marcados.length > 0 && <button type="button" className={styles.enlace} onClick={() => { setMarcados([]); setPorDia({}); }}>Quitar todos</button>}
                  </div>
                </div>
                <div className={styles.filaHoras}>
                  <span className={styles.filaDia}>Hora general</span>
                  <Horas valor={generales} onCambio={setGenerales} etiqueta="Hora general" />
                </div>
                {marcados.length > 0 && (
                  <div className={styles.tablaHoras}>
                    {[...marcados].sort().map((d) => (
                      <div key={d} className={styles.filaHoras}>
                        <span className={styles.filaDia}>{fechaCorta(`${d}T12:00:00`)}</span>
                        {porDia[d] ? (
                          <>
                            <Horas valor={porDia[d]} onCambio={(h) => setPorDia((m) => ({ ...m, [d]: h }))} etiqueta={d} />
                            <button type="button" className={styles.enlaceSuave} onClick={() => setPorDia((m) => { const c = { ...m }; delete c[d]; return c; })}>usar la general</button>
                          </>
                        ) : (
                          <>
                            <span className={styles.horasGenerales}>{limpias(generales).join(' · ') || '—'}</span>
                            <button type="button" className={styles.enlace} onClick={() => setPorDia((m) => ({ ...m, [d]: [...generales] }))}>cambiar</button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

          </section>

          <section className={styles.seccion}>
            <div className={styles.dosColumnas}>
              <Field label="Rampa (opcional)" placeholder="Rampa 03" value={rampa} onChange={(e) => setRampa(e.target.value)} />
              <label className={styles.check} style={{ alignSelf: 'end', paddingBottom: 10 }}>
                <input type="checkbox" checked={sinPasajeros} onChange={(e) => setSinPasajeros(e.target.checked)} />
                <span>
                  Sin pasajeros
                  <small>Viaja vacío: no sale a la venta</small>
                </span>
              </label>
            </div>
          </section>

          {salidas.length > 0 && (
            <section className={styles.seccion}>
              <div className={styles.rotulo}>Se van a programar · {salidas.length}</div>
              <div className={styles.vista}>
                {salidas.slice(0, 30).map((s, i) => (
                  <span key={i}>{fechaCorta(s.fechaHoraSalida)} · {horaDe(s.fechaHoraSalida)}</span>
                ))}
                {salidas.length > 30 && <span className={styles.vistaMas}>y {salidas.length - 30} más</span>}
              </div>
            </section>
          )}
        </div>

        <div className={styles.modalPie}>
          <div className={styles.resumen}>
            {error ? <span className={styles.error}>{error}</span> : pista ? <span>{pista}</span> : (
              <span>
                <strong>{salidas.length} salida{salidas.length === 1 ? '' : 's'}</strong>
                {ida ? ` · ${ida.origen} → ${ida.destino}` : ''}
                {pasadas > 0 ? ` · se saltan ${pasadas} que ya pasaron` : ''}
              </span>
            )}
          </div>
          <button type="button" className={ui.btnSecondary} onClick={onCerrar}>Cancelar</button>
          <button type="button" className={ui.btnPrimary} disabled={Boolean(pista) || crear.isPending} onClick={() => { setError(null); crear.mutate(); }}>
            {crear.isPending ? 'Programando…' : `Programar ${salidas.length || ''} salida${salidas.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
