import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarConector,
  crearConector,
  getAdminContratos,
  getConectores,
  sincronizarConector,
  type Conector,
  type ResultadoSync,
} from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { fechaCorta, hora } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const MENSAJES: Record<string, string> = {
  conector_ya_activo: 'Esa línea ya tiene un conector activo. Desactívalo primero.',
  tipo_desconocido: 'Ese tipo de conector no existe.',
  linea_no_encontrada: 'La línea no existe.',
  conector_simulado_en_produccion: 'El conector simulado no se puede usar en producción.',
  sistema_de_la_linea_no_responde: 'El sistema de la línea no respondió.',
  payload_invalido: 'Faltan datos.',
};
// Hoy solo existe el simulado (demos y pruebas). Cada sistema real de una línea será un tipo nuevo.
const TIPOS = [{ valor: 'simulado', nombre: 'Simulado (demos y pruebas)' }];
const cuando = (iso: string | null) => (iso ? `${fechaCorta(iso)} ${hora(iso)}` : '—');

/**
 * Conectores: cómo Butaca habla con la boletería de una línea del plan Solo
 * boletería. El boleto es del sistema de la línea; Butaca consume su API para
 * ver sus asientos y emitir, y guarda un comprobante propio. La configuración
 * (credenciales) se guarda cifrada y nunca se vuelve a mostrar: para cambiarla
 * se escribe de nuevo completa.
 */
export default function AdminConectores() {
  const queryClient = useQueryClient();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Conector | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ id: string; r: ResultadoSync } | null>(null);

  const { data: conectores, isLoading } = useQuery({ queryKey: ['admin-conectores'], queryFn: getConectores });
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['admin-conectores'] });
  const alFallar = (e: unknown) => setError(e instanceof ApiError ? (MENSAJES[e.code] ?? e.code) : 'No se pudo completar.');

  const alternar = useMutation({
    mutationFn: (c: Conector) => actualizarConector(c.documentId, { activo: !c.activo }),
    onSuccess: () => { setError(null); void refrescar(); },
    onError: alFallar,
  });
  const sincronizar = useMutation({
    mutationFn: (c: Conector) => sincronizarConector(c.documentId).then((r) => ({ id: c.documentId, r })),
    onSuccess: (x) => { setError(null); setResultado(x); void refrescar(); },
    onError: (e) => { alFallar(e); void refrescar(); },
  });

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Conectores</h2>
        <button className={ui.btnPrimary} style={{ marginLeft: 'auto', fontSize: 14, padding: '12px 20px' }} onClick={() => { setError(null); setCreando(true); }}>
          Nuevo conector
        </button>
      </div>
      <p style={{ color: 'var(--text-soft)', fontSize: 14, marginBottom: 16, maxWidth: 760 }}>
        Para las líneas del plan Solo boletería que ya tienen su sistema: Butaca consume su API para traer rutas y salidas,
        mostrar sus asientos en vivo y emitir los boletos allá. Butaca cobra, liquida a la línea y entrega al pasajero un
        comprobante que apunta al boleto de ellos. Una línea con conector activo no edita rutas ni salidas en su panel.
      </p>
      {error && <p style={{ color: 'var(--bad-text)', fontSize: 13, marginBottom: 10 }}>{error}</p>}

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Línea</th>
              <th>Conector</th>
              <th>Última sincronización</th>
              <th>Estado de la conexión</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(conectores ?? []).map((c) => (
              <tr key={c.documentId}>
                <td style={{ fontWeight: 600 }}>{c.linea.nombre}</td>
                <td>
                  {c.nombre} <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>({c.tipo})</span>{' '}
                  {c.activo ? <StatusChip tono="ok" size="sm">Activo</StatusChip> : <StatusChip tono="neutral" size="sm">Inactivo</StatusChip>}
                </td>
                <td style={{ color: 'var(--text-soft)', fontSize: 13 }}>
                  {cuando(c.ultimaSyncEn)}
                  {resultado?.id === c.documentId && (
                    <div style={{ fontSize: 12, color: 'var(--ok-text)' }}>
                      {resultado.r.rutas} ruta(s), {resultado.r.unidades} unidad(es), {resultado.r.salidasNuevas} salida(s) nueva(s), {resultado.r.salidasActualizadas} actualizada(s)
                    </div>
                  )}
                </td>
                <td style={{ fontSize: 12, maxWidth: 280 }}>
                  {c.ultimoError ? <span style={{ color: 'var(--bad-text)' }}>{c.ultimoError}</span> : c.ultimaSyncEn ? <span style={{ color: 'var(--ok-text)' }}>Sin errores</span> : <span style={{ color: 'var(--text-faint)' }}>Sin sincronizar</span>}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className={ui.btnGhost} style={{ fontSize: 13, marginRight: 8 }} disabled={sincronizar.isPending} onClick={() => sincronizar.mutate(c)}>
                    {sincronizar.isPending && sincronizar.variables?.documentId === c.documentId ? 'Sincronizando…' : 'Sincronizar ahora'}
                  </button>
                  <button className={ui.btnGhost} style={{ fontSize: 13, marginRight: 8 }} onClick={() => { setError(null); setEditando(c); }}>
                    Configuración
                  </button>
                  <button style={{ fontSize: 13, fontWeight: 600, color: c.activo ? 'var(--bad-text)' : 'var(--ok-text)' }} onClick={() => alternar.mutate(c)}>
                    {c.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && !conectores?.length && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 24 }}>Todavía no hay conectores.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {creando && <FormularioConector onCerrar={() => setCreando(false)} onListo={() => { setCreando(false); void refrescar(); }} />}
      {editando && <FormularioConector conector={editando} onCerrar={() => setEditando(null)} onListo={() => { setEditando(null); void refrescar(); }} />}
    </div>
  );
}

/** Crear (con línea y tipo) o, con `conector`, reemplazar nombre y configuración. */
function FormularioConector({ conector, onCerrar, onListo }: { conector?: Conector; onCerrar: () => void; onListo: () => void }) {
  const { data: lineas } = useQuery({ queryKey: ['admin-contratos'], queryFn: getAdminContratos, enabled: !conector });
  const [lineaId, setLineaId] = useState('');
  const [tipo, setTipo] = useState(TIPOS[0].valor);
  const [nombre, setNombre] = useState(conector?.nombre ?? 'Boletería de la línea');
  const [texto, setTexto] = useState(conector ? '' : '{\n  "catalogo": []\n}');
  const [error, setError] = useState<string | null>(null);

  // El JSON se valida aquí para no mandar a medias; el servidor valida el resto.
  const leer = (): { ok: true; valor: unknown } | { ok: false } => {
    if (conector && !texto.trim()) return { ok: true, valor: undefined };
    try {
      const v = JSON.parse(texto);
      return v && typeof v === 'object' && !Array.isArray(v) ? { ok: true, valor: v } : { ok: false };
    } catch {
      return { ok: false };
    }
  };
  const guardar = useMutation({
    mutationFn: () => {
      const c = leer();
      if (!c.ok) throw new Error('json');
      return conector
        ? actualizarConector(conector.documentId, { nombre, ...(c.valor !== undefined ? { config: c.valor } : {}) })
        : crearConector({ lineaId, tipo, nombre, config: c.valor });
    },
    onSuccess: onListo,
    onError: (e) => setError(e instanceof ApiError ? (MENSAJES[e.code] ?? e.code) : 'La configuración debe ser un objeto JSON válido.'),
  });

  return (
    <div className={styles.velo} onClick={onCerrar}>
      <div className={styles.modal} style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>{conector ? `Configuración · ${conector.linea.nombre}` : 'Nuevo conector'}</h3>
        {!conector && (
          <>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Línea</span>
              <select className={ui.fieldInput} value={lineaId} onChange={(e) => setLineaId(e.target.value)}>
                <option value="">Elige la línea…</option>
                {(lineas ?? []).map((l) => <option key={l.linea.documentId} value={l.linea.documentId}>{l.linea.nombre}</option>)}
              </select>
            </label>
            <label className={ui.field} style={{ marginTop: 12 }}>
              <span className={ui.fieldLabel}>Tipo de sistema</span>
              <select className={ui.fieldInput} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.nombre}</option>)}
              </select>
            </label>
          </>
        )}
        <label className={ui.field} style={{ marginTop: 12 }}>
          <span className={ui.fieldLabel}>Nombre</span>
          <input className={ui.fieldInput} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className={ui.field} style={{ marginTop: 12 }}>
          <span className={ui.fieldLabel}>{conector ? 'Configuración nueva (JSON)' : 'Configuración (JSON)'}</span>
          <textarea
            className={ui.fieldInput}
            style={{ fontFamily: 'monospace', fontSize: 12, minHeight: 160 }}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={conector ? 'Déjalo vacío para no cambiarla' : ''}
            spellCheck={false}
          />
        </label>
        <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>
          Se guarda cifrada y no se vuelve a mostrar{conector ? ': pega la configuración completa para reemplazarla.' : '.'}
        </p>
        {error && <p style={{ color: 'var(--bad-text)', fontSize: 13, marginTop: 8 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button className={ui.btnSecondary} onClick={onCerrar}>Cancelar</button>
          <button className={ui.btnPrimary} disabled={(!conector && !lineaId) || !nombre.trim() || guardar.isPending} onClick={() => { setError(null); guardar.mutate(); }}>
            {conector ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}
