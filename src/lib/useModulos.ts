import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../stores/auth';
import { getMiContrato, type ClaveModulo } from './api/endpoints';

const ROLES_CON_LINEA = new Set(['empresa', 'cajero', 'chofer', 'colector']);

/**
 * Qué módulos contrató la línea del usuario, para que la interfaz OCULTE lo
 * que no aplica. Ocultar no es proteger: la compuerta real está en el backend
 * y responde `modulo_no_contratado` aunque alguien escriba la URL a mano.
 *
 * `modulos === null` = no aplica (sin línea, sin contrato, o aún cargando):
 * se muestra todo, que es lo que hacía la web antes de que existieran módulos.
 */
export function useModulos(): {
  modulos: ClaveModulo[] | null;
  tiene: (modulo: ClaveModulo) => boolean;
} {
  const usuario = useAuth((s) => s.usuario);
  const aplica = ROLES_CON_LINEA.has(usuario?.role?.type ?? '') && Boolean(usuario?.linea);

  const { data } = useQuery({
    queryKey: ['mi-contrato', usuario?.id],
    queryFn: getMiContrato,
    enabled: aplica,
    staleTime: 60_000,
  });

  const modulos = aplica && data && !data.sinContrato ? data.modulos : null;
  return { modulos, tiene: (m) => modulos === null || modulos.includes(m) };
}
