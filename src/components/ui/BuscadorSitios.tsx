import { useEffect, useState } from 'react';
import { buscarLugares, type Ciudad, type LugarMapa } from '../../lib/api/endpoints';
import styles from './BuscadorSitios.module.css';

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
type Zona = [number, number, number, number];

/**
 * Buscador de sitios sobre un mapa (OpenStreetMap, vía el servidor).
 *
 * - Ruta de viaje: busca en todo el país y cada resultado dice a qué ciudad
 *   del catálogo pertenece; las ciudades del catálogo salen al instante.
 * - Ruta urbana: `zona` limita la búsqueda a lo que está en pantalla (la
 *   ciudad) y cada resultado dice su sector; no se ofrecen ciudades.
 */
export function BuscadorSitios({
  onElegir,
  placeholder,
  etiqueta,
  ciudades,
  zona,
  modo = 'pais',
}: {
  onElegir: (l: LugarMapa) => void;
  placeholder: string;
  etiqueta: string;
  /** Ciudades del catálogo para mostrar al instante (solo en modo país). */
  ciudades?: Ciudad[];
  /** Lo que está en pantalla, leído al buscar (modo ciudad). */
  zona?: () => Zona | null;
  modo?: 'pais' | 'ciudad';
}) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<LugarMapa[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [activo, setActivo] = useState(0);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 3) {
      setResultados(null);
      return;
    }
    const locales: LugarMapa[] =
      modo === 'pais'
        ? (ciudades ?? [])
            .filter((c) => c.lat != null && c.lng != null && normalizar(c.nombre).startsWith(normalizar(q)))
            .slice(0, 3)
            .map((c) => ({ nombre: c.nombre, detalle: c.estado ? `Ciudad · ${c.estado}` : 'Ciudad', lat: c.lat!, lng: c.lng!, ciudad: c.nombre }))
        : [];
    setResultados(locales);
    setActivo(0);
    setBuscando(true);
    setFallo(false);
    // Se espera a que se deje de escribir: el servidor consulta una vez por segundo
    const t = setTimeout(() => {
      buscarLugares(q, modo === 'ciudad' ? zona?.() : null)
        .then((r) => setResultados(r.lugares))
        .catch(() => {
          setFallo(true);
          setResultados((prev) => prev ?? []);
        })
        .finally(() => setBuscando(false));
    }, 450);
    return () => clearTimeout(t);
    // `zona` se lee al buscar; no debe relanzar la búsqueda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, ciudades, modo]);

  const elegir = (l: LugarMapa) => {
    setTexto('');
    setResultados(null);
    onElegir(l);
  };

  return (
    <div className={styles.buscador}>
      <span className={styles.lupa} aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <input
        role="combobox"
        aria-expanded={Boolean(resultados)}
        aria-label={etiqueta}
        placeholder={placeholder}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => setTimeout(() => setResultados(null), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setResultados(null);
            return;
          }
          if (!resultados?.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActivo((i) => Math.min(i + 1, resultados.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActivo((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            elegir(resultados[activo]);
          }
        }}
      />
      {texto && (
        <button type="button" className={styles.limpiar} aria-label="Borrar la búsqueda" onClick={() => setTexto('')}>
          ✕
        </button>
      )}
      {resultados && (
        <div role="listbox" className={styles.resultados}>
          {resultados.map((l, i) => (
            <button
              key={`${l.lat},${l.lng},${i}`}
              type="button"
              role="option"
              aria-selected={i === activo}
              className={`${styles.resultado} ${i === activo ? styles.resultadoActivo : ''}`}
              onMouseEnter={() => setActivo(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(l)}
            >
              <span className={styles.nombre}>{l.nombre ?? 'Sitio sin nombre'}</span>
              <span className={styles.detalle}>{l.detalle || '—'}</span>
              {modo === 'pais' && <span className={l.ciudad ? styles.ciudad : styles.fuera}>{l.ciudad ?? 'Fuera de la lista'}</span>}
            </button>
          ))}
          {!resultados.length && !buscando && (
            <div className={styles.vacio}>
              {fallo
                ? 'No se pudo buscar. Revisa la conexión e intenta de nuevo.'
                : modo === 'ciudad'
                  ? 'Nada con ese nombre en esta parte del mapa. Acércate a la zona o toca el mapa.'
                  : 'Nada con ese nombre. Prueba con la ciudad o toca el mapa.'}
            </div>
          )}
          {buscando && <div className={styles.vacio}>Buscando{modo === 'ciudad' ? ' en esta zona' : ''}…</div>}
        </div>
      )}
    </div>
  );
}
