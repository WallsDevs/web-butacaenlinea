import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useModulos } from '../../lib/useModulos';
import { AvisoIntegracion } from '../../components/ui/AvisoIntegracion';
import { cancelarSalida, getChoferes, getRutas, getSalidas, getUnidades, programarSalida } from '../../lib/api/endpoints';
import type { SalidaDto } from '../../lib/api/types';
import { fechaLarga, hora, hoyISO, rangoDia } from '../../lib/time';
import { isoDia } from '../../lib/series';
import { useAuth } from '../../stores/auth';
import { ApiError } from '../../lib/api/client';
import { StatusChip } from '../../components/ui/StatusChip';
import { ModalProgramar } from './ModalProgramar';
import { ModalAsignacion } from './ModalAsignacion';
import { PanelVentas } from './PanelVentas';
import ui from '../../components/ui/ui.module.css';
import styles from './EmpresaSalidas.module.css';
import flota from '../flota/flota.module.css';

type Periodo = 'hoy' | 'semana' | 'mes' | 'dia';
type Pendiente = 'todas' | 'sinBus' | 'sinConductor';
/** Faltando esto para salir, «sin conductor» deja de ser un recordatorio y pasa a ser urgente. */
const HORAS_URGENTE = 3;

const masDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDia(d);
};

/**
 * Programación de salidas: una agenda por día. Cada salida dice su bus, su
 * conductor y cuántos puestos lleva vendidos; lo que falta (bus o conductor)
 * se ve resaltado y se resuelve ahí mismo, salida por salida.
 */
export default function EmpresaSalidas({ abrirProgramar = 0 }: { abrirProgramar?: number }) {
  const queryClient = useQueryClient();
  const slug = useAuth((s) => s.usuario)?.linea?.slug;
  const { integracionActiva } = useModulos();
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [dia, setDia] = useState(hoyISO());
  const [rutaFiltro, setRutaFiltro] = useState('');
  const [pendiente, setPendiente] = useState<Pendiente>('todas');
  const [verPasadas, setVerPasadas] = useState(false);
  const [programando, setProgramando] = useState(false);
  const [asignando, setAsignando] = useState<SalidaDto[] | null>(null);
  // Salidas marcadas para asignarles el mismo bus o conductor de una vez
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const marcar = (ids: string[], si: boolean) =>
    setMarcadas((m) => {
      const n = new Set(m);
      for (const id of ids) {
        if (si) n.add(id);
        else n.delete(id);
      }
      return n;
    });
  const [aviso, setAviso] = useState<string | null>(null);
  // Las ventas de una salida, en vivo
  const [viendoVentas, setViendoVentas] = useState<SalidaDto | null>(null);

  // Solo un clic nuevo en «Programar salidas» (cabecera) abre el modal
  const clicVisto = useRef(abrirProgramar);
  useEffect(() => {
    if (abrirProgramar === clicVisto.current) return;
    clicVisto.current = abrirProgramar;
    setProgramando(true);
  }, [abrirProgramar]);

  const rango =
    periodo === 'hoy'
      ? rangoDia(hoyISO())
      : periodo === 'dia'
        ? rangoDia(dia)
        : { desde: rangoDia(verPasadas ? masDias(-7) : hoyISO()).desde, hasta: rangoDia(masDias(periodo === 'semana' ? 6 : 30)).hasta };
  const { data: salidas, isLoading } = useQuery({
    queryKey: ['empresa-salidas', slug, rango.desde, rango.hasta],
    queryFn: () => getSalidas({ ...rango, lineaSlug: slug, estados: ['programada', 'abordando', 'en_ruta', 'finalizada', 'cancelada'], limite: 100 }),
    // En vivo: los vendidos y quién está comprando se actualizan solos
    refetchInterval: 15_000,
  });
  const { data: rutas } = useQuery({ queryKey: ['rutas', slug], queryFn: () => getRutas(slug) });
  const { data: unidades } = useQuery({ queryKey: ['unidades', slug], queryFn: () => getUnidades(slug) });
  const { data: choferes } = useQuery({ queryKey: ['choferes'], queryFn: getChoferes });
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['empresa-salidas'] });

  const cancelar = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => cancelarSalida(id, force),
    onSuccess: (r) => {
      setAviso(
        r.afectados
          ? `Salida cancelada. ${r.afectados} boleto${r.afectados === 1 ? '' : 's'} anulado${r.afectados === 1 ? '' : 's'}; ${r.reembolsosPendientes} con dinero por devolver (están en Pagos como «Reembolsos pendientes»).`
          : 'Salida cancelada.'
      );
      refrescar();
    },
    onError: (e, vars) => {
      if (e instanceof ApiError && e.code === 'tiene_boletos') {
        const d = e.details as { afectados?: number; pagados?: number };
        if (confirm(`Esta salida tiene ${d.afectados} boleto${d.afectados === 1 ? '' : 's'} (${d.pagados} cobrados).\n\nAl cancelar se anulan todos; los cobrados quedan como REEMBOLSO PENDIENTE.\n\n¿Cancelar de todas formas?`)) {
          cancelar.mutate({ id: vars.id, force: true });
        }
      } else setAviso('No se pudo cancelar la salida.');
    },
  });

  // Regreso vacío: si el bus quedó en otra ciudad, la línea lo registra sin pasajeros desde la agenda
  const registrarRegreso = useMutation({
    mutationFn: (s: SalidaDto) => {
      const vuelta = (rutas ?? []).find((r) => r.id === s.ruta?.inversaId);
      return programarSalida({ rutaId: vuelta!.documentId, unidadId: s.unidad?.documentId, fechaHoraSalida: new Date(new Date(s.fechaHoraLlegada).getTime() + 60 * 60_000).toISOString(), sinPasajeros: true });
    },
    onSuccess: () => {
      setAviso('Regreso sin pasajeros registrado una hora después de la llegada. Cámbiale la hora si fue otra.');
      refrescar();
    },
    onError: (e) => setAviso(`No se pudo registrar el regreso (${e instanceof ApiError ? e.code : 'sin conexión'}).`),
  });

  const ahora = Date.now();
  const lista = (salidas ?? [])
    .filter((s) => !rutaFiltro || s.ruta?.documentId === rutaFiltro || String(s.ruta?.inversaId ?? '') === rutaFiltro)
    .filter((s) => pendiente === 'todas' || (pendiente === 'sinBus' ? !s.unidad : !s.chofer))
    .filter((s) => s.estado !== 'cancelada' || verPasadas);
  const activas = (salidas ?? []).filter((s) => ['programada', 'abordando'].includes(s.estado));
  const sinBus = activas.filter((s) => !s.unidad).length;
  const sinConductor = activas.filter((s) => !s.chofer).length;
  const porDia = new Map<string, SalidaDto[]>();
  for (const s of lista) {
    const k = isoDia(new Date(s.fechaHoraSalida));
    porDia.set(k, [...(porDia.get(k) ?? []), s]);
  }
  const porId = new Map((rutas ?? []).map((r) => [r.id, r]));
  const rutasVisibles = (rutas ?? []).filter((r) => !r.inversaId || !porId.has(r.inversaId) || r.id < r.inversaId);

  return (
    <div className={flota.contenido}>
      {integracionActiva && <AvisoIntegracion que="salidas" />}

      <div className={styles.barra}>
        <div className={styles.segmento} role="radiogroup" aria-label="Período">
          {([['hoy', 'Hoy'], ['semana', '7 días'], ['mes', '30 días'], ['dia', 'Un día']] as const).map(([id, txt]) => (
            <button key={id} type="button" role="radio" aria-checked={periodo === id} className={periodo === id ? styles.segActivo : ''} onClick={() => setPeriodo(id)}>
              {txt}
            </button>
          ))}
        </div>
        {periodo === 'dia' && <input className={ui.fieldInput} style={{ width: 170 }} type="date" value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Día" />}
        <select className={ui.fieldInput} style={{ width: 240 }} value={rutaFiltro} onChange={(e) => setRutaFiltro(e.target.value)} aria-label="Ruta">
          <option value="">Todas las rutas</option>
          {rutasVisibles.map((r) => (
            <option key={r.documentId} value={r.documentId}>
              {r.origen} {r.inversaId && porId.has(r.inversaId) ? '⇄' : '→'} {r.destino}
            </option>
          ))}
        </select>
        <div className={styles.pendientes}>
          <button type="button" aria-pressed={pendiente === 'sinBus'} className={pendiente === 'sinBus' ? styles.pendActivo : ''} onClick={() => setPendiente((p) => (p === 'sinBus' ? 'todas' : 'sinBus'))}>
            Sin bus <b>{sinBus}</b>
          </button>
          <button type="button" aria-pressed={pendiente === 'sinConductor'} className={pendiente === 'sinConductor' ? styles.pendActivo : ''} onClick={() => setPendiente((p) => (p === 'sinConductor' ? 'todas' : 'sinConductor'))}>
            Sin conductor <b>{sinConductor}</b>
          </button>
        </div>
        <label className={styles.check} style={{ marginLeft: 'auto' }}>
          <input type="checkbox" checked={verPasadas} onChange={(e) => setVerPasadas(e.target.checked)} />
          <span>Ver pasadas y canceladas</span>
        </label>
      </div>

      {aviso && (
        <div className={styles.mensaje}>
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">✕</button>
        </div>
      )}

      {isLoading ? (
        <div className={styles.vacio}>Cargando salidas…</div>
      ) : !lista.length ? (
        <div className={styles.vacio}>
          {pendiente !== 'todas' ? 'Nada pendiente en este período.' : 'No hay salidas en este período.'}
          {!integracionActiva && pendiente === 'todas' && (
            <button type="button" className={ui.btnPrimary} onClick={() => setProgramando(true)}>Programar salidas</button>
          )}
        </div>
      ) : (
        [...porDia.entries()].map(([d, delDia]) => (
          <section key={d} className={styles.dia}>
            <header className={styles.diaCabecera}>
              <span className={styles.diaNombre}>{d === hoyISO() ? 'Hoy' : d === masDias(1) ? 'Mañana' : fechaLarga(`${d}T12:00:00`)}</span>
              {d === hoyISO() || d === masDias(1) ? <span className={styles.diaFecha}>{fechaLarga(`${d}T12:00:00`)}</span> : null}
              <span className={styles.diaCuenta}>{delDia.length} salida{delDia.length === 1 ? '' : 's'}</span>
              {!integracionActiva && (() => {
                const activasDia = delDia.filter((x) => ['programada', 'abordando'].includes(x.estado));
                const sinBusDia = activasDia.filter((x) => !x.unidad);
                const todasMarcadas = activasDia.length > 0 && activasDia.every((x) => marcadas.has(x.documentId));
                return activasDia.length > 0 ? (
                  <span className={styles.diaAcciones}>
                    {sinBusDia.length > 0 && (
                      <button type="button" onClick={() => marcar(sinBusDia.map((x) => x.documentId), true)}>Marcar las sin bus ({sinBusDia.length})</button>
                    )}
                    <button type="button" onClick={() => marcar(activasDia.map((x) => x.documentId), !todasMarcadas)}>{todasMarcadas ? 'Desmarcar el día' : 'Marcar el día'}</button>
                  </span>
                ) : null;
              })()}
            </header>
            <div className={styles.filas}>
              {delDia.map((s) => {
                const activa = ['programada', 'abordando'].includes(s.estado);
                const faltan = (new Date(s.fechaHoraSalida).getTime() - ahora) / 3600_000;
                const urgente = activa && faltan < HORAS_URGENTE;
                const vendidos = s.vendidos ?? 0;
                const capacidad = s.capacidad ?? 0;
                const vuelta = s.ruta?.inversaId ? porId.get(s.ruta.inversaId) : undefined;
                return (
                  <article key={s.documentId} className={`${styles.salida} ${!activa ? styles.salidaApagada : ''} ${marcadas.has(s.documentId) ? styles.salidaMarcada : ''}`}>
                    <label className={styles.marca} title={activa ? 'Marcar para asignar varias de una vez' : undefined}>
                      <input type="checkbox" disabled={!activa || integracionActiva} checked={marcadas.has(s.documentId)} onChange={(e) => marcar([s.documentId], e.target.checked)} aria-label={`Marcar la salida de las ${hora(s.fechaHoraSalida)}`} />
                    </label>
                    <div className={styles.horaCol}>
                      <span className={styles.horaSale}>{hora(s.fechaHoraSalida)}</span>
                      <span className={styles.horaLlega}>llega {hora(s.fechaHoraLlegada)}</span>
                    </div>
                    <div className={styles.rutaCol}>
                      <span className={styles.rutaNombre}>{s.ruta?.origen ? `${s.ruta.origen} → ${s.ruta.destino}` : 'Ruta borrada'}</span>
                      <span className={styles.chips}>
                        {s.serieId && <span className={styles.chipSerie} title="Programada en serie">↻ Serie</span>}
                        {s.sinPasajeros && <StatusChip tono="neutral" size="sm">Sin pasajeros</StatusChip>}
                        {s.rampa && <span className={styles.chipSuave}>{s.rampa}</span>}
                      </span>
                    </div>
                    <button type="button" className={`${styles.asig} ${!s.unidad ? styles.falta : ''}`} disabled={!activa || integracionActiva} onClick={() => setAsignando([s])} title={s.unidad ? 'Cambiar el bus' : 'Sin bus no se vende: no hay puestos que ofrecer. Toca para asignarle uno.'}>
                      <span className={styles.asigRotulo}>Bus</span>
                      <span className={styles.asigValor}>{s.unidad ? `${s.unidad.numero} · ${capacidad} puestos` : 'Sin bus'}</span>
                    </button>
                    <button type="button" className={`${styles.asig} ${!s.chofer ? (urgente ? styles.faltaUrgente : styles.falta) : ''}`} disabled={!activa || integracionActiva} onClick={() => setAsignando([s])} title="Cambiar el conductor">
                      <span className={styles.asigRotulo}>Conductor</span>
                      <span className={styles.asigValor}>{s.chofer?.nombre ?? (urgente ? 'Sin conductor · sale pronto' : 'Sin conductor')}</span>
                    </button>
                    <button type="button" className={styles.ocupacion} title="Ver quién compró y quién está comprando ahora" onClick={() => setViendoVentas(s)}>
                      {s.sinPasajeros ? (
                        <span className={styles.ocupTexto}>No se vende</span>
                      ) : capacidad ? (
                        <>
                          <span className={styles.ocupTexto}><b>{vendidos}</b> / {capacidad}</span>
                          <span className={styles.ocupBarra}><i style={{ width: `${Math.min(100, (vendidos / capacidad) * 100)}%` }} /></span>
                        </>
                      ) : (
                        <span className={styles.ocupTexto}>—</span>
                      )}
                      {(s.comprando ?? 0) > 0 && (
                        <span className={styles.comprando}><i aria-hidden />{s.comprando} comprando</span>
                      )}
                    </button>
                    <div className={styles.estadoCol}>
                      {s.estado === 'abordando' ? <StatusChip tono="info" size="sm">Abordando</StatusChip>
                        : s.estado === 'en_ruta' ? <StatusChip tono="info" size="sm">En ruta</StatusChip>
                        : s.estado === 'finalizada' ? <StatusChip tono="ok" size="sm">Finalizada</StatusChip>
                        : s.estado === 'cancelada' ? <StatusChip tono="bad" size="sm">Cancelada</StatusChip>
                        : <StatusChip tono="neutral" size="sm">Programada</StatusChip>}
                    </div>
                    <div className={styles.acciones}>
                      {activa && !integracionActiva && (
                        <>
                          <button type="button" className={styles.enlace} onClick={() => setAsignando([s])}>Bus y conductor</button>
                          <button type="button" className={styles.enlacePeligro} onClick={() => confirm(`¿Cancelar la salida de las ${hora(s.fechaHoraSalida)} a ${s.ruta?.destino}?`) && cancelar.mutate({ id: s.documentId })}>Cancelar</button>
                        </>
                      )}
                      {s.estado === 'finalizada' && vuelta && s.unidad && (
                        <button type="button" className={styles.enlace} onClick={() => registrarRegreso.mutate(s)} title={`El bus volvió vacío de ${s.ruta?.destino}`}>¿Volvió vacío?</button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
      {(salidas?.length ?? 0) >= 100 && <div className={styles.nota}>Se muestran las primeras 100 salidas del período: acota con «Un día» o por ruta.</div>}

      {marcadas.size > 0 && (
        <div className={styles.barraMarcadas} role="region" aria-label="Salidas marcadas">
          <span><b>{marcadas.size}</b> salida{marcadas.size === 1 ? '' : 's'} marcada{marcadas.size === 1 ? '' : 's'}</span>
          <button type="button" className={ui.btnPrimary} onClick={() => setAsignando((salidas ?? []).filter((x) => marcadas.has(x.documentId)))}>Asignar bus o conductor</button>
          <button type="button" className={styles.enlaceClaro} onClick={() => setMarcadas(new Set())}>Quitar marcas</button>
        </div>
      )}

      {viendoVentas && <PanelVentas salida={viendoVentas} onCerrar={() => setViendoVentas(null)} />}

      {programando && (
        <ModalProgramar
          rutas={rutas ?? []}
          onCerrar={() => setProgramando(false)}
          onListo={(n, primerDia) => {
            setProgramando(false);
            setAviso(`${n} salida${n === 1 ? '' : 's'} programada${n === 1 ? '' : 's'}.`);
            // Una sola: se ve ese día; una serie: los próximos 30 días
            if (n === 1) {
              setPeriodo('dia');
              setDia(primerDia);
            } else setPeriodo('mes');
            refrescar();
          }}
        />
      )}
      {asignando && (
        <ModalAsignacion
          salidas={asignando}
          unidades={unidades ?? []}
          choferes={choferes ?? []}
          onCerrar={() => setAsignando(null)}
          onListo={(n) => {
            const varias = asignando.length > 1;
            setAsignando(null);
            setAviso(varias ? `${n} salida${n === 1 ? '' : 's'} actualizada${n === 1 ? '' : 's'}.` : 'Salida actualizada.');
            if (varias) setMarcadas(new Set());
            refrescar();
          }}
        />
      )}
    </div>
  );
}
