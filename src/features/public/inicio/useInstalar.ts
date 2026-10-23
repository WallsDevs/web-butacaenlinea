import { useInstalacion } from '../../../lib/instalacion';

/** La función que abre el diálogo de instalación de la PWA, o `null` si el navegador no la ofrece. */
export function useInstalar(): (() => void) | null {
  const { puede, instalar } = useInstalacion();
  return puede ? () => void instalar() : null;
}
