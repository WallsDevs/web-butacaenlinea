import { create } from 'zustand';
import type { MapaAsientos } from '../../lib/api/types';

export interface CriteriosBusqueda {
  origen: string;
  destino: string;
  fecha: string; // yyyy-mm-dd
  pasajeros: number;
}

interface PasajeroForm {
  asientoId: string;
  piso: number;
  claseServicio: string;
  nombre: string;
  documento: string;
  telefono: string;
}

interface BookingState {
  criterios: CriteriosBusqueda;
  salidaId: string | null;
  /** Selección por piso (la ocupación real siempre la manda el servidor). */
  seleccionados: Record<number, string[]>;
  reservaToken: string | null;
  reservaExpiraEn: string | null;
  serverOffsetMs: number;
  pasajeros: PasajeroForm[];
  metodoPago: string;

  setCriterios: (c: Partial<CriteriosBusqueda>) => void;
  toggleAsiento: (piso: number, id: string) => void;
  limpiarSeleccion: () => void;
  iniciarCheckout: (params: {
    salidaId: string;
    token: string;
    expiraEn: string;
    serverTime: string;
    mapa: MapaAsientos;
  }) => void;
  setPasajero: (i: number, datos: Partial<PasajeroForm>) => void;
  setMetodoPago: (m: string) => void;
  reiniciar: () => void;
}

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const useBooking = create<BookingState>()((set, get) => ({
  criterios: { origen: '', destino: '', fecha: hoy(), pasajeros: 2 },
  salidaId: null,
  seleccionados: {},
  reservaToken: null,
  reservaExpiraEn: null,
  serverOffsetMs: 0,
  pasajeros: [],
  metodoPago: 'pago_movil',

  setCriterios: (c) => set({ criterios: { ...get().criterios, ...c } }),
  toggleAsiento: (piso, id) =>
    set((s) => {
      const actual = s.seleccionados[piso] ?? [];
      const siguiente = actual.includes(id)
        ? actual.filter((x) => x !== id)
        : [...actual, id].sort();
      return { seleccionados: { ...s.seleccionados, [piso]: siguiente } };
    }),
  limpiarSeleccion: () => set({ seleccionados: {}, reservaToken: null, reservaExpiraEn: null }),
  iniciarCheckout: ({ salidaId, token, expiraEn, serverTime, mapa }) => {
    const s = get();
    const pasajeros: PasajeroForm[] = [];
    for (const piso of mapa.pisos) {
      for (const id of s.seleccionados[piso.numero] ?? []) {
        pasajeros.push({
          asientoId: id,
          piso: piso.numero,
          claseServicio: piso.claseServicio,
          nombre: '',
          documento: '',
          telefono: '',
        });
      }
    }
    pasajeros.sort((a, b) => a.asientoId.localeCompare(b.asientoId));
    set({
      salidaId,
      reservaToken: token,
      reservaExpiraEn: expiraEn,
      serverOffsetMs: new Date(serverTime).getTime() - Date.now(),
      pasajeros,
    });
  },
  setPasajero: (i, datos) =>
    set((s) => ({
      pasajeros: s.pasajeros.map((p, j) => (j === i ? { ...p, ...datos } : p)),
    })),
  setMetodoPago: (metodoPago) => set({ metodoPago }),
  reiniciar: () =>
    set({
      salidaId: null,
      seleccionados: {},
      reservaToken: null,
      reservaExpiraEn: null,
      pasajeros: [],
    }),
}));
