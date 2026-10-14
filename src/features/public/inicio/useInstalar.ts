import { useEffect, useState } from 'react';

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
}

/** La función que abre el diálogo de instalación de la PWA, o `null` si el navegador no la ofrece. */
export function useInstalar(): (() => void) | null {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  useEffect(() => {
    const guardar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalacion);
    };
    const limpiar = () => setEvento(null);
    window.addEventListener('beforeinstallprompt', guardar);
    window.addEventListener('appinstalled', limpiar);
    return () => {
      window.removeEventListener('beforeinstallprompt', guardar);
      window.removeEventListener('appinstalled', limpiar);
    };
  }, []);
  return evento ? () => void evento.prompt() : null;
}
