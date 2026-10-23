import { Isotipo } from '../brand/LogoMark';
import { QRCodeSVG } from 'qrcode.react';
import { StatusChip } from '../ui/StatusChip';
import { Money, MoneyAlt } from '../ui/Money';
import styles from './TicketCard.module.css';

export interface TicketData {
  folio?: string;
  codigo?: string; // texto bajo el QR (qrId recortado)
  qrValue?: string; // JWS firmado que codifica el QR real
  lineaNombre?: string;
  origen: string;
  destino: string;
  salidaHora: string;
  llegadaHora: string;
  fecha?: string;
  puestos: string;
  piso: string;
  rampa?: string;
  aborda?: string;
  pasajeroNombre?: string;
  pasajeroDoc?: string;
  equipaje?: string;
  totalUsd?: number;
  estadoChip?: { tono: 'ok' | 'warn' | 'bad' | 'neutral'; label: string };
}

/**
 * Tarjeta de boleto — el componente de marca reutilizado en el hero, el
 * checkout, el POS y el boleto móvil. Troquel punteado antes del QR; el QR
 * codifica el token firmado del servidor, nunca el folio en claro.
 */
export function TicketCard({
  data,
  variant = 'checkout',
  footer,
}: {
  data: TicketData;
  variant?: 'hero' | 'checkout' | 'movil' | 'compact';
  footer?: React.ReactNode;
}) {
  const esHero = variant === 'hero';
  const esMovil = variant === 'movil' || variant === 'compact';

  return (
    <div className={`${styles.card} ${esHero ? styles.cardHero : ''}`}>
      <div className={styles.header}>
        <span className={styles.headerLogo} aria-hidden>
          <Isotipo size={22} trazo={5} fondo="claro" />
        </span>
        <span className={styles.headerTitle}>Boleto electrónico</span>
        {data.folio && <span className={styles.headerFolio}>{data.folio}</span>}
      </div>

      <div className={styles.body} style={esMovil ? { padding: 18 } : undefined}>
        {!esHero && data.lineaNombre && (
          <>
            <div className={styles.linea}>{data.lineaNombre}</div>
            <div className={styles.rutaFecha}>
              {data.origen} → {data.destino}
              {data.fecha ? ` · ${data.fecha}` : ''}
            </div>
          </>
        )}
        <div className={styles.horas} style={esHero ? { marginTop: 0 } : undefined}>
          <div>
            <div className={styles.horaLabel}>SALE</div>
            <div className={`${styles.horaValor} ${esHero ? styles.horaValorLg : ''}`}>
              {data.salidaHora}
            </div>
            {esHero && <div className={styles.horaCiudad}>{data.origen}</div>}
          </div>
          <div className={styles.tramo} />
          <div style={{ textAlign: 'right' }}>
            <div className={styles.horaLabel}>LLEGA</div>
            <div className={`${styles.horaValor} ${esHero ? styles.horaValorLg : ''}`}>
              {data.llegadaHora}
            </div>
            {esHero && <div className={styles.horaCiudad}>{data.destino}</div>}
          </div>
        </div>

        <div className={`${styles.datos} ${esHero || esMovil ? styles.datos3 : styles.datos4}`}>
          <div className={styles.dato}>
            <div className={styles.datoLabel}>{data.puestos.includes('·') ? 'Puestos' : 'Puesto'}</div>
            <div className={styles.datoValor}>{data.puestos}</div>
          </div>
          <div className={styles.dato}>
            <div className={styles.datoLabel}>Piso</div>
            <div className={styles.datoValor}>{data.piso}</div>
          </div>
          {data.rampa && (
            <div className={styles.dato}>
              <div className={styles.datoLabel}>Rampa</div>
              <div className={styles.datoValor}>{data.rampa}</div>
            </div>
          )}
          {!esHero && !esMovil && data.aborda && (
            <div className={styles.dato}>
              <div className={styles.datoLabel}>Aborda</div>
              <div className={styles.datoValor}>{data.aborda}</div>
            </div>
          )}
        </div>
      </div>

      {esHero ? (
        <div className={`${styles.troquel} ${styles.zonaQrHero}`}>
          <span className={styles.qrMarco} style={{ padding: 6, borderRadius: 12 }}>
            <QRCodeSVG value={data.qrValue ?? data.codigo ?? 'butacaenlinea.com'} size={80} level="M" />
          </span>
          <div>
            <div className={styles.heroNombre}>{data.pasajeroNombre}</div>
            <div className={styles.heroDoc}>
              {data.pasajeroDoc}
              {data.equipaje ? ` · ${data.equipaje}` : ''}
            </div>
            {data.estadoChip && (
              <div style={{ marginTop: 8 }}>
                <StatusChip tono={data.estadoChip.tono} dot={data.estadoChip.tono === 'ok'}>
                  {data.estadoChip.label}
                </StatusChip>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={`${styles.troquel} ${styles.zonaQr}`}>
          <span className={styles.qrMarco}>
            <QRCodeSVG
              value={data.qrValue ?? data.codigo ?? 'butacaenlinea.com'}
              size={esMovil ? 140 : 150}
              level="M"
            />
          </span>
          {data.codigo && <div className={styles.qrCodigo}>{data.codigo}</div>}
          {esMovil && data.pasajeroNombre && (
            <div className={styles.qrNombre}>
              {data.pasajeroNombre}
              {data.pasajeroDoc ? ` · ${data.pasajeroDoc}` : ''}
            </div>
          )}
        </div>
      )}

      {(data.totalUsd != null || footer) && (
        <div className={styles.footer}>
          {data.totalUsd != null && (
            <>
              <div className={styles.totalFila}>
                <span className={styles.totalLabel}>Total</span>
                <Money usd={data.totalUsd} className={styles.totalValor} />
              </div>
              <MoneyAlt usd={data.totalUsd} />
            </>
          )}
          {footer}
        </div>
      )}
    </div>
  );
}
