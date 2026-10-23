import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getMisBoletos } from '../../lib/api/endpoints';
import type { BoletoMio } from '../../lib/api/types';
import { hora, fechaCorta } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import { PaginaPasajero } from './CuentaLayout';
import styles from './cuenta.module.css';

const CHIP: Record<string, { tono: 'ok' | 'warn' | 'bad' | 'neutral'; label: string }> = {
  abordado: { tono: 'ok', label: 'Abordado' },
  anulado: { tono: 'bad', label: 'Anulado' },
  no_show: { tono: 'neutral', label: 'No viajó' },
};

/** Un boleto como el de papel: la ruta y la hora, y el talón con el puesto. */
function Boleto({ b, pasado }: { b: BoletoMio; pasado?: boolean }) {
  const navigate = useNavigate();
  const chip = b.estadoPago === 'por_verificar' ? { tono: 'warn' as const, label: 'Pago por verificar' } : CHIP[b.estado] ?? { tono: 'ok' as const, label: 'Pagado' };
  return (
    <button type="button" className={`${styles.boleto} ${pasado ? styles.boletoPasado : ''}`} onClick={() => navigate(`/boleto/${b.qrId}`)}>
      <span className={styles.boletoCuerpo}>
        <span className={styles.boletoRuta}>{b.salida?.ruta?.origen} → {b.salida?.ruta?.destino}</span>
        <span className={styles.boletoCuando}>
          <b>{b.salida ? hora(b.salida.fechaHoraSalida) : '—'}</b>
          <span>{b.salida ? fechaCorta(b.salida.fechaHoraSalida) : ''}{b.salida?.fechaHoraLlegada ? ` · llega ${hora(b.salida.fechaHoraLlegada)}` : ''}</span>
        </span>
        <span className={styles.boletoDatos}>{b.linea?.nombre} · {b.pasajeroNombre} · {b.folio}</span>
        <span><StatusChip tono={chip.tono} size="sm">{chip.label}</StatusChip></span>
      </span>
      <span className={styles.talon}>
        <span>Puesto</span>
        <b>{b.asientoId}</b>
      </span>
    </button>
  );
}

/** Mis boletos: los próximos viajes primero, luego los anteriores. Cada boleto abre su QR. */
export default function MisBoletos() {
  const navigate = useNavigate();
  const { data: boletos, isLoading } = useQuery({ queryKey: ['mis-boletos'], queryFn: getMisBoletos });
  const ahora = Date.now() - 2 * 3600_000;
  const cuando = (b: BoletoMio) => (b.salida ? new Date(b.salida.fechaHoraSalida).getTime() : 0);
  const proximos = (boletos ?? []).filter((b) => b.estado === 'emitido' && cuando(b) > ahora).sort((a, b) => cuando(a) - cuando(b));
  const anteriores = (boletos ?? []).filter((b) => !proximos.includes(b)).sort((a, b) => cuando(b) - cuando(a));

  return (
    <PaginaPasajero
      titulo="Mis boletos"
      sub={boletos?.length ? 'Toca un boleto para ver su QR: es lo que muestras al abordar.' : 'Los pasajes que compres con esta cuenta.'}
      // Con boletos, comprar otro es un enlace; sin boletos, el enlace va en el aviso (no dos botones iguales)
      acciones={boletos?.length ? <button type="button" className={styles.enlace} onClick={() => navigate('/cuenta')}>Comprar otro pasaje</button> : undefined}
    >
      {isLoading && <div style={{ padding: 24, color: 'var(--text-soft)' }}>Cargando…</div>}
      {!isLoading && !boletos?.length && (
        <div className={styles.vacio}>
          <b>Todavía no tienes boletos</b>
          <span>Cuando compres un pasaje con tu cuenta, aparece aquí con su QR para abordar.</span>
          <button type="button" className={styles.enlace} onClick={() => navigate('/cuenta')}>Buscar salidas</button>
        </div>
      )}
      {proximos.length > 0 && (
        <section className={styles.grupo}>
          <div className={styles.grupoTitulo}>Próximos viajes · {proximos.length}</div>
          <div className={styles.boletos}>{proximos.map((b) => <Boleto key={b.qrId} b={b} />)}</div>
        </section>
      )}
      {anteriores.length > 0 && (
        <section className={styles.grupo}>
          <div className={styles.grupoTitulo}>Anteriores · {anteriores.length}</div>
          <div className={styles.boletos}>{anteriores.map((b) => <Boleto key={b.qrId} b={b} pasado />)}</div>
        </section>
      )}
    </PaginaPasajero>
  );
}
