import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UsuarioSesion } from '../lib/api/types';

interface AuthState {
  jwt: string | null;
  usuario: UsuarioSesion | null;
  iniciarSesion: (jwt: string, usuario: UsuarioSesion) => void;
  cerrarSesion: () => void;
}

/** Segundos de vida que le quedan al token (lee su `exp`); -1 si no se puede leer. */
export function vidaToken(jwt: string | null): number {
  if (!jwt) return -1;
  try {
    const carga = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return carga.exp ? carga.exp - Date.now() / 1000 : Infinity;
  } catch {
    return -1;
  }
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      jwt: null,
      usuario: null,
      iniciarSesion: (jwt, usuario) => set({ jwt, usuario }),
      cerrarSesion: () => {
        set({ jwt: null, usuario: null });
        // Los boletos guardados para verlos sin señal son de esta cuenta: no quedan en el equipo
        if (typeof caches !== 'undefined') void caches.delete('boletos').catch(() => undefined);
      },
    }),
    {
      name: 'bel-auth',
      // Al abrir la web: si el token ya venció, no se finge una sesión (antes se veía «Mi cuenta»
      // y se entraba al panel, pero el servidor ya no reconocía a nadie)
      onRehydrateStorage: () => (estado) => {
        if (estado?.jwt && vidaToken(estado.jwt) <= 0) estado.cerrarSesion();
      },
    }
  )
);
