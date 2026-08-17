import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getManifiesto, getSalidas, validarQr } from '../../lib/api/endpoints';
import { hora, hoyISO, rangoDia } from '../../lib/time';
import { useAuth } from '../../stores/auth';
import type { Manifiesto, RespuestaValidacion } from '../../lib/api/types';
import {
  DISPOSITIVO_ID,
  manifiestoLocal,
  pendientesDeSincronizar,
  precargarViaje,
  sincronizarOutbox,
  validarLocal,
} from './offline';
import { ScannerView } from './ScannerView';
import { EquipajeStepper } from './EquipajeStepper';
import ui from '../../components/ui/ui.module.css';
import styles from './chofer.module.css';

const TEXTO_RESULTADO: Record<RespuestaValidacion['resultado'], { titulo: string; ok: boolean }> = {
  valido: { titulo: 'Boleto válido', ok: true },
  duplicado: { titulo: 'QR ya validado · duplicado', ok: false },
  vencido: { titulo: 'Boleto vencido', ok: false },
  anulado: { titulo: 'Boleto anulado', ok: false },
  salida_incorrecta: { titulo: 'Es de otra salida', ok: false },
  no_encontrado: { titulo: 'Código no reconocido', ok: false },
};

export default function Escaner() {
  const queryClient = useQueryClient();
  const [salidaId, setSalidaId] = useState<string | null>(null);
  const [resultado, setResultado] = useState<RespuestaValidacion | null>(null);
  const [pausado, setPausado] = useState(false);
  const [manual, setManual] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [resumenLocal, setResumenLocal] = useState<{ abordados: number; faltan: number; piezas: number } | null>(null);

  // Salidas de hoy de la línea (el chófer escoge la suya)
  const { desde, hasta } = rangoDia(hoyISO());
  const usuarioSesion = useAuth((s) => s.usuario);
  const { data: salidas } = useQuery({
    queryKey: ['chofer-salidas', usuarioSesion?.linea?.slug],
    queryFn: () => getSalidas({ desde, hasta, lineaSlug: usuarioSesion?.linea?.slug }),
  });
  useEffect(() => {
    if (!salidaId && salidas?.length) {
      const abordando = salidas.find((s) => s.estado === 'abordando');
      setSalidaId((abordando ?? salidas[0]).documentId);
    }
  }, [salidas, salidaId]);

  // Manifiesto en vivo + precarga a IndexedDB (funciona sin señal después)
  const { data: manifiesto } = useQuery<Manifiesto>({
    queryKey: ['manifiesto', salidaId],
    queryFn: () => getManifiesto(salidaId!),
    enabled: Boolean(salidaId) && !offline,
    refetchInterval: 8000,
  });
  useEffect(() => {
    if (manifiesto && salidaId) {
      precargarViaje(salidaId, manifiesto).catch(() => {});
    }
  }, [manifiesto, salidaId]);

  const refrescarLocal = useCallback(async () => {
    setPendientes(await pendientesDeSincronizar());
    if (salidaId) {
      const filas = await manifiestoLocal(salidaId);
      if (filas.length) {
        const abordados = filas.filter((f) => f.estado === 'abordado');
        setResumenLocal({
          abordados: abordados.length,
          faltan: filas.filter((f) => f.estado === 'pendiente').length,
          piezas: abordados.reduce((s, f) => s + (f.equipajePiezas ?? 0), 0),
        });
      }
    }
  }, [salidaId]);

  // Online/offline + sincronización de la cola
  useEffect(() => {
    const onOnline = async () => {
      setOffline(false);
      await sincronizarOutbox();
      await refrescarLocal();
      queryClient.invalidateQueries({ queryKey: ['manifiesto', salidaId] });
    };
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    sincronizarOutbox().then(refrescarLocal);
    const intervalo = setInterval(() => {
      if (navigator.onLine) sincronizarOutbox().then(refrescarLocal);
    }, 20000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(intervalo);
    };
  }, [salidaId, refrescarLocal, queryClient]);

  useEffect(() => {
    refrescarLocal();
  }, [manifiesto, refrescarLocal]);

  const validar = useCallback(
    async (entrada: { qr?: string; qrId?: string }) => {
      if (!salidaId) return;
      setPausado(true);
      try {
        let r: RespuestaValidacion;
        if (navigator.onLine) {
          r = await validarQr({
            ...entrada,
            salidaId,
            dispositivoId: DISPOSITIVO_ID,
            escaneadoEn: new Date().toISOString(),
            idempotencyKey: crypto.randomUUID(),
          });
          queryClient.invalidateQueries({ queryKey: ['manifiesto', salidaId] });
        } else {
          r = await validarLocal({ ...entrada, salidaId });
        }
        setResultado(r);
        await refrescarLocal();
      } finally {
        setManual(false);
      }
    },
    [salidaId, queryClient, refrescarLocal]
  );

  const salida = salidas?.find((s) => s.documentId === salidaId);
  const resumen = offline && resumenLocal ? resumenLocal : manifiesto
    ? {
        abordados: manifiesto.resumen.abordados,
        faltan: manifiesto.resumen.pendientes,
        piezas: manifiesto.resumen.piezas,
      }
    : resumenLocal ?? { abordados: 0, faltan: 0, piezas: 0 };

  const pendientesManual = (manifiesto?.pasajeros ?? []).filter((p) => p.estado === 'pendiente');
  const info = resultado ? TEXTO_RESULTADO[resultado.resultado] : null;

  return (
    <div className={styles.pantalla}>
      <div className={styles.cabecera}>
        <div className={styles.cabeceraFila}>
          <span className={styles.cabeceraTitulo}>
            Abordaje · Unidad {salida?.unidad?.numero ?? '—'}
          </span>
          <span className={styles.cabeceraMeta}>{salida?.rampa}</span>
        </div>
        {salidas && salidas.length > 1 && (
          <select
            value={salidaId ?? ''}
            onChange={(e) => {
              setSalidaId(e.target.value);
              setResultado(null);
            }}
            style={{
              marginTop: 10,
              width: '100%',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              border: 0,
              borderRadius: 10,
              padding: '8px 10px',
              fontSize: 13,
            }}
          >
            {salidas.map((s) => (
              <option key={s.documentId} value={s.documentId} style={{ color: '#0F172A' }}>
                {hora(s.fechaHoraSalida)} · {s.ruta?.destino} · Unidad {s.unidad?.numero}
              </option>
            ))}
          </select>
        )}
        <div className={styles.contadores}>
          <div className={styles.contador}>
            <div className={styles.contadorLabel}>Abordados</div>
            <div className={styles.contadorValor}>{resumen.abordados}</div>
          </div>
          <div className={styles.contador}>
            <div className={styles.contadorLabel}>Faltan</div>
            <div className={styles.contadorValor}>{resumen.faltan}</div>
          </div>
          <div className={styles.contador}>
            <div className={styles.contadorLabel}>Equipaje</div>
            <div className={styles.contadorValor}>{resumen.piezas}</div>
          </div>
        </div>
      </div>

      <div className={styles.cuerpo}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 20 }}>Validar boletos</span>
          {pendientes > 0 && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--warn-text)',
                background: 'var(--warn-bg)',
                padding: '5px 11px',
                borderRadius: 'var(--r-pill)',
              }}
            >
              {pendientes} por sincronizar
            </span>
          )}
        </div>

        <ScannerView pausado={pausado} onDecode={(raw) => validar({ qr: raw })} />

        {resultado && info && (
          <div className={`${styles.resultado} ${info.ok ? styles.resultadoOk : styles.resultadoBad}`}>
            <div className={styles.resultadoTituloFila}>
              <span
                className={styles.resultadoIcono}
                style={{ background: info.ok ? 'var(--ok-dot)' : 'var(--bad-border)' }}
              >
                {info.ok ? '✓' : '!'}
              </span>
              {info.titulo}
            </div>
            {resultado.boleto && (
              <>
                <div className={styles.resultadoNombre}>
                  Puesto {resultado.boleto.asientoId} · {resultado.boleto.pasajeroNombre}
                </div>
                <div className={styles.resultadoMeta}>{resultado.boleto.pasajeroDocumento}</div>
                {info.ok && !offline ? (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)' }}>
                      Equipaje a bodega
                    </span>
                    <EquipajeStepper
                      qrId={resultado.boleto.qrId}
                      piezas={resultado.boleto.equipajePiezas ?? 0}
                      size="lg"
                      onCambio={refrescarLocal}
                    />
                  </div>
                ) : (
                  <div className={styles.resultadoMeta} style={{ marginTop: 4 }}>
                    {resultado.boleto.equipajePiezas
                      ? `${resultado.boleto.equipajePiezas} maleta${resultado.boleto.equipajePiezas === 1 ? '' : 's'} registrada${resultado.boleto.equipajePiezas === 1 ? '' : 's'}`
                      : 'Sin equipaje registrado'}
                    {offline ? ' · el equipaje se marca con señal' : ''}
                  </div>
                )}
                {resultado.boleto.pagoPorVerificar && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--warn-text)',
                      background: 'var(--warn-bg)',
                      padding: '6px 11px',
                      borderRadius: 'var(--r-pill)',
                      display: 'inline-block',
                    }}
                  >
                    Pago por verificar en taquilla
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className={styles.botonera}>
          <button
            className={`${ui.btnPrimary}`}
            style={{ flex: 1, padding: 15, borderRadius: 'var(--r-14)' }}
            onClick={() => {
              setResultado(null);
              setPausado(false);
            }}
          >
            {resultado ? 'Escanear siguiente' : 'Escaneando…'}
          </button>
          <button className={ui.btnSecondary} onClick={() => setManual((m) => !m)}>
            Manual
          </button>
        </div>

        {manual && (
          <div className={styles.listaManual}>
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-faint)' }}>
              Validación manual · pendientes de abordar
            </div>
            {pendientesManual.map((p) => (
              <button key={p.qrId} className={styles.filaManual} onClick={() => validar({ qrId: p.qrId })}>
                <span className={styles.puestoMini}>{p.asientoId}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{p.pasajeroNombre}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-soft)' }}>
                  {p.pasajeroDocumento}
                </span>
              </button>
            ))}
            {!pendientesManual.length && (
              <div style={{ padding: 14, fontSize: 13, color: 'var(--text-soft)', textAlign: 'center' }}>
                {offline ? 'Sin manifiesto en línea; escanea el QR.' : 'No quedan pasajeros pendientes.'}
              </div>
            )}
          </div>
        )}

        {offline && (
          <div className={styles.avisoOffline}>
            <span className={styles.avisoIcono}>!</span>
            <span className={styles.avisoTexto}>
              Sin señal en la vía: valida offline y sincroniza al llegar.
            </span>
          </div>
        )}

        <div className={styles.resumenAbordo}>
          <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>Abordados</span>
          <span style={{ fontSize: 20, fontWeight: 700 }}>
            {resumen.abordados} / {resumen.abordados + resumen.faltan}
          </span>
        </div>

      </div>
    </div>
  );
}
