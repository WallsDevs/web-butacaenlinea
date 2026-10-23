import { useEffect } from 'react';

const DOMINIO = 'https://butacaenlinea.com';

function meta(atributo: 'name' | 'property', clave: string, valor: string) {
  let el = document.querySelector(`meta[${atributo}="${clave}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(atributo, clave);
    document.head.appendChild(el);
  }
  el.setAttribute('content', valor);
}

/**
 * SEO por página: título, descripción, dirección canónica, vista previa al
 * compartir (WhatsApp, redes) y datos estructurados (JSON-LD) para Google.
 * Las páginas de pasajes además salen ya armadas en el HTML al publicar
 * (scripts/prerender-seo.mjs), así los buscadores las leen sin JavaScript.
 * `noindex` para lo privado (el boleto, la cuenta, ingresar).
 */
export function useSeo(
  titulo: string,
  descripcion?: string,
  opciones?: { noindex?: boolean; ruta?: string; datos?: object | object[] }
) {
  const datos = opciones?.datos ? JSON.stringify(opciones.datos) : '';
  useEffect(() => {
    document.title = titulo;
    if (descripcion) {
      meta('name', 'description', descripcion);
      meta('property', 'og:description', descripcion);
    }
    meta('property', 'og:title', titulo);
    if (opciones?.ruta) {
      const url = `${DOMINIO}${opciones.ruta}`;
      let canonica = document.querySelector('link[rel="canonical"]');
      if (!canonica) {
        canonica = document.createElement('link');
        canonica.setAttribute('rel', 'canonical');
        document.head.appendChild(canonica);
      }
      canonica.setAttribute('href', url);
      meta('property', 'og:url', url);
    }
    let robots = document.querySelector('meta[name="robots"]');
    if (opciones?.noindex) {
      if (!robots) {
        robots = document.createElement('meta');
        robots.setAttribute('name', 'robots');
        document.head.appendChild(robots);
      }
      robots.setAttribute('content', 'noindex');
    } else if (robots) {
      robots.remove();
    }
    // Datos estructurados de la página (se reemplazan al cambiar de página)
    document.querySelectorAll('script[data-seo-pagina]').forEach((s) => s.remove());
    if (datos) {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.dataset.seoPagina = '1';
      s.textContent = datos;
      document.head.appendChild(s);
    }
  }, [titulo, descripcion, opciones?.noindex, opciones?.ruta, datos]);
}
