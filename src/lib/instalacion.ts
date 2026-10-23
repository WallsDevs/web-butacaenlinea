import { useSyncExternalStore } from 'react';

/**
 * Instalar la web como app (PWA). El navegador ofrece la instalación UNA vez,
 * al cargar (`beforeinstallprompt`): si nadie escucha en ese momento, se
 * pierde. Por eso se captura aquí, al arrancar, y cualquier pantalla la usa.
 * iPhone no tiene ese evento: ahí solo se puede explicar «Compartir → Agregar
 * a inicio».
 */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let evento: EventoInstalacion | null = null;
let instalada = false;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    evento = e as EventoInstalacion;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    evento = null;
    instalada = true;
    avisar();
  });
}

/** Ya se abre como app (desde el ícono de inicio), no en el navegador. */
export const enModoApp = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export type Plataforma = 'ios' | 'android' | 'otra';
export function plataforma(): Plataforma {
  if (typeof navigator === 'undefined') return 'otra';
  const ua = navigator.userAgent;
  // iPadOS se presenta como Mac, pero tiene pantalla táctil
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'otra';
}

const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

/** El estado de la instalación: si el navegador ofrece el diálogo y cómo abrirlo. */
export function useInstalacion() {
  const ofrecida = useSyncExternalStore(suscribir, () => evento, () => null);
  const yaInstalada = useSyncExternalStore(suscribir, () => instalada, () => false);
  return {
    /** El navegador tiene su propio diálogo (Chrome en Android, Edge…). */
    puede: Boolean(ofrecida),
    instalada: yaInstalada || enModoApp(),
    plataforma: plataforma(),
    instalar: async () => {
      if (!evento) return false;
      await evento.prompt();
      const { outcome } = await evento.userChoice;
      if (outcome === 'accepted') {
        evento = null;
        avisar();
      }
      return outcome === 'accepted';
    },
  };
}
