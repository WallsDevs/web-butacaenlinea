import { IconoNav } from '../../../app/iconos';
import tarjetas from './tarjetas-nfc.webp';
import css from './TarjetasNfc.module.css';

const beneficios = [
  {
    titulo: 'Pago sin contacto',
    detalle: 'Acércala al lector y viaja.',
    icono: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 10a4 4 0 0 1 0 4m4-7a9 9 0 0 1 0 10m4-13a14 14 0 0 1 0 16m4-18a18 18 0 0 1 0 20"/>
    </svg>,
  },
  { titulo: 'Recarga fácil', detalle: 'Desde la web o la app.', icono: <IconoNav id="cierre" size={28}/> },
  { titulo: 'Más rápida y segura', detalle: 'Tus viajes y saldo siempre protegidos.', icono: <IconoNav id="seguridad" size={28}/> },
];

export function TarjetasNfc() {
  return (
    <section id="tarjeta-nfc" className={css.seccion} aria-labelledby="titulo-tarjeta-nfc">
      <div className={css.contenido}>
        <div className={css.intro} data-entrada="texto">
          <span className={css.estado}>Próximamente</span>
          <h2 id="titulo-tarjeta-nfc">Tu pasaje, más rápido <span>y sin contacto</span></h2>
          <p>Con nuestra tarjeta NFC podrás recargar, validar y viajar en todas nuestras rutas.</p>
        </div>
        <img className={css.tarjetas} data-entrada="tarjetas" src={tarjetas} width={1070} height={665} loading="lazy" decoding="async"
          alt="Frente azul marino y reverso turquesa de la tarjeta NFC de Butaca En Línea"/>
        <ul className={css.beneficios}>
          {beneficios.map(({ titulo, detalle, icono }) => (
            <li key={titulo}>
              <span className={css.icono}>{icono}</span>
              <div><h3>{titulo}</h3><p>{detalle}</p></div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
