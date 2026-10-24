import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crearReserva, getMapaAsientos } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { hora, fechaCorta } from '../../lib/time';
import { Money, MoneyAlt } from '../../components/ui/Money';
import { SeatMap, SeatLegend } from '../../components/seat-map/SeatMap';
import { useBooking } from './useBooking';
import ui from '../../components/ui/ui.module.css';
import styles from './public.module.css';

export default function Asientos() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { seleccionados, toggleAsiento, iniciarCheckout } = useBooking();
  const [pisoActivo, setPisoActivo] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Ocupación en vivo: polling corto mientras el mapa está montado
  const { data: mapa } = useQuery({
    queryKey: ['mapa', id],
    queryFn: () => getMapaAsientos(id!),
    refetchInterval: 4000,
    enabled: Boolean(id),
  });

  const reservar = useMutation({
    mutationFn: (asientos: string[]) => crearReserva(id!, asientos),
    onSuccess: (r) => {
      iniciarCheckout({ salidaId: id!, token: r.token, expiraEn: r.expiraEn, serverTime: r.serverTime, mapa: mapa! });
      navigate('/checkout');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'asientos_no_disponibles') {
        const ocupados = (e.details as { asientos?: string[] })?.asientos ?? [];
        setError(`Alguien tomó ${ocupados.length === 1 ? 'el puesto' : 'los puestos'} ${ocupados.join(', ')} antes que tú. Escoge otros.`);
        queryClient.invalidateQueries({ queryKey: ['mapa', id] });
      } else if (e instanceof ApiError && e.code === 'demasiados_puestos') {
        setError(`Puedes apartar hasta ${(e.details as { maximo?: number })?.maximo ?? 10} puestos por compra.`);
      } else if (e instanceof ApiError && e.code === 'demasiadas_reservas') {
        setError('Apartaste muchos puestos seguidos. Espera unos minutos e intenta de nuevo.');
      } else if (e instanceof ApiError && e.code === 'salida_no_vendible') {
        setError('Esta salida ya no está a la venta (se canceló o ya partió). Busca otra.');
      } else {
        setError('No se pudo apartar. Intenta de nuevo.');
      }
    },
  });

  const piso = mapa?.pisos.find((p) => p.numero === pisoActivo) ?? mapa?.pisos[0];
  const todosSeleccionados = useMemo(
    () => Object.values(seleccionados).flat().sort(),
    [seleccionados]
  );

  const elegidos = useMemo(() => {
    if (!mapa) return [];
    return mapa.pisos.flatMap((p) =>
      (seleccionados[p.numero] ?? []).map((id) => ({
        id,
        piso: p.numero,
        clase: p.nombre,
        precioUsd: Number(mapa.preciosUsd[p.claseServicio] ?? 0),
      }))
    ).sort((a, b) => a.id.localeCompare(b.id));
  }, [mapa, seleccionados]);

  const n = elegidos.length;
  const subtotal = elegidos.reduce((s, e) => s + e.precioUsd, 0);
  const tasa = (mapa?.recargosUsd.tasaTerminal ?? 0) * n;
  const seguro = (mapa?.recargosUsd.seguro ?? 0) * n;
  const total = subtotal + tasa + seguro;

  if (!mapa || !piso) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando mapa…</div>;
  }

  const s = mapa.salida;

  return (
    <div className={styles.layoutAsientos}>
      <div>
        <button className={ui.btnGhost} onClick={() => navigate(-1)}>
          ← Regresar a las salidas
        </button>
        <div style={{ marginTop: 10 }}>
          <h2 className={styles.resultadosH2}>Escoge tu puesto</h2>
          <div className={styles.resultadosSub}>
            Unidad {s.unidad?.numero} · {mapa.resumen.libres} de {mapa.resumen.total} disponibles
          </div>
        </div>

        {error && (
          <div
            style={{
              marginTop: 14,
              background: 'var(--warn-bg)',
              border: '1px solid var(--warn-border-soft)',
              color: 'var(--warn-text-alert)',
              borderRadius: 'var(--r-14)',
              padding: '12px 14px',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div className={styles.tarjetaMapa}>
          <div className={styles.mapaCabecera}>
            {mapa.pisos.map((p) => (
              <button
                key={p.numero}
                className={`${styles.tabPiso} ${p.numero === piso.numero ? styles.tabPisoActivo : ''}`}
                onClick={() => setPisoActivo(p.numero)}
              >
                <span className={styles.tabPisoNombre}>Piso {p.numero}</span>
                <span className={styles.tabPisoSub}>
                  {p.nombre} · {p.totalAsientos} puestos
                </span>
              </button>
            ))}
            <div style={{ marginLeft: 'auto' }}>
              <SeatLegend />
            </div>
          </div>
          <div className={styles.mapaCuerpo}>
            <SeatMap
              piso={piso}
              seleccionados={seleccionados[piso.numero] ?? []}
              onToggle={(id) => {
                setError(null);
                toggleAsiento(piso.numero, id);
              }}
              size="web"
            />
          </div>
        </div>
      </div>

      <aside className={styles.panelViaje}>
        <div className={styles.panelFoto}>Foto de la unidad {s.unidad?.numero}</div>
        <div className={styles.panelCuerpo}>
          <div className={styles.panelKicker}>Tu viaje</div>
          <div className={styles.panelRuta}>
            {s.ruta?.origen} → {s.ruta?.destino}
          </div>
          <div className={styles.panelMeta}>
            {fechaCorta(s.fechaHoraSalida)} · {hora(s.fechaHoraSalida)} — {hora(s.fechaHoraLlegada)} ·{' '}
            {s.unidad?.marcaModelo?.split(' ')[0]}
          </div>
          <div className={styles.divisor} />
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>Puestos escogidos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {elegidos.map((e) => (
              <div key={e.id} className={styles.puestoElegido}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span className={styles.puestoCuadro}>{e.id}</span> {e.clase}
                </span>
                <Money usd={e.precioUsd} style={{ fontWeight: 600 }} />
              </div>
            ))}
            {!n && <div className={styles.vacio}>Toca un asiento en el mapa</div>}
          </div>
          <div className={styles.divisor} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className={styles.desgloseFila}>
              <span>Subtotal</span>
              <Money usd={subtotal} />
            </div>
            <div className={styles.desgloseFila}>
              <span>Tasa de terminal</span>
              <Money usd={tasa} />
            </div>
            <div className={styles.desgloseFila}>
              <span>Seguro de viaje</span>
              <Money usd={seguro} />
            </div>
          </div>
          <div className={styles.totalFila}>
            <span style={{ fontWeight: 700 }}>Total</span>
            <Money usd={total} className={styles.totalGrande} />
          </div>
          <MoneyAlt usd={total} />
          <button
            className={`${ui.btnPrimary} ${ui.btnPrimaryLg}`}
            style={{ marginTop: 14 }}
            disabled={!n || reservar.isPending}
            onClick={() => reservar.mutate(todosSeleccionados)}
          >
            {reservar.isPending ? 'Apartando…' : 'Continuar al pago'}
          </button>
        </div>
      </aside>
    </div>
  );
}
