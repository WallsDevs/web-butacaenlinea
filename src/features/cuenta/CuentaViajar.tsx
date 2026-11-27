import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../stores/auth';
import { getMisBoletos, getWallet } from '../../lib/api/endpoints';
import { fechaCorta, hora } from '../../lib/time';
import { IconoNav } from '../../app/iconos';
import { MODALIDADES, type Modalidad } from '../../lib/api/types';
import { useSeo } from '../../lib/seo';
import { BuscadorPasajes } from '../public/BuscadorPasajes';
import { PaginaPasajero } from './CuentaLayout';
import { useGuia } from '../guia/useGuia';
import styles from './cuenta.module.css';

/** El boleto vigente más cercano: emitido, no anulado y que todavía no salió (o salió hace poco). */
export function proximoViaje<T extends { estado: string; salida?: { fechaHoraSalida: string } }>(boletos: T[]): T | undefined {
  const desde = Date.now() - 2 * 3600_000;
  return boletos
    .filter((b) => b.estado === 'emitido' && b.salida && new Date(b.salida.fechaHoraSalida).getTime() > desde)
    .sort((a, b) => new Date(a.salida!.fechaHoraSalida).getTime() - new Date(b.salida!.fechaHoraSalida).getTime())[0];
}

export default function CuentaViajar() {
  const usuarioId = useAuth(s => s.usuario?.id);
  useSeo('Comprar pasaje — Butaca En Línea', undefined, { noindex: true });
  const [params, setParams] = useSearchParams();
  const modalidad = MODALIDADES.find(m => m.toLowerCase() === params.get('tipo')) ?? 'Nacional';
  const { data: boletos } = useQuery({ queryKey: ['mis-boletos', usuarioId], queryFn: getMisBoletos });
  const { data: wallet } = useQuery({ queryKey: ['wallet', usuarioId], queryFn: getWallet });
  const proximo = proximoViaje(boletos ?? []);
  const iniciarGuia = useGuia((s) => s.iniciar);

  function elegirModalidad(m: Modalidad) {
    const siguientes = new URLSearchParams(params);
    siguientes.set('tipo', m.toLowerCase());
    setParams(siguientes, { replace: true, preventScrollReset: true });
  }

  return (
    <PaginaPasajero
      titulo="Comprar pasaje"
      acciones={
        <Link to="/cuenta/wallet" className={styles.saldoCompra}>
          <IconoNav id="wallet" size={20}/>
          <span>Mi saldo</span>
          {wallet && <strong>Bs {wallet.saldoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>}
        </Link>
      }
    >
      <BuscadorPasajes enPanel modalidad={modalidad} elegirModalidad={elegirModalidad}/>
      {proximo && (
        <Link className={styles.proximo} to={`/boleto/${proximo.qrId}`}>
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
        </Link>
      )}
      <button type="button" className={styles.guiaCompra} onClick={() => iniciarGuia(modalidad === 'Urbano' ? 'pagar-buseta' : 'comprar')}>
        <IconoNav id="ayuda" size={18}/>{modalidad === 'Urbano' ? 'Cómo pagar la buseta' : 'Cómo comprar un pasaje'}
      </button>
    </PaginaPasajero>
  );
}
