import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getCiudades, getRutas, getSalidas } from '../../lib/api/endpoints';
import { useSeo } from '../../lib/seo';
import { BuscadorPasajes } from './BuscadorPasajes';
import { useBooking } from './useBooking';
import { datosEstructurados, rutaCiudad, rutaPar, slug, textosCiudad, textosIndice, textosPar } from '../../seo/contenido.mjs';
import CIUDADES_RESPALDO from '../../seo/ciudades.json';
import styles from './pasajes.module.css';

type Ciudad = { nombre: string; estado: string | null };

/**
 * Páginas para buscadores (y para la gente): /pasajes (todas las ciudades por
 * estado), /pasajes/:ciudad y /pasajes/:origen/:destino. Cada una tiene su
 * título, su texto, sus preguntas frecuentes y el buscador ya puesto en esa
 * ciudad o ruta, para comprar ahí mismo. Al publicar salen además ya armadas
 * en el HTML (scripts/prerender-seo.mjs) con los mismos textos.
 */
export default function Pasajes() {
  const { ciudad: pCiudad, origen: pOrigen, destino: pDestino } = useParams();
  const { setCriterios } = useBooking();
  const { data: ciudadesApi } = useQuery({ queryKey: ['ciudades'], queryFn: getCiudades, staleTime: 600_000 });
  const { data: rutas } = useQuery({ queryKey: ['rutas-publicas'], queryFn: () => getRutas() });
  const { data: proximas } = useQuery({ queryKey: ['salidas-proximas', 'todas'], queryFn: () => getSalidas({ desde: new Date().toISOString(), limite: 100 }) });

  const ciudades: Ciudad[] = (ciudadesApi?.length ? ciudadesApi : (CIUDADES_RESPALDO as Ciudad[])).map((c) => ({ nombre: c.nombre, estado: c.estado }));
  const porSlug = useMemo(() => new Map(ciudades.map((c) => [slug(c.nombre), c])), [ciudades]);
  const ciudad = pCiudad ? porSlug.get(pCiudad) : undefined;
  const origen = pOrigen ? porSlug.get(pOrigen) : undefined;
  const destino = pDestino ? porSlug.get(pDestino) : undefined;

  // Una ruta de la línea por par (la ida y su vuelta enlazada son pares distintos)
  const pares = useMemo(() => {
    const m = new Map<string, { origen: string; destino: string; precio: number | null; duracionMin: number | null; distanciaKm: number | null }>();
    for (const r of rutas ?? []) {
      if (!r.origen || !r.destino) continue;
      const k = `${r.origen}→${r.destino}`;
      const precio = (r.tarifas ?? []).map((t) => Number(t.precioUsd)).filter((n) => n > 0);
      const min = precio.length ? Math.min(...precio) : null;
      const actual = m.get(k);
      if (!actual) m.set(k, { origen: r.origen, destino: r.destino, precio: min, duracionMin: r.duracionMin || null, distanciaKm: r.distanciaKm || null });
      else if (min != null && (actual.precio == null || min < actual.precio)) actual.precio = min;
    }
    return [...m.values()];
  }, [rutas]);
  const lineasDe = (o: string, d: string) => [...new Set((proximas ?? []).filter((s) => s.ruta?.origen === o && s.ruta?.destino === d).map((s) => s.linea?.nombre).filter(Boolean) as string[])];

  // El buscador de la página, ya puesto en la ciudad o la ruta
  useEffect(() => {
    if (origen && destino) setCriterios({ origen: origen.nombre, destino: destino.nombre });
    else if (ciudad) {
      const sale = pares.find((p) => p.origen === ciudad.nombre);
      setCriterios(sale ? { origen: ciudad.nombre, destino: sale.destino } : { destino: ciudad.nombre });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciudad?.nombre, origen?.nombre, destino?.nombre, pares.length]);

  // ── Textos de la página ──
  let ruta = '/pasajes';
  let t: { titulo: string; descripcion: string; h1: string; intro: string; preguntas?: { p: string; r: string }[]; datos?: { k: string; v: string }[] };
  let migas: { nombre: string; ruta: string }[] = [{ nombre: 'Inicio', ruta: '/' }, { nombre: 'Pasajes', ruta: '/pasajes' }];
  if (origen && destino) {
    const par = pares.find((p) => p.origen === origen.nombre && p.destino === destino.nombre);
    ruta = rutaPar(origen.nombre, destino.nombre);
    t = textosPar(origen.nombre, destino.nombre, { precioDesde: par?.precio, duracionMin: par?.duracionMin, distanciaKm: par?.distanciaKm, lineas: lineasDe(origen.nombre, destino.nombre) });
    migas = [...migas, { nombre: origen.nombre, ruta: rutaCiudad(origen.nombre) }, { nombre: `${origen.nombre} a ${destino.nombre}`, ruta }];
  } else if (ciudad) {
    ruta = rutaCiudad(ciudad.nombre);
    t = textosCiudad(ciudad.nombre, ciudad.estado, { desde: pares.filter((p) => p.origen === ciudad.nombre), hacia: pares.filter((p) => p.destino === ciudad.nombre) });
    migas = [...migas, { nombre: ciudad.nombre, ruta }];
  } else {
    t = textosIndice();
  }
  const noExiste = Boolean((pCiudad && !ciudad) || (pOrigen && (!origen || !destino)));
  useSeo(noExiste ? 'Ciudad no encontrada | Butaca En Línea' : t.titulo, t.descripcion, { ruta, noindex: noExiste, datos: noExiste ? undefined : datosEstructurados(ruta, migas, t.preguntas) });

  const porEstado = useMemo(() => {
    const m = new Map<string, Ciudad[]>();
    for (const c of ciudades) m.set(c.estado ?? 'Otras', [...(m.get(c.estado ?? 'Otras') ?? []), c]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [ciudades]);
  const centro = origen ?? ciudad;
  const vecinas = centro ? ciudades.filter((c) => c.estado === centro.estado && c.nombre !== centro.nombre) : [];
  const desde = centro ? pares.filter((p) => p.origen === centro.nombre && p.destino !== destino?.nombre) : [];
  const hacia = ciudad ? pares.filter((p) => p.destino === ciudad.nombre) : [];

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

      {(ciudad || (origen && destino)) && (
        <section className={styles.buscar} aria-label="Buscar salidas">
          <BuscadorPasajes enPanel />
        </section>
      )}

      {origen && destino && (
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
