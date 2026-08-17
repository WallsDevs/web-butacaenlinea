import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getLineas, getRutas, getSalidas } from '../../lib/api/endpoints';
import { hora, fechaCorta } from '../../lib/time';
import { Money } from '../../components/ui/Money';
import { StatusChip } from '../../components/ui/StatusChip';
import { Field } from '../../components/ui/Field';
import { TicketCard } from '../../components/ticket/TicketCard';
import { useBooking } from './useBooking';
import { useSeo } from '../../lib/seo';
import ui from '../../components/ui/ui.module.css';
import styles from './public.module.css';

const PASOS = [
  { n: '01', titulo: 'Busca tu salida', copy: 'Origen, destino y fecha — ves las salidas de todas las empresas afiliadas, con hora, unidad y precio.' },
  { n: '02', titulo: 'Escoge tu puesto', copy: 'Mapa por piso con lo que está libre ahora. Pagas en bolívares, dólares o pesos.' },
  { n: '03', titulo: 'Aborda con el código', copy: 'Tu boleto queda en el teléfono; el conductor lo lee con la cámara en la puerta.' },
];

/**
 * PÁGINA PRINCIPAL de butacaenlinea.com: el marketplace de la plataforma —
 * todas las empresas juntas, con búsqueda y compra global.
 */
export default function MarketplaceHome() {
  useSeo(
    'Butaca En Línea — Pasajes de autobús en Venezuela',
    'Busca salidas de todas las líneas, escoge tu puesto en el mapa y compra tu pasaje en línea. Boleto electrónico con QR.'
  );
  const navigate = useNavigate();
  const { criterios, setCriterios } = useBooking();

  const { data: lineas } = useQuery({ queryKey: ['lineas'], queryFn: getLineas });
  // Todas las próximas salidas de la plataforma (desde ahora)
  const { data: proximasSalidas } = useQuery({
    queryKey: ['salidas-proximas', 'todas'],
    queryFn: () => getSalidas({ desde: new Date().toISOString() }),
    refetchInterval: 60_000,
  });
  // Destinos de TODAS las rutas afiliadas (para el buscador)
  const { data: rutas } = useQuery({ queryKey: ['rutas-publicas'], queryFn: () => getRutas() });

  const destinos = useMemo(
    () => [...new Set((rutas ?? []).map((r) => r.destino).filter(Boolean))].sort() as string[],
    [rutas]
  );
  const origenes = useMemo(
    () => [...new Set((rutas ?? []).map((r) => r.origen).filter(Boolean))].sort() as string[],
    [rutas]
  );
  const proxima = proximasSalidas?.[0];
  const precioMinimo = (s: NonNullable<typeof proximasSalidas>[number]) =>
    Math.min(...Object.values(s.preciosUsd ?? { x: 0 }));

  const irASalidas = () => {
    const origen = criterios.origen ? `origen=${encodeURIComponent(criterios.origen)}&` : '';
    const destino = criterios.destino ? `destino=${encodeURIComponent(criterios.destino)}&` : '';
    navigate(`/salidas?${origen}${destino}fecha=${criterios.fecha}&pax=${criterios.pasajeros}`);
  };

  return (
    <div>
      {/* Hero de la plataforma */}
      <div className={styles.hero}>
        <div className={styles.heroCirculo1} />
        <div className={styles.heroCirculo2} />
        <div className={styles.heroCuerpo} style={{ paddingTop: 72 }}>
          <div>
            <h1 className={styles.heroH1}>Escoge tu puesto y aborda con el teléfono</h1>
            <p className={styles.heroParrafo}>
              Todas las líneas del terminal en un solo lugar: compara horarios, elige la silla en el
              mapa y sube mostrando tu código. Sin colas y sin apartar por WhatsApp.
            </p>
            <div className={styles.heroBotonera}>
              <button className={ui.btnCampaign} onClick={irASalidas}>
                Buscar mi salida <span className={ui.btnCampaignRule} />
              </button>
              <button className={ui.btnCampaignGhost} onClick={() => navigate('/cuenta')}>
                Consultar mi boleto
              </button>
            </div>
          </div>
          <div>
            <TicketCard
              variant="hero"
              data={{
                folio: proxima?.linea ? `${proxima.linea.nombre.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}-0473` : 'BE-0473',
                origen: proxima?.ruta?.origen ?? 'San Cristóbal',
                destino: proxima?.ruta?.destino ?? 'Caracas',
                salidaHora: proxima ? hora(proxima.fechaHoraSalida) : '20:30',
                llegadaHora: proxima ? hora(proxima.fechaHoraLlegada) : '06:15',
                puestos: '04',
                piso: '1 VIP',
                rampa: proxima?.rampa?.replace('Rampa ', '') ?? '03',
                pasajeroNombre: 'Yorman Peña Rangel',
                pasajeroDoc: 'V-19.884.201',
                equipaje: '1 maleta',
                estadoChip: { tono: 'ok', label: 'Válido' },
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: '0 32px' }}>
        {/* Buscador flotante global */}
        <div className={styles.buscador}>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Origen</span>
            <select
              className={ui.fieldInput}
              value={criterios.origen}
              onChange={(e) => setCriterios({ origen: e.target.value })}
            >
              <option value="">Todos los orígenes</option>
              {origenes.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Destino</span>
            <select
              className={ui.fieldInput}
              value={criterios.destino}
              onChange={(e) => setCriterios({ destino: e.target.value })}
            >
              <option value="">Todos los destinos</option>
              {destinos.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <Field
            label="Fecha"
            type="date"
            value={criterios.fecha}
            onChange={(e) => setCriterios({ fecha: e.target.value })}
          />
          <Field
            label="Pasajeros"
            type="number"
            min={1}
            max={10}
            value={criterios.pasajeros}
            onChange={(e) =>
              setCriterios({ pasajeros: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })
            }
          />
          <button className={ui.btnPrimary} onClick={irASalidas}>
            Buscar
          </button>
        </div>

        {/* Tablero: próximas salidas de TODAS las empresas */}
        <div className={styles.tableroTitulos}>
          <div>
            <div className={styles.kicker}>Todas las empresas</div>
            <h2 className={styles.tableroH2}>Próximas salidas</h2>
          </div>
          <span className={styles.actualizado}>Actualizado {hora(new Date().toISOString())}</span>
        </div>
        <div className={styles.tablero}>
          <div className={styles.tableroCabecera}>
            <span>Hora</span>
            <span>Destino</span>
            <span>Empresa</span>
            <span>Unidad</span>
            <span>Estado</span>
            <span style={{ textAlign: 'right' }}>Desde</span>
          </div>
          {(proximasSalidas ?? []).slice(0, 12).map((s) => (
            <div
              key={s.documentId}
              className={styles.tableroFila}
              onClick={() => navigate(`/salidas/${s.documentId}/asientos`)}
            >
              <span>
                <span className={styles.tabHora}>{hora(s.fechaHoraSalida)}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-faint)' }}>
                  {fechaCorta(s.fechaHoraSalida)}
                </span>
              </span>
              <span className={styles.tabDestino}>{s.ruta?.destino}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--blue-700)' }}>{s.linea?.nombre}</span>
              <span className={styles.tabMeta}>
                {s.unidad?.marcaModelo?.split(' ')[0]} · {s.unidad?.numero}
              </span>
              <span>
                {s.estado === 'abordando' ? (
                  <StatusChip tono="info">Abordando</StatusChip>
                ) : (
                  <StatusChip tono="neutral">A tiempo</StatusChip>
                )}
              </span>
              <Money usd={precioMinimo(s)} className={styles.tabPrecio} />
            </div>
          ))}
          {!proximasSalidas?.length && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-soft)', fontSize: 14 }}>
              Aún no hay salidas programadas.
            </div>
          )}
        </div>

        {/* Empresas afiliadas (informativo) */}
        <div id="empresas" style={{ padding: '52px 0 8px' }}>
          <div className={styles.kicker}>Empresas afiliadas</div>
          <h2 className={styles.tableroH2} style={{ marginBottom: 20 }}>
            Las líneas que venden aquí
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {(lineas ?? []).map((l) => (
              <div
                key={l.documentId}
                className={ui.card}
                style={{ padding: 20, display: 'flex', gap: 14, alignItems: 'center' }}
              >
                <span
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 13,
                    background: 'var(--navy)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 17,
                    fontWeight: 700,
                    flex: 'none',
                  }}
                >
                  {l.nombre.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 16 }}>{l.nombre}</span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--text-soft)', marginTop: 2 }}>
                    {l.terminalBase ?? 'Venta en línea y taquilla'}
                    {l.telefono ? ` · ${l.telefono}` : ''}
                  </span>
                </span>
              </div>
            ))}
            {!lineas?.length && (
              <div className={ui.card} style={{ padding: 28, textAlign: 'center', color: 'var(--text-soft)' }}>
                Aún no hay empresas afiliadas.
              </div>
            )}
          </div>
        </div>

        {/* Cómo funciona */}
        <div className={styles.bloqueDoble}>
          <div className={styles.marcadorFoto}>Foto del terminal y las unidades</div>
          <div className={styles.comoFunciona}>
            <div className={styles.kicker}>Cómo funciona</div>
            {PASOS.map((p) => (
              <div key={p.n} className={styles.paso}>
                <span className={styles.pasoNumero}>{p.n}</span>
                <div>
                  <div className={styles.pasoTitulo}>{p.titulo}</div>
                  <p className={styles.pasoCopy}>{p.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cierre */}
      <div className={styles.cierre}>
        <div className={styles.cierreCuerpo}>
          <h2 className={styles.cierreH2}>Tu puesto reservado antes de salir de casa</h2>
          <div className={styles.cierreBotones}>
            <button className={ui.btnCampaign} onClick={irASalidas}>
              Comprar pasaje <span className={ui.btnCampaignRule} />
            </button>
            <button className={ui.btnCampaignGhost} onClick={() => navigate('/registro')}>
              Crear mi cuenta
            </button>
          </div>
        </div>
        <div className={styles.pie}>
          <div className={styles.pieCuerpo}>
            <span>Butaca En Línea · butacaenlinea.com</span>
            <span>Boletería y flota para líneas de transporte</span>
            <a href="/ingresar" style={{ marginLeft: 'auto', color: '#9fb6e4' }}>
              Acceso operativo · Ingresar
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
