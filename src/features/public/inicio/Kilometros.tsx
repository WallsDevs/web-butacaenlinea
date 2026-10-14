import { H2, Demo } from './piezas';

/**
 * DEMOSTRACIÓN del programa de kilómetros. Se acumulan los km de cada boleto
 * comprado, en cualquier línea, y al llegar a ciertos umbrales el pasajero
 * obtiene un beneficio. Los umbrales y beneficios reales los definirá el
 * superadmin (desarrollo pendiente): estas cifras son de ejemplo y viven
 * juntas aquí para reemplazarlas por la API sin tocar el diseño.
 */
const ACTUAL = 2340;
const TOPE = 3000;
// Distancia de ejemplo por destino (el servidor aún no guarda km por ruta)
const DISTANCIA: Record<string, number> = { Caracas: 820, Mérida: 230, Valencia: 660, Maracaibo: 440, 'San Cristóbal': 820 };
const NIVELES = [
  { nombre: 'Viajero', desc: 'Desde tu primer viaje', desde: 0 },
  { nombre: 'Frecuente', desc: 'Desde 1.000 km · prioridad en abordaje', desde: 1000 },
  { nombre: 'Ruta Oro', desc: 'Desde 5.000 km · puesto VIP sin costo cada mes', desde: 5000 },
];
const PREMIOS = [
  { nombre: 'Puesto VIP', km: '1.500 km' },
  { nombre: 'Maleta extra', km: '800 km' },
  { nombre: 'Viaje gratis', km: '3.000 km' },
];
const n = (v: number) => v.toLocaleString('es-VE');

export function Kilometros({ destino, pasajeros }: { destino: string; pasajeros: number }) {
  const kmViaje = (DISTANCIA[destino] ?? 500) * Math.max(1, pasajeros);
  const nuevo = ACTUAL + kmViaje;
  const nivel = ACTUAL >= 3000 ? 2 : ACTUAL >= 1000 ? 1 : 0;
  const llega = nuevo >= TOPE;
  return (
    <section id="kilometros" className="kmCuerpo" style={{ background: '#0B2A6B', borderRadius: 28, padding: 40, display: 'flex', flexWrap: 'wrap', gap: 40, color: '#FFFFFF', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', left: -80, bottom: -120, width: 320, height: 320, borderRadius: '50%', background: 'rgba(96,165,250,.10)' }} />
      <div style={{ position: 'relative', flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <H2>Cada viaje suma kilómetros</H2>
          <Demo oscuro />
        </div>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: '#C7D9FB', maxWidth: 460, textWrap: 'pretty' }}>
          Ganas un kilómetro por cada kilómetro recorrido, en cualquier línea afiliada. Canjéalos por puestos VIP, equipaje extra o viajes completos.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
          {NIVELES.map((nv, i) => (
            <div key={nv.nombre} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', flex: 'none', boxSizing: 'border-box', border: `3px solid ${i <= nivel ? '#60A5FA' : 'rgba(159,192,255,.4)'}`, background: i === nivel ? '#60A5FA' : 'transparent' }} />
              <span style={{ fontSize: 16, fontWeight: 700, width: 120 }}>{nv.nombre}</span>
              <span style={{ fontSize: 14, color: '#C7D9FB' }}>{nv.desc}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative', flex: '1 1 380px', minWidth: 0, background: '#FFFFFF', color: '#0F172A', borderRadius: 22, padding: 26, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 44, height: 44, borderRadius: '50%', background: '#EFF4FF', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>YP</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Yorman Peña</span>
            <span style={{ fontSize: 13, color: '#7C8AA5' }}>Nivel Frecuente · 14 viajes</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1 }}>{n(ACTUAL)}</span>
          <span style={{ fontSize: 16, color: '#7C8AA5' }}>km</span>
          <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: '#2563EB', whiteSpace: 'nowrap' }}>+{n(kmViaje)} con este viaje</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ position: 'relative', height: 12, borderRadius: 999, background: '#EEF2F9', overflow: 'hidden' }}>
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, nuevo / 30)}%`, background: '#9FC0FF', borderRadius: 999 }} />
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, ACTUAL / 30)}%`, background: '#2563EB', borderRadius: 999 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#7C8AA5' }}>
            <span>0</span><span>1.500 · Puesto VIP</span><span>3.000 · Viaje gratis</span>
          </div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 14, background: llega ? '#E7F6EC' : '#EFF4FF', color: llega ? '#166534' : '#1D4ED8', fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>
          {llega ? `Con este viaje llegas a ${n(nuevo)} km: ya puedes canjear un viaje gratis.` : `Te faltan ${n(TOPE - nuevo)} km para un viaje gratis.`}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
          {PREMIOS.map((p) => (
            <div key={p.nombre} style={{ border: '1.5px solid #E6EBF4', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{p.nombre}</span>
              <span style={{ fontSize: 12, color: '#7C8AA5' }}>{p.km}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
