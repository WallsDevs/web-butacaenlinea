import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getOcupacionSalidas, getRutas, getSalidas } from '../../lib/api/endpoints';
import { hora, duracion, fechaLarga, rangoDia, hoyISO } from '../../lib/time';
import { Money } from '../../components/ui/Money';
import { Field } from '../../components/ui/Field';
import { PillTabs } from '../../components/ui/PillTabs';
import { RouteDash } from '../../components/ui/RouteDash';
import { useBooking } from './useBooking';
import { useSeo } from '../../lib/seo';
import ui from '../../components/ui/ui.module.css';
import styles from './public.module.css';

type Orden = 'hora' | 'tipo' | 'precio';

export default function Salidas() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { criterios, setCriterios, limpiarSeleccion } = useBooking();
  const [orden, setOrden] = useState<Orden>('hora');

  const origen = params.get('origen') ?? '';
  const destino = params.get('destino') ?? '';
  useSeo(
    `Pasajes ${origen || 'Venezuela'} a ${destino || 'todos los destinos'} — Butaca En Línea`,
    `Salidas de autobús ${origen ? `desde ${origen} ` : ''}${destino ? `hacia ${destino}` : 'a todos los destinos'}: horarios, precios y compra en línea con puesto numerado.`
  );
  const fecha = params.get('fecha') ?? hoyISO();
  const { desde, hasta } = rangoDia(fecha);

  const { data: salidas, isLoading } = useQuery({
    queryKey: ['salidas', 'todas', origen, destino, fecha],
    queryFn: () => getSalidas({ origen: origen || undefined, destino: destino || undefined, desde, hasta }),
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
    const p: Record<string, string> = { fecha: f };
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
        (acc, p) => acc + p.filas.length * (p.layout.izquierda + p.layout.derecha),
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

  const tipoUnidad = (s: (typeof ordenadas)[number]) => {
    const pisos = s.unidad?.configuracionAsientos?.pisos;
    const nombres = pisos?.map((p) => p.nombre) ?? [];
    const prefijo = (pisos?.length ?? 1) > 1 ? 'Doble piso' : 'Piso sencillo';
    return `${prefijo} · ${[...new Set(nombres)].join(' + ')}`;
  };

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
          label="Fecha"
          type="date"
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
            {isLoading ? 'Buscando…' : `${ordenadas.length} salida${ordenadas.length === 1 ? ' disponible' : 's disponibles'}`}
          </h2>
          <div className={styles.resultadosSub}>
            {origen || 'Todos los orígenes'} → {destino || 'todos los destinos'} · {fechaLarga(`${fecha}T12:00:00`)} · todas las empresas
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
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
        {ordenadas.map((s, i) => {
          const destacada = i === 0;
          const precioMin = Math.min(...Object.values(s.preciosUsd ?? { x: 0 }));
          return (
            <div key={s.documentId} className={`${styles.tarjetaSalida} ${destacada ? styles.tarjetaSalidaHl : ''}`}>
              <div className={styles.tarjetaSalidaInterior}>
                <div className={styles.horario}>
                  <div>
                    <div className={styles.horaGrande}>{hora(s.fechaHoraSalida)}</div>
                    <div className={styles.horaSub}>Salida</div>
                  </div>
                  <RouteDash width={86} duracion={s.ruta ? duracion(s.ruta.duracionMin) : undefined} />
                  <div>
                    <div className={styles.horaGrande}>{hora(s.fechaHoraLlegada)}</div>
                    <div className={styles.horaSub}>Llegada</div>
                  </div>
                </div>
                <div className={styles.unidadInfo}>
                  {s.linea && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-600)', marginBottom: 2 }}>
                      {s.linea.nombre}
                    </div>
                  )}
                  <div className={styles.unidadTipo}>{tipoUnidad(s)}</div>
                  <div className={styles.unidadMeta}>
                    Unidad {s.unidad?.numero} · {s.unidad?.marcaModelo} · {libresDe(s)} puestos libres
                  </div>
                  <div className={styles.amenidades}>
                    {(s.unidad?.amenidades ?? []).map((a) => (
                      <span key={a} className={styles.amenidad}>
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
                <div className={styles.precioCta}>
                  <div style={{ textAlign: 'right' }}>
                    <Money usd={precioMin} className={styles.precioGrande} />
                    <div className={styles.horaSub}>por pasajero</div>
                  </div>
                  <button
                    className={`${styles.btnEscoger} ${destacada ? styles.btnEscogerHl : ''}`}
                    onClick={() => escoger(s.documentId)}
                  >
                    Escoger puesto
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {!isLoading && !ordenadas.length && (
          <div className={styles.vacio} style={{ padding: 40 }}>
            No hay salidas {destino ? `a ${destino}` : ''} con {criterios.pasajeros} puesto{criterios.pasajeros === 1 ? '' : 's'} libres ese día. Prueba otra fecha o menos pasajeros.
          </div>
        )}
      </div>
    </div>
  );
}
