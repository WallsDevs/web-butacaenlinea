import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getOcupacionSalidas, getRutas, getRutasUrbanasPublicas, getSalidas, type RutaUrbanaPublica } from '../../lib/api/endpoints';
import { fechaConAnio, fechaCorta, rangoDia, hoyISO } from '../../lib/time';
import { PantallaCarga } from '../../components/ui/PantallaCarga';
import { Isotipo } from '../../components/brand/LogoMark';
import { IconoNav } from '../../app/iconos';
import { useBooking } from './useBooking';
import { TarjetaSalida } from './TarjetaSalida';
import { PanelAsientos } from './inicio/PanelAsientos';
import { FormularioViaje, IconoModalidad, type Modalidad } from './FormularioViaje';
import formulario from './FormularioViaje.module.css';

// Número de atención por WhatsApp (solo dígitos, con código de país). VITE_WHATSAPP lo reemplaza.
const WHATSAPP = (import.meta.env.VITE_WHATSAPP as string | undefined)?.replace(/\D/g, '') || '584129647161';
const TITULOS: Record<Modalidad, string> = {
  Urbano: 'Rutas urbanas',
  Extraurbano: 'Rutas extraurbanas',
  Nacional: 'Salidas nacionales',
  Tours: 'Tours',
};

function EstadoBusqueda({ modalidad, titulo, detalle, acciones, error, sinPasajes = false }: {
  modalidad: Modalidad;
  titulo: string;
  detalle?: string;
  acciones?: ReactNode;
  error?: boolean;
  sinPasajes?: boolean;
}) {
  return (
    <div className={formulario.estadoResultados} data-sin-pasajes={sinPasajes || undefined}>
      {sinPasajes ? (
        <svg className={formulario.marcaSinPasajes} viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="#cbd5e1" strokeWidth="4">
          <rect x="6" y="6" width="22" height="22" rx="6"/>
          <rect x="6" y="36" width="22" height="22" rx="6"/>
          <rect x="36" y="36" width="22" height="22" rx="6"/>
          <rect x="36" y="6" width="22" height="22" rx="6" stroke="#9fc0ff" strokeDasharray="4 4"/>
        </svg>
      ) : (
        <span className={formulario.iconoEstado}><IconoModalidad modalidad={modalidad}/></span>
      )}
      <div role={error ? 'alert' : 'status'}>
        <h3>{titulo}</h3>
        {detalle && <p>{detalle}</p>}
      </div>
      {acciones && <div className={formulario.accionesEstado}>{acciones}</div>}
    </div>
  );
}

function TarjetaRutaUrbana({ ruta }: { ruta: RutaUrbanaPublica }) {
  const activas = ruta.busetasEnCamino;
  const extremos = [ruta.origen, ruta.destino].filter(Boolean).join(' → ');
  return (
    <li className={formulario.rutaUrbana}>
      <div className={formulario.identidadRuta}>
        <span className={formulario.iconoRuta}><IconoModalidad modalidad="Urbano"/></span>
        <div>
          <h3>{ruta.nombre}</h3>
          {ruta.linea && <p>{ruta.linea}</p>}
        </div>
      </div>
      {(extremos || ruta.paradas > 0) && (
        <div className={formulario.trayectoRuta}>
          {extremos && <span>{extremos}</span>}
          {ruta.paradas > 0 && <small>{ruta.paradas} {ruta.paradas === 1 ? 'parada' : 'paradas'}</small>}
        </div>
      )}
      <div className={formulario.servicioRuta}>
        <span className={formulario.busetasActivas} data-activa={activas > 0}>
          {activas > 0 ? `${activas} ${activas === 1 ? 'buseta' : 'busetas'} en servicio` : 'Sin busetas en servicio'}
        </span>
        <span className={formulario.tarifaRuta}>
          {ruta.porTramos && 'Desde '}<strong>Bs {ruta.tarifaBs.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong> por pasaje
        </span>
      </div>
      <Link className={formulario.mapaRuta} to={`/mapa/${ruta.documentId}`} aria-label={`Ver recorrido de ${ruta.nombre}`}>
        <IconoNav id="busetas" size={18}/> Ver recorrido
      </Link>
    </li>
  );
}

function ListaSalidas({ children }: { children: ReactElement[] }) {
  const visibles = 5;
  const restantes = children.length - visibles;
  return (
    <>
      <ul className={formulario.filasResultados}>{children.slice(0, visibles)}</ul>
      {restantes > 0 && (
        <details className={formulario.masResultados}>
          <summary>
            <span className={formulario.mostrarMas}>Ver {restantes} {restantes === 1 ? 'salida' : 'salidas'} más</span>
            <span className={formulario.mostrarMenos}>Mostrar menos salidas</span>
          </summary>
          <ul className={formulario.filasResultados}>{children.slice(visibles)}</ul>
        </details>
      )}
    </>
  );
}

interface Props {
  enPanel?: boolean;
  modalidad?: Modalidad;
  elegirModalidad?: (modalidad: Modalidad) => void;
}

export function BuscadorPasajes({ enPanel = false, modalidad = 'Nacional', elegirModalidad }: Props) {
  const { criterios, setCriterios } = useBooking();
  const [trayectoUrbano, setTrayectoUrbano] = useState({ origen: '', destino: '' });
  const [consultas, setConsultas] = useState({
    Extraurbano: { origen: '', destino: '' },
    Tours: { origen: '', destino: '' },
  });
  const consulta = modalidad === 'Extraurbano' || modalidad === 'Tours' ? consultas[modalidad] : undefined;
  const [abierta, setAbierta] = useState<string | null>(null);
  const urbano = modalidad === 'Urbano';
  const nacional = modalidad === 'Nacional';
  const nacionales = useQuery({ queryKey: ['rutas-publicas'], queryFn: () => getRutas(), enabled: nacional });
  const urbanas = useQuery({ queryKey: ['rutas-urbanas-publicas', 'inicio'], queryFn: () => getRutasUrbanasPublicas(), enabled: urbano, refetchInterval: urbano ? 15_000 : false });
  const catalogo = urbano ? urbanas : nacionales;
  const rutas = consulta ? undefined : catalogo.data;
  const seleccion = urbano ? trayectoUrbano : criterios;
  const origenes = useMemo(() => {
    const nombres = (rutas ?? []).map(r => r.origen).filter((o): o is string => Boolean(o));
    return [...new Set(nombres)].sort();
  }, [rutas]);
  const origen = origenes.includes(seleccion.origen) ? seleccion.origen : (urbano ? '' : origenes[0] || '');
  const destinos = useMemo(() => {
    const nombres = (rutas ?? []).filter(r => r.origen === origen || (urbano && !origen)).map(r => r.destino).filter((d): d is string => Boolean(d));
    return [...new Set(nombres)].sort();
  }, [rutas, origen, urbano]);
  const destino = destinos.includes(seleccion.destino) ? seleccion.destino : (urbano ? '' : destinos[0] || '');
  const reversible = origen !== destino && Boolean(rutas?.some(r =>
    (r.origen === destino || (urbano && !destino)) && (r.destino === origen || (urbano && !origen))));
  const hoy = hoyISO();
  const fecha = criterios.fecha >= hoy ? criterios.fecha : hoy;
  const pax = Math.max(1, Math.min(6, criterios.pasajeros));
  const diaTxt = fechaCorta(`${fecha}T12:00:00`);

  const distintas = Boolean(origen && destino && origen !== destino);
  const { data: salidas, isError: errorSalidas, refetch: recargarSalidas } = useQuery({
    queryKey: ['salidas-home', origen, destino, fecha],
    queryFn: () => getSalidas({ origen, destino, ...rangoDia(fecha) }),
    enabled: nacional && distintas,
    refetchInterval: 60_000,
  });
  const { data: ocupacion } = useQuery({
    queryKey: ['ocupacion', (salidas ?? []).map((s) => s.documentId).join(',')],
    queryFn: () => getOcupacionSalidas((salidas ?? []).map((s) => s.documentId)),
    enabled: nacional && Boolean(salidas?.length),
    refetchInterval: 30_000,
  });
  const libresDe = (s: NonNullable<typeof salidas>[number]) => {
    const total = s.unidad?.configuracionAsientos?.pisos?.reduce((acc, p) => acc + (p.filas.length * (p.layout.izquierda + p.layout.derecha) + (p.filaTrasera ?? 0)), 0) ?? 0;
    return Math.max(0, total - (ocupacion?.[s.documentId] ?? 0));
  };
  const lista = nacional && distintas ? (salidas ?? []).filter((s) => !ocupacion || libresDe(s) >= pax) : [];
  const recorridos = urbano ? (urbanas.data ?? []).filter(r =>
    (!origen || r.origen === origen) && (!destino || r.destino === destino)) : [];
  const hayResultados = Boolean(lista.length || recorridos.length);

  // Otra ruta o fecha: se cierra el mapa abierto
  useEffect(() => setAbierta(null), [modalidad, origen, destino, fecha]);

  function cambiarTrayecto(origen: string, destino: string) {
    if (modalidad === 'Extraurbano' || modalidad === 'Tours') {
      setConsultas(actual => ({ ...actual, [modalidad]: { origen, destino } }));
    } else if (urbano) {
      setTrayectoUrbano({ origen, destino });
    } else {
      setCriterios({ origen, destino });
    }
  }

  function estadoResultados() {
    const desde = (consulta?.origen ?? origen).trim();
    const hasta = (consulta?.destino ?? destino).trim();
    const trayecto = [desde && `desde ${desde}`, hasta && `hasta ${hasta}`].filter(Boolean).join(' ');
    const mensaje = [
      consulta ? `Hola, quisiera consultar ${modalidad === 'Tours' ? 'un tour' : 'un viaje extraurbano'}` : 'Hola, avísame cuando haya salidas',
      trayecto, `el ${fechaConAnio(fecha + 'T12:00:00')} para ${pax} ${pax === 1 ? 'pasajero' : 'pasajeros'}.`,
    ].filter(Boolean).join(' ');
    const contacto = <a className={formulario.accionPrincipal} href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`}
      target="_blank" rel="noopener noreferrer">{consulta ? 'Consultar por WhatsApp' : 'Avísame por WhatsApp'}</a>;

    if (consulta) {
      return <EstadoBusqueda modalidad={modalidad} sinPasajes
        titulo={modalidad === 'Tours' ? 'Aún no hay tours publicados' : 'Aún no hay rutas extraurbanas publicadas'}
        detalle="Indica desde dónde sales y adónde quieres ir para consultar disponibilidad." acciones={contacto}/>;
    }
    if ((!catalogo.data && catalogo.isError) || (nacional && distintas && !salidas && errorSalidas)) {
      return <EstadoBusqueda modalidad={modalidad} error titulo="No pudimos cargar los resultados"
        detalle="Revisa tu conexión y vuelve a intentarlo."
        acciones={<button type="button" className={formulario.accionPrincipal} onClick={() => rutas ? recargarSalidas() : catalogo.refetch()}>Reintentar</button>}/>;
    }
    if (!catalogo.data || (nacional && distintas && !salidas)) {
      return <PantallaCarga enLista mensaje={urbano ? 'Buscando rutas urbanas…' : 'Buscando salidas…'}/>;
    }
    if (urbano) {
      return <EstadoBusqueda modalidad={modalidad} sinPasajes titulo="Aún no hay rutas urbanas publicadas"/>;
    }
    if (origen && origen === destino) {
      return <EstadoBusqueda modalidad={modalidad} titulo="Elige un destino distinto al origen"/>;
    }
    const titulo = !distintas ? 'Todavía no hay rutas publicadas'
      : salidas?.length ? 'No hay suficientes puestos para este viaje' : `Todavía no hay salidas de ${origen} a ${destino}`;
    return <EstadoBusqueda modalidad={modalidad} sinPasajes titulo={titulo}
      detalle={salidas?.length ? 'Prueba otra fecha o reduce la cantidad de pasajeros.'
        : 'Las líneas afiliadas publican sus horarios con anticipación. Escríbenos por WhatsApp y te avisamos apenas haya puestos.'}
      acciones={<>{contacto}<span className={formulario.viajasPronto}>¿Viajas pronto? <a href="/pasajes">Ver pasajes por ciudad</a></span></>}/>;
  }

  return (
    <>
      <FormularioViaje modalidad={modalidad} elegirModalidad={elegirModalidad} enPanel={enPanel}
        origenes={origenes} destinos={destinos} origen={consulta?.origen ?? origen} destino={consulta?.destino ?? destino}
        invertir={consulta ? Boolean(consulta.origen.trim() || consulta.destino.trim()) : reversible}
        cambiarTrayecto={cambiarTrayecto} consultaLibre={Boolean(consulta)}
        fecha={fecha} pasajeros={pax} cambiarFecha={fecha => setCriterios({ fecha })} cambiarPasajeros={pasajeros => setCriterios({ pasajeros })}
      />
      <div className={enPanel ? formulario.resultadosEnPanel : formulario.resultadosPortada}>
        <section id="salidas" className={formulario.resultados} aria-labelledby="titulo-resultados" data-guia="buscar-salidas">
          <header className={formulario.cabeceraResultados}>
            <Isotipo size={23} trazo={5} contorno="#fff" acento="#60a5fa"/>
            <div>
              <h2 id="titulo-resultados">{TITULOS[modalidad]}</h2>
              {urbano ? <span role="status">{urbanas.data && `${recorridos.length} ${recorridos.length === 1 ? 'recorrido' : 'recorridos'}`}</span> : <span>{diaTxt}</span>}
            </div>
            {nacional && lista.length > 0 && <small>{lista.length} {lista.length === 1 ? 'salida' : 'salidas'}</small>}
          </header>
          <div key={`${modalidad}/${origen}/${destino}/${urbano ? '' : fecha}`} className={formulario.listaResultados}>
            {!hayResultados && estadoResultados()}
            {recorridos.length > 0 && (
              <ul className={`${formulario.filasResultados} ${formulario.listaUrbana}`} aria-labelledby="titulo-resultados" tabIndex={0}>
                {recorridos.map(r => <TarjetaRutaUrbana key={r.documentId} ruta={r}/>)}
              </ul>
            )}
            {lista.length > 0 && (
              <ListaSalidas>
                {lista.map(s => {
                  const elegida = abierta === s.documentId;
                  return (
                    <li key={s.documentId}>
                      <TarjetaSalida salida={s} libres={ocupacion ? libresDe(s) : undefined} abierta={elegida}
                        alElegir={() => setAbierta(elegida ? null : s.documentId)} />
                      {elegida && <PanelAsientos salidaId={s.documentId} pax={pax}/>}
                    </li>
                  );
                })}
              </ListaSalidas>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
