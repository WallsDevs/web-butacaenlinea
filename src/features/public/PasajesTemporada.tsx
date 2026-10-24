import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getRutas, getSalidas, getTasas } from '../../lib/api/endpoints';
import { useSeo } from '../../lib/seo';
import { type SalidaPublica, TEMPORADAS, datosEstructurados, filasSalidas, rutaPar, rutaTemporada, textosTemporada } from '../../seo/contenido.mjs';
import styles from './pasajes.module.css';

/**
 * /temporada/:slug — pasajes para una temporada (diciembre, Semana Santa…):
 * las salidas publicadas en esas fechas y las rutas con su precio desde. Se
 * publica semanas antes; al publicar se arma también en HTML.
 */
export default function PasajesTemporada() {
  const { slug } = useParams();
  const temp = TEMPORADAS.find((t) => t.slug === slug);
  const { data: rutas } = useQuery({ queryKey: ['rutas-publicas'], queryFn: () => getRutas() });
  const { data: tasas } = useQuery({ queryKey: ['tasas'], queryFn: getTasas, staleTime: 600_000 });
  const { data: salidas, isError: sinConexion, refetch } = useQuery({
    queryKey: ['salidas-temporada', slug],
    queryFn: () => getSalidas({ desde: new Date(`${temp!.desde}T00:00:00-04:00`).toISOString(), hasta: new Date(`${temp!.hasta}T23:59:59-04:00`).toISOString(), limite: 100 }),
    enabled: Boolean(temp),
  });

  const pares = useMemo(() => {
    const m = new Map<string, { origen: string; destino: string; precio: number | null }>();
    for (const r of rutas ?? []) {
      if (!r.origen || !r.destino) continue;
      const precios = (r.tarifas ?? []).map((t) => Number(t.precioUsd)).filter((n) => n > 0);
      const min = precios.length ? Math.min(...precios) : null;
      const k = `${r.origen}→${r.destino}`;
      const a = m.get(k);
      if (!a || (min != null && (a.precio == null || min < a.precio))) m.set(k, { origen: r.origen, destino: r.destino, precio: min });
    }
    return [...m.values()].sort((a, b) => (a.precio ?? 999) - (b.precio ?? 999));
  }, [rutas]);
  const filas = useMemo(
    () => filasSalidas((salidas ?? []) as unknown as SalidaPublica[], Number(tasas?.bcv) || null).map((f, i) => ({ ...f, ruta: salidas?.[i]?.ruta ?? null })),
    [salidas, tasas]
  );

  const ruta = rutaTemporada(slug ?? '');
  const t = temp ? textosTemporada(temp, { salidas: filas.length, rutas: pares }) : null;
  useSeo(t ? t.titulo : 'Temporada no encontrada | Butaca En Línea', t?.descripcion, {
    ruta,
    noindex: !temp,
    datos: t && temp
      ? datosEstructurados(ruta, [{ nombre: 'Inicio', ruta: '/' }, { nombre: 'Pasajes', ruta: '/pasajes' }, { nombre: `${temp.titulo} ${temp.anio}`, ruta }], t.preguntas, filas.filter((f) => f.ruta?.origen && f.ruta?.destino).map((f) => ({ ...f, origen: f.ruta!.origen!, destino: f.ruta!.destino! })))
      : undefined,
  });

  if (!temp || !t) {
    return (
      <main className={styles.pagina}>
        <h1 className={styles.h1}>No encontramos esa temporada</h1>
        <p className={styles.intro}>Mira las rutas y ciudades con pasajes en <Link to="/pasajes">Pasajes por ciudad</Link>.</p>
      </main>
    );
  }

  return (
    <main className={styles.pagina}>
      <nav className={styles.migas} aria-label="Estás en">
        <Link to="/">Inicio</Link>
        <span aria-hidden> › </span>
        <Link to="/pasajes">Pasajes</Link>
        <span aria-hidden> › </span>
        <span aria-current="page">{temp.titulo} {temp.anio}</span>
      </nav>
      <h1 className={styles.h1}>{t.h1}</h1>
      <p className={styles.respuesta}>{t.respuesta}</p>
      <p className={styles.intro}>{t.intro}</p>
      {sinConexion && !salidas && (
        <p className={styles.intro}>
          No pudimos cargar las salidas. <button type="button" className={styles.reintentar} onClick={() => void refetch()}>Intentar de nuevo</button>
        </p>
      )}

      {filas.length > 0 && (
        <section className={styles.seccion}>
          <h2>Salidas publicadas</h2>
          <div className={styles.tablaEnvoltura}>
            <table className={`${styles.tabla} ${styles.tablaRutaPrimero}`}>
              <thead>
                <tr><th>Ruta</th><th>Día</th><th>Sale</th><th>Línea</th><th>Desde</th><th aria-label="Comprar" /></tr>
              </thead>
              <tbody>
                {filas.slice(0, 60).map((f) => (
                  <tr key={f.id}>
                    <td className={styles.cLinea}>{f.ruta?.origen && f.ruta?.destino ? <Link to={rutaPar(f.ruta.origen, f.ruta.destino)}>{f.ruta.origen} a {f.ruta.destino}</Link> : ''}</td>
                    <td className={styles.cFecha}>{f.fecha}</td>
                    <td className={`${styles.hora} ${styles.cHora}`}>{f.hora}</td>
                    <td className={styles.cLlega}>{f.linea ?? ''}</td>
                    <td className={styles.cPrecio}>{f.desdeUsd != null ? `$${f.desdeUsd}` : '—'}</td>
                    <td className={styles.cComprar}><Link to={`/salidas/${f.id}/asientos`}>Comprar</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pares.length > 0 && (
        <section className={styles.seccion}>
          <h2>Rutas y precio desde</h2>
          <ul className={styles.enlaces}>
            {pares.map((p) => (
              <li key={`${p.origen}-${p.destino}`}>
                <Link to={rutaPar(p.origen, p.destino)}>{p.origen} a {p.destino}</Link>
                {p.precio != null && <span>desde ${p.precio}</span>}
              </li>
            ))}
          </ul>
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
      <p className={styles.todas}><Link to="/pasajes/precios">Ver los precios de hoy de todas las rutas →</Link></p>
    </main>
  );
}
