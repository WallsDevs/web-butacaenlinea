import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { activar2fa, desactivar2fa, generar2fa, getSeguridad } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { Field } from '../../components/ui/Field';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

/** Seguridad del acceso a la plataforma: verificación en dos pasos (TOTP). */
export default function AdminSeguridad() {
  const queryClient = useQueryClient();
  const [enrolando, setEnrolando] = useState<{ secreto: string; otpauthUri: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const { data: seguridad, isLoading } = useQuery({ queryKey: ['admin-seguridad'], queryFn: getSeguridad });

  const limpiar = () => {
    setEnrolando(null);
    setCodigo('');
    setError(null);
  };

  const generar = useMutation({
    mutationFn: generar2fa,
    onSuccess: (r) => {
      setEnrolando(r);
      setError(null);
      setAviso(null);
    },
  });

  const activar = useMutation({
    mutationFn: () => activar2fa(codigo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-seguridad'] });
      limpiar();
      setAviso('Verificación en dos pasos activada. Desde ahora el acceso pedirá tu código.');
    },
    onError: (e) =>
      setError(e instanceof ApiError && e.code === 'codigo_invalido' ? 'Código incorrecto. Revisa la app e intenta de nuevo.' : 'No se pudo activar.'),
  });

  const desactivar = useMutation({
    mutationFn: () => desactivar2fa(codigo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-seguridad'] });
      limpiar();
      setAviso('Verificación en dos pasos desactivada.');
    },
    onError: (e) =>
      setError(e instanceof ApiError && e.code === 'codigo_invalido' ? 'Código incorrecto.' : 'No se pudo desactivar.'),
  });

  if (isLoading || !seguridad) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando…</div>;
  }

  return (
    <div className={styles.contenido} style={{ maxWidth: 760 }}>
      <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>Seguridad</h2>
      {aviso && (
        <div style={{ fontSize: 13, color: 'var(--blue-700)', background: 'var(--tint-50)', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
          {aviso}
        </div>
      )}

      <div className={ui.card} style={{ padding: 22, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Verificación en dos pasos (2FA)</div>
          {seguridad.totpHabilitado ? (
            <StatusChip tono="ok">Activada</StatusChip>
          ) : (
            <StatusChip tono="warn">Desactivada</StatusChip>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-soft)', margin: '6px 0 16px' }}>
          Con 2FA, entrar a la plataforma exige tu contraseña y un código de 6 dígitos que genera tu
          app de autenticación (Google Authenticator, Authy, 1Password…). Aunque roben tu clave, no
          entran sin tu teléfono.
        </p>

        {!seguridad.totpHabilitado && !enrolando && (
          <button className={ui.btnPrimary} disabled={generar.isPending} onClick={() => generar.mutate()}>
            {generar.isPending ? 'Generando…' : 'Activar 2FA'}
          </button>
        )}

        {!seguridad.totpHabilitado && enrolando && (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ background: '#fff', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
              <QRCodeSVG value={enrolando.otpauthUri} size={170} />
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <ol style={{ fontSize: 13, color: 'var(--text-soft)', paddingLeft: 18, marginBottom: 12, lineHeight: 1.7 }}>
                <li>Abre tu app de autenticación y escanea el código QR.</li>
                <li>
                  ¿Sin cámara? Ingresa la clave manual:{' '}
                  <code style={{ fontSize: 12, background: 'var(--pill-bg)', padding: '2px 6px', borderRadius: 6, wordBreak: 'break-all' }}>
                    {enrolando.secreto}
                  </code>
                </li>
                <li>Escribe aquí el código de 6 dígitos que muestra la app.</li>
              </ol>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <Field label="Código de la app" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoFocus />
                <button
                  className={ui.btnPrimary}
                  style={{ whiteSpace: 'nowrap' }}
                  disabled={codigo.replace(/\s/g, '').length !== 6 || activar.isPending}
                  onClick={() => activar.mutate()}
                >
                  {activar.isPending ? 'Verificando…' : 'Confirmar y activar'}
                </button>
                <button className={ui.btnSecondary} onClick={limpiar}>
                  Cancelar
                </button>
              </div>
              {error && <div style={{ fontSize: 13, color: 'var(--bad-text)', marginTop: 8 }}>{error}</div>}
            </div>
          </div>
        )}

        {seguridad.totpHabilitado && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: 420 }}>
            <Field label="Código actual de la app" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            <button
              className={ui.btnSecondary}
              style={{ color: 'var(--bad-text)', whiteSpace: 'nowrap' }}
              disabled={codigo.replace(/\s/g, '').length !== 6 || desactivar.isPending}
              onClick={() => {
                if (confirm('¿Desactivar la verificación en dos pasos? El acceso quedará solo con contraseña.')) desactivar.mutate();
              }}
            >
              {desactivar.isPending ? 'Verificando…' : 'Desactivar 2FA'}
            </button>
          </div>
        )}
        {seguridad.totpHabilitado && error && (
          <div style={{ fontSize: 13, color: 'var(--bad-text)', marginTop: 8 }}>{error}</div>
        )}
      </div>

      <div className={ui.card} style={{ padding: 22 }}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>Protección contra intentos</div>
        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 6 }}>
          Activa siempre: 5 intentos fallidos de login (por usuario e IP) bloquean nuevos intentos
          durante 15 minutos, en el acceso público y en el de la plataforma. Además, la cuenta del
          operador no puede autenticarse por el login público: solo por este acceso.
        </p>
      </div>
    </div>
  );
}
