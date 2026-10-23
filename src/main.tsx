import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import { router } from './app/router';
import { ApiError } from './lib/api/client';
import './styles/base.css';
// Escucha el ofrecimiento de instalación desde el arranque (si no, se pierde)
import './lib/instalacion';

const esDeContrato = (e: unknown) => e instanceof ApiError && (e.code === 'modulo_no_contratado' || e.code === 'contrato_vencido' || e.code === 'sin_contrato' || e.code === 'modulo_suspendido_por_pago');

const queryClient: QueryClient = new QueryClient({
  // La compuerta del backend manda: si negó por contrato, el contrato que la web
  // tenía en caché está viejo. Se refresca y las secciones se reacomodan solas.
  queryCache: new QueryCache({
    onError: (e) => {
      if (esDeContrato(e)) void queryClient.invalidateQueries({ queryKey: ['mi-contrato'] });
    },
  }),
  defaultOptions: {
    queries: {
      // Reintentar una negación por contrato no la cambia
      retry: (n, e) => !esDeContrato(e) && n < 1,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
