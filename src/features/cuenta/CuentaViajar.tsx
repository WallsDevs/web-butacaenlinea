import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getMisBoletos, getWallet } from '../../lib/api/endpoints';
import { fechaCorta, hora } from '../../lib/time';
import { useAuth } from '../../stores/auth';
import { useSeo } from '../../lib/seo';
import { BuscadorPasajes } from '../public/BuscadorPasajes';
import { PaginaPasajero } from './CuentaLayout';
import styles from './cuenta.module.css';

/** El boleto vigente más cercano: emitido, no anulado y que todavía no salió (o salió hace poco). */
export function proximoViaje<T extends { estado: string; salida?: { fechaHoraSalida: string } }>(boletos: T[]): T | undefined {
  const desde = Date.now() - 2 * 3600_000;
  return boletos
    .filter((b) => b.estado === 'emitido' && b.salida && new Date(b.salida.fechaHoraSalida).getTime() > desde)
    .sort((a, b) => new Date(a.salida!.fechaHoraSalida).getTime() - new Date(b.salida!.fechaHoraSalida).getTime())[0];
}

/**
 * Inicio del pasajero: su próximo viaje (con el boleto a un toque), su saldo,
 * y el mismo buscador de la página principal para comprar el siguiente
 * pasaje sin salir de su cuenta.
 */
export default function CuentaViajar() {
  useSeo('Viajar — Butaca En Línea', undefined, { noindex: true });
  const navigate = useNavigate();
  const usuario = useAuth((s) => s.usuario);
  const { data: boletos } = useQuery({ queryKey: ['mis-boletos'], queryFn: getMisBoletos });
  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: getWallet });
  const proximo = proximoViaje(boletos ?? []);
  const nombre = (usuario?.nombreCorto ?? usuario?.username ?? '').split(' ')[0];

  return (
    <PaginaPasajero
      titulo={nombre ? `Hola, ${nombre}` : 'Viajar'}
      sub={
        <>
          Busca tu salida, escoge tu puesto y paga en línea.{' '}
          <a href="/ayuda#comprar" onClick={(e) => { e.preventDefault(); navigate('/ayuda#comprar'); }}>¿Primera vez? Así se compra</a>
        </>
      }
    >
      <div className={styles.resumen}>
        {proximo ? (
          <button type="button" className={styles.proximo} onClick={() => navigate(`/boleto/${proximo.qrId}`)}>
            <span className={styles.proximoHora}>
              <b>{hora(proximo.salida!.fechaHoraSalida)}</b>
              <span>{fechaCorta(proximo.salida!.fechaHoraSalida)}</span>
            </span>
            <span className={styles.proximoRuta}>
              <small>Tu próximo viaje</small>
              <b>{proximo.salida?.ruta?.origen} → {proximo.salida?.ruta?.destino}</b>
              <span>Puesto {proximo.asientoId} · {proximo.linea?.nombre}</span>
            </span>
            <span className={styles.proximoVer}>Ver boleto</span>
          </button>
        ) : (
          <div className={`${styles.tarjeta} ${styles.sinViaje}`}>
            <b>No tienes viajes próximos</b>
            <span>Cuando compres un pasaje, tu boleto con QR aparece aquí.</span>
          </div>
        )}
        <div className={`${styles.tarjeta} ${styles.saldo}`}>
          <span>Saldo</span>
          <b>Bs {(wallet?.saldoBs ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</b>
          <a href="/cuenta/wallet" onClick={(e) => { e.preventDefault(); navigate('/cuenta/wallet'); }}>Recargar o pagar busetas →</a>
        </div>
      </div>
      <BuscadorPasajes enPanel />
    </PaginaPasajero>
  );
}
