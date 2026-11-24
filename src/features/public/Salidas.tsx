import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getOcupacionSalidas, getRutas, getSalidas } from '../../lib/api/endpoints';
import { fechaLarga, rangoDia, hoyISO } from '../../lib/time';
import { PantallaCarga } from '../../components/ui/PantallaCarga';
import { Field } from '../../components/ui/Field';
import { PillTabs } from '../../components/ui/PillTabs';
import { TarjetaSalida } from './TarjetaSalida';
import { useBooking } from './useBooking';
import { useSeo } from '../../lib/seo';
import ui from '../../components/ui/ui.module.css';
import styles from './public.module.css';

type Orden = 'hora' | 'tipo' | 'precio';

/** Ventana del catálogo público (/salidas sin fecha). */
const DIAS_CATALOGO = 30;

export default function Salidas() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { criterios, setCriterios, limpiarSeleccion } = useBooking();
  const [orden, setOrden] = useState<Orden>('hora');

  const origen = params.get('origen') ?? '';
  const destino = params.get('destino') ?? '';
  // Sin fecha, /salidas es el catálogo público: todo lo que sale en los próximos días
  const fecha = params.get('fecha') ?? '';
  useSeo(
    fecha || origen || destino
      ? `Pasajes ${origen || 'Venezuela'} a ${destino || 'todos los destinos'} — Butaca En Línea`
      : 'Todas las salidas — Butaca En Línea',
    `Salidas de autobús ${origen ? `desde ${origen} ` : ''}${destino ? `hacia ${destino}` : 'a todos los destinos'}: horarios, precios y compra en línea con puesto numerado.`
  );
  const { desde, hasta } = fecha
    ? rangoDia(fecha)
    : { desde: new Date().toISOString(), hasta: new Date(Date.now() + DIAS_CATALOGO * 86_400_000).toISOString() };

  const { data: salidas, isPending, isError, refetch } = useQuery({
    queryKey: ['salidas', 'todas', origen, destino, fecha],
    queryFn: () => getSalidas({ origen: origen || undefined, destino: destino || undefined, desde, hasta, limite: 100 }),
    refetchInterval: 60_000,
  });
  const { data: rutasPublicas } = useQuery({ queryKey: ['rutas-publicas'], queryFn: () => getRutas() });
  const destinos = useMemo(
    () => [...new Set((rutasPublicas ?? []).map((r) => r.destino).filter(Boolean))].sort() as string[],
    [rutasPublicas]
  );
  const origenes = useMemo(
    () => [...new Set((rutasPublicas ?? []).map((r) => r.origen).filter(Boolean))].sort() as string[],
    [rutasPublicas]
  );
  const actualizarParams = (o: string, d: string, f: string) => {
    const p: Record<string, string> = {};
    if (f) p.fecha = f;
    if (o) p.origen = o;
    if (d) p.destino = d;
    setParams(p);
  };

  // Puestos libres reales: total de la unidad menos vendidos + reservas vigentes
  const { data: ocupacion } = useQuery({
    queryKey: ['ocupacion', (salidas ?? []).map((s) => s.documentId).join(',')],
    queryFn: () => getOcupacionSalidas((salidas ?? []).map((s) => s.documentId)),
    enabled: Boolean(salidas?.length),
    refetchInterval: 30_000,
  });
  const libresDe = (s: NonNullable<typeof salidas>[number]) => {
    const total =
      s.unidad?.configuracionAsientos?.pisos?.reduce(
        (acc, p) => acc + (p.filas.length * (p.layout.izquierda + p.layout.derecha) + (p.filaTrasera ?? 0)),
        0
      ) ?? 0;
    return Math.max(0, total - (ocupacion?.[s.documentId] ?? 0));
  };

  const ordenadas = useMemo(() => {
    const lista = [...(salidas ?? [])].filter((s) => libresDe(s) >= criterios.pasajeros);
    const minPrecio = (s: (typeof lista)[number]) => Math.min(...Object.values(s.preciosUsd ?? { x: 99 }));
    if (orden === 'precio') lista.sort((a, b) => minPrecio(a) - minPrecio(b));
    if (orden === 'tipo') lista.sort((a, b) => (a.unidad?.marcaModelo ?? '').localeCompare(b.unidad?.marcaModelo ?? ''));
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salidas, orden, ocupacion, criterios.pasajeros]);

  const escoger = (id: string) => {
    limpiarSeleccion();
    navigate(`/salidas/${id}/asientos`);
  };

  return (
    <div className={styles.contenido}>
      {/* Criterios reeditables */}
      <div className={styles.criterios}>
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Origen</span>
          <select
            className={ui.fieldInput}
            value={origen}
            onChange={(e) => actualizarParams(e.target.value, destino, fecha)}
          >
            <option value="">Todos los orígenes</option>
            {origenes.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Destino</span>
          <select
            className={ui.fieldInput}
            value={destino}
            onChange={(e) => {
              setCriterios({ destino: e.target.value });
              actualizarParams(origen, e.target.value, fecha);
            }}
          >
            <option value="">Todos los destinos</option>
            {destinos.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <Field
          label="Fecha (vacía: próximos días)"
          type="date"
          min={hoyISO()}
          value={fecha}
          onChange={(e) => actualizarParams(origen, destino, e.target.value)}
        />
        <Field
          label="Pasajeros"
          type="number"
          min={1}
          max={10}
          value={criterios.pasajeros}
          onChange={(e) =>
            setCriterios({ pasajeros: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })
          }
        />
      </div>

      <div className={styles.resultadosCabecera}>
        <div>
          <h2 className={styles.resultadosH2}>
            {!salidas ? 'Salidas de bus' : `${ordenadas.length} salida${ordenadas.length === 1 ? ' disponible' : 's disponibles'}`}
          </h2>
          <div className={styles.resultadosSub}>
            {origen || 'Todos los orígenes'} → {destino || 'todos los destinos'} · {fecha ? fechaLarga(`${fecha}T12:00:00`) : `próximos ${DIAS_CATALOGO} días`} · todas las empresas
          </div>
        </div>
        <div className={styles.ordenSalidas}>
          <PillTabs<Orden>
            variant="loose"
            items={[
              { id: 'hora', label: 'Hora de salida' },
              { id: 'tipo', label: 'Tipo de unidad' },
              { id: 'precio', label: 'Precio' },
            ]}
            value={orden}
            onChange={setOrden}
          />
        </div>
      </div>

      <div className={styles.listaSalidas}>
        {isPending && <PantallaCarga enLista mensaje="Buscando salidas…" />}
        {isError && !salidas && (
          <div className={styles.avisoSalidas} role="alert">
            <strong>No pudimos cargar las salidas</strong>
            <button type="button" onClick={() => void refetch()}>Reintentar</button>
          </div>
        )}
        {ordenadas.map((s, i) => {
          // En el catálogo (sin fecha, orden por hora) cada día lleva su cabecera
          const dia = s.fechaHoraSalida.slice(0, 10);
          const nuevoDia = !fecha && orden === 'hora' && (i === 0 || ordenadas[i - 1].fechaHoraSalida.slice(0, 10) !== dia);
          return (
            <div key={s.documentId}>
              {nuevoDia && <h3 className={styles.diaSalidas}>{fechaLarga(s.fechaHoraSalida)}</h3>}
              <TarjetaSalida salida={s} libres={ocupacion ? libresDe(s) : undefined}
                mostrarFecha={!fecha && orden !== 'hora'} alElegir={() => escoger(s.documentId)} />
            </div>
          );
        })}
        {salidas && !ordenadas.length && (
          <div className={styles.avisoSalidas} role="status">
            No hay salidas {destino ? `a ${destino}` : ''} con {criterios.pasajeros} puesto{criterios.pasajeros === 1 ? '' : 's'} libres {fecha ? 'ese día' : `en los próximos ${DIAS_CATALOGO} días`}. Prueba otra fecha o menos pasajeros.
          </div>
        )}
      </div>
    </div>
  );
}
