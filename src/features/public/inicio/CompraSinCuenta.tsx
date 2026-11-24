import { Link } from 'react-router';
import { IconoNav } from '../../../app/iconos';
import { ComprobanteMuestra } from '../ComprobanteMuestra';
import css from './CompraKilometros.module.css';

const PASOS = [
  { icono: 'busetas', titulo: 'Escoge', texto: 'Tu salida y tu puesto en el bus.' },
  { icono: 'telefono', titulo: 'Paga', texto: 'Por Pago Móvil y copia los datos.' },
  { icono: 'boletos', titulo: 'Guarda', texto: 'El enlace de tu boleto para abordar.' },
];

export function CompraSinCuenta({ onBuscar, conSesion = false }: { onBuscar: () => void; conSesion?: boolean }) {
  return (
    <section id="sin-cuenta" className={css.compra} aria-labelledby="sin-cuenta-titulo">
      <div className={css.fila}>
        <div className={css.texto} data-entrada="texto">
          <span className={css.etiqueta}><IconoNav id="rayo" size={16} />Compra rápida</span>
          <h2 id="sin-cuenta-titulo">Compra sin crear <span>cuenta</span></h2>
          <p className={css.intro}>Paga tu pasaje con Pago Móvil, completa los datos del comprobante y recibe tu boleto al instante.</p>
          <ol className={css.detalles} role="list">
            {PASOS.map((paso, i) => (
              <li key={paso.titulo}>
                <span className={css.icono}><IconoNav id={paso.icono} /></span>
                <div><strong>{i + 1}. {paso.titulo}</strong><p>{paso.texto}</p></div>
              </li>
            ))}
          </ol>
          <div className={css.acciones}>
            <button type="button" onClick={onBuscar}>Buscar pasajes <span aria-hidden="true">→</span></button>
            {!conSesion && <Link to="/registro">O crea tu cuenta y guarda tus boletos</Link>}
          </div>
        </div>
        <div className={css.escenaCompra}>
          <div className={css.telefonoRecibo} data-entrada="telefono">
            <div className={css.pantallaRecibo}><ComprobanteMuestra compacto /></div>
          </div>
          <div className={css.recuperar}>
            <h3>¿Perdiste tu boleto?</h3>
            <p>Recupéralo con los cuatro datos marcados en tu comprobante de Pago Móvil.</p>
            <Link to="/recuperar-boletos">Recuperar mi boleto <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
