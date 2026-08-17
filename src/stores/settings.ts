import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Moneda, Tasas } from '../lib/money';

interface SettingsState {
  moneda: Moneda;
  /** Última tasa conocida (respaldo para conversiones offline; el servidor manda). */
  tasas: Tasas;
  /** true solo cuando la tasa llegó del servidor EN ESTA sesión (no persistido). */
  tasasFrescas: boolean;
  /** true si la tasa BS vigente es la propia de la línea del usuario. */
  tasaPropia: boolean;
  setMoneda: (m: Moneda) => void;
  setTasas: (t: Tasas, propia?: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      moneda: 'Bs',
      tasas: { bcv: 0, cop: 0 },
      tasasFrescas: false,
      tasaPropia: false,
      setMoneda: (moneda) => set({ moneda }),
      setTasas: (tasas, propia = false) => set({ tasas, tasasFrescas: true, tasaPropia: propia }),
    }),
    {
      name: 'bel-settings',
      version: 1,
      // v0 → v1: purgar tasas persistidas de versiones viejas (p. ej. el 580
      // de la demo) — la próxima consulta al servidor las repone reales
      migrate: (estado: any) => ({ ...estado, tasas: { bcv: 0, cop: 0 } }),
      partialize: (s) => ({ moneda: s.moneda, tasas: s.tasas }) as SettingsState,
    }
  )
);
