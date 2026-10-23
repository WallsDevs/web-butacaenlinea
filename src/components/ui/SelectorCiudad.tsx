import { useEffect, useRef, useState } from 'react';
import type { Ciudad } from '../../lib/api/endpoints';
import ui from './ui.module.css';

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Selector de ciudad del catálogo común: un campo que abre la lista, filtra
 * mientras se escribe (sin importar tildes) y solo acepta ciudades de la
 * lista. Al salir del campo, si lo escrito coincide con una ciudad, queda
 * con su nombre oficial.
 */
export function SelectorCiudad({
  label,
  valor,
  onCambio,
  ciudades,
  excluir,
}: {
  label: string;
  valor: string;
  onCambio: (nombre: string) => void;
  ciudades: Ciudad[];
  /** La otra punta de la ruta: no se ofrece. */
  excluir?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState(valor);
  const [activo, setActivo] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => setTexto(valor), [valor]);

  const q = normalizar(texto);
  const oficial = ciudades.find((c) => normalizar(c.nombre) === q);
  const opciones = ciudades
    .filter((c) => c.nombre !== excluir)
    .filter((c) => !q || oficial || normalizar(c.nombre).includes(q) || normalizar(c.estado ?? '').includes(q))
    // Primero las que empiezan igual, luego las que lo contienen, al final las del estado buscado
    .map((c) => {
      const n = normalizar(c.nombre);
      return { c, peso: !q || oficial ? 0 : n.startsWith(q) ? 0 : n.includes(q) ? 1 : 2 };
    })
    .sort((a, b) => a.peso - b.peso)
    .map((x) => x.c)
    .slice(0, 50);

  const elegir = (c: Ciudad) => {
    onCambio(c.nombre);
    setTexto(c.nombre);
    setAbierto(false);
  };

  // Cerrar al tocar fuera; lo escrito queda con el nombre oficial si coincide
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) {
        setAbierto(false);
        if (oficial) onCambio(oficial.nombre);
        else onCambio(texto);
      }
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  });

  return (
    <div ref={caja} className={ui.field} style={{ position: 'relative' }}>
      <span className={ui.fieldLabel}>{label}</span>
      <div style={{ position: 'relative' }}>
        <input
          className={ui.fieldInput}
          role="combobox"
          aria-expanded={abierto}
          aria-autocomplete="list"
          placeholder="Escoge la ciudad"
          value={texto}
          onFocus={() => setAbierto(true)}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
            setActivo(0);
            onCambio(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setAbierto(true);
              setActivo((i) => Math.min(i + 1, opciones.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActivo((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && abierto && opciones[activo]) {
              e.preventDefault();
              elegir(opciones[activo]);
            } else if (e.key === 'Escape') {
              setAbierto(false);
            }
          }}
          style={{ paddingRight: 34, width: '100%' }}
        />
        <span aria-hidden style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none', fontSize: 12 }}>▾</span>
      </div>
      {abierto && (
        <div
          role="listbox"
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, maxHeight: 240, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-panel)' }}
        >
          {opciones.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={c.nombre === valor}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(c)}
              onMouseEnter={() => setActivo(i)}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 10, width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: 14, background: i === activo ? 'var(--tint-50)' : 'transparent', cursor: 'pointer' }}
            >
              <span style={{ fontWeight: c.nombre === valor ? 700 : 500 }}>{c.nombre}</span>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{c.estado ?? ''}</span>
            </button>
          ))}
          {!opciones.length && (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-soft)' }}>
              {ciudades.length ? 'Ninguna ciudad coincide. Si falta, pídele a Butaca En Línea que la agregue.' : 'No hay ciudades cargadas.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
