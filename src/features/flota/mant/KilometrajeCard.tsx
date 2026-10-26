import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { anotarTablero, getKmUnidad } from '../../../lib/api/endpoints';
import type { KmUnidad } from '../../../lib/api/types';
import { Field } from '../../../components/ui/Field';
import ui from '../../../components/ui/ui.module.css';
import styles from '../flota.module.css';
import { ErrorLinea, Modal, diaLargo, enteroDe, km, mensajeError } from './comun';

/**
 * Kilometraje de la unidad: el odómetro lo sube el GPS de la app del
 * conductor cada noche; aquí se ve cuánto anduvo cada día y se anota de vez
 * en cuando lo que marca el tablero para corregir la diferencia.
 */
export function KilometrajeCard({ unidadId, kilometraje, esEmpresa }: { unidadId: string; kilometraje: number; esEmpresa: boolean }) {
  const [anotando, setAnotando] = useState(false);
  const { data } = useQuery({ queryKey: ['km-unidad', unidadId], queryFn: () => getKmUnidad(unidadId, 30) });
  const odometro = data?.kilometraje ?? kilometraje;

  return (
    <div className={styles.tarjeta}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div className={styles.kicker}>Kilometraje</div>
        <button className={ui.btnGhost} style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 10px' }} onClick={() => setAnotando(true)}>
          Anotar tablero
        </button>
      </div>
      <div className={styles.cifraKm}>{km(odometro)}</div>
      <div className={styles.notaKm}>
        km en el odómetro
        {data?.hoyKm ? ` · hoy +${km(data.hoyKm)} km por GPS` : ''}
      </div>
      <div className={styles.kmCifras}>
        <span><strong>{km(data?.semanaKm)}</strong> últimos 7 días</span>
        <span><strong>{km(data?.mesKm)}</strong> últimos 30 días</span>
        <span><strong>{km(data?.promedioSemanaKm)}</strong> promedio / semana</span>
      </div>
      {data && <GraficoKm dias={data.dias} />}
      {data && !data.conGps && (
        <p className={styles.notaSuave}>
          Todavía no hay recorridos del GPS. El km sube solo cuando el conductor abre su turno o jornada en la app; mientras tanto, anota el tablero.
        </p>
      )}
      {data?.ajustes[0] && (
        <p className={styles.notaSuave}>
          Última lectura del tablero: {km(data.ajustes[0].kilometraje)} km ({data.ajustes[0].km > 0 ? '+' : ''}{km(data.ajustes[0].km)} sobre el GPS) · {diaLargo(data.ajustes[0].fecha.slice(0, 10))}
        </p>
      )}
      {anotando && <ModalTablero unidadId={unidadId} actual={odometro} esEmpresa={esEmpresa} onCerrar={() => setAnotando(false)} />}
    </div>
  );
}

/** Barras de km por día: una sola serie, sin leyenda; el detalle aparece al pasar el dedo o el mouse. */
function GraficoKm({ dias }: { dias: KmUnidad['dias'] }) {
  const [foco, setFoco] = useState<number | null>(null);
  const ancho = 300;
  const alto = 72;
  const n = dias.length;
  const paso = ancho / n;
  const barra = Math.max(2, paso - 2); // 2 de separación entre barras
  const max = Math.max(1, ...dias.map((d) => d.km));
  const elegido = foco != null ? dias[foco] : null;
  const total = dias.reduce((s, d) => s + d.km, 0);

  // Barra con las puntas de arriba redondeadas y la base recta sobre el eje
  const ruta = (x: number, h: number) => {
    const r = Math.min(2, barra / 2, h);
    const y = alto - h;
    return `M${x},${alto} V${y + r} Q${x},${y} ${x + r},${y} H${x + barra - r} Q${x + barra},${y} ${x + barra},${y + r} V${alto} Z`;
  };

  return (
    <div className={styles.graficoKm}>
      <div className={styles.graficoKmCabecera} aria-live="polite">
        {elegido ? (
          <>
            <strong>{km(elegido.km)} km</strong> · {diaLargo(elegido.fecha)}
            {elegido.kmGps != null ? ' · GPS' : elegido.kmViajes ? ' · viajes' : ''}
          </>
        ) : (
          <>Km por día · máx. {km(max)}</>
        )}
      </div>
      <svg viewBox={`0 0 ${ancho} ${alto + 1}`} preserveAspectRatio="none" className={styles.graficoKmSvg} role="img" aria-label={`Km por día en los últimos ${n} días: ${km(total)} km en total`} onMouseLeave={() => setFoco(null)}>
        <line x1="0" x2={ancho} y1={alto / 2} y2={alto / 2} className={styles.graficoKmGuia} />
        {dias.map((d, i) => {
          const h = d.km > 0 ? Math.max(2, (d.km / max) * (alto - 4)) : 0;
          return h > 0 ? <path key={d.fecha} d={ruta(i * paso + 1, h)} className={foco === i ? styles.graficoKmBarraFoco : styles.graficoKmBarra} /> : null;
        })}
        <line x1="0" x2={ancho} y1={alto + 0.5} y2={alto + 0.5} className={styles.graficoKmEje} />
        {dias.map((d, i) => (
          <rect key={`h-${d.fecha}`} x={i * paso} y={0} width={paso} height={alto + 1} fill="transparent" onMouseEnter={() => setFoco(i)} onClick={() => setFoco(i)} />
        ))}
      </svg>
      <div className={styles.graficoKmPie}>
        <span>{dias[0] ? diaLargo(dias[0].fecha) : ''}</span>
        <span>ayer</span>
      </div>
      <details className={styles.tablaOculta}>
        <summary>Ver como tabla</summary>
        <table className={styles.tabla}>
          <thead><tr><th>Día</th><th>Km</th><th>Fuente</th></tr></thead>
          <tbody>
            {[...dias].reverse().filter((d) => d.km > 0).map((d) => (
              <tr key={d.fecha}><td>{diaLargo(d.fecha)}</td><td>{km(d.km)}</td><td>{d.kmGps != null ? 'GPS' : 'Viajes'}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function ModalTablero({ unidadId, actual, esEmpresa, onCerrar }: { unidadId: string; actual: number; esEmpresa: boolean; onCerrar: () => void }) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [corregir, setCorregir] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valor = enteroDe(texto);
  const menor = valor != null && valor < actual;
  const guardar = useMutation({
    mutationFn: () => anotarTablero(unidadId, valor!, menor && corregir),
    onSuccess: () => {
      for (const k of ['km-unidad', 'unidad', 'plan', 'alertas', 'cauchos', 'resumen-mant']) void queryClient.invalidateQueries({ queryKey: [k, unidadId] });
      onCerrar();
    },
    onError: (e) => setError(mensajeError(e)),
  });
  const diferencia = valor != null ? valor - actual : null;

  return (
    <Modal
      titulo="Anotar el tablero"
      nota="Escribe lo que marca el odómetro del tablero. La diferencia con lo que contó el GPS queda registrada y el odómetro de la unidad pasa a ese valor."
      onCerrar={onCerrar}
    >
      <Field label="Km del tablero" inputMode="numeric" placeholder={km(actual)} value={texto} onChange={(e) => { setTexto(e.target.value); setError(null); }} autoFocus />
      {diferencia != null && diferencia !== 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
          Sistema {km(actual)} · tablero {km(valor)} · ajuste <strong style={{ color: 'var(--text)' }}>{diferencia > 0 ? '+' : ''}{km(diferencia)} km</strong>
        </div>
      )}
      {menor && esEmpresa && (
        <label style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={corregir} onChange={(e) => setCorregir(e.target.checked)} />
          <span>El GPS contó de más: bajar el odómetro a {km(valor)} km.</span>
        </label>
      )}
      {menor && !esEmpresa && <ErrorLinea texto="El tablero marca menos que el sistema. Avísale a la empresa para que lo corrija." />}
      <ErrorLinea texto={error} />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className={ui.btnSecondary} onClick={onCerrar}>Cancelar</button>
        <button className={ui.btnPrimary} disabled={valor == null || diferencia === 0 || (menor && !corregir) || guardar.isPending} onClick={() => guardar.mutate()}>
          {guardar.isPending ? 'Guardando…' : 'Guardar lectura'}
        </button>
      </div>
    </Modal>
  );
}
