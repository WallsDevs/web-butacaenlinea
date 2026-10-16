import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fijarTasaLinea, getTasasLinea, usarTasaPlataforma } from '../../lib/api/endpoints';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';

const NOMBRE: Record<'bs' | 'cop', { titulo: string; unidad: string; plataforma: string }> = {
  bs: { titulo: 'Bolívares (Bs por USD)', unidad: 'Bs', plataforma: 'BCV automática' },
  cop: { titulo: 'Pesos (COP por USD)', unidad: 'COP', plataforma: 'comercial de la plataforma' },
};

/**
 * Tasas de cambio de la empresa. Por defecto rigen las de la plataforma
 * (BCV / comercial); la empresa puede fijar la suya — administrador y cajero.
 * La tasa propia aplica a sus ventas web, POS y boletos al instante.
 */
export function TasasLinea() {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  const { data: tasas, isLoading } = useQuery({ queryKey: ['tasas-linea'], queryFn: getTasasLinea });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['tasas-linea'] });
    queryClient.invalidateQueries({ queryKey: ['tasas'] });
  };

  const fijar = useMutation({
    mutationFn: ({ moneda, valor }: { moneda: 'BS' | 'COP'; valor: number }) => fijarTasaLinea(moneda, valor),
    onSuccess: (_r, v) => {
      invalidar();
      setValores((x) => ({ ...x, [v.moneda]: '' }));
      setAviso(`Tasa propia de ${v.moneda} fijada. Aplica de inmediato a tus ventas.`);
    },
  });

  const volver = useMutation({
    mutationFn: (moneda: 'BS' | 'COP') => usarTasaPlataforma(moneda),
    onSuccess: () => {
      invalidar();
      setAviso('Listo: esa moneda vuelve a la tasa de la plataforma.');
    },
  });

  if (isLoading || !tasas) {
    return (
      <div className={ui.card} style={{ padding: 22 }}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>Tasas de cambio</div>
        <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 6 }}>Cargando tasas…</div>
      </div>
    );
  }

  return (
    <div className={ui.card} style={{ padding: 22 }}>
      <div style={{ fontWeight: 700, fontSize: 17 }}>Tasas de cambio</div>
      <p style={{ fontSize: 13, color: 'var(--text-soft)', margin: '6px 0 14px' }}>
        Por defecto usas la tasa de la plataforma (BCV). Si fijas una propia, tus precios en Bs y COP
        se calculan con ella — en la web, el POS y los boletos.
      </p>
      {aviso && (
        <div style={{ fontSize: 13, color: 'var(--blue-700)', background: 'var(--tint-50)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
          {aviso}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {(['bs', 'cop'] as const).map((m) => {
          const t = tasas[m];
          const moneda = m.toUpperCase() as 'BS' | 'COP';
          const valorInput = valores[moneda] ?? '';
          return (
            <div key={m} style={{ border: '1.5px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{NOMBRE[m].titulo}</span>
                {t.propia ? (
                  <StatusChip tono="info" size="sm">Tasa propia</StatusChip>
                ) : (
                  <StatusChip tono="neutral" size="sm">Plataforma</StatusChip>
                )}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, margin: '8px 0 2px' }}>
                {t.valor.toLocaleString('es-VE', { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>
                {t.propia
                  ? `La ${NOMBRE[m].plataforma} está en ${t.plataforma.toLocaleString('es-VE', { maximumFractionDigits: 2 })}`
                  : `Usando la ${NOMBRE[m].plataforma}`}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className={ui.fieldInput}
                  style={{ flex: 1, minWidth: 0 }}
                  type="number"
                  placeholder={`Nueva tasa (${NOMBRE[m].unidad})`}
                  value={valorInput}
                  onChange={(e) => setValores((x) => ({ ...x, [moneda]: e.target.value }))}
                />
                <button
                  className={ui.btnPrimary}
                  style={{ whiteSpace: 'nowrap', fontSize: 13, padding: '10px 14px' }}
                  disabled={!(Number(valorInput) > 0) || fijar.isPending}
                  onClick={() => fijar.mutate({ moneda, valor: Number(valorInput) })}
                >
                  Fijar
                </button>
              </div>
              {t.propia && (
                <button
                  className={ui.btnGhost}
                  style={{ fontSize: 13, marginTop: 10 }}
                  disabled={volver.isPending}
                  onClick={() => {
                    if (confirm(`¿Volver a la tasa de la plataforma para ${moneda}?`)) volver.mutate(moneda);
                  }}
                >
                  Volver a la tasa de la plataforma
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
