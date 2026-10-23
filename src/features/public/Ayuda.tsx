import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../stores/auth';
import { useSeo } from '../../lib/seo';
import { useInstalacion } from '../../lib/instalacion';
import { PaginaPasajero } from '../cuenta/CuentaLayout';
import { useGuia } from '../guia/useGuia';
import { GUIAS } from '../guia/guias';
import ui from '../../components/ui/ui.module.css';
import styles from './ayuda.module.css';

const WHATSAPP = (import.meta.env.VITE_WHATSAPP as string | undefined)?.replace(/\D/g, '') || '584129647161';

interface Tutorial {
  id: string;
  titulo: string;
  resumen: string;
  pasos: { titulo: string; texto: string }[];
  ir?: { texto: string; ruta: string; conCuenta?: boolean };
}

/** Lo que el pasajero hace en Butaca, paso a paso, tal como funciona la web. */
const TUTORIALES: Tutorial[] = [
  {
    id: 'comprar',
    titulo: 'Cómo comprar un pasaje',
    resumen: 'De la búsqueda al boleto con QR en unos minutos.',
    pasos: [
      { titulo: 'Busca tu salida', texto: 'En «Viajar» elige desde dónde sales, a dónde vas, el día y cuántos pasajeros viajan.' },
      { titulo: 'Escoge la salida', texto: 'Toca la que te sirva: se abre el mapa del bus con los puestos libres.' },
      { titulo: 'Toca tus puestos', texto: 'Elige uno por pasajero y toca «Pagar boleto». Los puestos quedan apartados para ti durante 5 minutos mientras pagas.' },
      { titulo: 'Escribe los datos y paga', texto: 'Pon el nombre y la cédula de cada pasajero y paga con Pago Móvil, Zelle o el saldo de tu wallet.' },
      { titulo: 'Guarda tu boleto', texto: 'Tu boleto con QR queda en «Mis boletos». Al abordar, muéstralo en el teléfono: lo escanean en la puerta.' },
    ],
    ir: { texto: 'Buscar salidas', ruta: '/cuenta', conCuenta: true },
  },
  {
    id: 'recargar',
    titulo: 'Cómo recargar tu wallet',
    resumen: 'Tu saldo sirve para pagar las busetas y también tus pasajes.',
    pasos: [
      { titulo: 'Guarda tu método de pago', texto: 'La primera vez, en «Métodos de pago» guarda el Pago Móvil desde el que vas a pagar.' },
      { titulo: 'Abre «Recargar»', texto: 'En «Mi wallet» toca «Recargar»: verás la cuenta de Butaca para el Pago Móvil, con botones para copiar el teléfono y la cédula.' },
      { titulo: 'Haz el Pago Móvil', texto: 'Desde tu banco, envía el monto a esa cuenta y guarda la referencia y la captura.' },
      { titulo: 'Reporta el pago', texto: 'Escribe el monto y la referencia, adjunta la captura y toca reportar. La recarga aparece como «Por confirmar».' },
      { titulo: 'Espera la confirmación', texto: 'Cuando la plataforma verifica el pago, el saldo se acredita. Si sale «Rechazada», revisa el monto y la referencia.' },
    ],
    ir: { texto: 'Ir a mi wallet', ruta: '/cuenta/wallet', conCuenta: true },
  },
  {
    id: 'pagar-buseta',
    titulo: 'Cómo pagar el pasaje de la buseta',
    resumen: 'Sin efectivo: escaneas el QR de la buseta y se descuenta de tu saldo.',
    pasos: [
      { titulo: 'Ten saldo en tu wallet', texto: 'El pasaje urbano se paga con tu saldo. Si no tienes, recarga primero.' },
      { titulo: 'Busca el QR de la buseta', texto: 'Está pegado en la buseta o lo muestra el colector en su teléfono.' },
      { titulo: 'Escanéalo', texto: 'En «Mi wallet» toca «Pagar pasaje — escanear QR» y apunta la cámara al código.' },
      { titulo: 'Dinos dónde te subes y te bajas', texto: 'Si la ruta cobra por tramos, elige tu parada de subida y de bajada: el precio sale de ahí.' },
      { titulo: 'Confirma', texto: 'Toca pagar. El colector y el conductor ven tu pago al instante y saben dónde te bajas.' },
    ],
    ir: { texto: 'Pagar pasaje', ruta: '/pagar', conCuenta: true },
  },
];

const PREGUNTAS: { p: string; r: string }[] = [
  { p: '¿Necesito una cuenta para comprar?', r: 'No: puedes comprar sin cuenta. Con una cuenta tus boletos quedan guardados en «Mis boletos», puedes pagar con tu saldo y pagar las busetas con QR.' },
  { p: '¿Cuánto tiempo tengo para pagar?', r: 'Los puestos quedan apartados 5 minutos desde que tocas «Pagar boleto». Si no terminas a tiempo se liberan y tienes que escogerlos de nuevo.' },
  { p: 'Mi boleto dice «Pago por verificar»', r: 'La línea está revisando tu Pago Móvil o Zelle. Cuando lo confirme, el boleto cambia a «Pagado».' },
  { p: '¿El boleto funciona sin señal?', r: 'Sí. Ábrelo una vez con conexión y queda guardado en tu teléfono: el QR se ve aunque no tengas señal al abordar.' },
  { p: 'Hice una recarga y no aparece en mi saldo', r: 'Se acredita cuando la plataforma verifica el pago; mientras tanto se ve como «Por confirmar». Si aparece «Rechazada», revisa que el monto y la referencia coincidan con tu Pago Móvil.' },
  { p: '¿Puedo pagar la buseta sin saldo?', r: 'No: el pasaje urbano se descuenta de tu wallet. Recarga antes de subir.' },
  { p: '¿Cómo sé por dónde viene mi buseta?', r: 'En «Busetas» ves en el mapa las busetas que están en servicio en cada ruta y por dónde van.' },
  { p: 'Compré sin cuenta y perdí mi boleto', r: 'Entra en «Recuperar mis boletos» (enlace abajo) y escribe la cédula del pasajero con el teléfono o el folio que pusiste al comprar. Aparecen tus boletos y puedes abrirlos de nuevo.' },
  { p: '¿Puedo cambiar o devolver un boleto?', r: 'Escríbenos por WhatsApp con el folio de tu boleto (aparece en el boleto) y te ayudamos con la línea.' },
];

/**
 * Ayuda para el pasajero: tutoriales paso a paso (comprar un pasaje,
 * recargar la wallet, pagar la buseta), cómo instalar la app y preguntas
 * frecuentes. Pública: sirve con o sin cuenta.
 */
export default function Ayuda() {
  useSeo('Ayuda — Butaca En Línea', 'Cómo comprar pasajes, recargar tu wallet y pagar la buseta con QR en Butaca En Línea.');
  const navigate = useNavigate();
  const { hash } = useLocation();
  const conCuenta = useAuth((s) => s.usuario?.role?.type) === 'cliente';
  const { puede, instalada, plataforma, instalar } = useInstalacion();
  const iniciarGuia = useGuia((s) => s.iniciar);
  // La guía va sobre las pantallas de la cuenta: sin sesión, primero ingresar
  const guiar = (id: string) => (conCuenta ? iniciarGuia(id) : navigate('/ingresar'));

  // Desde un enlace «¿Cómo recargo?» se llega directo a ese tutorial
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <PaginaPasajero titulo="Ayuda" sub="Todo lo que necesitas para viajar con Butaca, paso a paso.">
      <nav className={styles.atajos} aria-label="Tutoriales">
        {TUTORIALES.map((t) => (
          <a key={t.id} href={`#${t.id}`} className={styles.atajo} onClick={(e) => { e.preventDefault(); navigate(`/ayuda#${t.id}`, { replace: true }); }}>
            <b>{t.titulo}</b>
            <span>{t.resumen}</span>
          </a>
        ))}
      </nav>

      {TUTORIALES.map((t) => (
        <section key={t.id} id={t.id} className={styles.tutorial}>
          <div className={styles.tutorialCabeza}>
            <h2 className={styles.tutorialTitulo}>{t.titulo}</h2>
            {GUIAS[t.id] && (
              <button type="button" className={styles.hazlo} onClick={() => guiar(t.id)}>
                <span aria-hidden>▶</span> {conCuenta ? 'Hazlo conmigo' : 'Ingresa y hazlo conmigo'}
              </button>
            )}
          </div>
          <ol className={styles.pasos}>
            {t.pasos.map((p) => (
              <li key={p.titulo}>
                <b>{p.titulo}</b>
                <span>{p.texto}</span>
              </li>
            ))}
          </ol>
          {t.ir && (
            <button type="button" className={ui.btnSecondary} onClick={() => navigate(t.ir!.conCuenta && !conCuenta ? '/ingresar' : t.ir!.ruta)}>
              {t.ir.conCuenta && !conCuenta ? 'Ingresar para empezar' : t.ir.texto}
            </button>
          )}
        </section>
      ))}

      {!instalada && (
        <section id="instalar" className={styles.tutorial}>
          <h2 className={styles.tutorialTitulo}>Cómo tener Butaca como app</h2>
          {puede ? (
            <>
              <p className={styles.nota}>Tu navegador puede instalarla: queda en tu pantalla de inicio y se abre sin la barra del navegador.</p>
              <button type="button" className={ui.btnPrimary} onClick={() => void instalar()}>Agregar a mi pantalla de inicio</button>
            </>
          ) : (
            <ol className={styles.pasos}>
              {plataforma === 'ios' ? (
                <>
                  <li><b>Abre Butaca en Safari</b><span>En iPhone solo Safari permite agregarla al inicio.</span></li>
                  <li><b>Toca Compartir</b><span>El cuadrado con la flecha hacia arriba, abajo en la pantalla.</span></li>
                  <li><b>Toca «Agregar a inicio»</b><span>Confirma con «Agregar»: Butaca queda con su ícono junto a tus apps.</span></li>
                </>
              ) : (
                <>
                  <li><b>Abre el menú del navegador</b><span>Los tres puntos ⋮ arriba a la derecha.</span></li>
                  <li><b>Toca «Instalar app» o «Agregar a pantalla de inicio»</b><span>Según tu navegador aparece con uno u otro nombre.</span></li>
                  <li><b>Confirma</b><span>Butaca queda con su ícono junto a tus apps.</span></li>
                </>
              )}
            </ol>
          )}
        </section>
      )}

      <section id="preguntas" className={styles.tutorial}>
        <h2 className={styles.tutorialTitulo}>Preguntas frecuentes</h2>
        <div className={styles.preguntas}>
          {PREGUNTAS.map((q) => (
            <details key={q.p} className={styles.pregunta}>
              <summary>{q.p}</summary>
              <p>{q.r}</p>
            </details>
          ))}
        </div>
      </section>

      <p style={{ textAlign: 'center', margin: '4px 0 18px', fontSize: 15 }}>
        <Link to="/recuperar-boletos" style={{ fontWeight: 700, textDecoration: 'underline' }}>Recuperar mis boletos (compré sin cuenta)</Link>
      </p>

      <div className={styles.contacto}>
        <span>¿No encontraste lo que buscabas?</span>
        <a className={ui.btnPrimary} href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola, necesito ayuda con Butaca En Línea')}`} target="_blank" rel="noopener noreferrer">
          Escríbenos por WhatsApp
        </a>
      </div>
    </PaginaPasajero>
  );
}
