import { API_URL } from './api/client';

/**
 * ¿La persona llegó desde Instagram? Por el enlace de la biografía
 * (butacaenlinea.com/ig), por un enlace con ?utm_source=instagram (stories,
 * anuncios) o porque viene de instagram.com. Se avisa una vez por sesión: lo
 * que se cuenta es gente que entra, no páginas vistas.
 */
export function contarVisitaDeInstagram() {
  try {
    const url = new URL(window.location.href);
    const fuente = (url.searchParams.get('utm_source') ?? '').toLowerCase();
    const desdeInstagram =
      url.pathname === '/ig' || fuente === 'instagram' || fuente === 'ig' || /(^|\.)instagram\.com$/i.test(document.referrer ? new URL(document.referrer).hostname : '');
    if (!desdeInstagram || sessionStorage.getItem('visita-instagram')) return;
    sessionStorage.setItem('visita-instagram', '1');
    // Sin esperar respuesta ni mostrar errores: medir nunca estorba a quien navega
    void fetch(`${API_URL}/api/visitas`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ origen: 'instagram' }), keepalive: true }).catch(() => undefined);
  } catch {
    // sessionStorage bloqueado (modo privado estricto): no se cuenta y ya
  }
}
