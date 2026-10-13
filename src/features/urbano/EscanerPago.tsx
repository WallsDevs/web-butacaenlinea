import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ScannerView } from '../chofer/ScannerView';
import { useSeo } from '../../lib/seo';
import ui from '../../components/ui/ui.module.css';

/**
 * Escáner del pasajero (PWA): escanea el QR pegado en la buseta y va directo
 * a la pantalla de pago. Acepta el QR con la URL completa (/pagar/<id>) o un
 * id de unidad a secas. La cámara del navegador requiere HTTPS (en producción
 * siempre; en dev funciona en localhost) — el QR también se puede escanear
 * con la cámara nativa del teléfono, que abre el mismo link.
 */
export default function EscanerPago() {
  useSeo('Pagar pasaje — Butaca En Línea', undefined, { noindex: true });
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const pausado = useRef(false);

  const alLeer = (raw: string) => {
    if (pausado.current) return;
    // QR de buseta (/pagar/<id>), QR de taquilla (/caja/<id>) o documentId pelado
    const porCaja = raw.match(/\/caja\/([A-Za-z0-9]+)/);
    if (porCaja) {
      pausado.current = true;
      navigate(`/caja/${porCaja[1]}`);
      return;
    }
    const porUrl = raw.match(/\/pagar\/([A-Za-z0-9]+)/);
    const id = porUrl?.[1] ?? (/^[A-Za-z0-9]{16,40}$/.test(raw.trim()) ? raw.trim() : null);
    if (id) {
      pausado.current = true;
      navigate(`/pagar/${id}`);
    } else {
      setError(true);
      setTimeout(() => setError(false), 2500);
    }
  };

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', textAlign: 'center' }}>
        Pagar pasaje
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-soft)', textAlign: 'center', margin: '6px 0 16px' }}>
        Escanea el código QR pegado en la buseta.
      </p>

      <ScannerView onDecode={alLeer} pausado={false} hint="Enfoca el QR de la buseta o de la taquilla" />

      {error && (
        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--bad-bg, #fdeaea)',
            color: 'var(--bad-text)',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          Este código no es de una buseta de Butaca En Línea.
        </div>
      )}

      <button
        className={ui.btnSecondary}
        style={{ width: '100%', marginTop: 16 }}
        onClick={() => navigate('/cuenta/wallet')}
      >
        Volver a mi wallet
      </button>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
        También puedes escanear el QR con la cámara normal de tu teléfono: abre esta misma
        pantalla de pago.
      </p>
    </div>
  );
}
