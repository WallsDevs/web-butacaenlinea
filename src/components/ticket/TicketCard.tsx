import { useId, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Isotipo } from '../brand/LogoMark';
import { Money, MoneyAlt } from '../ui/Money';
import { StatusChip, type TonoChip } from '../ui/StatusChip';
import autobus from './autobus.jpg';
import marcaQr from './marca-qr.svg?inline';
import styles from './TicketCard.module.css';

export interface TicketData {
  folio?: string;
  codigo?: string;
  qrValue?: string;
  lineaNombre?: string;
  unidad?: string;
  tipo?: 'Nacional' | 'Urbano';
  origen: string;
  destino: string;
  salidaHora: string;
  llegadaHora: string;
  fecha?: string;
  puestos?: string;
  piso?: string;
  rampa?: string;
  aborda?: string;
  pasajeroNombre?: string;
  pasajeroDoc?: string;
  totalUsd?: number;
  estadoChip?: { tono: TonoChip; label: string };
  anulado?: boolean;
}

const dibujos = {
  boleto: <><path d="m3 13 10-10 3 3a2.8 2.8 0 0 0 4 4l2 2-10 10-3-3a2.8 2.8 0 0 0-4-4z"/><path d="m12 8 1 1m2 2 1 1"/></>,
  bus: <><rect x="3.5" y="3.5" width="17" height="15" rx="3"/><path d="M4 12h16M6 19v2m12-2v2M7 15h1m8 0h1"/></>,
  dia: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2.5v5m10-5v5M3 10h18"/></>,
  puesto: <><path d="m5 14 1-11h12l1 11M3 21v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 17h18"/></>,
  piso: <><path d="m2 8 10-5 10 5-10 5zM2 13l10 5 10-5M2 17l10 5 10-5"/></>,
};

function Icono({ nombre }: { nombre: keyof typeof dibujos }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{dibujos[nombre]}</svg>;
}

/** Mantiene cada módulo del QR en píxeles enteros, incluso en pantallas de baja densidad. */
function ajustarQr(svg: SVGSVGElement | null) {
  if (!svg) return;
  const modulos = svg.viewBox.baseVal.width;
  const ancho = modulos * Math.max(1, Math.floor(248 / modulos));
  svg.style.setProperty('--ancho-qr', ancho + 'px');
}

export function TicketCard({ data, variant = 'emitido', footer }: {
  data: TicketData;
  variant?: 'hero' | 'checkout' | 'emitido' | 'compact';
  footer?: ReactNode;
}) {
  const id = useId();
  const muestra = variant === 'hero';
  const resumen = variant === 'compact';
  const qr = muestra ? 'BUTACA-BOLETO-DE-MUESTRA' : data.qrValue;
  const porEmitir = variant === 'checkout';
  const tieneDetalles = data.pasajeroNombre || data.estadoChip || data.totalUsd != null || data.rampa || data.aborda;

  return (
    <article aria-label={muestra ? 'Boleto electrónico de muestra' : 'Boleto electrónico'} className={muestra ? `${styles.ticket} ${styles.ticketMuestra}` : styles.ticket}>
      <div className={`${styles.papel} ${muestra ? styles.muestra : ''} ${resumen ? styles.resumen : ''}`}>
        <header className={styles.cabecera}>
          <svg className={styles.onda} viewBox="0 0 1000 105" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={id + '-azul'} x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#073888"/><stop offset=".68" stopColor="#0655b2"/><stop offset="1" stopColor="#002b70"/></linearGradient>
              <linearGradient id={id + '-cielo'}><stop stopColor="#24c7ff"/><stop offset=".55" stopColor="#0392ff"/><stop offset="1" stopColor="#0647bf"/></linearGradient>
            </defs>
            <path fill={`url(#${id}-cielo)`} d="M0 0H1000V54C950 8 881 12 810 35C732 60 685 87 571 89L38 91Q10 91 0 105Z"/>
            <path fill={`url(#${id}-azul)`} d="M0 0H750C696 8 680 81 556 88C406 92 156 89 38 91Q10 91 0 105Z"/>
          </svg>
          <span className={styles.marca}><Isotipo size={36} contorno="#fff" acento="#36bcff"/><span><b>Butaca</b><small>EN LÍNEA</small></span></span>
          <span className={styles.titulo}><Icono nombre="boleto"/>Boleto electrónico</span>
        </header>
        <div className={styles.cuerpo}>
          <div className={styles.viaje}>
            <div className={styles.identidad}>
              <span className={styles.tipo}><Icono nombre="bus"/>{data.tipo ?? 'Nacional'}</span>
              {data.folio && <span className={styles.folio}><span>N.º de boleto</span><b>{data.folio}</b></span>}
            </div>
            <div className={styles.ruta}>
              <div><b aria-label={`Salida ${data.salidaHora}`}>{data.salidaHora || '—'}</b><span>{data.origen || '—'}</span></div>
              <span className={styles.tramo} aria-hidden="true"/>
              <div><b aria-label={`Llegada ${data.llegadaHora}`}>{data.llegadaHora || '—'}</b><span>{data.destino || '—'}</span></div>
            </div>
            <div className={styles.datos}>
              {data.fecha && <span><Icono nombre="dia"/><b>{data.fecha}</b></span>}
              {data.puestos && <span><Icono nombre="puesto"/><span>{data.puestos.includes('·') ? 'Puestos' : 'Puesto'} <b className={styles.asiento}>{data.puestos}</b></span></span>}
              {data.piso && <span><Icono nombre="piso"/><span>Piso <b>{data.piso}</b></span></span>}
            </div>
            <div className={styles.transporte}>
              <img src={autobus} width="359" height="164" alt=""/>
              <div><small>Transportista</small><b>{data.lineaNombre || 'Por asignar'}</b></div>
              <div><small>Unidad</small><b>{data.unidad || 'Por asignar'}</b></div>
            </div>
          </div>
          <div className={styles.talon}>
            {resumen ? <span className={styles.ver}>Ver boleto →</span>
              : data.anulado ? <strong>Boleto anulado</strong>
              : qr ? <QRCodeSVG key={qr} ref={muestra ? undefined : ajustarQr} value={qr} size={256} level={muestra ? 'H' : 'Q'} marginSize={4} fgColor="#091a33"
                    title={muestra ? 'QR de muestra' : 'Código QR de abordaje'}
                    imageSettings={{ src: marcaQr, width: muestra ? 44 : 32, height: muestra ? 44 : 32, excavate: true }}/>
              : <strong>{porEmitir ? 'Por emitir' : 'QR no disponible'}</strong>}
            {!resumen && <p>{muestra ? 'Boleto de muestra' : data.anulado ? 'No sirve para abordar' : qr ? 'Presenta este código al abordar' : porEmitir ? 'El QR aparece al emitir el boleto' : 'En el terminal te ubican por el folio'}</p>}
            {!resumen && !muestra && !porEmitir && data.codigo && <small>{data.codigo}</small>}
          </div>
        </div>
      </div>
      {(tieneDetalles || footer) && <div className={styles.anexo}>
        {tieneDetalles && <div className={styles.detalles}>
          {data.pasajeroNombre && <span><b>{data.pasajeroNombre}</b>{data.pasajeroDoc && <small>{data.pasajeroDoc}</small>}</span>}
          {data.rampa && <span>Rampa <b>{data.rampa}</b></span>}
          {data.aborda && <span>Aborda <b>{data.aborda}</b></span>}
          {data.estadoChip && <StatusChip tono={data.estadoChip.tono} size="sm">{data.estadoChip.label}</StatusChip>}
          {data.totalUsd != null && <span className={styles.total}>Total <b><Money usd={data.totalUsd}/></b><MoneyAlt usd={data.totalUsd}/></span>}
        </div>}
        {footer && <div className="no-print">{footer}</div>}
      </div>}
    </article>
  );
}
