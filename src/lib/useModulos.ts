import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../stores/auth';
import { getMiContrato, type ClaveModulo, type Contrato } from './api/endpoints';

const ROLES_CON_LINEA = new Set(['empresa', 'cajero', 'chofer', 'colector']);

/**
 * Qué módulos contrató la línea del usuario, para que la interfaz OCULTE lo
 * que no aplica. Ocultar no es proteger: la compuerta real está en el backend
 * y responde `modulo_no_contratado` (o `contrato_vencido`) aunque alguien
 * escriba la URL a mano.
 *
 * `modulos === null` = no aplica (sin línea, sin contrato, o aún cargando):
 * se muestra todo, que es lo que hacía la web antes de que existieran módulos.
 * Con el contrato vencido, `modulos` es `[]`: no queda ninguna sección de
 * módulo, solo las del núcleo (facturas, configuración).
 */
export function useModulos(): {
  modulos: ClaveModulo[] | null;
  tiene: (modulo: ClaveModulo) => boolean;
  /** El contrato vigente de la línea (vencido o no), si lo hay. */
  contrato: Contrato | null;
  vencido: boolean;
} {
  const usuario = useAuth((s) => s.usuario);
  const aplica = ROLES_CON_LINEA.has(usuario?.role?.type ?? '') && Boolean(usuario?.linea);

  const { data } = useQuery({
    queryKey: ['mi-contrato', usuario?.id],
    queryFn: getMiContrato,
    enabled: aplica,
    staleTime: 60_000,
  });

  const vencido = Boolean(aplica && data?.vencido);
  const modulos = aplica && data && !data.sinContrato ? (vencido ? [] : data.modulos) : null;
  return {
    modulos,
    tiene: (m) => modulos === null || modulos.includes(m),
    contrato: (aplica && data?.contrato) || null,
    vencido,
  };
}
