import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import styles from './chofer.module.css';

/**
 * Visor del escáner con overlay de marca (marco azul + línea de escaneo).
 * Usa la cámara vía ZXing; si no hay cámara (demo en escritorio), muestra el
 * visor con la indicación y queda el modo manual.
 */
export function ScannerView({
  onDecode,
  pausado,
  hint = 'Enfoca el código del pasajero',
}: {
  onDecode: (raw: string) => void;
  pausado: boolean;
  hint?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [sinCamara, setSinCamara] = useState(false);
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;
  const pausadoRef = useRef(pausado);
  pausadoRef.current = pausado;

  useEffect(() => {
    let cancelado = false;
    const lector = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 300 });
    (async () => {
      try {
        const controles = await lector.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (result && !pausadoRef.current) onDecodeRef.current(result.getText());
        });
        if (cancelado) controles.stop();
        else controlsRef.current = controles;
      } catch {
        if (!cancelado) setSinCamara(true);
      }
    })();
    return () => {
      cancelado = true;
      controlsRef.current?.stop();
    };
  }, []);

  return (
    <div className={styles.visor}>
      {!sinCamara && <video ref={videoRef} className={styles.visorVideo} muted playsInline />}
      <div className={styles.marcoEscaneo}>
        <div className={styles.lineaEscaneo} />
      </div>
      <div className={styles.visorHint}>
        {sinCamara ? 'Sin cámara disponible · usa el modo manual' : hint}
      </div>
    </div>
  );
}
