import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  cerrarTurnoDeUnidad,
  getRutasUrbanas,
  getServicioUrbano,
  getUsuariosEmpresa,
  guardarServicioUrbano,
} from '../../lib/api/endpoints';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

/**
 * Tarjeta "Servicio urbano" de la ficha de unidad (empresa): las rutas urbanas
 * que la unidad puede hacer, el esquema de reparto (línea/propietario/conductor,
 * debe sumar 100) y el QR imprimible que se pega en la buseta. El pago nunca
 * pregunta de quién es el bus: esta configuración lo resuelve por adelantado.
 *
 * Aquí se define el CATÁLOGO. Cuál de esas rutas se está haciendo en este
 * momento lo decide el conductor al abrir su turno desde la app.
 */
export function ServicioUrbanoCard({
  unidadId,
  numeroUnidad,
  lineaNombre,
}: {
  unidadId: string;
  numeroUnidad: string;
  lineaNombre: string;
}) {
  const queryClient = useQueryClient();
  const [modalQr, setModalQr] = useState(false);
  const [form, setForm] = useState<{
    rutasUrbanaIds: string[];
    lineaPct: string;
    propietarioPct: string;
    conductorPct: string;
    propietarioUsuarioId: string;
  } | null>(null);

  const { data: config } = useQuery({
    queryKey: ['servicio-urbano', unidadId],
    queryFn: () => getServicioUrbano(unidadId),
  });
  const { data: rutas } = useQuery({ queryKey: ['rutas-urbanas'], queryFn: getRutasUrbanas });
  const { data: usuarios } = useQuery({ queryKey: ['usuarios-empresa'], queryFn: getUsuariosEmpresa });

  useEffect(() => {
    if (config && !form) {
      setForm({
        rutasUrbanaIds: config.rutasUrbanaIds ?? [],
        lineaPct: String(config.repartoUrbano.lineaPct),
        propietarioPct: String(config.repartoUrbano.propietarioPct),
        conductorPct: String(config.repartoUrbano.conductorPct),
        propietarioUsuarioId: config.propietarioUsuarioId ? String(config.propietarioUsuarioId) : '',
      });
    }
  }, [config, form]);

  const cerrarTurno = useMutation({
    mutationFn: () => cerrarTurnoDeUnidad(unidadId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['servicio-urbano', unidadId] }),
  });

  const guardar = useMutation({
    mutationFn: () =>
      guardarServicioUrbano(unidadId, {
        rutasUrbanaIds: form!.rutasUrbanaIds,
        repartoUrbano: {
          lineaPct: Number(form!.lineaPct) || 0,
          propietarioPct: Number(form!.propietarioPct) || 0,
          conductorPct: Number(form!.conductorPct) || 0,
        },
        propietarioUsuarioId: form!.propietarioUsuarioId ? Number(form!.propietarioUsuarioId) : null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['servicio-urbano', unidadId] }),
  });

  if (!form) return null;

  const suma = (Number(form.lineaPct) || 0) + (Number(form.propietarioPct) || 0) + (Number(form.conductorPct) || 0);
  const sumaOk = Math.round(suma * 100) / 100 === 100;
  const necesitaProp = (Number(form.propietarioPct) || 0) > 0;
  const urlPago = `${window.location.origin}/pagar/${unidadId}`;
  const tieneRutas = form.rutasUrbanaIds.length > 0;
  // Para el QR impreso: la que está haciendo ahora, o la única del catálogo
  const rutaSel =
    (rutas ?? []).find((r) => r.documentId === config?.turnoEnCurso?.rutaId) ??
    (form.rutasUrbanaIds.length === 1
      ? (rutas ?? []).find((r) => r.documentId === form.rutasUrbanaIds[0])
      : undefined);
  const alternarRuta = (documentId: string) =>
    setForm({
      ...form,
      rutasUrbanaIds: form.rutasUrbanaIds.includes(documentId)
        ? form.rutasUrbanaIds.filter((x) => x !== documentId)
        : [...form.rutasUrbanaIds, documentId],
    });

  const campoPct = (label: string, key: 'lineaPct' | 'propietarioPct' | 'conductorPct') => (
    <label className={ui.field}>
      <span className={ui.fieldLabel}>{label}</span>
      <input
        className={ui.fieldInput}
        type="number"
        min={0}
        max={100}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <div className={styles.tarjeta} style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className={styles.kicker}>Servicio urbano</div>
          <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>
            Pasaje por QR con la wallet: tarifa plana, split inmediato, sin equipaje.
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          {config?.turnoEnCurso ? (
            <StatusChip tono="ok">En turno</StatusChip>
          ) : tieneRutas ? (
            <StatusChip tono="neutral">Configurada</StatusChip>
          ) : (
            <StatusChip tono="neutral">Sin ruta</StatusChip>
          )}
        </div>
      </div>

      {config?.turnoEnCurso && (
        <div style={s2.turno}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <span style={s2.punto} />
            <strong style={{ fontSize: 15 }}>{config.turnoEnCurso.conductor}</strong>
            <span style={{ fontSize: 14, color: 'var(--text-soft)' }}>
              está de turno{config.turnoEnCurso.ruta ? ` · ${config.turnoEnCurso.ruta}` : ''}
            </span>
            <button
              className={ui.btnSecondary}
              style={{ marginLeft: 'auto', fontSize: 13 }}
              disabled={cerrarTurno.isPending}
              onClick={() => {
                if (confirm(`¿Cerrar el turno de ${config.turnoEnCurso!.conductor}? Su unidad deja de cobrar por QR.`))
                  cerrarTurno.mutate();
              }}
            >
              {cerrarTurno.isPending ? 'Cerrando…' : 'Cerrar turno'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>
            Abierto {desde(config.turnoEnCurso.abiertoEn)}. El turno es del conductor: la ruta es
            lo que hace mientras dura.
          </div>
        </div>
      )}

      {config?.desincronizada && (
        <div style={s2.trabado}>
          <strong>Esta unidad quedó marcada en servicio sin turno.</strong> Pasa si la app del
          conductor murió a mitad de camino. Mientras siga así el chip miente y el QR podría
          cobrar sin nadie responsable.
          <div style={{ marginTop: 10 }}>
            <button
              className={ui.btnPrimary}
              style={{ fontSize: 13 }}
              disabled={cerrarTurno.isPending}
              onClick={() => cerrarTurno.mutate()}
            >
              {cerrarTurno.isPending ? 'Destrabando…' : 'Destrabar la unidad'}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <span className={ui.fieldLabel}>Rutas que puede hacer esta unidad</span>
        <div style={{ fontSize: 13, color: 'var(--text-soft)', margin: '4px 0 10px' }}>
          Si marcas más de una, el conductor escoge cuál hace al abrir su turno.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(rutas ?? []).length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>
              Esta empresa todavía no tiene rutas urbanas. Créalas en Salidas y rutas.
            </div>
          )}
          {(rutas ?? []).map((r) => {
            const marcada = form.rutasUrbanaIds.includes(r.documentId);
            return (
              <label
                key={r.documentId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  border: `1px solid ${marcada ? 'var(--blue-200)' : 'var(--border)'}`,
                  background: marcada ? 'var(--tint-50)' : 'var(--surface)',
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={marcada}
                  onChange={() => alternarRuta(r.documentId)}
                />
                <span style={{ fontWeight: 600 }}>{r.nombre}</span>
                <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>
                  Bs {Number(r.tarifaBs).toLocaleString('es-VE')}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 110px)', gap: 12, marginTop: 16, alignItems: 'end' }}>
        {campoPct('% Línea', 'lineaPct')}
        {campoPct('% Propietario', 'propietarioPct')}
        {campoPct('% Conductor', 'conductorPct')}
      </div>

      {necesitaProp && (
        <div style={{ marginTop: 12, maxWidth: 380 }}>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Propietario del bus (recibe su parte en su wallet)</span>
            <select
              className={ui.fieldInput}
              value={form.propietarioUsuarioId}
              onChange={(e) => setForm({ ...form, propietarioUsuarioId: e.target.value })}
            >
              <option value="">Escoger usuario…</option>
              {(usuarios ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombreCorto ?? u.username} ({u.rolNombre ?? u.rol})
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: sumaOk ? 'var(--text-soft)' : 'var(--bad-text)', fontWeight: sumaOk ? 400 : 600 }}>
          El reparto (después de la comisión de la plataforma) suma {suma}% {sumaOk ? '' : '— debe sumar 100%'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          {tieneRutas && (
            <button className={ui.btnSecondary} style={{ fontSize: 14 }} onClick={() => setModalQr(true)}>
              Ver QR de la unidad
            </button>
          )}
          <button
            className={ui.btnPrimary}
            style={{ fontSize: 14 }}
            disabled={!sumaOk || (necesitaProp && !form.propietarioUsuarioId) || guardar.isPending}
            onClick={() => guardar.mutate()}
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar servicio urbano'}
          </button>
        </div>
      </div>
      {guardar.isError && (
        <div style={{ fontSize: 13, color: 'var(--bad-text)', marginTop: 8 }}>No se pudo guardar. Revisa el reparto.</div>
      )}

      {modalQr && (
        <div className={styles.velo}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="ficha-imprimible" style={{ textAlign: 'center', padding: '10px 0', background: '#fff' }}>
              <div style={{ fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                Paga tu pasaje aquí
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 2px' }}>{lineaNombre}</div>
              <div style={{ fontSize: 15, color: 'var(--text-soft)', marginBottom: 14 }}>
                Unidad {numeroUnidad}
                {rutaSel ? ` · ${rutaSel.nombre}` : ''}
              </div>
              <div style={{ background: '#fff', display: 'inline-block', padding: 16, borderRadius: 16, border: '1px solid var(--border)' }}>
                <QRCodeSVG value={urlPago} size={220} level="M" />
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 12 }}>
                Escanea con la cámara de tu teléfono y paga con tu wallet de Butaca En Línea.
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>butacaenlinea.com</div>
            </div>
            <div className="no-print" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className={ui.btnSecondary} onClick={() => setModalQr(false)}>
                Cerrar
              </button>
              <button className={ui.btnPrimary} onClick={() => window.print()}>
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** "hace 3 h 12 min" — cuánto lleva abierto el turno. */
function desde(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h ${min % 60} min`;
}

const s2: Record<string, React.CSSProperties> = {
  turno: {
    marginTop: 16,
    background: 'var(--ok-bg)',
    border: '1px solid var(--ok-dot)',
    borderRadius: 14,
    padding: '13px 15px',
  },
  punto: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    background: 'var(--ok-dot)',
    display: 'inline-block',
    flex: 'none',
  },
  trabado: {
    marginTop: 16,
    background: 'var(--warn-bg)',
    color: 'var(--warn-text)',
    border: '1px solid var(--warn-border, #FDE68A)',
    borderRadius: 14,
    padding: '13px 15px',
    fontSize: 13,
    lineHeight: 1.55,
  },
};
