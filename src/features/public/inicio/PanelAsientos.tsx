import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crearReserva, getMapaAsientos } from '../../../lib/api/endpoints';
import { ApiError } from '../../../lib/api/client';
import { Money } from '../../../components/ui/Money';
import { SeatMap, SeatLegend } from '../../../components/seat-map/SeatMap';
import { useBooking } from '../useBooking';

interface Elegido { piso: number; id: string }

/**
 * Panel que se abre bajo la salida elegida en el tablero (diseño v5): el mapa
 * de asientos en vivo, el resumen y «Pagar boleto». Aparta los puestos con la
 * misma reserva de la página de asientos y sigue al checkout.
 */
export function PanelAsientos({ salidaId, pax }: { salidaId: string; pax: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { limpiarSeleccion, toggleAsiento, iniciarCheckout } = useBooking();
  const [sel, setSel] = useState<Elegido[]>([]);
  const [pisoActivo, setPisoActivo] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Ocupación en vivo mientras el panel está abierto
  const { data: mapa } = useQuery({ queryKey: ['mapa', salidaId], queryFn: () => getMapaAsientos(salidaId), refetchInterval: 4000 });

  // Si bajan los pasajeros, se conservan los últimos puestos tocados
  useEffect(() => setSel((s) => s.slice(-pax)), [pax]);

  const reservar = useMutation({
    mutationFn: () => crearReserva(salidaId, sel.map((e) => e.id)),
    onSuccess: (r) => {
      // El checkout lee la selección del almacén de reserva
      limpiarSeleccion();
      sel.forEach((e) => toggleAsiento(e.piso, e.id));
      iniciarCheckout({ salidaId, token: r.token, expiraEn: r.expiraEn, serverTime: r.serverTime, mapa: mapa! });
      navigate('/checkout');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'asientos_no_disponibles') {
        const ocupados = (e.details as { asientos?: string[] })?.asientos ?? [];
        setError(`Alguien tomó ${ocupados.length === 1 ? 'el puesto' : 'los puestos'} ${ocupados.join(', ')} antes que tú. Escoge otros.`);
        setSel((s) => s.filter((x) => !ocupados.includes(x.id)));
        void queryClient.invalidateQueries({ queryKey: ['mapa', salidaId] });
      } else {
        setError('No se pudo apartar. Intenta de nuevo.');
      }
    },
  });

  const piso = mapa?.pisos.find((p) => p.numero === pisoActivo) ?? mapa?.pisos[0];
  const precioDe = (p: number) => {
    const clase = mapa?.pisos.find((x) => x.numero === p)?.claseServicio;
    return Number((clase && mapa?.preciosUsd[clase]) ?? 0);
  };
  const { subtotal, total } = useMemo(() => {
    const sub = sel.reduce((s, e) => s + precioDe(e.piso), 0);
    const extra = ((mapa?.recargosUsd.tasaTerminal ?? 0) + (mapa?.recargosUsd.seguro ?? 0)) * sel.length;
    return { subtotal: sub, total: sub + extra };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, mapa]);

  const toggle = (p: number, id: string) => {
    setError(null);
    setSel((s) => {
      if (s.some((e) => e.id === id && e.piso === p)) return s.filter((e) => !(e.id === id && e.piso === p));
      return [...s, { piso: p, id }].slice(-pax);
    });
  };

  const falta = pax - sel.length;
  const listo = falta === 0;
  const ordenados = sel.map((e) => e.id).sort();
  const pedido = listo
    ? `Listo · ${ordenados.join(' · ')}`
    : falta === pax
      ? `Toca ${pax === 1 ? 'un puesto libre' : `${pax} puestos libres`}`
      : `Falta ${falta === 1 ? '1 puesto' : `${falta} puestos`}`;

  return (
    <div style={{ margin: '0 8px 8px', borderRadius: 12, background: '#FFFFFF', color: '#0F172A', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!mapa || !piso ? (
        <div style={{ padding: 28, textAlign: 'center', color: '#7C8AA5', fontSize: 14 }}>Cargando mapa…</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1D4ED8' }}>{pedido}</span>
            <SeatLegend />
          </div>
          {mapa.pisos.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {mapa.pisos.map((p) => {
                const on = p.numero === piso.numero;
                return (
                  <button key={p.numero} onClick={() => setPisoActivo(p.numero)} style={{ padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${on ? '#2563EB' : '#E2E8F2'}`, background: on ? '#EFF4FF' : '#FFFFFF', color: on ? '#1D4ED8' : '#475569', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Piso {p.numero} · {p.nombre}
                  </button>
                );
              })}
            </div>
          )}
          {error && <div role="alert" style={{ fontSize: 13, color: '#8A5108', background: '#FEF3E2', border: '1px solid #F5D9A8', borderRadius: 12, padding: '10px 14px' }}>{error}</div>}
          <div style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
            <SeatMap
              piso={piso}
              seleccionados={sel.filter((e) => e.piso === piso.numero).map((e) => e.id)}
              onToggle={(id) => toggle(piso.numero, id)}
              size="web"
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingTop: 14, borderTop: '1px solid #EEF2F9' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, color: '#7C8AA5' }}>
                {sel.length ? `${pax} pasajero${pax > 1 ? 's' : ''} · Puesto${sel.length > 1 ? 's' : ''} ${ordenados.join(' · ')}` : 'Ningún puesto elegido'}
              </span>
              <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
                <Money usd={total} />
              </span>
              {subtotal !== total && <span style={{ fontSize: 12, color: '#7C8AA5' }}>Incluye tasa de terminal y seguro</span>}
            </div>
            <button
              onClick={() => listo && reservar.mutate()}
              disabled={!listo || reservar.isPending}
              style={{ height: 50, padding: '0 30px', borderRadius: 14, border: 'none', background: listo ? '#2563EB' : '#E6EBF4', color: listo ? '#FFFFFF' : '#7C8AA5', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: listo && !reservar.isPending ? 'pointer' : 'default' }}
            >
              {reservar.isPending ? 'Apartando…' : listo ? 'Pagar boleto' : `Elige ${falta === 1 ? '1 puesto' : `${falta} puestos`}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
