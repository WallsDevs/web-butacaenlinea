import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { actualizarEmpresa, crearEmpresa, getAdminEmpresas, subirArchivo } from '../../lib/api/endpoints';
import { urlMedia } from '../../lib/api/client';
import { LogoLockup } from '../../components/brand/LogoMark';
import type { AdminEmpresa } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { fechaCorta } from '../../lib/time';
import { Field } from '../../components/ui/Field';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

interface FormEmpresa {
  nombre: string;
  rif: string;
  razonSocial: string;
  terminalBase: string;
  telefono: string;
  comisionPct: string;
  adminUsername: string;
  adminPassword: string;
  adminNombre: string;
}

const NUEVA: FormEmpresa = {
  nombre: '',
  rif: '',
  razonSocial: '',
  terminalBase: '',
  telefono: '',
  comisionPct: '5',
  adminUsername: '',
  adminPassword: '',
  adminNombre: '',
};

/** Onboarding y administración de las empresas afiliadas. */
export default function AdminEmpresas() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormEmpresa | null>(null);
  const [editando, setEditando] = useState<AdminEmpresa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [ficha, setFicha] = useState<{
    nombre: string;
    rif: string;
    slug: string;
    usuario: string;
    clave: string;
    adminNombre: string;
  } | null>(null);

  const { data: empresas, isLoading } = useQuery({ queryKey: ['admin-empresas'], queryFn: getAdminEmpresas });

  const cerrar = () => {
    setForm(null);
    setEditando(null);
    setError(null);
    setLogo(null);
  };

  const crear = useMutation({
    mutationFn: async (f: FormEmpresa) => {
      const logoId = logo ? (await subirArchivo(logo)).id : undefined;
      return crearEmpresa({
        nombre: f.nombre,
        rif: f.rif || undefined,
        razonSocial: f.razonSocial || undefined,
        terminalBase: f.terminalBase || undefined,
        telefono: f.telefono || undefined,
        comisionPct: Number(f.comisionPct) || 5,
        logoId,
        admin: { username: f.adminUsername, password: f.adminPassword, nombreCorto: f.adminNombre || undefined },
      });
    },
    onSuccess: (r, f) => {
      queryClient.invalidateQueries({ queryKey: ['admin-empresas'] });
      setFicha({
        nombre: f.nombre,
        rif: f.rif,
        slug: r.slug,
        usuario: f.adminUsername,
        clave: f.adminPassword,
        adminNombre: f.adminNombre || f.adminUsername,
      });
      cerrar();
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : null;
      setError(
        code === 'usuario_ya_existe'
          ? 'Ese nombre de usuario ya existe. Escoge otro.'
          : code === 'password_corta'
            ? 'La contraseña debe tener al menos 6 caracteres.'
            : 'No se pudo crear la empresa.'
      );
    },
  });

  const actualizar = useMutation({
    mutationFn: async ({ documentId, datos }: { documentId: string; datos: Record<string, unknown> }) => {
      const logoId = logo ? (await subirArchivo(logo)).id : undefined;
      return actualizarEmpresa(documentId, logoId ? { ...datos, logoId } : datos);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-empresas'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      cerrar();
    },
    onError: () => setError('No se pudo guardar.'),
  });

  const abrirEdicion = (e: AdminEmpresa) => {
    setEditando(e);
    setForm({
      nombre: e.nombre,
      rif: e.rif ?? '',
      razonSocial: e.razonSocial ?? '',
      terminalBase: e.terminalBase ?? '',
      telefono: e.telefono ?? '',
      comisionPct: String(e.comisionPct),
      adminUsername: '',
      adminPassword: '',
      adminNombre: '',
    });
  };

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {isLoading ? 'Cargando…' : `${empresas?.length ?? 0} empresa${(empresas?.length ?? 0) === 1 ? '' : 's'}`}
        </h2>
        <button
          className={ui.btnPrimary}
          style={{ marginLeft: 'auto', fontSize: 14, padding: '12px 20px' }}
          onClick={() => { setEditando(null); setForm(NUEVA); setAviso(null); }}
        >
          Nueva empresa
        </button>
      </div>

      {aviso && (
        <div style={{ fontSize: 13, color: 'var(--blue-700)', background: 'var(--tint-50)', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
          {aviso}
        </div>
      )}

      <div className={ui.card} style={{ overflow: 'hidden' }}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>RIF</th>
              <th>Terminal</th>
              <th>Comisión</th>
              <th>Personas</th>
              <th>Alta</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(empresas ?? []).map((e) => (
              <tr key={e.documentId}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {e.logoUrl ? (
                      <img
                        src={urlMedia(e.logoUrl)!}
                        alt=""
                        style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }}
                      />
                    ) : (
                      <span
                        style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--pill-bg)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, color: 'var(--text-soft)' }}
                      >
                        {e.nombre.slice(0, 1)}
                      </span>
                    )}
                    <div>
                      <div style={{ fontWeight: 600 }}>{e.nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{e.slug}</div>
                    </div>
                  </div>
                </td>
                <td style={{ color: 'var(--text-soft)' }}>{e.rif || '—'}</td>
                <td style={{ color: 'var(--text-soft)' }}>{e.terminalBase || '—'}</td>
                <td style={{ fontWeight: 600 }}>{e.comisionPct}%</td>
                <td style={{ color: 'var(--text-soft)' }}>{e.usuarios}</td>
                <td style={{ color: 'var(--text-soft)' }}>{fechaCorta(e.creadaEn)}</td>
                <td>
                  {e.activa ? (
                    <StatusChip tono="ok" size="sm">Activa</StatusChip>
                  ) : (
                    <StatusChip tono="bad" size="sm">Suspendida</StatusChip>
                  )}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className={ui.btnGhost} style={{ fontSize: 13, marginRight: 12 }} onClick={() => abrirEdicion(e)}>
                    Editar
                  </button>
                  <button
                    style={{ fontSize: 13, fontWeight: 600, color: e.activa ? 'var(--bad-text)' : 'var(--ok-text)' }}
                    onClick={() => {
                      const accion = e.activa ? 'suspender' : 'reactivar';
                      if (confirm(`¿Seguro que quieres ${accion} a ${e.nombre}?`)) {
                        actualizar.mutate({ documentId: e.documentId, datos: { activa: !e.activa } });
                      }
                    }}
                  >
                    {e.activa ? 'Suspender' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && !empresas?.length && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 24 }}>
                  Sin empresas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <div className={styles.velo} onClick={cerrar}>
          <div className={styles.modal} onClick={(ev) => ev.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              {editando ? `Editar ${editando.nombre}` : 'Nueva empresa'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 16 }}>
              {editando
                ? 'Datos públicos y comisión de la plataforma.'
                : 'Se crea la empresa con su taquilla inicial y el usuario administrador con el que entran a su panel.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <Field label="Nombre comercial" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus={!editando} />
                <Field label="Comisión %" type="number" value={form.comisionPct} onChange={(e) => setForm({ ...form, comisionPct: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="RIF" value={form.rif} onChange={(e) => setForm({ ...form, rif: e.target.value })} />
                <Field label="Razón social" value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Terminal base" value={form.terminalBase} onChange={(e) => setForm({ ...form, terminalBase: e.target.value })} />
                <Field label="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </div>
              <div className={ui.field}>
                <span className={ui.fieldLabel}>Logo</span>
                <input
                  id="logo-empresa"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  style={{ display: 'none' }}
                  onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
                />
                <label
                  htmlFor="logo-empresa"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    border: '1.5px dashed var(--border)',
                    borderRadius: 'var(--r-14)',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: 'var(--pill-bg)',
                  }}
                >
                  {logo ? (
                    <img
                      src={URL.createObjectURL(logo)}
                      alt=""
                      style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)', background: '#fff' }}
                    />
                  ) : editando?.logoUrl ? (
                    <img
                      src={urlMedia(editando.logoUrl)!}
                      alt=""
                      style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)', background: '#fff' }}
                    />
                  ) : (
                    <span
                      style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', color: 'var(--text-faint)' }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="3" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    </span>
                  )}
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>
                      {logo ? logo.name : editando?.logoUrl ? 'Cambiar logo' : 'Subir el logo de la empresa'}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
                      {logo ? 'Clic para cambiar' : 'PNG, JPG o SVG · opcional'}
                    </span>
                  </span>
                  {logo && (
                    <button
                      type="button"
                      style={{ marginLeft: 'auto', color: 'var(--bad-text)', fontWeight: 700, fontSize: 16, background: 'transparent', border: 0, cursor: 'pointer' }}
                      onClick={(ev) => {
                        ev.preventDefault();
                        setLogo(null);
                      }}
                    >
                      ×
                    </button>
                  )}
                </label>
              </div>
              {!editando && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6 }}>
                    Administrador de la empresa
                  </div>
                  <Field label="Nombre (ej. Juan Pérez)" value={form.adminNombre} onChange={(e) => setForm({ ...form, adminNombre: e.target.value })} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Usuario" value={form.adminUsername} onChange={(e) => setForm({ ...form, adminUsername: e.target.value })} />
                    <Field label="Contraseña" type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
                  </div>
                </>
              )}
              {error && <div style={{ fontSize: 13, color: 'var(--bad-text)' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className={ui.btnSecondary} onClick={cerrar}>
                  Cancelar
                </button>
                <button
                  className={ui.btnPrimary}
                  disabled={
                    editando
                      ? !form.nombre || actualizar.isPending
                      : !form.nombre || !form.adminUsername || form.adminPassword.length < 6 || crear.isPending
                  }
                  onClick={() =>
                    editando
                      ? actualizar.mutate({
                          documentId: editando.documentId,
                          datos: {
                            nombre: form.nombre,
                            rif: form.rif,
                            razonSocial: form.razonSocial,
                            terminalBase: form.terminalBase,
                            telefono: form.telefono,
                            comisionPct: Number(form.comisionPct) || 5,
                          },
                        })
                      : crear.mutate(form)
                  }
                >
                  {editando
                    ? actualizar.isPending ? 'Guardando…' : 'Guardar cambios'
                    : crear.isPending ? 'Creando…' : 'Crear empresa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {ficha && (
        <div className={styles.velo} onClick={() => setFicha(null)}>
          <div className={`${styles.modal} ficha-imprimible`} style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <LogoLockup />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 700, margin: '10px 0 2px' }}>Bienvenido, {ficha.nombre}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 16 }}>
              Ficha de acceso a Butaca En Línea{ficha.rif ? ` · RIF ${ficha.rif}` : ''}. Compártela solo con el
              administrador de la empresa.
            </p>
            <div style={{ border: '1.5px solid var(--border)', borderRadius: 14, padding: 18, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Credenciales de acceso
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 14 }}>
                <span style={{ color: 'var(--text-soft)' }}>Dirección</span>
                <strong>butacaenlinea.com/ingresar</strong>
                <span style={{ color: 'var(--text-soft)' }}>Administrador</span>
                <strong>{ficha.adminNombre}</strong>
                <span style={{ color: 'var(--text-soft)' }}>Usuario</span>
                <strong style={{ fontFamily: 'monospace' }}>{ficha.usuario}</strong>
                <span style={{ color: 'var(--text-soft)' }}>Contraseña</span>
                <strong style={{ fontFamily: 'monospace' }}>{ficha.clave}</strong>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.7, marginBottom: 16 }}>
              <strong style={{ color: 'var(--text)' }}>Primeros pasos:</strong> 1) Entrar con el usuario y la
              contraseña · 2) Rutas: crear los trayectos y sus tarifas por clase de asiento · 3) Unidades:
              registrar los buses con su mapa de asientos · 4) Personal: crear cajeros y conductores ·
              5) Salidas: programar el primer viaje — queda en venta al instante.
            </div>
            <div className="no-print" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className={ui.btnSecondary} onClick={() => setFicha(null)}>
                Cerrar
              </button>
              <button className={ui.btnPrimary} onClick={() => window.print()}>
                Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
