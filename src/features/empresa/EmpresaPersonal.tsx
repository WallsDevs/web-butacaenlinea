import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useQuery as useQueryHistorial } from '@tanstack/react-query';
import {
  actualizarUsuarioEmpresa,
  getHistorialConductor,
  bloquearUsuarioEmpresa,
  crearTaquilla,
  crearUsuarioEmpresa,
  getTaquillas,
  getUsuariosEmpresa,
} from '../../lib/api/endpoints';
import type { UsuarioEmpresa } from '../../lib/api/endpoints';
import { Field } from '../../components/ui/Field';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const NOMBRE_ROL: Record<string, string> = { cajero: 'Cajero', chofer: 'Conductor', colector: 'Colector', empresa: 'Administrador' };

/** Personal de la empresa: cajeros, conductores y administradores. */
export default function EmpresaPersonal() {
  const queryClient = useQueryClient();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<UsuarioEmpresa | null>(null);
  const [historialDe, setHistorialDe] = useState<UsuarioEmpresa | null>(null);
  const [nuevaTaquilla, setNuevaTaquilla] = useState<{ nombre: string; serie: string } | null>(null);
  const [errorTaquilla, setErrorTaquilla] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombreCorto: '',
    username: '',
    password: '',
    rol: 'cajero' as 'cajero' | 'chofer' | 'colector' | 'empresa',
    taquillaId: '',
    cedula: '',
  });
  const [error, setError] = useState<string | null>(null);

  const { data: usuarios, isLoading } = useQuery({ queryKey: ['empresa-usuarios'], queryFn: getUsuariosEmpresa });
  const { data: taquillas } = useQuery({ queryKey: ['taquillas'], queryFn: getTaquillas });

  const abrirEdicion = (u: UsuarioEmpresa) => {
    setForm({
      nombreCorto: u.nombreCorto ?? '',
      username: u.username,
      password: '',
      rol: (u.rol as 'cajero' | 'chofer' | 'colector' | 'empresa') ?? 'cajero',
      taquillaId: u.taquillaId ?? '',
      cedula: u.cedula ?? '',
    });
    setError(null);
    setEditando(u);
  };

  const cerrarModal = () => {
    setCreando(false);
    setEditando(null);
    setForm({ nombreCorto: '', username: '', password: '', rol: 'cajero', taquillaId: '', cedula: '' });
    setError(null);
  };

  const actualizar = useMutation({
    mutationFn: () =>
      actualizarUsuarioEmpresa(editando!.id, {
        nombreCorto: form.nombreCorto,
        password: form.password || undefined,
        rol: form.rol,
        taquillaId: form.rol === 'cajero' ? form.taquillaId || null : null,
        cedula: form.rol === 'chofer' ? form.cedula : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresa-usuarios'] });
      queryClient.invalidateQueries({ queryKey: ['choferes'] });
      cerrarModal();
    },
    onError: (e) => {
      const code = (e as { code?: string }).code;
      setError(
        code === 'no_puedes_cambiar_tu_rol'
          ? 'No puedes quitarte a ti mismo el rol de Administrador.'
          : code === 'pin_invalido'
            ? 'La clave del personal a bordo son exactamente 6 dígitos.'
            : code === 'password_corta'
              ? 'La contraseña debe tener al menos 6 caracteres.'
              : 'No se pudo guardar los cambios.'
      );
    },
  });

  const crear = useMutation({
    mutationFn: () =>
      crearUsuarioEmpresa({
        username: form.username,
        password: form.password,
        nombreCorto: form.nombreCorto,
        rol: form.rol,
        taquillaId: form.rol === 'cajero' ? form.taquillaId || undefined : undefined,
        cedula: form.rol === 'chofer' ? form.cedula || undefined : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresa-usuarios'] });
      queryClient.invalidateQueries({ queryKey: ['choferes'] });
      cerrarModal();
    },
    onError: (e) =>
      setError(
        (e as { code?: string }).code === 'pin_invalido'
          ? 'La clave del personal a bordo son exactamente 6 dígitos.'
          : 'No se pudo crear. ¿El usuario ya existe?'
      ),
  });

  const crearCaja = useMutation({
    mutationFn: () =>
      crearTaquilla({
        nombre: nuevaTaquilla!.nombre.trim(),
        serieFolio: nuevaTaquilla!.serie.trim().toUpperCase(),
      }),
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ['taquillas'] });
      setForm((f) => ({ ...f, taquillaId: t.documentId }));
      setNuevaTaquilla(null);
      setErrorTaquilla(null);
    },
    onError: () => setErrorTaquilla('No se pudo crear. ¿Esa serie ya existe?'),
  });

  const bloquear = useMutation({
    mutationFn: ({ id, bloqueado }: { id: number; bloqueado: boolean }) => bloquearUsuarioEmpresa(id, bloqueado),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['empresa-usuarios'] }),
  });

  /**
   * El personal a bordo entra a la app del conductor con una CLAVE DE 6
   * DÍGITOS, no con contraseña de texto: es un teclado numérico dentro de una
   * buseta. Cajero y administrador siguen con contraseña normal, porque entran
   * por la web.
   */
  const usaPin = form.rol === 'chofer' || form.rol === 'colector';
  const claveOk = usaPin ? /^\d{6}$/.test(form.password) : form.password.length >= 6;
  const claveOkAlEditar = form.password.length === 0 || claveOk;

  // Conductor/colector usan PIN de 6 dígitos y el resto contraseña: al cambiar de tipo
  // la clave escrita deja de valer (y el campo la oculta), así que se limpia.
  const cambiarRol = (rol: typeof form.rol) => {
    const pinNuevo = rol === 'chofer' || rol === 'colector';
    setForm({ ...form, rol, password: pinNuevo !== usaPin ? '' : form.password });
  };
  // Qué falta para habilitar el botón (se muestra bajo el campo, no solo se deshabilita)
  const falta = editando
    ? null
    : !form.nombreCorto.trim()
      ? 'Falta el nombre.'
      : !form.username.trim()
        ? 'Falta el usuario.'
        : !claveOk
          ? usaPin
            ? 'La clave debe tener exactamente 6 dígitos.'
            : 'La contraseña debe tener al menos 6 caracteres.'
          : null;

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {isLoading ? 'Cargando…' : `${usuarios?.length ?? 0} personas`}
        </h2>
        <button className={ui.btnPrimary} style={{ marginLeft: 'auto', fontSize: 14, padding: '12px 20px' }} onClick={() => setCreando(true)}>
          Agregar persona
        </button>
      </div>

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Taquilla</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(usuarios ?? []).map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.nombreCorto ?? '—'}</td>
                <td style={{ color: 'var(--text-soft)' }}>{u.username}</td>
                <td>{NOMBRE_ROL[u.rol ?? ''] ?? u.rolNombre ?? '—'}</td>
                <td style={{ color: 'var(--text-soft)' }}>{u.taquilla ?? '—'}</td>
                <td>
                  {u.bloqueado ? (
                    <StatusChip tono="bad" size="sm">Bloqueado</StatusChip>
                  ) : (
                    <StatusChip tono="ok" size="sm">Activo</StatusChip>
                  )}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {u.rol === 'chofer' && (
                    <button className={ui.btnGhost} style={{ fontSize: 13, marginRight: 12 }} onClick={() => setHistorialDe(u)}>
                      Historial
                    </button>
                  )}
                  <button className={ui.btnGhost} style={{ fontSize: 13, marginRight: 12 }} onClick={() => abrirEdicion(u)}>
                    Editar
                  </button>
                  <button
                    style={{ fontSize: 13, fontWeight: 600, color: u.bloqueado ? 'var(--ok-text)' : 'var(--bad-text)' }}
                    onClick={() => bloquear.mutate({ id: u.id, bloqueado: !u.bloqueado })}
                  >
                    {u.bloqueado ? 'Reactivar' : 'Bloquear'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creando || editando) && (
        <div className={styles.velo}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              {editando ? `Editar a ${editando.nombreCorto ?? editando.username}` : 'Agregar persona'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 16 }}>
              {editando
                ? 'Cambia el rol, la taquilla o el nombre. Deja la clave en blanco para no cambiarla.'
                : usaPin
                  ? 'Conductor y colector trabajan en la app del teléfono: entran con su usuario y una clave de 6 dígitos que tú le asignas aquí.'
                  : 'El usuario queda vinculado a tu empresa y entra con su clave en butacaenlinea.com. El rol Administrador tiene acceso completo al panel de tu empresa (igual que tú).'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className={ui.pillGroup} style={{ alignSelf: 'flex-start' }}>
                {(['cajero', 'chofer', 'colector', 'empresa'] as const).map((r) => (
                  <button key={r} className={`${ui.pill} ${form.rol === r ? ui.pillActive : ''}`} onClick={() => cambiarRol(r)}>
                    {NOMBRE_ROL[r]}
                  </button>
                ))}
              </div>
              <Field label="Nombre (ej. M. Contreras)" value={form.nombreCorto} onChange={(e) => setForm({ ...form, nombreCorto: e.target.value })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Usuario" value={form.username} disabled={Boolean(editando)} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                <Field
                  label={
                    usaPin
                      ? editando
                        ? 'Nueva clave de 6 dígitos (opcional)'
                        : 'Clave de 6 dígitos'
                      : editando
                        ? 'Nueva contraseña (opcional)'
                        : 'Contraseña'
                  }
                  type="password"
                  value={form.password}
                  inputMode={usaPin ? 'numeric' : undefined}
                  maxLength={usaPin ? 6 : undefined}
                  placeholder={usaPin ? '••••••' : undefined}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      password: usaPin
                        ? e.target.value.replace(/\D/g, '').slice(0, 6)
                        : e.target.value,
                    })
                  }
                />
              </div>
              {usaPin && (
                <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: -4 }}>
                  Con estos 6 dígitos entra a la app en su teléfono. Solo números.
                </div>
              )}
              {form.rol === 'cajero' && (
                <label className={ui.field}>
                  <span className={ui.fieldLabel}>Taquilla</span>
                  <select
                    className={ui.fieldInput}
                    value={nuevaTaquilla ? '__nueva__' : form.taquillaId}
                    onChange={(e) => {
                      if (e.target.value === '__nueva__') {
                        const n = (taquillas?.length ?? 0) + 1;
                        setNuevaTaquilla({ nombre: `Caja ${String(n).padStart(2, '0')}`, serie: `C${String(n).padStart(2, '0')}` });
                      } else {
                        setNuevaTaquilla(null);
                        setForm({ ...form, taquillaId: e.target.value });
                      }
                    }}
                  >
                    <option value="">Sin taquilla fija</option>
                    {(taquillas ?? []).map((t) => (
                      <option key={t.documentId} value={t.documentId}>
                        {t.nombre} ({t.serieFolio})
                      </option>
                    ))}
                    <option value="__nueva__">+ Nueva taquilla…</option>
                  </select>
                  {nuevaTaquilla && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 8, marginTop: 10, alignItems: 'end' }}>
                      <Field
                        label="Nombre (ej. Taquilla Terminal Mérida)"
                        value={nuevaTaquilla.nombre}
                        onChange={(e) => setNuevaTaquilla({ ...nuevaTaquilla, nombre: e.target.value })}
                        autoFocus
                      />
                      <Field
                        label="Serie"
                        value={nuevaTaquilla.serie}
                        onChange={(e) => setNuevaTaquilla({ ...nuevaTaquilla, serie: e.target.value.toUpperCase().slice(0, 4) })}
                      />
                      <button
                        type="button"
                        className={ui.btnSecondary}
                        style={{ whiteSpace: 'nowrap' }}
                        disabled={!nuevaTaquilla.nombre.trim() || !/^[A-Z0-9]{2,4}$/.test(nuevaTaquilla.serie) || crearCaja.isPending}
                        onClick={() => crearCaja.mutate()}
                      >
                        {crearCaja.isPending ? 'Creando…' : 'Crear'}
                      </button>
                      <span style={{ gridColumn: '1 / -1', fontSize: 12, color: errorTaquilla ? 'var(--bad-text)' : 'var(--text-faint)' }}>
                        {errorTaquilla ?? 'La serie numera sus boletos (ej. C02-000001). Debe ser única.'}
                      </span>
                    </div>
                  )}
                </label>
              )}
              {form.rol === 'chofer' && (
                <Field label="Cédula del conductor" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} />
              )}
              {error && <div style={{ fontSize: 13, color: 'var(--bad-text)' }}>{error}</div>}
              {falta && !error && <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>{falta}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className={ui.btnSecondary} onClick={cerrarModal}>
                  Cancelar
                </button>
                <button
                  className={ui.btnPrimary}
                  disabled={
                    editando
                      ? !form.nombreCorto || !claveOkAlEditar || actualizar.isPending
                      : Boolean(falta) || crear.isPending
                  }
                  onClick={() => (editando ? actualizar.mutate() : crear.mutate())}
                >
                  {editando
                    ? actualizar.isPending ? 'Guardando…' : 'Guardar cambios'
                    : crear.isPending ? 'Creando…' : 'Crear usuario'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {historialDe && <ModalHistorial usuario={historialDe} onCerrar={() => setHistorialDe(null)} />}
    </div>
  );
}

const ESTADO_VIAJE: Record<string, { label: string; tono: 'ok' | 'warn' | 'bad' | 'info' | 'neutral' }> = {
  programada: { label: 'Programada', tono: 'neutral' },
  abordando: { label: 'Abordando', tono: 'info' },
  en_ruta: { label: 'En Ruta', tono: 'info' },
  finalizada: { label: 'Finalizada', tono: 'ok' },
  cancelada: { label: 'Cancelada', tono: 'bad' },
};

/** Asignaciones del conductor: unidad fija + historial de viajes con su unidad. */
function ModalHistorial({ usuario, onCerrar }: { usuario: UsuarioEmpresa; onCerrar: () => void }) {
  const { data, isLoading } = useQueryHistorial({
    queryKey: ['historial-conductor', usuario.id],
    queryFn: () => getHistorialConductor(usuario.id),
  });
  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
  const horaDe = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className={styles.velo}>
      <div className={styles.modal} style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 20, fontWeight: 700 }}>Asignaciones de {usuario.nombreCorto ?? usuario.username}</h3>
        {isLoading || !data ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando…</div>
        ) : (
          <>
            <div style={{ fontSize: 14, margin: '10px 0 14px' }}>
              {data.unidadesACargo.length > 0 ? (
                <>
                  <span>
                    {data.unidadesACargo.length === 1 ? 'Unidad a su cargo: ' : 'Unidades a su cargo: '}
                  </span>
                  {data.unidadesACargo.map((u, i) => (
                    <span key={u.numero}>
                      {i > 0 && ', '}
                      <strong>
                        {u.numero} · {u.marcaModelo}
                      </strong>
                      {u.estado === 'en_mantenimiento' && (
                        <span style={{ color: 'var(--warn-text)' }}> (en taller)</span>
                      )}
                    </span>
                  ))}
                  {data.unidadesACargo.length > 1 && (
                    <div style={{ color: 'var(--text-soft)', marginTop: 4 }}>
                      Escoge cuál maneja al abrir su turno en la app.
                    </div>
                  )}
                </>
              ) : (
                <span style={{ color: 'var(--text-soft)' }}>
                  Sin unidad a su cargo (opera la unidad de cada viaje) — asígnala en Unidades → ficha
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Viajes ({data.viajes.length})
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Ruta</th>
                    <th>Unidad</th>
                    <th>Pasajeros</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.viajes.map((v) => (
                    <tr key={v.documentId}>
                      <td style={{ fontWeight: 600 }}>
                        {fecha(v.fechaHoraSalida)} {horaDe(v.fechaHoraSalida)}
                      </td>
                      <td>
                        {v.ruta?.origen} → {v.ruta?.destino}
                      </td>
                      <td style={{ color: 'var(--text-soft)' }}>{v.unidad?.numero ?? '—'}</td>
                      <td style={{ color: 'var(--text-soft)' }}>{v.abordados ?? '—'}</td>
                      <td>
                        <StatusChip tono={ESTADO_VIAJE[v.estado]?.tono ?? 'neutral'} size="sm">
                          {ESTADO_VIAJE[v.estado]?.label ?? v.estado}
                        </StatusChip>
                      </td>
                    </tr>
                  ))}
                  {!data.viajes.length && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 20 }}>
                        Aún no tiene viajes registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className={ui.btnSecondary} onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
