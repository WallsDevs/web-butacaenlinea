import { useMemo } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getRutas, getTasas } from '../../lib/api/endpoints';
import { useSeo } from '../../lib/seo';
import { RUTA_PRECIOS, datosEstructurados, rutaPar, textosPrecios } from '../../seo/contenido.mjs';
import styles from './pasajes.module.css';

const duracion = (min: number | null) => (min ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : '—');

/**
 * /pasajes/precios — cuánto cuesta cada ruta hoy, en dólares y en bolívares a
 * la tasa BCV. Compite con las notas de precios de los medios, pero siempre al
 * día. Al publicar se arma también en HTML (scripts/prerender-seo.mjs).
 */
export default function PreciosHoy() {
  const { data: rutas, isError: sinConexion, refetch } = useQuery({ queryKey: ['rutas-publicas'], queryFn: () => getRutas() });
  const { data: tasas } = useQuery({ queryKey: ['tasas'], queryFn: getTasas, staleTime: 600_000 });
  const bcv = Number(tasas?.bcv) || null;

  const pares = useMemo(() => {
    const m = new Map<string, { origen: string; destino: string; precio: number | null; duracionMin: number | null }>();
    for (const r of rutas ?? []) {
      if (!r.origen || !r.destino) continue;
      const precios = (r.tarifas ?? []).map((t) => Number(t.precioUsd)).filter((n) => n > 0);
      const min = precios.length ? Math.min(...precios) : null;
      const k = `${r.origen}→${r.destino}`;
      const a = m.get(k);
      if (!a || (min != null && (a.precio == null || min < a.precio))) m.set(k, { origen: r.origen, destino: r.destino, precio: min, duracionMin: r.duracionMin || null });
    }
    return [...m.values()].sort((a, b) => `${a.origen}${a.destino}`.localeCompare(`${b.origen}${b.destino}`));
  }, [rutas]);

  const fecha = new Date().toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Caracas' });
  const t = textosPrecios(fecha, pares.length);
  const migas = [{ nombre: 'Inicio', ruta: '/' }, { nombre: 'Pasajes', ruta: '/pasajes' }, { nombre: 'Precios de hoy', ruta: RUTA_PRECIOS }];
  useSeo(t.titulo, t.descripcion, { ruta: RUTA_PRECIOS, datos: datosEstructurados(RUTA_PRECIOS, migas, t.preguntas) });

  return (
    <main className={styles.pagina}>
      <nav className={styles.migas} aria-label="Estás en">
        <Link to="/">Inicio</Link>
        <span aria-hidden> › </span>
        <Link to="/pasajes">Pasajes</Link>
        <span aria-hidden> › </span>
        <span aria-current="page">Precios de hoy</span>
      </nav>
      <h1 className={styles.h1}>{t.h1}</h1>
      <p className={styles.intro}>{t.intro}</p>

      {sinConexion && !rutas && (
        <p className={styles.intro}>
          No pudimos cargar los precios. <button type="button" className={styles.reintentar} onClick={() => void refetch()}>Intentar de nuevo</button>
        </p>
      )}
      <section className={styles.seccion}>
        <h2>Precio desde, por ruta</h2>
        <div className={styles.tablaEnvoltura}>
          <table className={`${styles.tabla} ${styles.tablaRutaPrimero}`}>
            <thead>
              <tr><th>Ruta</th><th>Desde ($)</th><th>Desde (Bs)</th><th>Duración</th></tr>
            </thead>
            <tbody>
              {pares.map((p) => (
                <tr key={`${p.origen}-${p.destino}`}>
                  <td className={styles.cLinea}><Link to={rutaPar(p.origen, p.destino)}>{p.origen} a {p.destino}</Link></td>
                  <td className={styles.cPrecio}>{p.precio != null ? `$${p.precio}` : '—'}</td>
                  <td className={styles.cFecha}>{p.precio != null && bcv ? `Bs ${Math.round(p.precio * bcv).toLocaleString('es-VE')}` : '—'}</td>
                  <td className={styles.cLlega}>{duracion(p.duracionMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
      <p className={styles.todas}><Link to="/pasajes">Ver todas las ciudades con pasajes →</Link></p>
    </main>
  );
}
