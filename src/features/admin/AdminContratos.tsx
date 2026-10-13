import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  crearContrato,
  getAdminContratos,
  getCatalogoModulos,
  getHistorialContratos,
  type ClaveModulo,
  type Contrato,
  type ModuloCatalogo,
  type ResumenContratoLinea,
} from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { fechaCorta, hoyISO } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const usd = (n: number) => `$ ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

const MENSAJES: Record<string, string> = {
  modulo_requiere: 'Ese módulo necesita otro que no está marcado.',
  comision_invalido: 'La comisión va de 0 a 100.',
  monto_bus_invalido: 'El monto por bus no es válido.',
  dias_gracia_invalido: 'Los días de gracia van de 0 a 365.',
  vigencia_anterior_al_contrato_actual: 'La fecha no puede ser anterior al inicio del contrato vigente.',
  contrato_en_curso: 'Alguien más está guardando un contrato para esta línea. Recarga y vuelve a intentar.',
};

/**
 * Contratos por línea: qué módulos contrató, qué comisión paga por boleto y
 * cuánto paga al mes por bus. Nunca se edita encima: cada cambio es una
 * versión nueva con su fecha, y la anterior queda cerrada.
 */
export default function AdminContratos() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<ResumenContratoLinea | null>(null);
  const [historialDe, setHistorialDe] = useState<string | null>(null);

  const { data: lineas, isLoading } = useQuery({ queryKey: ['admin-contratos'], queryFn: getAdminContratos });
  const { data: catalogo } = useQuery({ queryKey: ['catalogo-modulos'], queryFn: getCatalogoModulos, staleTime: Infinity });

  const nombreDe = (clave: ClaveModulo) => catalogo?.find((m) => m.clave === clave)?.nombre ?? clave;
  const sinContrato = (lineas ?? []).filter((l) => !l.contrato).length;

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Contratos</h2>
        {sinContrato > 0 && (
          <StatusChip tono="warn">
            {sinContrato} {sinContrato === 1 ? 'línea sin contrato' : 'líneas sin contrato'}
          </StatusChip>
        )}
      </div>
      <p style={{ color: 'var(--text-soft)', fontSize: 14, marginBottom: 16, maxWidth: 720 }}>
        Una línea sin contrato se comporta como si tuviera todos los módulos. Cuando le crea uno, solo ve lo que
        contrató, y cada cambio queda como una versión nueva con su fecha.
      </p>

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Módulos</th>
              <th>Comisión</th>
              <th>Por bus / mes</th>
              <th>Vigente desde</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(lineas ?? []).map((l) => (
              <tr key={l.linea.documentId}>
                <td style={{ fontWeight: 600 }}>
                  {l.linea.nombre}
                  {!l.linea.activa && (
                    <span style={{ marginLeft: 8 }}>
                      <StatusChip tono="neutral" size="sm">Inactiva</StatusChip>
                    </span>
                  )}
                </td>
                <td>
                  {l.contrato ? (
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {l.contrato.modulos.map((m) => (
                        <StatusChip key={m} tono="info" size="sm">{nombreDe(m)}</StatusChip>
                      ))}
                    </span>
                  ) : (
                    <StatusChip tono="warn" size="sm">Sin contrato · todo abierto</StatusChip>
                  )}
                </td>
                <td style={{ fontWeight: 700 }}>{l.contrato ? `${l.contrato.comisionPct} %` : '—'}</td>
                <td style={{ fontWeight: 700 }}>{l.contrato ? usd(l.contrato.montoBusUsd) : '—'}</td>
                <td style={{ color: 'var(--text-soft)' }}>
                  {l.contrato ? (
                    <>
                      {fechaCorta(`${l.contrato.vigenteDesde}T12:00:00`)}
                      <span style={{ color: 'var(--text-faint)', fontSize: 12 }}> · v{l.contrato.version}</span>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {l.contrato && (
                    <button
                      className={ui.btnGhost}
                      style={{ fontSize: 13, marginRight: 8 }}
                      onClick={() => setHistorialDe(historialDe === l.linea.documentId ? null : l.linea.documentId)}
                    >
                      {historialDe === l.linea.documentId ? 'Ocultar historial' : 'Historial'}
                    </button>
                  )}
                  <button className={ui.btnPrimary} style={{ fontSize: 13, padding: '10px 16px' }} onClick={() => setEditando(l)}>
                    {l.contrato ? 'Nueva versión' : 'Crear contrato'}
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && !lineas?.length && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 24 }}>
                  Todavía no hay empresas. Créelas en Empresas y vuelva aquí.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {historialDe && <Historial lineaId={historialDe} nombreDe={nombreDe} />}

      {editando && catalogo && (
        <EditorContrato
          resumen={editando}
          catalogo={catalogo}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            queryClient.invalidateQueries({ queryKey: ['admin-contratos'] });
            queryClient.invalidateQueries({ queryKey: ['historial-contratos'] });
            queryClient.invalidateQueries({ queryKey: ['admin-empresas'] });
          }}
        />
      )}
    </div>
  );
}

function Historial({ lineaId, nombreDe }: { lineaId: string; nombreDe: (m: ClaveModulo) => string }) {
  const { data } = useQuery({ queryKey: ['historial-contratos', lineaId], queryFn: () => getHistorialContratos(lineaId) });
  return (
    <div className={ui.card} style={{ marginTop: 16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid var(--border)' }}>
        Historial · {data?.[0]?.linea.nombre ?? ''}
      </div>
      <table className={styles.tabla}>
        <thead>
          <tr>
            <th>Versión</th>
            <th>Vigencia</th>
            <th>Módulos</th>
            <th>Comisión</th>
            <th>Por bus</th>
            <th>Gracia</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((c: Contrato) => (
            <tr key={c.documentId}>
              <td style={{ fontWeight: 600 }}>
                v{c.version}
                {!c.vigenteHasta && (
                  <span style={{ marginLeft: 6 }}>
                    <StatusChip tono="ok" size="sm">Vigente</StatusChip>
                  </span>
                )}
              </td>
              <td style={{ color: 'var(--text-soft)' }}>
                {fechaCorta(`${c.vigenteDesde}T12:00:00`)} → {c.vigenteHasta ? fechaCorta(`${c.vigenteHasta}T12:00:00`) : 'hoy'}
              </td>
              <td style={{ fontSize: 12 }}>{c.modulos.map(nombreDe).join(', ')}</td>
              <td>{c.comisionPct} %</td>
              <td>{usd(c.montoBusUsd)}</td>
              <td>{c.diasGracia} días</td>
              <td style={{ fontSize: 12, color: 'var(--text-faint)' }}>{c.notas ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditorContrato({
  resumen,
  catalogo,
  onCerrar,
  onGuardado,
}: {
  resumen: ResumenContratoLinea;
  catalogo: ModuloCatalogo[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const base = resumen.contrato;
  const [modulos, setModulos] = useState<ClaveModulo[]>(base?.modulos ?? ['flota']);
  const [comisionPct, setComisionPct] = useState(String(base?.comisionPct ?? 5));
  const [montoBusUsd, setMontoBusUsd] = useState(String(base?.montoBusUsd ?? 0));
  const [diasGracia, setDiasGracia] = useState(String(base?.diasGracia ?? 10));
  const [vigenteDesde, setVigenteDesde] = useState(hoyISO());
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Marcar un módulo arrastra lo que necesita; desmarcar uno suelta lo que dependía de él.
  const alternar = (clave: ClaveModulo) => {
    setModulos((actual) => {
      if (actual.includes(clave)) {
        const dependientes = catalogo.filter((m) => m.depende.includes(clave)).map((m) => m.clave);
        return actual.filter((m) => m !== clave && !dependientes.includes(m));
      }
      const requeridos = catalogo.find((m) => m.clave === clave)?.depende ?? [];
      return [...new Set([...actual, ...requeridos, clave])];
    });
  };

  const cobraPorBus = useMemo(
    () => modulos.some((m) => catalogo.find((c) => c.clave === m)?.cobro === 'por_bus'),
    [modulos, catalogo]
  );
  const cobraComision = useMemo(
    () => modulos.some((m) => catalogo.find((c) => c.clave === m)?.cobro === 'comision'),
    [modulos, catalogo]
  );

  useEffect(() => {
    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [onCerrar]);

  const guardar = useMutation({
    mutationFn: () =>
      crearContrato({
        lineaId: resumen.linea.documentId,
        modulos,
        comisionPct: Number(comisionPct),
        montoBusUsd: Number(montoBusUsd),
        diasGracia: Number(diasGracia),
        vigenteDesde,
        notas: notas.trim() || undefined,
      }),
    onSuccess: onGuardado,
    onError: (e) => setError(e instanceof ApiError ? (MENSAJES[e.code] ?? e.code) : 'No se pudo guardar.'),
  });

  return (
    <div className={styles.velo} onClick={onCerrar}>
      <div className={styles.modal} style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {base ? `Nueva versión · v${base.version + 1}` : 'Primer contrato'}
        </div>
        <h3 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 16px' }}>{resumen.linea.nombre}</h3>

        <div className={ui.fieldLabel}>Módulos contratados</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, marginBottom: 16 }}>
          {catalogo.map((m) => (
            <label
              key={m.clave}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-10)',
                background: modulos.includes(m.clave) ? 'var(--blue-50, #EFF4FF)' : 'var(--surface)',
                cursor: 'pointer',
              }}
            >
              <input type="checkbox" checked={modulos.includes(m.clave)} onChange={() => alternar(m.clave)} style={{ marginTop: 3 }} />
              <span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{m.nombre}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-soft)' }}>{m.descripcion}</span>
                {m.depende.length > 0 && (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)' }}>
                    Requiere {m.depende.map((d) => catalogo.find((c) => c.clave === d)?.nombre ?? d).join(', ')}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Comisión por boleto (%)</span>
            <input className={ui.fieldInput} inputMode="decimal" value={comisionPct} onChange={(e) => setComisionPct(e.target.value)} disabled={!cobraComision} />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Por bus al mes (USD)</span>
            <input className={ui.fieldInput} inputMode="decimal" value={montoBusUsd} onChange={(e) => setMontoBusUsd(e.target.value)} disabled={!cobraPorBus} />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Días de gracia</span>
            <input className={ui.fieldInput} inputMode="numeric" value={diasGracia} onChange={(e) => setDiasGracia(e.target.value)} />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Vigente desde</span>
            <input className={ui.fieldInput} type="date" value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)} />
          </label>
        </div>
        <label className={ui.field} style={{ marginTop: 12 }}>
          <span className={ui.fieldLabel}>Notas (opcional)</span>
          <input className={ui.fieldInput} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Acuerdo comercial, condiciones, quién negoció…" />
        </label>

        {!cobraPorBus && !cobraComision && (
          <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 8 }}>Con solo Flota la línea no paga nada: es la base de los demás módulos.</p>
        )}
        {error && <p style={{ color: 'var(--red-600, #DC2626)', fontSize: 13, marginTop: 8 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className={ui.btnSecondary} onClick={onCerrar}>Cancelar</button>
          <button className={ui.btnPrimary} disabled={guardar.isPending || !modulos.length} onClick={() => guardar.mutate()}>
            {base ? 'Guardar nueva versión' : 'Crear contrato'}
          </button>
        </div>
      </div>
    </div>
  );
}
