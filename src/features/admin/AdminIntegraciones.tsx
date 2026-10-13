import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarIntegracion,
  crearIntegracion,
  getAdminContratos,
  getEntregasIntegracion,
  getIntegraciones,
  probarWebhook,
  reintentarEntrega,
  rotarClaveIntegracion,
  rotarSecretoIntegracion,
  type Integracion,
  type IntegracionConSecretos,
} from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { fechaCorta, hora } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const MENSAJES: Record<string, string> = {
  integracion_ya_activa: 'Esa línea ya tiene una integración activa.',
  webhook_url_invalida: 'La URL del webhook no es válida (en producción, solo https y fuera de redes privadas).',
  payload_invalido: 'Faltan datos.',
};
const cuando = (iso: string | null) => (iso ? `${fechaCorta(iso)} ${hora(iso)}` : '—');
const CHIP_ENTREGA = { pendiente: 'warn', entregado: 'ok', fallido: 'bad' } as const;

/**
 * Integraciones: la clave de API con la que la boletería (o el sistema) de una
 * línea habla con Butaca — catálogo, asientos vendidos, ventas y rastreo — y
 * el webhook con el que Butaca le avisa de lo que vende. La clave y el secreto
 * se muestran UNA vez, al crearlos o rotarlos.
 */
export default function AdminIntegraciones() {
  const queryClient = useQueryClient();
  const [creando, setCreando] = useState(false);
  const [secretos, setSecretos] = useState<IntegracionConSecretos | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: integraciones, isLoading } = useQuery({ queryKey: ['admin-integraciones'], queryFn: getIntegraciones });
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['admin-integraciones'] });
  const alFallar = (e: unknown) => setError(e instanceof ApiError ? (MENSAJES[e.code] ?? e.code) : 'No se pudo completar.');

  const rotarClave = useMutation({ mutationFn: rotarClaveIntegracion, onSuccess: (r) => { setSecretos(r); void refrescar(); }, onError: alFallar });
  const rotarSecreto = useMutation({ mutationFn: rotarSecretoIntegracion, onSuccess: (r) => { setSecretos(r); void refrescar(); }, onError: alFallar });
  const alternar = useMutation({ mutationFn: (i: Integracion) => actualizarIntegracion(i.documentId, { activa: !i.activa }), onSuccess: () => void refrescar(), onError: alFallar });

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Integraciones</h2>
        <button className={ui.btnPrimary} style={{ marginLeft: 'auto', fontSize: 14, padding: '12px 20px' }} onClick={() => { setError(null); setCreando(true); }}>
          Nueva integración
        </button>
      </div>
      <p style={{ color: 'var(--text-soft)', fontSize: 14, marginBottom: 16, maxWidth: 760 }}>
        Para las líneas con su propio sistema de boletería (plan Solo boletería) o que quieren rastrear su flota por API.
        Cada línea tiene una integración activa: su sistema carga las rutas y salidas, ocupa y libera asientos, y recibe por
        webhook lo que Butaca vende. Documentación para su equipo técnico: <code>docs/API-INTEGRACION.md</code>.
      </p>
      {error && <p style={{ color: 'var(--bad-text)', fontSize: 13, marginBottom: 10 }}>{error}</p>}

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Línea</th>
              <th>Integración</th>
              <th>Clave</th>
              <th>Webhook</th>
              <th>Último uso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(integraciones ?? []).map((i) => (
              <>
                <tr key={i.documentId}>
                  <td style={{ fontWeight: 600 }}>{i.linea.nombre}</td>
                  <td>
                    {i.nombre} {i.activa ? <StatusChip tono="ok" size="sm">Activa</StatusChip> : <StatusChip tono="neutral" size="sm">Inactiva</StatusChip>}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>btk_{i.clavePrefijo}_…</td>
                  <td style={{ fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.webhookUrl ?? '—'}</td>
                  <td style={{ color: 'var(--text-soft)', fontSize: 13 }}>{cuando(i.ultimoUsoEn)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className={ui.btnGhost} style={{ fontSize: 13, marginRight: 8 }} onClick={() => setAbierta(abierta === i.documentId ? null : i.documentId)}>
                      {abierta === i.documentId ? 'Ocultar' : 'Entregas'}
                    </button>
                    <button className={ui.btnGhost} style={{ fontSize: 13, marginRight: 8 }} onClick={() => confirm('Rotar la clave invalida la actual al instante. ¿Seguro?') && rotarClave.mutate(i.documentId)}>
                      Rotar clave
                    </button>
                    <button style={{ fontSize: 13, fontWeight: 600, color: i.activa ? 'var(--bad-text)' : 'var(--ok-text)' }} onClick={() => alternar.mutate(i)}>
                      {i.activa ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
                {abierta === i.documentId && (
                  <tr key={`${i.documentId}-e`}>
                    <td colSpan={6} style={{ background: 'var(--pill-bg)' }}>
                      <Entregas integracion={i} onRotarSecreto={() => rotarSecreto.mutate(i.documentId)} />
                    </td>
                  </tr>
                )}
              </>
            ))}
            {!isLoading && !integraciones?.length && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 24 }}>Todavía no hay integraciones.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {creando && <NuevaIntegracion onCerrar={() => setCreando(false)} onCreada={(r) => { setCreando(false); setSecretos(r); void refrescar(); }} />}
      {secretos && <Secretos datos={secretos} onCerrar={() => setSecretos(null)} />}
    </div>
  );
}

function Entregas({ integracion, onRotarSecreto }: { integracion: Integracion; onRotarSecreto: () => void }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['entregas', integracion.documentId], queryFn: () => getEntregasIntegracion(integracion.documentId), refetchInterval: 10_000 });
  const reintentar = useMutation({ mutationFn: (id: string) => reintentarEntrega(integracion.documentId, id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas', integracion.documentId] }) });
  const probar = useMutation({ mutationFn: () => probarWebhook(integracion.documentId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas', integracion.documentId] }) });
  return (
    <div style={{ padding: '8px 4px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>Entregas del webhook</strong>
        {integracion.webhookConfigurado ? (
          <>
            <button className={ui.btnGhost} style={{ fontSize: 12 }} onClick={() => probar.mutate()}>Enviar ping de prueba</button>
            <button className={ui.btnGhost} style={{ fontSize: 12 }} onClick={() => confirm('Rotar el secreto invalida las firmas con el anterior. ¿Seguro?') && onRotarSecreto()}>Rotar secreto</button>
          </>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Sin webhook configurado.</span>
        )}
      </div>
      <table className={styles.tabla}>
        <thead><tr><th>Evento</th><th>Estado</th><th>Intentos</th><th>Último error</th><th>Próximo intento</th><th>Creado</th><th></th></tr></thead>
        <tbody>
          {(data ?? []).map((e) => (
            <tr key={e.documentId}>
              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.tipo}</td>
              <td><StatusChip tono={CHIP_ENTREGA[e.estado]} size="sm">{e.estado}</StatusChip></td>
              <td>{e.intentos}</td>
              <td style={{ fontSize: 12, color: 'var(--text-soft)' }}>{e.ultimoError ?? ''}</td>
              <td style={{ fontSize: 12, color: 'var(--text-soft)' }}>{e.estado === 'pendiente' ? cuando(e.proximoIntentoEn) : ''}</td>
              <td style={{ fontSize: 12, color: 'var(--text-soft)' }}>{cuando(e.creadoEn)}</td>
              <td style={{ textAlign: 'right' }}>
                {e.estado !== 'entregado' && <button className={ui.btnGhost} style={{ fontSize: 12 }} onClick={() => reintentar.mutate(e.documentId)}>Reintentar</button>}
              </td>
            </tr>
          ))}
          {!data?.length && <tr><td colSpan={7} style={{ color: 'var(--text-faint)', fontSize: 12, padding: 12 }}>Aún no hay entregas.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function NuevaIntegracion({ onCerrar, onCreada }: { onCerrar: () => void; onCreada: (r: IntegracionConSecretos) => void }) {
  const { data: lineas } = useQuery({ queryKey: ['admin-contratos'], queryFn: getAdminContratos });
  const [lineaId, setLineaId] = useState('');
  const [nombre, setNombre] = useState('Sistema de la línea');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const crear = useMutation({
    mutationFn: () => crearIntegracion({ lineaId, nombre, webhookUrl: webhookUrl.trim() || undefined }),
    onSuccess: onCreada,
    onError: (e) => setError(e instanceof ApiError ? (MENSAJES[e.code] ?? e.code) : 'No se pudo crear.'),
  });
  return (
    <div className={styles.velo} onClick={onCerrar}>
      <div className={styles.modal} style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>Nueva integración</h3>
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Línea</span>
          <select className={ui.fieldInput} value={lineaId} onChange={(e) => setLineaId(e.target.value)}>
            <option value="">Elige la línea…</option>
            {(lineas ?? []).map((l) => <option key={l.linea.documentId} value={l.linea.documentId}>{l.linea.nombre}</option>)}
          </select>
        </label>
        <label className={ui.field} style={{ marginTop: 12 }}>
          <span className={ui.fieldLabel}>Nombre</span>
          <input className={ui.fieldInput} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className={ui.field} style={{ marginTop: 12 }}>
          <span className={ui.fieldLabel}>URL del webhook (opcional)</span>
          <input className={ui.fieldInput} value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://su-sistema.com/butaca/webhook" />
        </label>
        {error && <p style={{ color: 'var(--bad-text)', fontSize: 13, marginTop: 8 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button className={ui.btnSecondary} onClick={onCerrar}>Cancelar</button>
          <button className={ui.btnPrimary} disabled={!lineaId || !nombre.trim() || crear.isPending} onClick={() => crear.mutate()}>Crear</button>
        </div>
      </div>
    </div>
  );
}

function Secretos({ datos, onCerrar }: { datos: IntegracionConSecretos; onCerrar: () => void }) {
  const copiar = (t: string) => void navigator.clipboard?.writeText(t).catch(() => {});
  const fila = (etiqueta: string, valor: string) => (
    <div style={{ marginTop: 12 }}>
      <div className={ui.fieldLabel}>{etiqueta}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <code style={{ flex: 1, wordBreak: 'break-all', background: 'var(--pill-bg)', padding: '10px 12px', borderRadius: 10, fontSize: 13 }}>{valor}</code>
        <button className={ui.btnSecondary} onClick={() => copiar(valor)}>Copiar</button>
      </div>
    </div>
  );
  return (
    <div className={styles.velo}>
      <div className={styles.modal} style={{ maxWidth: 600 }}>
        <h3 style={{ fontSize: 20, fontWeight: 700 }}>{datos.nombre} · {datos.linea.nombre}</h3>
        <p style={{ fontSize: 13, color: 'var(--bad-text)', marginTop: 6 }}>
          Cópialas ahora y entrégalas por un canal seguro: <strong>no se vuelven a mostrar</strong>. Si se pierden, se rotan.
        </p>
        {datos.clave && fila('Clave de la API (Authorization: Bearer …)', datos.clave)}
        {datos.webhookSecreto && fila('Secreto del webhook (firma X-Butaca-Firma)', datos.webhookSecreto)}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button className={ui.btnPrimary} onClick={onCerrar}>Ya las guardé</button>
        </div>
      </div>
    </div>
  );
}
