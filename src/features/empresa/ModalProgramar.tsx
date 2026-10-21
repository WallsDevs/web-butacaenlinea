import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { programarSerie } from '../../lib/api/endpoints';
import type { UnidadDto } from '../../lib/api/types';
import type { RutaDto } from '../../lib/api/types';
import { expandirConfiguracion } from '../../lib/asientos';
import { diasSemanales, enHora, isoDia } from '../../lib/series';
import { fechaCorta, hora as horaDe, hoyISO } from '../../lib/time';
import { Field } from '../../components/ui/Field';
import { mensajeDeError } from './salidasErrores';
import ui from '../../components/ui/ui.module.css';
import styles from './EmpresaSalidas.module.css';

type Cuando = 'una' | 'calendario' | 'semanal';
const SEMANA = [
  [1, 'L', 'lunes'],
  [2, 'M', 'martes'],
  [3, 'M', 'miércoles'],
  [4, 'J', 'jueves'],
  [5, 'V', 'viernes'],
  [6, 'S', 'sábado'],
  [0, 'D', 'domingo'],
] as const;
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MAX = 200;

export const puestosDe = (u?: { configuracionAsientos?: UnidadDto['configuracionAsientos'] } | null) =>
  u?.configuracionAsientos ? expandirConfiguracion(u.configuracionAsientos).reduce((s, p) => s + p.totalAsientos, 0) : 0;

/**
 * Programar salidas: una vez, en los días que se marquen en el calendario, o
 * semanal hasta una fecha. Bus y conductor son opcionales (se ponen después,
 * salida por salida). Si la ruta es de ida y vuelta se puede programar el
 * regreso de cada salida. Todo o nada: si una no se puede, no queda ninguna.
 */
export function ModalProgramar({
  rutas,
  unidades,
  choferes,
  onCerrar,
  onListo,
}: {
  rutas: RutaDto[];
  unidades: UnidadDto[];
  choferes: { documentId: string; nombre: string }[];
  onCerrar: () => void;
  onListo: (creadas: number, primerDia: string) => void;
}) {
  const porId = new Map(rutas.map((r) => [r.id, r]));
  const visibles = rutas.filter((r) => !r.inversaId || !porId.has(r.inversaId) || r.id < r.inversaId);
  const [rutaId, setRutaId] = useState(visibles[0]?.documentId ?? '');
  const [sentido, setSentido] = useState<'ida' | 'vuelta'>('ida');
  const [cuando, setCuando] = useState<Cuando>('una');
  const [dia, setDia] = useState(hoyISO());
  const [marcados, setMarcados] = useState<string[]>([]);
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() };
  });
  const [semana, setSemana] = useState<number[]>([1, 2, 3, 4, 5]);
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 28);
    return isoDia(d);
  });
  const [horas, setHoras] = useState<string[]>(['06:00']);
  const [conRegreso, setConRegreso] = useState(false);
  const [horaRegreso, setHoraRegreso] = useState('15:00');
  const [diaRegreso, setDiaRegreso] = useState<0 | 1>(0);
  const [unidadId, setUnidadId] = useState('');
  const [choferId, setChoferId] = useState('');
  const [rampa, setRampa] = useState('');
  const [sinPasajeros, setSinPasajeros] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = rutas.find((r) => r.documentId === rutaId);
  const vuelta = base?.inversaId ? porId.get(base.inversaId) : undefined;
  const ida = sentido === 'vuelta' && vuelta ? vuelta : base;
  const regreso = sentido === 'vuelta' ? base : vuelta;

  const dias = cuando === 'una' ? [dia] : cuando === 'calendario' ? [...marcados].sort() : diasSemanales(desde, hasta, semana);
  const salidas = useMemo(() => {
    if (!ida) return [];
    const lista: { rutaId: string; fechaHoraSalida: string }[] = [];
    for (const d of dias) {
      for (const h of horas.filter(Boolean)) {
        lista.push({ rutaId: ida.documentId, fechaHoraSalida: enHora(d, h) });
        if (conRegreso && regreso) lista.push({ rutaId: regreso.documentId, fechaHoraSalida: enHora(d, horaRegreso, diaRegreso) });
      }
    }
    // Las que ya pasaron (p. ej. hoy a las 6:00 cuando ya son las 9) se saltan solas
    return lista.filter((s) => new Date(s.fechaHoraSalida).getTime() > Date.now()).sort((a, b) => a.fechaHoraSalida.localeCompare(b.fechaHoraSalida));
  }, [ida, regreso, dias.join(','), horas.join(','), conRegreso, horaRegreso, diaRegreso]); // eslint-disable-line react-hooks/exhaustive-deps
  // Cuántas se saltaron por estar en el pasado (para decirlo)
  const pasadas = dias.length * horas.filter(Boolean).length * (conRegreso && regreso ? 2 : 1) - salidas.length;

  const crear = useMutation({
    mutationFn: () => programarSerie({ salidas, unidadId: unidadId || undefined, choferId: choferId || undefined, rampa: rampa.trim() || undefined, sinPasajeros: sinPasajeros || undefined }),
    onSuccess: (r) => onListo(r.creadas, dias[0] ?? hoyISO()),
    onError: (e) => setError(mensajeDeError(e)),
  });

  const pista = !ida
    ? 'Escoge la ruta.'
    : !dias.length
      ? cuando === 'calendario' ? 'Marca los días en el calendario.' : 'Escoge los días de la semana y hasta cuándo.'
      : !horas.filter(Boolean).length
        ? 'Pon la hora de salida.'
        : !salidas.length
          ? 'Esas fechas y horas ya pasaron.'
          : salidas.length > MAX
            ? `Son ${salidas.length} salidas: el máximo es ${MAX} de una vez.`
            : null;

  // Calendario del mes
  const primero = new Date(mes.anio, mes.mes, 1);
  const vacios = (primero.getDay() + 6) % 7; // la semana empieza el lunes
  const diasMes = new Date(mes.anio, mes.mes + 1, 0).getDate();
  const hoy = hoyISO();
  const cambiarMes = (n: number) => setMes((m) => {
    const d = new Date(m.anio, m.mes + n, 1);
    return { anio: d.getFullYear(), mes: d.getMonth() };
  });
  const alternar = (d: string) => setMarcados((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d]));

  return (
    <div className={styles.velo} onClick={onCerrar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Programar salidas">
        <div className={styles.modalCabecera}>
          <div className={styles.modalTitulo}>Programar salidas</div>
          <button type="button" className={styles.cerrar} onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>

        <div className={styles.modalCuerpo}>
          <section className={styles.seccion}>
            <div className={styles.rotulo}>Ruta</div>
            <select className={ui.fieldInput} value={rutaId} onChange={(e) => { setRutaId(e.target.value); setSentido('ida'); }}>
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
            <div className={styles.rotulo}>Cuándo</div>
            <div className={styles.segmento} role="radiogroup" aria-label="Cuándo">
              {([['una', 'Una vez'], ['calendario', 'Días del calendario'], ['semanal', 'Semanal']] as const).map(([id, txt]) => (
                <button key={id} type="button" role="radio" aria-checked={cuando === id} className={cuando === id ? styles.segActivo : ''} onClick={() => setCuando(id)}>
                  {txt}
                </button>
              ))}
            </div>

            {cuando === 'una' && <Field label="Fecha" type="date" min={hoy} value={dia} onChange={(e) => setDia(e.target.value)} />}

            {cuando === 'calendario' && (
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
                    const pasado = d < hoy;
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={pasado}
                        aria-pressed={marcados.includes(d)}
                        className={`${styles.calDia} ${marcados.includes(d) ? styles.calMarcado : ''} ${d === hoy ? styles.calHoy : ''}`}
                        onClick={() => alternar(d)}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
                <div className={styles.calPie}>
                  <span>{marcados.length ? `${marcados.length} día${marcados.length === 1 ? '' : 's'} marcado${marcados.length === 1 ? '' : 's'}` : 'Toca los días en que sale'}</span>
                  {marcados.length > 0 && <button type="button" className={styles.enlace} onClick={() => setMarcados([])}>Quitar todos</button>}
                </div>
              </div>
            )}

            {cuando === 'semanal' && (
              <>
                <div className={styles.semana} role="group" aria-label="Días de la semana">
                  {SEMANA.map(([n, l, nombre]) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={semana.includes(n)}
                      title={nombre}
                      className={semana.includes(n) ? styles.semanaActivo : ''}
                      onClick={() => setSemana((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]))}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className={styles.dosColumnas}>
                  <Field label="Desde" type="date" min={hoy} value={desde} onChange={(e) => setDesde(e.target.value)} />
                  <Field label="Hasta" type="date" min={desde} value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </div>
              </>
            )}

            <div>
              <span className={ui.fieldLabel}>Hora de salida</span>
              <div className={styles.horas}>
                {horas.map((h, i) => (
                  <span key={i} className={styles.hora}>
                    <input className={ui.fieldInput} type="time" value={h} aria-label={`Hora ${i + 1}`} onChange={(e) => setHoras((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
                    {horas.length > 1 && (
                      <button type="button" aria-label="Quitar esta hora" onClick={() => setHoras((l) => l.filter((_, j) => j !== i))}>✕</button>
                    )}
                  </span>
                ))}
                <button type="button" className={styles.enlace} onClick={() => setHoras((l) => [...l, ''])}>+ Otra hora</button>
              </div>
            </div>

            {regreso && (
              <div className={styles.regreso}>
                <label className={styles.check}>
                  <input type="checkbox" checked={conRegreso} onChange={(e) => setConRegreso(e.target.checked)} />
                  <span>
                    Programar también el regreso
                    <small>{regreso.origen} → {regreso.destino}, con el mismo bus y conductor</small>
                  </span>
                </label>
                {conRegreso && (
                  <div className={styles.dosColumnas}>
                    <Field label="Hora del regreso" type="time" value={horaRegreso} onChange={(e) => setHoraRegreso(e.target.value)} />
                    <label className={ui.field}>
                      <span className={ui.fieldLabel}>Qué día</span>
                      <select className={ui.fieldInput} value={diaRegreso} onChange={(e) => setDiaRegreso(Number(e.target.value) as 0 | 1)}>
                        <option value={0}>El mismo día</option>
                        <option value={1}>Al día siguiente</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className={styles.seccion}>
            <div className={styles.rotulo}>Bus y conductor · opcionales</div>
            <div className={styles.dosColumnas}>
              <label className={ui.field}>
                <span className={ui.fieldLabel}>Bus</span>
                <select className={ui.fieldInput} value={unidadId} onChange={(e) => setUnidadId(e.target.value)}>
                  <option value="">Por asignar</option>
                  {unidades
                    .filter((u) => u.estado === 'disponible' || u.estado === 'en_ruta')
                    .map((u) => (
                      <option key={u.documentId} value={u.documentId}>
                        {u.numero} · {puestosDe(u)} puestos{u.marcaModelo ? ` · ${u.marcaModelo}` : ''}
                      </option>
                    ))}
                </select>
              </label>
              <label className={ui.field}>
                <span className={ui.fieldLabel}>Conductor</span>
                <select className={ui.fieldInput} value={choferId} onChange={(e) => setChoferId(e.target.value)}>
                  <option value="">Por asignar</option>
                  {choferes.map((c) => (
                    <option key={c.documentId} value={c.documentId}>{c.nombre}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.nota}>
              {unidadId
                ? 'El mismo bus para todas. Si una se complica (se daña, un incidente), se le cambia el bus solo a esa desde la agenda.'
                : 'Sin bus la salida no se vende: no hay puestos que ofrecer. Asígnaselo desde la agenda cuando lo sepas.'}
            </div>
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
                {salidas.slice(0, 24).map((s, i) => (
                  <span key={i} className={s.rutaId === regreso?.documentId ? styles.vistaRegreso : ''}>
                    {fechaCorta(s.fechaHoraSalida)} · {horaDe(s.fechaHoraSalida)}
                  </span>
                ))}
                {salidas.length > 24 && <span className={styles.vistaMas}>y {salidas.length - 24} más</span>}
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
                {conRegreso && regreso ? ' con regreso' : ''}
                {pasadas > 0 ? ` · se saltan ${pasadas} que ya pasaron` : ''}
              </span>
            )}
          </div>
          <button type="button" className={ui.btnSecondary} onClick={onCerrar}>Cancelar</button>
          <button
            type="button"
            className={ui.btnPrimary}
            disabled={Boolean(pista) || crear.isPending}
            onClick={() => {
              setError(null);
              crear.mutate();
            }}
          >
            {crear.isPending ? 'Programando…' : `Programar ${salidas.length || ''} salida${salidas.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
