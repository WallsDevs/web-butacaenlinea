import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../stores/auth';
import { getMisBoletos } from '../../lib/api/endpoints';
import { NOMBRE_TIPO_VIAJE, type BoletoMio } from '../../lib/api/types';
import { hora, fechaConAnio } from '../../lib/time';
import { TicketCard } from '../../components/ticket/TicketCard';
import { PaginaPasajero } from './CuentaLayout';
import styles from './cuenta.module.css';

const CHIP: Record<string, { tono: 'ok' | 'warn' | 'bad' | 'neutral'; label: string }> = {
  abordado: { tono: 'ok', label: 'Abordado' },
  anulado: { tono: 'bad', label: 'Anulado' },
  no_show: { tono: 'neutral', label: 'No viajó' },
};

function Boleto({ b }: { b: BoletoMio }) {
  const chip = CHIP[b.estado] ?? (b.estadoPago === 'por_verificar'
    ? { tono: 'warn' as const, label: 'Pago por verificar' }
    : b.estadoPago === 'rechazado'
      ? { tono: 'bad' as const, label: 'Pago rechazado' }
      : { tono: 'ok' as const, label: 'Pagado' });
  return (
    <Link to={`/boleto/${b.qrId}`} className={styles.boleto}>
      <TicketCard variant="compact" data={{
        folio: b.folio,
        tipo: NOMBRE_TIPO_VIAJE[b.salida?.ruta?.tipoViaje ?? 'nacional'],
        lineaNombre: b.linea?.nombre,
        unidad: b.salida?.unidad?.numero,
        origen: b.salida?.ruta?.origen ?? '',
        destino: b.salida?.ruta?.destino ?? '',
        salidaHora: b.salida ? hora(b.salida.fechaHoraSalida) : '',
        llegadaHora: b.salida?.fechaHoraLlegada ? hora(b.salida.fechaHoraLlegada) : '',
        fecha: b.salida ? fechaConAnio(b.salida.fechaHoraSalida) : undefined,
        puestos: b.asientoId,
        pasajeroNombre: b.pasajeroNombre,
        estadoChip: chip,
      }}/>
    </Link>
  );
}

/** Mis boletos: los próximos viajes primero, luego los anteriores. Cada boleto abre su QR. */
export default function MisBoletos() {
  const usuarioId = useAuth(s => s.usuario?.id);
  const navigate = useNavigate();
  const { data: boletos, isLoading } = useQuery({ queryKey: ['mis-boletos', usuarioId], queryFn: getMisBoletos });
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
          <div className={styles.boletos}>{anteriores.map((b) => <Boleto key={b.qrId} b={b} />)}</div>
        </section>
      )}
    </PaginaPasajero>
  );
}
