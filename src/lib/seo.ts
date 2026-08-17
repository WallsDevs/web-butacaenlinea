import { useEffect } from 'react';

/**
 * SEO por página para la SPA: título y descripción dinámicos (Google renderiza
 * JS; con esto + sitemap el marketplace indexa). `noindex` para páginas
 * privadas por token (ej. el boleto).
 */
export function useSeo(titulo: string, descripcion?: string, opciones?: { noindex?: boolean }) {
  useEffect(() => {
    document.title = titulo;
    if (descripcion) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', descripcion);
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
  }, [titulo, descripcion, opciones?.noindex]);
}
