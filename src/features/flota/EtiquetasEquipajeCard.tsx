import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cargarEtiquetas, getResumenEtiquetas } from '../../lib/api/endpoints';
import { StatusChip } from '../../components/ui/StatusChip';
import { Field } from '../../components/ui/Field';
import ui from '../../components/ui/ui.module.css';
import styles from './flota.module.css';

/**
 * Talonario de etiquetas de equipaje de la unidad. Son las etiquetas FÍSICAS
 * numeradas que la empresa ya usa: se cargan por rango, el conductor registra
 * cuál pegó a cada maleta y al usarse sale de la lista para que no se repita.
 *
 * Solo aplica si la empresa escogió "Mis etiquetas numeradas" en Configuración.
 */
export function EtiquetasEquipajeCard({
  unidadId,
  modoEmpresa,
}: {
  unidadId: string;
  modoEmpresa: boolean;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ prefijo: 'ET', desde: '', hasta: '' });
  const [aviso, setAviso] = useState<string | null>(null);

  const { data: resumen } = useQuery({
    queryKey: ['etiquetas-equipaje', unidadId],
    queryFn: () => getResumenEtiquetas(unidadId),
  });

  const cargar = useMutation({
    mutationFn: () =>
      cargarEtiquetas(unidadId, {
        prefijo: form.prefijo.trim() || 'ET',
        desde: Number(form.desde),
        hasta: Number(form.hasta),
      }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['etiquetas-equipaje', unidadId] });
      setForm({ ...form, desde: '', hasta: '' });
      setAviso(
        r.repetidas > 0
          ? `Se cargaron ${r.creadas}. Otras ${r.repetidas} ya existían y se saltaron.`
          : `Se cargaron ${r.creadas} etiquetas.`
      );
    },
    onError: (e) => {
      const code = (e as { code?: string }).code;
      setAviso(
        code === 'rango_muy_grande'
          ? 'Máximo 500 etiquetas por carga. Divide el talonario.'
          : code === 'rango_invalido'
            ? 'Revisa el rango: el número final tiene que ser mayor o igual al inicial.'
            : 'No se pudo cargar el talonario.'
      );
    },
  });

  const desde = Number(form.desde);
  const hasta = Number(form.hasta);
  const rangoOk = Number.isFinite(desde) && Number.isFinite(hasta) && hasta >= desde && form.desde !== '' && form.hasta !== '';
  const cuantas = rangoOk ? hasta - desde + 1 : 0;

  if (!modoEmpresa) {
    return (
      <div className={styles.tarjeta} style={{ marginTop: 18 }}>
        <div className={styles.kicker}>Etiquetas de equipaje</div>
        <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 6 }}>
          Tu empresa tiene configurado que <strong>las genera la app</strong>, así que no hace
          falta cargar talonarios. Puedes cambiarlo en Configuración.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tarjeta} style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className={styles.kicker}>Etiquetas de equipaje</div>
          <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>
            El talonario numerado que el conductor pega a las maletas de esta unidad.
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          {resumen && resumen.libres > 0 ? (
            <StatusChip tono="ok">{resumen.libres} libres</StatusChip>
          ) : (
            <StatusChip tono="warn">Sin etiquetas libres</StatusChip>
          )}
        </div>
      </div>

      {resumen && resumen.total > 0 && (
        <div style={{ display: 'flex', gap: 26, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Cargadas</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 3 }}>{resumen.total}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Usadas</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 3 }}>{resumen.usadas}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Libres</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 3, color: 'var(--blue-700)' }}>
              {resumen.libres}
            </div>
          </div>
          {resumen.rangos.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Rangos</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>
                {resumen.rangos.join(' · ')}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr auto', gap: 12, marginTop: 16, alignItems: 'end' }}>
        <Field
          label="Prefijo"
          value={form.prefijo}
          maxLength={8}
          onChange={(e) => setForm({ ...form, prefijo: e.target.value.toUpperCase() })}
        />
        <Field
          label="Desde"
          type="number"
          value={form.desde}
          onChange={(e) => setForm({ ...form, desde: e.target.value })}
        />
        <Field
          label="Hasta"
          type="number"
          value={form.hasta}
          onChange={(e) => setForm({ ...form, hasta: e.target.value })}
        />
        <button
          className={ui.btnPrimary}
          style={{ fontSize: 14 }}
          disabled={!rangoOk || cuantas > 500 || cargar.isPending}
          onClick={() => cargar.mutate()}
        >
          {cargar.isPending ? 'Cargando…' : 'Cargar'}
        </button>
      </div>

      <div style={{ fontSize: 13, color: cuantas > 500 ? 'var(--bad-text)' : 'var(--text-soft)', marginTop: 10 }}>
        {rangoOk
          ? cuantas > 500
            ? `${cuantas} etiquetas es demasiado de una vez: máximo 500 por carga.`
            : `Se cargarán ${cuantas} etiquetas, de ${form.prefijo}-${form.desde} a ${form.prefijo}-${form.hasta}.`
          : 'Escribe el rango impreso en tu talonario, por ejemplo del 4451 al 4500.'}
      </div>
      {aviso && (
        <div style={{ fontSize: 13, color: 'var(--blue-700)', marginTop: 8 }}>{aviso}</div>
      )}
    </div>
  );
}
