import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { actualizarConfiguracionEmpresa, getLineas } from '../../lib/api/endpoints';
import { useAuth } from '../../stores/auth';
import { Field } from '../../components/ui/Field';
import { TasasLinea } from './TasasLinea';
import { WalletEmpresa } from './WalletEmpresa';
import ui from '../../components/ui/ui.module.css';
import { EncabezadoPantalla } from '../../components/ui/EncabezadoPantalla';
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
    modoEtiquetaEquipaje: 'empresa' as 'empresa' | 'app',
    piezasIncluidasPorBoleto: '1',
    tarifaPiezaExtraUsd: '',
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
          modoEtiquetaEquipaje: mia.modoEtiquetaEquipaje ?? 'empresa',
          piezasIncluidasPorBoleto: String(mia.piezasIncluidasPorBoleto ?? 1),
          tarifaPiezaExtraUsd: String(mia.tarifaPiezaExtraUsd ?? ''),
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
        modoEtiquetaEquipaje: form.modoEtiquetaEquipaje,
        piezasIncluidasPorBoleto: Number(form.piezasIncluidasPorBoleto) || 0,
        tarifaPiezaExtraUsd: Number(form.tarifaPiezaExtraUsd) || 0,
      }),
    onSuccess: () => setMensaje('Configuración guardada. Se refleja en tu tienda pública.'),
    onError: () => setMensaje('No se pudo guardar.'),
  });

  return (
    <div className={styles.contenido} style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <EncabezadoPantalla titulo="Configuración" descripcion="Tasas de cambio, wallet de la línea y los datos de la empresa." />
      <TasasLinea />
      <WalletEmpresa />
      <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Datos de la empresa</h2>
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
        <div style={{ height: 1, background: 'var(--divider)', margin: '22px 0 18px' }} />

        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Equipaje en rutas largas
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-soft)', margin: '6px 0 14px' }}>
          Esto decide qué ve el conductor en su app cuando un pasajero sube con maletas. El
          servicio urbano no lleva equipaje.
        </p>

        <div className={ui.pillGroup} style={{ alignSelf: 'flex-start', marginBottom: 14 }}>
          {(['empresa', 'app'] as const).map((m) => (
            <button
              key={m}
              className={`${ui.pill} ${form.modoEtiquetaEquipaje === m ? ui.pillActive : ''}`}
              onClick={() => setForm({ ...form, modoEtiquetaEquipaje: m })}
            >
              {m === 'empresa' ? 'Mis etiquetas numeradas' : 'Las genera la app'}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 14 }}>
          {form.modoEtiquetaEquipaje === 'empresa'
            ? 'El conductor pega una etiqueta de tu talonario, le da la contraparte al pasajero y registra el número en la app. Carga los rangos de cada unidad en Unidades → ficha.'
            : 'La app genera el código de cada pieza y se lo muestra al conductor; también le llega al pasajero en su boleto.'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field
            label="Piezas incluidas en el boleto"
            type="number"
            min={0}
            value={form.piezasIncluidasPorBoleto}
            onChange={(e) => setForm({ ...form, piezasIncluidasPorBoleto: e.target.value })}
          />
          <Field
            label="Pieza extra (USD)"
            type="number"
            min={0}
            value={form.tarifaPiezaExtraUsd}
            onChange={(e) => setForm({ ...form, tarifaPiezaExtraUsd: e.target.value })}
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
