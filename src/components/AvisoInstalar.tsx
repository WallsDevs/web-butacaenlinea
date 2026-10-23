import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { useInstalacion } from '../lib/instalacion';
import { Isotipo } from './brand/LogoMark';
import styles from './AvisoInstalar.module.css';

/** Se cerró en esta visita: vuelve a salir la próxima vez que se abra la web. */
const CLAVE = 'bel-aviso-instalar-cerrado';
const ANCHO_TELEFONO = 1024;

/** El ícono de Compartir de Safari, para que el paso se reconozca. */
const Compartir = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Compartir" role="img">
    <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);

/**
 * Cada vez que se abre la web en un teléfono o tablet (y no está instalada),
 * un aviso abajo ofrece agregarla a la pantalla de inicio. En Android abre el
 * diálogo del navegador; en iPhone explica «Compartir → Agregar a inicio».
 * «Ahora no» lo esconde hasta la próxima vez que se abra.
 */
export function AvisoInstalar() {
  const { puede, instalada, plataforma, instalar } = useInstalacion();
  const { pathname } = useLocation();
  const [cerrado, setCerrado] = useState(() => {
    try {
      return sessionStorage.getItem(CLAVE) === '1';
    } catch {
      return false;
    }
  });
  const [telefono, setTelefono] = useState(() => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${ANCHO_TELEFONO}px)`).matches);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${ANCHO_TELEFONO}px)`);
    const cambio = () => setTelefono(mq.matches);
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, []);
  // Mientras escanea o paga en la buseta no estorba
  const pantallaDePago = pathname.startsWith('/pagar') || pathname.startsWith('/checkout');
  const visible = !(instalada || cerrado || !telefono || pantallaDePago);
  // La página le deja sitio abajo mientras se ve (si no, tapaba el final: p. ej. enlaces de ingresar)
  useEffect(() => {
    document.body.classList.toggle('con-aviso-instalar', visible);
    return () => document.body.classList.remove('con-aviso-instalar');
  }, [visible]);
  if (!visible) return null;

  const cerrar = () => {
    setCerrado(true);
    try {
      sessionStorage.setItem(CLAVE, '1');
    } catch {
      /* sin almacenamiento: se cierra solo en esta pantalla */
    }
  };

  return (
    <aside className={styles.aviso} role="dialog" aria-label="Agregar Butaca a tu pantalla de inicio">
      <div className={styles.icono} aria-hidden>
        <Isotipo size={30} trazo={5} contorno="#FFFFFF" acento="#60A5FA" />
      </div>
      <div className={styles.texto}>
        <b>Agrega Butaca a tu pantalla de inicio</b>
        {puede ? (
          <span>Ábrela como una app, con tu boleto a mano aunque no tengas señal.</span>
        ) : plataforma === 'ios' ? (
          <span>
            Toca <span className={styles.paso}><Compartir /></span> abajo en Safari y luego <b>«Agregar a inicio»</b>.
          </span>
        ) : (
          <span>
            Abre el menú del navegador <b>⋮</b> y toca <b>«Instalar app»</b> o <b>«Agregar a pantalla de inicio»</b>.
          </span>
        )}
      </div>
      <div className={styles.botones}>
        {puede && (
          <button type="button" className={styles.instalar} onClick={() => void instalar()}>
            Agregar
          </button>
        )}
        <button type="button" className={styles.ahoraNo} onClick={cerrar}>
          {puede ? 'Ahora no' : 'Entendido'}
        </button>
      </div>
    </aside>
  );
}
