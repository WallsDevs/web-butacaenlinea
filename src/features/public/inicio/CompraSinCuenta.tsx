import { Link } from 'react-router';
import { ComprobanteMuestra } from '../ComprobanteMuestra';
import { H2 } from './piezas';
import css from './inicio.module.css';

/**
 * «Compra sin crear cuenta»: que se sepa que se puede comprar pagando por
 * Pago Móvil sin registrarse, y dónde se recupera el boleto si se pierde el
 * enlace (con los datos del comprobante, que ya tiene en la captura).
 */
export function CompraSinCuenta({ onBuscar }: { onBuscar: () => void }) {
  return (
    <section id="sin-cuenta" className={css.sinCuenta} aria-labelledby="sin-cuenta-titulo">
      <div className={css.sinCuentaTexto}>
        <span id="sin-cuenta-titulo"><H2>Compra sin crear cuenta</H2></span>
        <p className={css.sinCuentaIntro}>
          No hace falta registrarte para comprar tu pasaje. Pagas por Pago Móvil a Butaca, escribes los datos de tu comprobante y el boleto te llega al instante.
        </p>
        <ul className={css.sinCuentaPasos}>
          <li><strong>Escoge</strong> la salida y tu puesto en el mapa del bus.</li>
          <li><strong>Paga</strong> por Pago Móvil y copia los datos del comprobante: referencia, banco, teléfono y cédula.</li>
          <li><strong>Guarda</strong> el enlace de tu boleto: lo muestras en el teléfono al abordar.</li>
        </ul>
        <div className={css.sinCuentaAcciones}>
          <button type="button" className={css.botonClaro} onClick={onBuscar}>Buscar pasajes</button>
          <Link to="/registro" className={css.enlaceSuave}>O crea tu cuenta y tus boletos quedan guardados</Link>
        </div>
      </div>

      <div className={css.sinCuentaRecuperar}>
        <ComprobanteMuestra compacto />
        <div className={css.sinCuentaRecuperarTexto}>
          <h3>¿Perdiste tu boleto?</h3>
          <p>Recupéralo con los cuatro datos marcados de tu comprobante de Pago Móvil.</p>
          <Link to="/recuperar-boletos" className={css.botonFuerte}>Recuperar mi boleto</Link>
        </div>
      </div>
    </section>
  );
}
