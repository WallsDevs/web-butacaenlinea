import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { avisarRuta } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import styles from './pasajes.module.css';

/**
 * «Avísame cuando se venda»: en la guía de una ruta que ninguna línea vende
 * todavía en Butaca. El WhatsApp queda guardado por ruta (la plataforma ve
 * cuánta gente pide cada una) y se le escribe cuando la ruta abre.
 */
export function AvisoRuta({ origen, destino, visibleOrigen, visibleDestino }: { origen: string; destino: string; visibleOrigen: string; visibleDestino: string }) {
  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const enviar = useMutation({
    mutationFn: () => avisarRuta({ origen, destino, telefono: telefono.trim(), nombre: nombre.trim() || undefined }),
    onError: (e) =>
      setError(
        e instanceof ApiError && e.code === 'telefono_invalido'
          ? 'Revisa el número: escríbelo como 0412-1234567.'
          : e instanceof ApiError && e.code === 'demasiados_avisos'
            ? 'Ya registramos tus avisos. Intenta de nuevo en unos minutos.'
            : 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.'
      ),
  });

  if (enviar.isSuccess) {
    return (
      <section className={styles.aviso} aria-live="polite">
        <h2>Listo, te avisamos</h2>
        <p>Apenas una línea publique la ruta de {visibleOrigen} a {visibleDestino} en Butaca En Línea, te escribimos por WhatsApp para que compres tu boleto desde el teléfono.</p>
      </section>
    );
  }

  return (
    <section className={styles.aviso}>
      <h2>¿Viajas de {visibleOrigen} a {visibleDestino}?</h2>
      <p>Todavía no vendemos esta ruta en línea. Déjanos tu WhatsApp y te avisamos apenas una línea la publique: compras desde el teléfono, escoges tu puesto y recibes tu boleto al instante.</p>
      <form
        className={styles.avisoForm}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          enviar.mutate();
        }}
      >
        <label>
          <span>WhatsApp</span>
          <input type="tel" inputMode="tel" autoComplete="tel" placeholder="0412-1234567" value={telefono} onChange={(e) => setTelefono(e.target.value)} required />
        </label>
        <label>
          <span>Nombre (opcional)</span>
          <input autoComplete="given-name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <button type="submit" disabled={!telefono.trim() || enviar.isPending}>{enviar.isPending ? 'Guardando…' : 'Avísame'}</button>
      </form>
      {error && <p className={styles.avisoError} role="alert">{error}</p>}
      <p className={styles.avisoNota}>Solo te escribimos por esta ruta. Nada de publicidad.</p>
    </section>
  );
}
