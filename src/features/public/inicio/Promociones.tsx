import { useState } from 'react';
import styles from './inicio.module.css';

/**
 * DEMOSTRACIÓN. Los descuentos todavía no existen en el servidor: estas
 * tarjetas muestran cómo se verán y se comportan, y no alteran ningún precio.
 * Cuando haya promociones reales, esta lista sale de la API.
 */
const PROMOS = [
  { codigo: 'MARTES20', big: '−20%', titulo: 'Martes de ruta', desc: 'Todas las salidas de los martes, en cualquier línea afiliada.', fondo: 'var(--blue-600)', color: '#fff', blob: 'rgba(255,255,255,.12)', raya: 'rgba(255,255,255,.6)', borde: 'var(--blue-600)' },
  { codigo: 'ANDES', big: '−15%', titulo: 'Rumbo a los Andes', desc: 'Mérida, Táriba y La Grita durante la temporada.', fondo: '#fff', color: 'var(--text)', blob: 'var(--tint-50)', raya: 'var(--blue-200)', borde: 'var(--border)' },
  { codigo: 'ESTUDIA', big: '−10%', titulo: 'Estudiantes', desc: 'Con carnet vigente. Acumulas kilómetros igual.', fondo: 'var(--navy)', color: '#fff', blob: 'rgba(96,165,250,.16)', raya: 'rgba(159,192,255,.7)', borde: 'var(--navy)' },
];

export function Promociones() {
  const [aplicada, setAplicada] = useState<string | null>(null);
  return (
    <section id="promos" className={styles.seccion}>
      <div className={styles.seccionCab}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <h2 className={styles.h2}>Promociones de la semana</h2>
          <span className={styles.demo}>Demostración</span>
        </div>
        <span className={styles.nota}>Toca una para ver cómo se aplica a tu boleto</span>
      </div>
      <div className={styles.promos}>
        {PROMOS.map((p) => {
          const on = aplicada === p.codigo;
          return (
            <button
              key={p.codigo}
              className={styles.promo}
              style={{ background: p.fondo, color: p.color, borderColor: on ? 'var(--seat-free-border)' : p.borde }}
              onClick={() => setAplicada(on ? null : p.codigo)}
            >
              <span className={styles.promoBlob} style={{ background: p.blob }} />
              <span className={styles.promoCuerpo}>
                <span className={styles.promoBig}>{p.big}</span>
                <span className={styles.promoTitulo}>{p.titulo}</span>
                <span className={styles.promoDesc}>{p.desc}</span>
              </span>
              <span className={styles.promoPie}>
                <span className={styles.promoCodigo} style={{ borderColor: p.raya }}>{p.codigo}</span>
                <span className={styles.promoCta}>{on ? 'Aplicada' : 'Aplicar →'}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className={styles.pieDemo}>Vista de demostración: los descuentos se cobrarán en el pago cuando estén activos.</p>
    </section>
  );
}
