import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getLineas, getRutas, getSalidas, getTasas } from '../../lib/api/endpoints';
import { useSeo } from '../../lib/seo';
import { type SalidaPublica, datosEstructurados, filasSalidas, rutaLinea, rutaPar, textosLinea } from '../../seo/contenido.mjs';
import styles from './pasajes.module.css';

/**
 * /lineas/:slug — la página de una línea para buscadores y para la gente: sus
 * rutas con precio desde, sus próximas salidas y cómo comprar. Al publicar se
 * arma también en HTML con los mismos textos (scripts/prerender-seo.mjs).
 */
export default function PasajesLinea() {
  const { slug } = useParams();
  const { data: lineas, isSuccess: lineasListas, isError: sinConexion, refetch } = useQuery({ queryKey: ['lineas-publicas'], queryFn: getLineas, staleTime: 600_000 });
  const linea = lineas?.find((l) => l.slug === slug);
  const { data: rutas } = useQuery({ queryKey: ['rutas-linea', slug], queryFn: () => getRutas(slug), enabled: Boolean(linea) });
  const { data: tasas } = useQuery({ queryKey: ['tasas'], queryFn: getTasas, staleTime: 600_000 });
  const { data: salidas } = useQuery({
    queryKey: ['salidas-linea', slug],
    queryFn: () => getSalidas({ lineaSlug: slug, desde: new Date().toISOString(), hasta: new Date(Date.now() + 14 * 24 * 3600_000).toISOString(), limite: 30 }),
    enabled: Boolean(linea),
  });

  const rutasLista = useMemo(() => {
    const m = new Map<string, { origen: string; destino: string; precio: number | null }>();
    for (const r of rutas ?? []) {
      if (!r.origen || !r.destino) continue;
      const precios = (r.tarifas ?? []).map((t) => Number(t.precioUsd)).filter((n) => n > 0);
      const min = precios.length ? Math.min(...precios) : null;
      const k = `${r.origen}→${r.destino}`;
      const a = m.get(k);
      if (!a || (min != null && (a.precio == null || min < a.precio))) m.set(k, { origen: r.origen, destino: r.destino, precio: min });
    }
    return [...m.values()];
  }, [rutas]);
  const filas = useMemo(
    () => filasSalidas((salidas ?? []) as unknown as SalidaPublica[], Number(tasas?.bcv) || null).map((f, i) => ({ ...f, ruta: salidas?.[i]?.ruta ?? null })),
    [salidas, tasas]
  );

  const semana = filas.filter((f) => new Date(f.salida).getTime() <= Date.now() + 7 * 24 * 3600_000).length;
  const t = textosLinea(linea?.nombre ?? '', { rutas: rutasLista, salidasSemana: semana, terminalBase: (linea as { terminalBase?: string | null } | undefined)?.terminalBase ?? null });
  const ruta = rutaLinea(slug ?? '');
  const migas = [{ nombre: 'Inicio', ruta: '/' }, { nombre: 'Líneas', ruta: '/pasajes' }, { nombre: linea?.nombre ?? '', ruta }];
  const noExiste = lineasListas && !linea;
  useSeo(noExiste ? 'Línea no encontrada | Butaca En Línea' : t.titulo, t.descripcion, {
    ruta,
    noindex: noExiste,
    datos: noExiste || !linea ? undefined : datosEstructurados(ruta, migas, t.preguntas, filas.filter((f) => f.ruta?.origen && f.ruta?.destino).map((f) => ({ ...f, origen: f.ruta!.origen!, destino: f.ruta!.destino! }))),
  });

  if (noExiste) {
    return (
      <main className={styles.pagina}>
        <h1 className={styles.h1}>No encontramos esa línea</h1>
        <p className={styles.intro}>Mira las rutas y ciudades con pasajes en <Link to="/pasajes">Pasajes por ciudad</Link>.</p>
      </main>
    );
  }
  if (!linea && sinConexion) {
    return (
      <main className={styles.pagina}>
        <h1 className={styles.h1}>No pudimos cargar la línea</h1>
        <p className={styles.intro}>
          Revisa tu conexión. <button type="button" className={styles.reintentar} onClick={() => void refetch()}>Intentar de nuevo</button>
        </p>
      </main>
    );
  }
  if (!linea) return <main className={styles.pagina} aria-busy="true" />;

  return (
    <main className={styles.pagina}>
      <nav className={styles.migas} aria-label="Estás en">
        <Link to="/">Inicio</Link>
        <span aria-hidden> › </span>
        <Link to="/pasajes">Líneas</Link>
        <span aria-hidden> › </span>
        <span aria-current="page">{linea.nombre}</span>
      </nav>
      <h1 className={styles.h1}>{t.h1}</h1>
      {t.respuesta && <p className={styles.respuesta}>{t.respuesta}</p>}
      <p className={styles.intro}>{t.intro}</p>

      {rutasLista.length > 0 && (
        <section className={styles.seccion}>
          <h2>Rutas de {linea.nombre}</h2>
          <ul className={styles.enlaces}>
            {rutasLista.map((r) => (
              <li key={`${r.origen}-${r.destino}`}>
                <Link to={rutaPar(r.origen, r.destino)}>{r.origen} a {r.destino}</Link>
                {r.precio != null && <span>desde ${r.precio}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {filas.length > 0 && (
        <section className={styles.seccion}>
          <h2>Próximas salidas de {linea.nombre}</h2>
          <div className={styles.tablaEnvoltura}>
            <table className={`${styles.tabla} ${styles.tablaRutaPrimero}`}>
              <thead>
                <tr><th>Ruta</th><th>Día</th><th>Sale</th><th>Desde</th><th aria-label="Comprar" /></tr>
              </thead>
              <tbody>
                {filas.slice(0, 20).map((f) => (
                  <tr key={f.id}>
                    <td className={styles.cLinea}>{f.ruta?.origen && f.ruta?.destino ? <Link to={rutaPar(f.ruta.origen, f.ruta.destino)}>{f.ruta.origen} a {f.ruta.destino}</Link> : ''}</td>
                    <td className={styles.cFecha}>{f.fecha}</td>
                    <td className={`${styles.hora} ${styles.cHora}`}>{f.hora}</td>
                    <td className={styles.cPrecio}>{f.desdeUsd != null ? `$${f.desdeUsd}` : '—'}</td>
                    <td className={styles.cComprar}><Link to={`/salidas/${f.id}/asientos`}>Comprar</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
      <p className={styles.todas}><Link to="/pasajes/precios">Ver los precios de todas las rutas hoy →</Link></p>
    </main>
  );
}
