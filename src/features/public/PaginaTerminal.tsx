import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getCiudades } from '../../lib/api/endpoints';
import { useSeo } from '../../lib/seo';
import { datosEstructurados, rutaPar, textosTerminal } from '../../seo/contenido.mjs';
import { TERMINALES, nombreVisible, rutaTerminal, todasLasGuias } from '../../seo/guias.mjs';
import CIUDADES_RESPALDO from '../../seo/ciudades.json';
import styles from './pasajes.module.css';

const horas = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;

/**
 * /terminales/:slug — «Terminal La Bandera: precios de pasajes 2026». Es de lo
 * más buscado después de las rutas: cada destino con su precio de referencia
 * (con fuente), la duración y las líneas. Al publicar sale también en HTML.
 */
export default function PaginaTerminal() {
  const { slug } = useParams();
  const terminal = TERMINALES.find((t) => t.slug === slug);
  const { data: ciudadesApi } = useQuery({ queryKey: ['ciudades'], queryFn: getCiudades, staleTime: 600_000 });
  const ciudades = (ciudadesApi?.length ? ciudadesApi : (CIUDADES_RESPALDO as { nombre: string; estado: string | null }[])).map((c) => ({ nombre: c.nombre, estado: c.estado }));
  const destinos = useMemo(
    () => (terminal ? todasLasGuias(ciudades).filter((g) => g.origen === terminal.ciudad && g.terminalSalida === terminal.nombre).sort((a, b) => (a.precio?.min ?? 999) - (b.precio?.min ?? 999)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [terminal?.slug, ciudades.length]
  );
  const t = terminal ? textosTerminal(terminal, destinos) : null;
  const ruta = terminal ? rutaTerminal(terminal.slug) : '/terminales';
  const migas = [{ nombre: 'Inicio', ruta: '/' }, { nombre: 'Pasajes', ruta: '/pasajes' }, { nombre: terminal?.nombre ?? 'Terminal', ruta }];
  useSeo(t ? t.titulo : 'Terminal no encontrado | Butaca En Línea', t?.descripcion, { ruta, noindex: !t, datos: t ? datosEstructurados(ruta, migas, t.preguntas) : undefined });

  if (!terminal || !t) {
    return (
      <main className={styles.pagina}>
        <h1 className={styles.h1}>No encontramos ese terminal</h1>
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
        <span aria-current="page">{terminal.nombre}</span>
      </nav>
      <h1 className={styles.h1}>{t.h1}</h1>
      <p className={styles.respuesta}>{t.respuesta}</p>
      <p className={styles.intro}>{t.intro}</p>

      <section className={styles.seccion}>
        <h2>Destinos y precios de referencia</h2>
        <div className={styles.tablaEnvoltura}>
          <table className={`${styles.tabla} ${styles.tablaRutaPrimero}`}>
            <thead>
              <tr><th>Destino</th><th>Precio de referencia</th><th>Duración</th></tr>
            </thead>
            <tbody>
              {destinos.map((g) => (
                <tr key={g.destino}>
                  <td className={styles.cLinea}><Link to={rutaPar(g.origen, g.destino)}>{nombreVisible(g.destino)}</Link></td>
                  <td className={styles.cPrecio}>{g.precio ? (g.precio.min === g.precio.max ? `$${g.precio.min}` : `$${g.precio.min}–${g.precio.max}`) : '—'}</td>
                  <td className={styles.cFecha}>{horas(g.minutos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.notaPrecio} style={{ marginTop: 10 }}>
          Precios de referencia de tarifas publicadas, sondeos de prensa y agregadores, con la fecha de cada fuente en la página de cada ruta. Se pagan en bolívares a la tasa BCV del día: confírmalos en la taquilla.
        </p>
      </section>

      <section className={styles.seccion}>
        <h2>Otros terminales</h2>
        <ul className={styles.enlaces}>
          {TERMINALES.filter((x) => x.slug !== terminal.slug).map((x) => <li key={x.slug}><Link to={rutaTerminal(x.slug)}>{x.nombre}: precios de pasajes</Link></li>)}
        </ul>
      </section>

      <section className={styles.seccion}>
        <h2>Preguntas frecuentes</h2>
        <div className={styles.preguntas}>
          {t.preguntas!.map((q) => (
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
