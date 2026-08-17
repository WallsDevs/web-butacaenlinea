import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UsuarioSesion } from '../lib/api/types';

interface AuthState {
  jwt: string | null;
  usuario: UsuarioSesion | null;
  iniciarSesion: (jwt: string, usuario: UsuarioSesion) => void;
  cerrarSesion: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      jwt: null,
      usuario: null,
      iniciarSesion: (jwt, usuario) => set({ jwt, usuario }),
      cerrarSesion: () => set({ jwt: null, usuario: null }),
    }),
    { name: 'bel-auth' }
  )
);
