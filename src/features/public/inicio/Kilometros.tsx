import styles from './inicio.module.css';

/**
 * DEMOSTRACIÓN del programa de kilómetros. Se acumulan los km de cada boleto
 * comprado, en cualquier línea, y al llegar a ciertos umbrales el pasajero
 * obtiene un beneficio. Los umbrales y beneficios reales los definirá el
 * superadmin (desarrollo pendiente): estas cifras son de ejemplo y viven
 * juntas aquí para reemplazarlas por la API sin tocar el diseño.
 */
const EJEMPLO = {
  nombre: 'Yorman Peña',
  iniciales: 'YP',
  nivel: 'Frecuente',
  viajes: 14,
  kmActual: 2340,
  kmDelViaje: 820,
  topeBarra: 3000,
  premios: [
    { nombre: 'Puesto VIP', km: 1500 },
    { nombre: 'Maleta extra', km: 800 },
    { nombre: 'Viaje gratis', km: 3000 },
  ],
  niveles: [
    { nombre: 'Viajero', desc: 'Desde tu primer viaje', desde: 0 },
    { nombre: 'Frecuente', desc: 'Desde 1.000 km · prioridad en abordaje', desde: 1000 },
    { nombre: 'Ruta Oro', desc: 'Desde 5.000 km · puesto VIP sin costo cada mes', desde: 5000 },
  ],
};

const n = (v: number) => v.toLocaleString('es-VE');

export function Kilometros() {
  const e = EJEMPLO;
  const nuevo = e.kmActual + e.kmDelViaje;
  const nivelActual = e.niveles.reduce((acc, nv, i) => (e.kmActual >= nv.desde ? i : acc), 0);
  const pct = (v: number) => Math.min(100, (v / e.topeBarra) * 100);
  const llega = nuevo >= e.topeBarra;
  return (
    <section id="kilometros" className={styles.seccion}>
      <div className={styles.km}>
        <div className={styles.kmBlob} />
        <div className={styles.kmTexto}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <h2 className={styles.h2}>Cada viaje suma kilómetros</h2>
            <span className={`${styles.demo} ${styles.demoOscuro}`}>Demostración</span>
          </div>
          <p className={styles.kmParrafo}>
            Ganas un kilómetro por cada kilómetro de tus boletos, en cualquier línea afiliada. Al llegar a ciertas
            metas obtienes beneficios: descuentos, puestos VIP, equipaje extra o un viaje completo.
          </p>
          <div className={styles.niveles}>
            {e.niveles.map((nv, i) => (
              <div key={nv.nombre} className={styles.nivel}>
                <span
                  className={styles.nivelPunto}
                  style={{
                    borderColor: i <= nivelActual ? 'var(--blue-400)' : 'rgba(159,192,255,.4)',
                    background: i === nivelActual ? 'var(--blue-400)' : 'transparent',
                  }}
                />
                <span className={styles.nivelNombre}>{nv.nombre}</span>
                <span className={styles.nivelDesc}>{nv.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.kmTarjeta}>
          <div className={styles.kmPerfil}>
            <span className={styles.kmAvatar}>{e.iniciales}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{e.nombre}</div>
              <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Nivel {e.nivel} · {e.viajes} viajes</div>
            </div>
          </div>
          <div className={styles.kmCifra}>
            <span className={styles.kmCifraN}>{n(e.kmActual)}</span>
            <span style={{ fontSize: 16, color: 'var(--text-faint)' }}>km</span>
            <span className={styles.kmSuma}>+{n(e.kmDelViaje)} con este viaje</span>
          </div>
          <div>
            <div className={styles.barra}>
              <span className={styles.barraNueva} style={{ width: `${pct(nuevo)}%` }} />
              <span className={styles.barraActual} style={{ width: `${pct(e.kmActual)}%` }} />
            </div>
            <div className={styles.barraEscala}>
              <span>0</span>
              <span>1.500 · Puesto VIP</span>
              <span>3.000 · Viaje gratis</span>
            </div>
          </div>
          <div className={styles.kmMeta} style={llega ? { background: 'var(--seat-free-bg)', color: 'var(--seat-free-text)' } : undefined}>
            {llega
              ? `Con este viaje llegas a ${n(nuevo)} km: ya puedes canjear un viaje gratis.`
              : `Te faltan ${n(e.topeBarra - nuevo)} km para un viaje gratis.`}
          </div>
          <div className={styles.premios}>
            {e.premios.map((p) => (
              <div key={p.nombre} className={styles.premio}>
                <span className={styles.premioN}>{p.nombre}</span>
                <span className={styles.premioKm}>{n(p.km)} km</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className={styles.pieDemo}>Vista de demostración: los kilómetros y las metas de ejemplo se conectarán a tu cuenta en una próxima versión.</p>
    </section>
  );
}
