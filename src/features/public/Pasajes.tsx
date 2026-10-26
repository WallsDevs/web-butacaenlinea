import { useEffect, useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getCiudades, getRutas, getSalidas, getTasas } from '../../lib/api/endpoints';
import { useSeo } from '../../lib/seo';
import { BuscadorPasajes } from './BuscadorPasajes';
import { AvisoRuta } from './AvisoRuta';
import { useBooking } from './useBooking';
import { type SalidaPublica, type ViajeLd, RUTA_PRECIOS, TEMPORADAS, ZONA, datosEstructurados, filasSalidas, resumenPar, rutaCiudad, rutaLinea, rutaPar, rutaTemporada, separarPar, slug, textosCiudad, textosGuia, textosIndice, textosPar } from '../../seo/contenido.mjs';
import { TERMINALES, nombreVisible, rutaTerminal, todasLasGuias } from '../../seo/guias.mjs';
import CIUDADES_RESPALDO from '../../seo/ciudades.json';
import styles from './pasajes.module.css';

type Ciudad = { nombre: string; estado: string | null };

/**
 * Páginas para buscadores (y para la gente): /pasajes (todas las ciudades por
 * estado), /pasajes/:ciudad y /pasajes/:origen-a-:destino. Cada una tiene su
 * título, su texto, sus preguntas frecuentes y el buscador ya puesto en esa
 * ciudad o ruta, para comprar ahí mismo. Al publicar salen además ya armadas
 * en el HTML (scripts/prerender-seo.mjs) con los mismos textos.
 */
export default function Pasajes() {
  // /pasajes/:ciudad lleva una ciudad o un par «origen-a-destino»; /pasajes/:origen/:destino es la dirección vieja
  const { ciudad: pSegmento, origen: pViejoOrigen, destino: pViejoDestino } = useParams();
  const { setCriterios } = useBooking();
  const { data: ciudadesApi } = useQuery({ queryKey: ['ciudades'], queryFn: getCiudades, staleTime: 600_000 });
  const { data: rutas, isSuccess: rutasListas } = useQuery({ queryKey: ['rutas-publicas'], queryFn: () => getRutas() });
  const { data: tasas } = useQuery({ queryKey: ['tasas'], queryFn: getTasas, staleTime: 600_000 });

  const ciudades: Ciudad[] = (ciudadesApi?.length ? ciudadesApi : (CIUDADES_RESPALDO as Ciudad[])).map((c) => ({ nombre: c.nombre, estado: c.estado }));
  const porSlug = useMemo(() => new Map(ciudades.map((c) => [slug(c.nombre), c])), [ciudades]);
  const par = pSegmento && !porSlug.has(pSegmento) ? separarPar(pSegmento, new Set(porSlug.keys())) : null;
  const pCiudad = par ? undefined : pSegmento;
  const pOrigen = par?.[0];
  const pDestino = par?.[1];
  const ciudad = pCiudad ? porSlug.get(pCiudad) : undefined;
  const origen = pOrigen ? porSlug.get(pOrigen) : undefined;
  const destino = pDestino ? porSlug.get(pDestino) : undefined;

  // Horarios de la ruta: las mismas salidas (14 días, solo comprables) que van en el HTML para Google
  const { data: salidasPar } = useQuery({
    queryKey: ['salidas-par', origen?.nombre, destino?.nombre],
    queryFn: () => getSalidas({ origen: origen!.nombre, destino: destino!.nombre, desde: new Date().toISOString(), hasta: new Date(Date.now() + 14 * 24 * 3600_000).toISOString(), limite: 30 }),
    enabled: Boolean(origen && destino),
  });
  const tasaBcv = Number(tasas?.bcv) || null;
  const filas = useMemo(() => filasSalidas((salidasPar ?? []) as unknown as SalidaPublica[], tasaBcv), [salidasPar, tasaBcv]);

  // Una ruta de la línea por par (la ida y su vuelta enlazada son pares distintos)
  const pares = useMemo(() => {
    const m = new Map<string, { origen: string; destino: string; precio: number | null; duracionMin: number | null; distanciaKm: number | null; terminalSalida: string | null; terminalLlegada: string | null }>();
    for (const r of rutas ?? []) {
      if (!r.origen || !r.destino) continue;
      const k = `${r.origen}→${r.destino}`;
      const precio = (r.tarifas ?? []).map((t) => Number(t.precioUsd)).filter((n) => n > 0);
      const min = precio.length ? Math.min(...precio) : null;
      const actual = m.get(k);
      const lugar = (l: unknown) => (l && typeof l === 'object' ? ((l as { nombre?: string }).nombre ?? null) : null);
      if (!actual) m.set(k, { origen: r.origen, destino: r.destino, precio: min, duracionMin: r.duracionMin || null, distanciaKm: r.distanciaKm || null, terminalSalida: lugar((r as { origenLugar?: unknown }).origenLugar), terminalLlegada: lugar((r as { destinoLugar?: unknown }).destinoLugar) });
      else if (min != null && (actual.precio == null || min < actual.precio)) actual.precio = min;
    }
    return [...m.values()];
  }, [rutas]);

  // Guías: rutas que la gente busca y que todavía ninguna línea vende aquí (ver seo/guias.mjs)
  const guias = useMemo(() => todasLasGuias(ciudades), [ciudades]);
  const sePar = (o?: string, d?: string) => pares.some((p) => p.origen === o && p.destino === d);
  const guia = origen && destino && !sePar(origen.nombre, destino.nombre) ? guias.find((g) => g.origen === origen.nombre && g.destino === destino.nombre) ?? null : null;

  // El buscador de la página, ya puesto en la ciudad o la ruta (y en el día de la primera salida:
  // si hoy no hay, decir «no hay salidas» al lado de la tabla de horarios confunde)
  const primeraFecha = filas[0] ? new Date(filas[0].salida).toLocaleDateString('en-CA', { timeZone: ZONA }) : null;
  useEffect(() => {
    if (origen && destino) setCriterios({ origen: origen.nombre, destino: destino.nombre, ...(primeraFecha ? { fecha: primeraFecha } : {}) });
    else if (ciudad) {
      // Solo una ruta que exista: una ciudad sin rutas no se pone de destino (el buscador
      // mostraría otra ciudad y buscaría esta, «Caracas a Táriba»)
      const sale = pares.find((p) => p.origen === ciudad.nombre);
      const llega = pares.find((p) => p.destino === ciudad.nombre);
      if (sale) setCriterios({ origen: ciudad.nombre, destino: sale.destino });
      else if (llega) setCriterios({ origen: llega.origen, destino: ciudad.nombre });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciudad?.nombre, origen?.nombre, destino?.nombre, pares.length, primeraFecha]);

  // ── Textos de la página ──
  let ruta = '/pasajes';
  let t: { titulo: string; descripcion: string; h1: string; intro: string; respuesta?: string | null; preguntas?: { p: string; r: string }[]; datos?: { k: string; v: string }[] };
  let viajes: ViajeLd[] = [];
  let migas: { nombre: string; ruta: string }[] = [{ nombre: 'Inicio', ruta: '/' }, { nombre: 'Pasajes', ruta: '/pasajes' }];
  let notaPrecio: string | null = null;
  if (origen && destino && guia) {
    ruta = rutaPar(origen.nombre, destino.nombre);
    const tg = textosGuia(guia);
    t = tg;
    notaPrecio = tg.notaPrecio;
    migas = [...migas, { nombre: origen.nombre, ruta: rutaCiudad(origen.nombre) }, { nombre: `${origen.nombre} a ${destino.nombre}`, ruta }];
  } else if (origen && destino) {
    const par = pares.find((p) => p.origen === origen.nombre && p.destino === destino.nombre);
    ruta = rutaPar(origen.nombre, destino.nombre);
    const resumen = resumenPar(filas, { precioDesde: par?.precio ?? null, tasaBcv });
    t = textosPar(origen.nombre, destino.nombre, { precioDesde: par?.precio, duracionMin: par?.duracionMin, distanciaKm: par?.distanciaKm, resumen, terminalSalida: par?.terminalSalida ?? null, terminalLlegada: par?.terminalLlegada ?? null });
    viajes = filas.map((f) => ({ ...f, origen: origen.nombre, destino: destino.nombre, terminalSalida: par?.terminalSalida ?? null, terminalLlegada: par?.terminalLlegada ?? null }));
    migas = [...migas, { nombre: origen.nombre, ruta: rutaCiudad(origen.nombre) }, { nombre: `${origen.nombre} a ${destino.nombre}`, ruta }];
  } else if (ciudad) {
    ruta = rutaCiudad(ciudad.nombre);
    t = textosCiudad(ciudad.nombre, ciudad.estado, { desde: pares.filter((p) => p.origen === ciudad.nombre), hacia: pares.filter((p) => p.destino === ciudad.nombre) });
    migas = [...migas, { nombre: ciudad.nombre, ruta }];
  } else {
    t = textosIndice();
  }
  const noExiste = Boolean(!pViejoOrigen && ((pCiudad && !ciudad) || (pOrigen && (!origen || !destino))));
  // Ciudad sin ninguna ruta: se ve, pero no se indexa (igual que en el HTML para Google). Solo con las rutas ya cargadas.
  const conGuia = (c: string) => guias.some((g) => g.origen === c || g.destino === c);
  const sinOferta = Boolean(ciudad && rutasListas && !pares.some((p) => p.origen === ciudad.nombre || p.destino === ciudad.nombre) && !conGuia(ciudad.nombre));
  // Un par sin ruta a la venta y sin guía es una página vacía: se ve, pero no se indexa
  const parVacio = Boolean(origen && destino && rutasListas && !guia && !sePar(origen.nombre, destino.nombre));
  useSeo(noExiste ? 'Ciudad no encontrada | Butaca En Línea' : t.titulo, t.descripcion, { ruta, noindex: noExiste || sinOferta || parVacio, datos: noExiste ? undefined : datosEstructurados(ruta, migas, t.preguntas, viajes) });

  // Solo se enlazan las ciudades con alguna ruta a la venta: las demás (pueblos de rutas
  // urbanas como Táriba) existen por su dirección, pero no se ofrecen como destino de bus
  const conRuta = useMemo(() => new Set([...pares, ...guias].flatMap((p) => [p.origen, p.destino])), [pares, guias]);
  const conPasajes = useMemo(() => ciudades.filter((c) => conRuta.has(c.nombre)), [ciudades, conRuta]);
  const porEstado = useMemo(() => {
    const m = new Map<string, Ciudad[]>();
    for (const c of conPasajes) m.set(c.estado ?? 'Otras', [...(m.get(c.estado ?? 'Otras') ?? []), c]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [conPasajes]);
  const centro = origen ?? ciudad;
  const vecinas = centro ? conPasajes.filter((c) => c.estado === centro.estado && c.nombre !== centro.nombre) : [];
  const desde = centro ? pares.filter((p) => p.origen === centro.nombre && p.destino !== destino?.nombre) : [];
  const hacia = ciudad ? pares.filter((p) => p.destino === ciudad.nombre) : [];
  // Guías desde y hacia la ciudad (o desde el origen de la ruta), sin repetir las que ya se venden
  const guiasDesde = centro ? guias.filter((g) => g.origen === centro.nombre && g.destino !== destino?.nombre && !sePar(g.origen, g.destino)) : [];
  const guiasHacia = ciudad ? guias.filter((g) => g.destino === ciudad.nombre && !sePar(g.origen, g.destino)) : [];
  const vueltaGuia = guia ? guias.find((g) => g.origen === guia.destino && g.destino === guia.origen) : null;

  // Dirección vieja (/pasajes/maracaibo/caracas): a la nueva, sin quedar en el historial
  if (pViejoOrigen && pViejoDestino) return <Navigate to={`/pasajes/${pViejoOrigen}-a-${pViejoDestino}`} replace />;

  if (noExiste) {
    return (
      <main className={styles.pagina}>
        <h1 className={styles.h1}>No encontramos esa ciudad</h1>
        <p className={styles.intro}>Mira todas las ciudades con pasajes en <Link to="/pasajes">Pasajes por ciudad</Link>.</p>
      </main>
    );
  }

  return (
    <main className={styles.pagina}>
      <nav className={styles.migas} aria-label="Estás en">
        {migas.map((m, i) => (
          <span key={m.ruta}>
            {i > 0 && <span aria-hidden> › </span>}
            {i === migas.length - 1 ? <span aria-current="page">{m.nombre}</span> : <Link to={m.ruta}>{m.nombre}</Link>}
          </span>
        ))}
      </nav>
      <h1 className={styles.h1}>{t.h1}</h1>
      {t.respuesta && <p className={styles.respuesta}>{t.respuesta}</p>}
      <p className={styles.intro}>{t.intro}</p>
      {t.datos && t.datos.length > 0 && (
        <dl className={styles.datos}>
          {t.datos.map((d) => (
            <div key={d.k}>
              <dt>{d.k}</dt>
              <dd>{d.v}</dd>
            </div>
          ))}
        </dl>
      )}

      {notaPrecio && <p className={styles.notaPrecio}>{notaPrecio}</p>}
      {guia && <AvisoRuta origen={guia.origen} destino={guia.destino} visibleOrigen={nombreVisible(guia.origen)} visibleDestino={nombreVisible(guia.destino)} />}

      {origen && destino && filas.length > 0 && (
        <section className={styles.seccion}>
          <h2>Horarios de {origen.nombre} a {destino.nombre}</h2>
          <div className={styles.tablaEnvoltura}>
            <table className={styles.tabla}>
              <thead>
                <tr><th>Día</th><th>Sale</th><th>Llega</th><th>Línea</th><th>Desde</th><th aria-label="Comprar" /></tr>
              </thead>
              <tbody>
                {filas.slice(0, 20).map((f) => (
                  <tr key={f.id}>
                    <td className={styles.cFecha}>{f.fecha}</td>
                    <td className={`${styles.hora} ${styles.cHora}`}>{f.hora}</td>
                    <td className={styles.cLlega}>{f.horaLlegada ? <><span className={styles.soloMovil}>llega </span>{f.horaLlegada}</> : '—'}</td>
                    <td className={styles.cLinea}>{f.linea ?? ''}</td>
                    <td className={styles.cPrecio}>{f.desdeUsd != null ? <>${f.desdeUsd}{f.desdeBs ? <span> · Bs {f.desdeBs.toLocaleString('es-VE')}</span> : null}</> : '—'}</td>
                    <td className={styles.cComprar}><Link to={`/salidas/${f.id}/asientos`}>Comprar</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {((ciudad && rutasListas && pares.some((p) => p.origen === ciudad.nombre || p.destino === ciudad.nombre)) || (origen && destino && !guia)) && (
        <section className={styles.buscar} aria-label="Buscar salidas">
          <BuscadorPasajes enPanel />
        </section>
      )}
      {sinOferta && (
        <section className={styles.seccion}>
          <h2>Ciudades con pasajes de autobús</h2>
          {conPasajes.length > 0 ? (
            <ul className={styles.enlaces}>
              {conPasajes.map((c) => <li key={c.nombre}><Link to={rutaCiudad(c.nombre)}>Pasajes en {c.nombre}</Link></li>)}
            </ul>
          ) : (
            <p className={styles.intro}>Las líneas afiliadas todavía están publicando sus rutas.</p>
          )}
        </section>
      )}

      {origen && destino && filas.some((f) => f.lineaSlug) && (
        <section className={styles.seccion}>
          <h2>Líneas que viajan esta ruta</h2>
          <ul className={styles.enlaces}>
            {[...new Map(filas.filter((f) => f.lineaSlug).map((f) => [f.lineaSlug!, f.linea])).entries()].map(([sl, nombre]) => (
              <li key={sl}><Link to={rutaLinea(sl)}>Pasajes de {nombre}</Link></li>
            ))}
          </ul>
        </section>
      )}
      {origen && destino && (!guia || vueltaGuia || sePar(destino.nombre, origen.nombre)) && (
        <section className={styles.seccion}>
          <h2>Viaje de vuelta</h2>
          <ul className={styles.enlaces}>
            <li><Link to={rutaPar(destino.nombre, origen.nombre)}>Pasajes de {destino.nombre} a {origen.nombre}</Link></li>
          </ul>
        </section>
      )}
      {desde.length > 0 && (
        <section className={styles.seccion}>
          <h2>Viajes desde {centro!.nombre}</h2>
          <ul className={styles.enlaces}>
            {desde.map((p) => (
              <li key={p.destino}>
                <Link to={rutaPar(p.origen, p.destino)}>{p.origen} a {p.destino}</Link>
                {p.precio != null && <span>desde ${p.precio}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {hacia.length > 0 && (
        <section className={styles.seccion}>
          <h2>Viajes hacia {ciudad!.nombre}</h2>
          <ul className={styles.enlaces}>
            {hacia.map((p) => (
              <li key={p.origen}>
                <Link to={rutaPar(p.origen, p.destino)}>{p.origen} a {p.destino}</Link>
                {p.precio != null && <span>desde ${p.precio}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {guiasDesde.length > 0 && (
        <section className={styles.seccion}>
          <h2>{guia ? `Más rutas desde ${nombreVisible(centro!.nombre)}` : `Guías de viaje en bus desde ${nombreVisible(centro!.nombre)}`}</h2>
          <ul className={styles.enlaces}>
            {guiasDesde.map((g) => (
              <li key={g.destino}>
                <Link to={rutaPar(g.origen, g.destino)}>Pasaje de {nombreVisible(g.origen)} a {nombreVisible(g.destino)}</Link>
                {g.precio && <span>desde ${g.precio.min}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {guiasHacia.length > 0 && (
        <section className={styles.seccion}>
          <h2>Guías de viaje en bus hacia {nombreVisible(ciudad!.nombre)}</h2>
          <ul className={styles.enlaces}>
            {guiasHacia.map((g) => (
              <li key={g.origen}>
                <Link to={rutaPar(g.origen, g.destino)}>Pasaje de {nombreVisible(g.origen)} a {nombreVisible(g.destino)}</Link>
                {g.precio && <span>desde ${g.precio.min}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {vecinas.length > 0 && (
        <section className={styles.seccion}>
          <h2>Otras ciudades de {centro!.estado}</h2>
          <ul className={styles.enlaces}>
            {vecinas.map((c) => <li key={c.nombre}><Link to={rutaCiudad(c.nombre)}>Pasajes en {c.nombre}</Link></li>)}
          </ul>
        </section>
      )}

      {!centro && (
        <section className={styles.seccion}>
          <h2>Precios y temporadas</h2>
          <ul className={styles.enlaces}>
            <li><Link to={RUTA_PRECIOS}>Precios de pasajes de autobús hoy, en dólares y bolívares</Link></li>
            {TERMINALES.map((x) => <li key={x.slug}><Link to={rutaTerminal(x.slug)}>{x.nombre}: precios de pasajes</Link></li>)}
            {TEMPORADAS.filter((t) => new Date(`${t.hasta}T23:59:59-04:00`).getTime() >= Date.now()).map((t) => (
              <li key={t.slug}><Link to={rutaTemporada(t.slug)}>Pasajes para {t.nombre} {t.anio}</Link></li>
            ))}
          </ul>
        </section>
      )}
      {!centro && (
        <section className={styles.seccion}>
          <h2>Ciudades por estado</h2>
          <div className={styles.estados}>
            {porEstado.map(([estado, cs]) => (
              <div key={estado} className={styles.estado}>
                <h3>{estado}</h3>
                <ul>
                  {cs.map((c) => <li key={c.nombre}><Link to={rutaCiudad(c.nombre)}>{c.nombre}</Link></li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {t.preguntas && (
        <section className={styles.seccion}>
          <h2>Preguntas frecuentes</h2>
          <div className={styles.preguntas}>
            {t.preguntas.map((q) => (
              <details key={q.p} className={styles.pregunta}>
                <summary>{q.p}</summary>
                <p>{q.r}</p>
              </details>
            ))}
          </div>
        </section>
      )}
      {centro && <p className={styles.todas}><Link to="/pasajes">Ver todas las ciudades de Venezuela con pasajes →</Link></p>}
    </main>
  );
}
