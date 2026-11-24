import { IconoNav } from '../../../app/iconos';
import { Demo } from './piezas';
import css from './CompraKilometros.module.css';

// Cifras de demostración hasta que el programa publique sus distancias y premios.
const ACTUAL = 2340;
const TOPE = 3000;
const DISTANCIA: Record<string, number> = { Caracas: 820, Mérida: 230, Valencia: 660, Maracaibo: 440, 'San Cristóbal': 820 };
const NIVELES = [
  { nombre: 'Viajero', icono: 'perfil', desc: 'Desde tu primer viaje' },
  { nombre: 'Frecuente', icono: 'estrella', desc: 'Desde 1.000 km, prioridad al abordar' },
  { nombre: 'Ruta Oro', icono: 'corona', desc: 'Desde 5.000 km, un puesto VIP gratis cada mes' },
];
const PREMIOS = [
  { nombre: 'Puesto VIP', km: '1.500 km' },
  { nombre: 'Maleta extra', km: '800 km' },
  { nombre: 'Viaje gratis', km: '3.000 km' },
];
const n = (v: number) => v.toLocaleString('es-VE');

export function Kilometros({ destino, pasajeros }: { destino: string; pasajeros: number }) {
  const kmViaje = (DISTANCIA[destino] ?? 500) * Math.max(1, pasajeros);
  const nuevo = ACTUAL + kmViaje;
  const llega = nuevo >= TOPE;

  return (
    <section id="kilometros" className={css.kilometros} aria-labelledby="kilometros-titulo">
      <div className={css.fila}>
        <div className={css.texto} data-entrada="texto">
          <Demo />
          <h2 id="kilometros-titulo">Cada viaje suma <span>kilómetros</span></h2>
          <p className={css.intro}>Ganas un kilómetro por cada kilómetro recorrido en cualquier línea afiliada. Canjéalos por puestos VIP, equipaje extra o viajes completos.</p>
          <ul className={css.detalles} role="list" aria-label="Niveles del programa">
            {NIVELES.map((nivel) => (
              <li key={nivel.nombre}>
                <span className={css.icono}><IconoNav id={nivel.icono} /></span>
                <div><strong>{nivel.nombre}</strong><p>{nivel.desc}</p></div>
              </li>
            ))}
          </ul>
        </div>
        <div className={css.escenaKm}>
          <figure className={css.telefonoKm} data-entrada="telefono" aria-label="Ejemplo de kilómetros acumulados y premios">
            <div className={css.pantallaKm}>
              <div className={css.perfil}>
                <span className={css.avatar} aria-hidden="true">YP</span>
                <div><strong>Yorman Peña</strong><small>Nivel Frecuente · 14 viajes</small></div>
              </div>
              <div className={css.saldo}>
                <strong>{n(ACTUAL)} <small>km</small></strong>
                <span>+{n(kmViaje)} con este viaje</span>
              </div>
              <div className={css.barra} data-entrada="progreso" aria-hidden="true">
                <i style={{ width: Math.min(100, nuevo / TOPE * 100) + '%' }} />
                <i style={{ width: ACTUAL / TOPE * 100 + '%' }} />
              </div>
              <div className={css.escala}><span>0</span><span>1.500 · Puesto VIP</span><span>3.000 · Viaje gratis</span></div>
              <p className={llega ? css.metaAlcanzada : css.meta}>
                {llega ? <>Con este viaje llegas a {n(nuevo)} km. Ya puedes canjear un viaje gratis.</> : <>Te faltan {n(TOPE - nuevo)} km para un viaje gratis.</>}
              </p>
              <dl className={css.premios}>
                {PREMIOS.map((p) => <div key={p.nombre}><dt>{p.nombre}</dt><dd>{p.km}</dd></div>)}
              </dl>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
