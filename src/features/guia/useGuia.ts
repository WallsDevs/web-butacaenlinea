import { create } from 'zustand';
import { GUIAS } from './guias';

interface EstadoGuia {
  guia: string | null;
  paso: number;
  iniciar: (id: string) => void;
  siguiente: () => void;
  anterior: () => void;
  salir: () => void;
}

/** La guía en curso (no se guarda: al recargar la página se termina). */
export const useGuia = create<EstadoGuia>((set, get) => ({
  guia: null,
  paso: 0,
  iniciar: (id) => (GUIAS[id] ? set({ guia: id, paso: 0 }) : undefined),
  siguiente: () => {
    const { guia, paso } = get();
    if (!guia) return;
    if (paso + 1 >= GUIAS[guia].pasos.length) set({ guia: null, paso: 0 });
    else set({ paso: paso + 1 });
  },
  anterior: () => set((e) => ({ paso: Math.max(0, e.paso - 1) })),
  salir: () => set({ guia: null, paso: 0 }),
}));
