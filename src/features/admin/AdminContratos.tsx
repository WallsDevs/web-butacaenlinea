import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  crearContrato,
  getAdminContratos,
  getCatalogoModulos,
  getCatalogoPlanes,
  getHistorialContratos,
  type ClaveModulo,
  type ClavePlan,
  type Contrato,
  type ModuloCatalogo,
  type PlanCatalogo,
  type ResumenContratoLinea,
} from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { fechaCorta, hoyISO } from '../../lib/time';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const usd = (n: number) => `$ ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
const dia = (iso: string) => fechaCorta(`${iso}T12:00:00`);

const MENSAJES: Record<string, string> = {
  modulo_requiere: 'Ese módulo necesita otro que no está marcado.',
  comision_invalido: 'La comisión va de 0 a 100.',
  monto_bus_invalido: 'El monto por bus no es válido.',
  dias_gracia_invalido: 'Los días de gracia van de 0 a 365.',
  plazo_invalido: 'El plazo va de 1 a 120 meses.',
  vigencia_anterior_al_contrato_actual: 'La fecha no puede ser anterior al inicio del contrato vigente.',
  contrato_en_curso: 'Alguien más está guardando un contrato para esta línea. Recarga y vuelve a intentar.',
};

const PLAZOS: { meses: number | null; label: string }[] = [
  { meses: null, label: 'Indefinido' },
  { meses: 1, label: '1 mes' },
  { meses: 3, label: '3 meses' },
  { meses: 6, label: '6 meses' },
  { meses: 12, label: '12 meses' },
];

const NOMBRE_PLAN: Record<ClavePlan, string> = {
  mantenimiento: 'Mantenimiento',
  venta: 'Solo venta en línea',
  completo: 'Butaca completo',
  personalizado: 'Personalizado',
};

/** Cómo se lee el cobro de un contrato en una frase. */
function cobroDe(c: Contrato, catalogo: ModuloCatalogo[] | undefined): string {
  const partes: string[] = [];
  const porBus = c.modulos.some((m) => catalogo?.find((x) => x.clave === m)?.cobro === 'por_bus');
  const comision = c.modulos.some((m) => catalogo?.find((x) => x.clave === m)?.cobro === 'comision');
  if (comision) partes.push(`${c.comisionPct} % por pasaje`);
  if (porBus) partes.push(`${usd(c.montoBusUsd)} por bus al mes`);
  return partes.join(' · ') || 'Sin cobro';
}

function ChipVigencia({ c }: { c: Contrato }) {
  if (c.estado === 'vencido') return <StatusChip tono="bad" size="sm">Vencido {c.venceEn ? dia(c.venceEn) : ''}</StatusChip>;
  if (c.estado === 'por_vencer') return <StatusChip tono="warn" size="sm">Vence en {c.diasRestantes} {c.diasRestantes === 1 ? 'día' : 'días'}</StatusChip>;
  if (c.venceEn) return <StatusChip tono="ok" size="sm">Hasta {dia(c.venceEn)}</StatusChip>;
  return <StatusChip tono="ok" size="sm">Indefinido</StatusChip>;
}

/**
 * Contratos por línea: qué plan y qué módulos contrató, cómo paga (comisión
 * por pasaje, tarifa por bus) y por cuánto tiempo. Nunca se edita encima:
 * cada cambio —y cada renovación— es una versión nueva con su fecha.
 */
export default function AdminContratos() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<ResumenContratoLinea | null>(null);
  const [historialDe, setHistorialDe] = useState<string | null>(null);

  const { data: lineas, isLoading } = useQuery({ queryKey: ['admin-contratos'], queryFn: getAdminContratos });
  const { data: catalogo } = useQuery({ queryKey: ['catalogo-modulos'], queryFn: getCatalogoModulos, staleTime: Infinity });
  const { data: planes } = useQuery({ queryKey: ['catalogo-planes'], queryFn: getCatalogoPlanes, staleTime: Infinity });

  const nombreDe = (clave: ClaveModulo) => catalogo?.find((m) => m.clave === clave)?.nombre ?? clave;
  const sinContrato = (lineas ?? []).filter((l) => !l.contrato).length;
  const vencidos = (lineas ?? []).filter((l) => l.contrato?.estado === 'vencido').length;
  const porVencer = (lineas ?? []).filter((l) => l.contrato?.estado === 'por_vencer').length;

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Contratos</h2>
        {vencidos > 0 && <StatusChip tono="bad">{vencidos} {vencidos === 1 ? 'vencido' : 'vencidos'}</StatusChip>}
        {porVencer > 0 && <StatusChip tono="warn">{porVencer} por vencer</StatusChip>}
        {sinContrato > 0 && (
          <StatusChip tono="neutral">
            {sinContrato} {sinContrato === 1 ? 'línea sin contrato' : 'líneas sin contrato'}
          </StatusChip>
        )}
      </div>
      <p style={{ color: 'var(--text-soft)', fontSize: 14, marginBottom: 16, maxWidth: 760 }}>
        Tres formas de vender la plataforma: <strong>Mantenimiento</strong> (tarifa fija por bus al mes),{' '}
        <strong>Solo venta en línea</strong> (Butaca vende los boletos de la línea en el marketplace y cobra comisión por pasaje) y{' '}
        <strong>Butaca completo</strong> (toda la plataforma, comisión por pasaje). Un contrato con plazo deja de regir al vencer:
        la línea pierde sus módulos y sus salidas salen del marketplace hasta que se renueve. Una línea sin contrato se comporta como si tuviera todo.
      </p>

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Plan</th>
              <th>Módulos</th>
              <th>Cobro</th>
              <th>Vigencia</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(lineas ?? []).map((l) => (
              <tr key={l.linea.documentId} style={l.contrato?.estado === 'vencido' ? { background: 'var(--bad-bg, #FEF2F2)' } : undefined}>
                <td style={{ fontWeight: 600 }}>
                  {l.linea.nombre}
                  {!l.linea.activa && (
                    <span style={{ marginLeft: 8 }}>
                      <StatusChip tono="neutral" size="sm">Inactiva</StatusChip>
                    </span>
                  )}
                </td>
                <td style={{ fontWeight: 600 }}>{l.contrato ? NOMBRE_PLAN[l.contrato.plan] : '—'}</td>
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
                <td style={{ fontSize: 13 }}>{l.contrato ? cobroDe(l.contrato, catalogo) : '—'}</td>
                <td style={{ color: 'var(--text-soft)', fontSize: 13 }}>
                  {l.contrato ? (
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span>
                        Desde {dia(l.contrato.vigenteDesde)}
                        <span style={{ color: 'var(--text-faint)', fontSize: 12 }}> · v{l.contrato.version}</span>
                      </span>
                      <span><ChipVigencia c={l.contrato} /></span>
                    </span>
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
                    {!l.contrato ? 'Crear contrato' : l.contrato.estado === 'vencido' ? 'Renovar' : 'Nueva versión'}
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

      {historialDe && <Historial lineaId={historialDe} nombreDe={nombreDe} catalogo={catalogo} />}

      {editando && catalogo && planes && (
        <EditorContrato
          resumen={editando}
          catalogo={catalogo}
          planes={planes}
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

function Historial({ lineaId, nombreDe, catalogo }: { lineaId: string; nombreDe: (m: ClaveModulo) => string; catalogo: ModuloCatalogo[] | undefined }) {
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
            <th>Plan</th>
            <th>Vigencia</th>
            <th>Módulos</th>
            <th>Cobro</th>
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
                    <ChipVigencia c={c} />
                  </span>
                )}
              </td>
              <td>{NOMBRE_PLAN[c.plan]}</td>
              <td style={{ color: 'var(--text-soft)' }}>
                {dia(c.vigenteDesde)} → {c.vigenteHasta ? dia(c.vigenteHasta) : c.venceEn ? dia(c.venceEn) : 'indefinido'}
                {c.plazoMeses ? <span style={{ color: 'var(--text-faint)', fontSize: 12 }}> · {c.plazoMeses} {c.plazoMeses === 1 ? 'mes' : 'meses'}</span> : null}
              </td>
              <td style={{ fontSize: 12 }}>{c.modulos.map(nombreDe).join(', ')}</td>
              <td style={{ fontSize: 12 }}>{cobroDe(c, catalogo)}</td>
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
  planes,
  onCerrar,
  onGuardado,
}: {
  resumen: ResumenContratoLinea;
  catalogo: ModuloCatalogo[];
  planes: PlanCatalogo[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const base = resumen.contrato;
  const renovando = base?.estado === 'vencido';
  const [modulos, setModulos] = useState<ClaveModulo[]>(base?.modulos ?? ['flota']);
  const [comisionPct, setComisionPct] = useState(String(base?.comisionPct ?? 5));
  const [montoBusUsd, setMontoBusUsd] = useState(String(base?.montoBusUsd ?? 0));
  const [diasGracia, setDiasGracia] = useState(String(base?.diasGracia ?? 10));
  const [plazoMeses, setPlazoMeses] = useState<number | null>(base?.plazoMeses ?? null);
  const [vigenteDesde, setVigenteDesde] = useState(hoyISO());
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  // El plan es la lectura de los módulos marcados: cualquier combinación que no sea un plan es "personalizado".
  const plan: ClavePlan = useMemo(() => {
    const clave = [...modulos].sort().join(',');
    return planes.find((p) => [...p.modulos].sort().join(',') === clave)?.clave ?? 'personalizado';
  }, [modulos, planes]);

  const elegirPlan = (p: PlanCatalogo) => {
    setModulos(p.modulos);
    if (p.cobro === 'por_bus' && Number(comisionPct) > 0 && plan !== 'personalizado') setComisionPct('0');
  };

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

  const cobraPorBus = useMemo(() => modulos.some((m) => catalogo.find((c) => c.clave === m)?.cobro === 'por_bus'), [modulos, catalogo]);
  const cobraComision = useMemo(() => modulos.some((m) => catalogo.find((c) => c.clave === m)?.cobro === 'comision'), [modulos, catalogo]);

  // Vista previa del vencimiento: desde + plazo, menos un día (último día inclusive)
  const venceEnPrevisto = useMemo(() => {
    if (!plazoMeses || !/^\d{4}-\d{2}-\d{2}$/.test(vigenteDesde)) return null;
    const [a, m, d] = vigenteDesde.split('-').map(Number);
    const ultimo = new Date(Date.UTC(a, m - 1 + plazoMeses + 1, 0)).getUTCDate();
    const fin = new Date(Date.UTC(a, m - 1 + plazoMeses, Math.min(d, ultimo)));
    fin.setUTCDate(fin.getUTCDate() - 1);
    return fin.toISOString().slice(0, 10);
  }, [plazoMeses, vigenteDesde]);

  useEffect(() => {
    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [onCerrar]);

  const guardar = useMutation({
    mutationFn: () =>
      crearContrato({
        lineaId: resumen.linea.documentId,
        plan,
        modulos,
        comisionPct: Number(comisionPct),
        montoBusUsd: Number(montoBusUsd),
        diasGracia: Number(diasGracia),
        vigenteDesde,
        plazoMeses,
        notas: notas.trim() || undefined,
      }),
    onSuccess: onGuardado,
    onError: (e) => setError(e instanceof ApiError ? (MENSAJES[e.code] ?? e.code) : 'No se pudo guardar.'),
  });

  return (
    <div className={styles.velo} onClick={onCerrar}>
      <div className={styles.modal} style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 12, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {!base ? 'Primer contrato' : renovando ? `Renovación · v${base.version + 1}` : `Nueva versión · v${base.version + 1}`}
        </div>
        <h3 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 16px' }}>{resumen.linea.nombre}</h3>
        {renovando && base?.venceEn && (
          <div className={`${styles.alerta} ${styles.alertaBad}`} style={{ marginBottom: 14 }}>
            <div className={styles.alertaTitulo}>El contrato venció el {dia(base.venceEn)}</div>
            <div className={styles.alertaNota}>Mientras no se renueve, la línea no tiene módulos y sus salidas no se venden.</div>
          </div>
        )}

        <div className={ui.fieldLabel}>Plan</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 14 }}>
          {planes.map((p) => (
            <button
              key={p.clave}
              type="button"
              onClick={() => elegirPlan(p)}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                border: `1.5px solid ${plan === p.clave ? 'var(--blue-600)' : 'var(--border)'}`,
                borderRadius: 'var(--r-14)',
                background: plan === p.clave ? 'var(--blue-50, #EFF4FF)' : 'var(--surface)',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{p.nombre}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-soft)', marginTop: 2 }}>{p.descripcion}</span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
                {p.cobro === 'por_bus' ? 'Tarifa fija por bus al mes' : 'Comisión por pasaje'}
              </span>
            </button>
          ))}
        </div>
        {plan === 'personalizado' && (
          <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: -8, marginBottom: 12 }}>
            Combinación personalizada: no coincide con ningún plan.
          </p>
        )}

        <div className={ui.fieldLabel}>Módulos contratados</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginBottom: 16 }}>
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

        <div className={ui.fieldLabel}>Cobro y plazo</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Comisión por pasaje (%)</span>
            <input className={ui.fieldInput} inputMode="decimal" value={comisionPct} onChange={(e) => setComisionPct(e.target.value)} disabled={!cobraComision} />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Por bus al mes (USD)</span>
            <input className={ui.fieldInput} inputMode="decimal" value={montoBusUsd} onChange={(e) => setMontoBusUsd(e.target.value)} disabled={!cobraPorBus} />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Días de gracia</span>
            <input className={ui.fieldInput} inputMode="numeric" value={diasGracia} onChange={(e) => setDiasGracia(e.target.value)} disabled={!cobraPorBus} />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Vigente desde</span>
            <input className={ui.fieldInput} type="date" value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)} />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Plazo</span>
            <select className={ui.fieldInput} value={plazoMeses ?? ''} onChange={(e) => setPlazoMeses(e.target.value === '' ? null : Number(e.target.value))}>
              {PLAZOS.map((p) => (
                <option key={String(p.meses)} value={p.meses ?? ''}>{p.label}</option>
              ))}
            </select>
          </label>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 8 }}>
          {venceEnPrevisto
            ? <>Rige hasta el <strong>{dia(venceEnPrevisto)}</strong> inclusive; después la línea queda sin módulos hasta renovar.</>
            : 'Sin plazo: rige hasta que se cree otra versión.'}
          {cobraPorBus && ' La tarifa por bus se factura cada mes; los días de gracia cuentan desde la factura.'}
        </p>
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
            {!base ? 'Crear contrato' : renovando ? 'Renovar contrato' : 'Guardar nueva versión'}
          </button>
        </div>
      </div>
    </div>
  );
}
