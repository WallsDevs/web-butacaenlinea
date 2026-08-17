import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { actualizarConfiguracionEmpresa, getLineas } from '../../lib/api/endpoints';
import { useAuth } from '../../stores/auth';
import { Field } from '../../components/ui/Field';
import { TasasLinea } from './TasasLinea';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

/** Datos públicos de la empresa (la comisión la fija la plataforma). */
export default function EmpresaConfiguracion() {
  const usuario = useAuth((s) => s.usuario);
  const [form, setForm] = useState({
    nombre: '',
    razonSocial: '',
    rif: '',
    terminalBase: '',
    telefono: '',
    tasaTerminalUsd: '',
    seguroViajeUsd: '',
  });
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const lineas = await getLineas();
      const mia = lineas.find((l) => l.documentId === usuario?.linea?.documentId);
      if (mia) {
        setForm({
          nombre: mia.nombre,
          razonSocial: mia.razonSocial ?? '',
          rif: mia.rif ?? '',
          terminalBase: mia.terminalBase ?? '',
          telefono: mia.telefono ?? '',
          tasaTerminalUsd: String(mia.tasaTerminalUsd ?? ''),
          seguroViajeUsd: String(mia.seguroViajeUsd ?? ''),
        });
      }
    })();
  }, [usuario?.linea?.documentId]);

  const guardar = useMutation({
    mutationFn: () =>
      actualizarConfiguracionEmpresa({
        nombre: form.nombre,
        razonSocial: form.razonSocial,
        rif: form.rif,
        terminalBase: form.terminalBase,
        telefono: form.telefono,
        tasaTerminalUsd: Number(form.tasaTerminalUsd) || 0,
        seguroViajeUsd: Number(form.seguroViajeUsd) || 0,
      }),
    onSuccess: () => setMensaje('Configuración guardada. Se refleja en tu tienda pública.'),
    onError: () => setMensaje('No se pudo guardar.'),
  });

  return (
    <div className={styles.contenido} style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <TasasLinea />
      <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>
        Configuración de la empresa
      </h2>
      <div className={ui.card} style={{ padding: 24 }}>
        {mensaje && (
          <div style={{ fontSize: 13, color: 'var(--blue-700)', background: 'var(--tint-50)', borderRadius: 12, padding: '10px 12px', marginBottom: 14 }}>
            {mensaje}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Nombre público" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <Field label="Razón social" value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} />
          <Field label="RIF" value={form.rif} onChange={(e) => setForm({ ...form, rif: e.target.value })} />
          <Field label="Terminal base" value={form.terminalBase} onChange={(e) => setForm({ ...form, terminalBase: e.target.value })} />
          <Field label="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          <div />
          <Field
            label="Tasa de terminal (USD por pasajero)"
            type="number"
            value={form.tasaTerminalUsd}
            onChange={(e) => setForm({ ...form, tasaTerminalUsd: e.target.value })}
          />
          <Field
            label="Seguro de viaje (USD por pasajero)"
            type="number"
            value={form.seguroViajeUsd}
            onChange={(e) => setForm({ ...form, seguroViajeUsd: e.target.value })}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button className={ui.btnPrimary} disabled={guardar.isPending || !form.nombre} onClick={() => guardar.mutate()}>
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 12 }}>
        El porcentaje de comisión de la plataforma lo administra Butaca En Línea.
      </p>
    </div>
  );
}
