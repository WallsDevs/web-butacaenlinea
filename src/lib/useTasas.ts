import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTasas } from './api/endpoints';
import { useSettings } from '../stores/settings';
import { useAuth } from '../stores/auth';

/**
 * Mantiene las tasas del store sincronizadas con el servidor (cada 5 min).
 * La clave de caché incluye la identidad: el personal de una empresa ve SU
 * tasa, pero el visitante anónimo (landing) SIEMPRE la global del BCV — al
 * cerrar sesión la query pública refetchea y no hereda la caché del staff.
 */
export function useTasasSync(): void {
  const setTasas = useSettings((s) => s.setTasas);
  const usuarioId = useAuth((s) => s.usuario?.id ?? 'publico');
  const { data } = useQuery({
    queryKey: ['tasas', usuarioId],
    queryFn: getTasas,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => {
    if (data && data.bcv > 0) setTasas({ bcv: data.bcv, cop: data.cop }, Boolean(data.bsPropia));
  }, [data, setTasas]);
}
