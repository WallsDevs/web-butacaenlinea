import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarEstadoUnidad,
  asignarChoferUnidad,
  getAlertas,
  getChoferes,
  getCauchos,
  getLineas,
  getOrdenes,
  getResumenMantenimiento,
  getSalidas,
  getUnidad,
  reemplazarCaucho,
  rotarCauchos,
} from '../../lib/api/endpoints';
import { fechaCorta, hora } from '../../lib/time';
import { useAuth } from '../../stores/auth';
import { ServicioUrbanoCard } from '../urbano/ServicioUrbanoCard';
import { useModulos } from '../../lib/useModulos';
import { EtiquetasEquipajeCard } from './EtiquetasEquipajeCard';
import { StatusChip } from '../../components/ui/StatusChip';
import { Field } from '../../components/ui/Field';
import type { CauchoDto } from '../../lib/api/types';
import ui from '../../components/ui/ui.module.css';
import styles from './flota.module.css';

const NOMBRE_DOC: Record<string, string> = {
  seguro_rcv: 'Seguro RCV',
  certificado_intt: 'Certificado INTT',
  revision_tecnica: 'Revisión técnica',
  permiso_ruta: 'Permiso de ruta',
};

const fechaVe = (isoDate?: string) => {
  if (!isoDate) return '—';
  const [a, m, d] = isoDate.split('-');
  return `${d}/${m}/${a}`;
};

export default function FichaUnidad() {
  const { unidadId } = useParams<{ unidadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usuario = useAuth((s) => s.usuario);
  // Cada bloque pide su módulo: sin él el backend respondería modulo_no_contratado
  const { tiene } = useModulos();
  const conMant = tiene('mantenimiento');
  const conBol = tiene('boleteria');
  const conEq = tiene('equipaje');
  const conUrb = tiene('urbano');
  const [cauchoSel, setCauchoSel] = useState<CauchoDto | null>(null);
  const [modoRotacion, setModoRotacion] = useState(false);
  const [rotacionOrigen, setRotacionOrigen] = useState<CauchoDto | null>(null);
  const [modalOrden, setModalOrden] = useState(false);
  const [modalReemplazo, setModalReemplazo] = useState(false);

  const { data: unidad } = useQuery({ queryKey: ['unidad', unidadId], queryFn: () => getUnidad(unidadId!) });
  const { data: cauchos } = useQuery({ queryKey: ['cauchos', unidadId], queryFn: () => getCauchos(unidadId!), enabled: conMant });
  const { data: alertas } = useQuery({ queryKey: ['alertas', unidadId], queryFn: () => getAlertas(unidadId!), enabled: conMant });
  const { data: ordenes } = useQuery({ queryKey: ['ordenes', unidadId], queryFn: () => getOrdenes(unidadId!), enabled: conMant });
  const { data: choferes } = useQuery({ queryKey: ['choferes'], queryFn: getChoferes });
  // El modo de etiqueta lo fija la empresa; decide qué tarjeta de equipaje se ve
  const { data: lineas } = useQuery({ queryKey: ['lineas'], queryFn: getLineas });
  const miLinea = lineas?.find((l) => l.documentId === usuario?.linea?.documentId);
  const asignarChofer = useMutation({
    mutationFn: (choferId: string | null) => asignarChoferUnidad(unidadId!, choferId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unidad', unidadId] }),
  });
  const { data: viajes } = useQuery({
    queryKey: ['viajes-unidad', unidadId],
    queryFn: () =>
      getSalidas({
        unidadId,
        estados: ['programada', 'abordando', 'en_ruta', 'finalizada', 'cancelada'],
        orden: 'fechaHoraSalida:desc',
      }),
    enabled: Boolean(unidadId) && conBol,
  });
  const { data: resumen } = useQuery({
    queryKey: ['resumen-mant', unidadId],
    queryFn: () => getResumenMantenimiento(unidadId!),
    enabled: conMant,
  });

  const cambiarEstado = useMutation({
    mutationFn: (estado: string) => actualizarEstadoUnidad(unidadId!, estado),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unidad', unidadId] }),
  });

  const rotar = useMutation({
    mutationFn: (movs: { cauchoId: string; posicionNueva: string }[]) => rotarCauchos(movs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cauchos', unidadId] });
      queryClient.invalidateQueries({ queryKey: ['alertas', unidadId] });
      setModoRotacion(false);
      setRotacionOrigen(null);
      setCauchoSel(null);
    },
  });

  const totalPuestos = useMemo(
    () =>
      unidad?.configuracionAsientos?.pisos?.reduce(
        (s, p) => s + (p.filas.length * (p.layout.izquierda + p.layout.derecha) + (p.filaTrasera ?? 0)),
        0
      ),
    [unidad]
  );

  if (!unidad) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)' }}>Cargando unidad…</div>;
  }

  // Aceite / kilometraje
  const proximoServicio = (unidad.kmUltimoCambioAceite ?? 0) + (unidad.intervaloAceiteKm ?? 0);
  const faltanKm = Math.max(0, proximoServicio - unidad.kilometraje);
  const progresoAceite =
    unidad.intervaloAceiteKm && unidad.kmUltimoCambioAceite
      ? Math.max(0, Math.min(1, (unidad.kilometraje - unidad.kmUltimoCambioAceite) / unidad.intervaloAceiteKm))
      : 0;
  const semanasAprox = unidad.promedioKmSemana ? Math.max(1, Math.round(faltanKm / unidad.promedioKmSemana)) : null;

  const descPisos = unidad.configuracionAsientos?.pisos?.length === 2 ? 'Doble piso' : 'Piso sencillo';
  const clasesDesc = unidad.configuracionAsientos?.pisos
    ?.map((p) => `${(p.filas.length * (p.layout.izquierda + p.layout.derecha) + (p.filaTrasera ?? 0))} ${p.nombre.toLowerCase()}`)
    .join(' / ');

  const elegirCaucho = (c: CauchoDto | null, posicionLibre?: string) => {
    if (!modoRotacion) {
      setCauchoSel(c);
      return;
    }
    // Modo rotación: primer toque escoge el caucho, segundo la posición destino
    if (!rotacionOrigen) {
      if (c) setRotacionOrigen(c);
      return;
    }
    const destino = c?.posicion ?? posicionLibre;
    if (!destino || destino === rotacionOrigen.posicion) return;
    const movimientos = [{ cauchoId: rotacionOrigen.documentId, posicionNueva: destino }];
    if (c) movimientos.push({ cauchoId: c.documentId, posicionNueva: rotacionOrigen.posicion });
    rotar.mutate(movimientos);
  };

  const claseCaucho = (c: CauchoDto | null) =>
    !c
      ? styles.cauchoVacio
      : c.estado === 'reemplazo_vencido'
        ? styles.cauchoBad
        : c.estado === 'rotacion_sugerida'
          ? styles.cauchoWarn
          : styles.cauchoSano;

  return (
    <div className={styles.contenido}>
      <button className={ui.btnGhost} onClick={() => navigate('/empresa/flota?tab=unidades')} style={{ marginBottom: 14 }}>
        ← Todas las unidades
      </button>

      {/* Cabecera */}
      <div className={styles.cabeceraUnidad}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className={styles.cuadroNumeroLg}>{unidad.numero}</div>
          <div>
            <div className={styles.modelo}>{unidad.marcaModelo}</div>
            <div className={styles.metaUnidad}>
              Placa {unidad.placa} · {unidad.anio} · {descPisos}, {totalPuestos} puestos ({clasesDesc})
            </div>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {unidad.estado === 'en_ruta' && <StatusChip tono="info">En Ruta</StatusChip>}
          {unidad.estado !== 'en_ruta' && unidad.ubicacionActual && (
            <StatusChip tono="neutral">En {unidad.ubicacionActual}</StatusChip>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Estado</span>
          <div className={ui.pillGroup}>
            {[
              ['disponible', 'Activo'],
              ['en_mantenimiento', 'En Mantenimiento'],
              ['fuera_de_servicio', 'Fuera de Servicio'],
            ].map(([valor, label]) => (
              <button
                key={valor}
                className={`${ui.pill} ${unidad.estado === valor ? ui.pillActive : ''}`}
                style={{ fontSize: 12, padding: '9px 14px' }}
                onClick={() => cambiarEstado.mutate(valor)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tres tarjetas */}
      <div className={styles.tresTarjetas}>
        <div className={styles.tarjeta}>
          <div className={styles.kicker}>Kilometraje y aceite</div>
          <div className={styles.cifraKm}>{unidad.kilometraje.toLocaleString('es-VE')}</div>
          <div className={styles.notaKm}>
            kilómetros{unidad.promedioKmSemana ? ` · promedio ${unidad.promedioKmSemana.toLocaleString('es-VE')} / semana` : ''}
          </div>
          <div className={styles.divisor} />
          <div className={styles.filaDato}>
            <span>Último cambio</span>
            <span>
              {unidad.kmUltimoCambioAceite?.toLocaleString('es-VE')} · {fechaVe(unidad.fechaUltimoCambioAceite).slice(0, 5)}
            </span>
          </div>
          <div className={styles.filaDato} style={{ marginTop: 6 }}>
            <span>Próximo servicio</span>
            <span>{proximoServicio.toLocaleString('es-VE')}</span>
          </div>
          <div className={styles.barraKm}>
            <div className={styles.barraKmRelleno} style={{ width: `${progresoAceite * 100}%` }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {faltanKm <= 0 ? (
              <StatusChip tono="bad">Servicio vencido</StatusChip>
            ) : faltanKm <= 8000 ? (
              <StatusChip tono="warn">Servicio próximo</StatusChip>
            ) : (
              <StatusChip tono="ok">Al día</StatusChip>
            )}
            <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>
              Faltan {faltanKm.toLocaleString('es-VE')} km{semanasAprox ? ` · ~${semanasAprox} semana${semanasAprox === 1 ? '' : 's'}` : ''}
            </span>
          </div>
        </div>

        {conMant && (
          <div className={styles.tarjeta}>
            <div className={styles.kicker}>Alertas de servicio</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {(alertas ?? []).map((a, i) => (
                <div
                  key={i}
                  className={`${styles.alerta} ${a.tono === 'bad' ? styles.alertaBad : a.tono === 'warn' ? styles.alertaWarn : styles.alertaOk}`}
                >
                  <div className={styles.alertaTitulo}>{a.titulo}</div>
                  <div className={styles.alertaNota}>{a.nota}</div>
                </div>
              ))}
              {!alertas?.length && (
                <div className={styles.alertaOk} style={{ padding: '12px 14px', borderRadius: 14, fontSize: 13 }}>
                  Sin alertas activas.
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.tarjeta}>
          <div className={styles.kicker}>Documentación y chófer</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, fontSize: 14 }}>
            {(unidad.documentos ?? []).map((d, i) => (
              <div key={i} className={styles.filaDato}>
                <span>{NOMBRE_DOC[d.tipo] ?? d.tipo}</span>
                <span>{fechaVe(d.vence)}</span>
              </div>
            ))}
          </div>
          <div className={styles.divisor} />
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>
            Conductor asignado — verá esta unidad en su app y podrá reportar km y novedades. Un
            mismo conductor puede tener varias unidades a su cargo: escoge cuál maneja al abrir
            su turno.
          </div>
          <select
            className={ui.fieldInput}
            value={unidad.choferAsignado?.documentId ?? ''}
            disabled={asignarChofer.isPending}
            onChange={(e) => asignarChofer.mutate(e.target.value || null)}
          >
            <option value="">Sin asignar</option>
            {(choferes ?? []).map((c) => (
              <option key={c.documentId} value={c.documentId}>
                {c.nombre}
                {c.cedula ? ` · ${c.cedula}` : ''}
              </option>
            ))}
          </select>
          {unidad.choferAsignado && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <span className={styles.avatarChofer}>
                {unidad.choferAsignado.nombre
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{unidad.choferAsignado.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                  {unidad.choferAsignado.cedula ?? 'sin cédula'}
                  {unidad.choferAsignado.licenciaGrado
                    ? ` · licencia ${unidad.choferAsignado.licenciaGrado} · vence ${fechaVe(unidad.choferAsignado.licenciaVence).slice(3)}`
                    : ''}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Servicio urbano: ruta, reparto y QR de la buseta */}
      {usuario?.role?.type === 'empresa' && conUrb && (
        <ServicioUrbanoCard
          unidadId={unidad.documentId}
          numeroUnidad={unidad.numero}
          lineaNombre={usuario?.linea?.nombre ?? ''}
        />
      )}

      {/* Talonario de etiquetas de equipaje (rutas largas) */}
      {usuario?.role?.type === 'empresa' && conEq && (
        <EtiquetasEquipajeCard
          unidadId={unidad.documentId}
          modoEmpresa={(miLinea?.modoEtiquetaEquipaje ?? 'empresa') === 'empresa'}
        />
      )}

      {/* Cauchos por posición */}
      {cauchos && cauchos.ejes.length > 0 && (
        <div className={styles.cardCauchos}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>Cauchos por posición</div>
              <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
                {cauchos.ejes.length === 3 ? 'Tres ejes' : `${cauchos.ejes.length} ejes`} · {cauchos.totalPosiciones}{' '}
                posiciones
              </div>
            </div>
            <button
              className={ui.btnSecondary}
              style={{
                marginLeft: 'auto',
                padding: '10px 18px',
                fontSize: 13,
                ...(modoRotacion ? { borderColor: 'var(--blue-600)', color: 'var(--blue-700)' } : {}),
              }}
              onClick={() => {
                setModoRotacion((m) => !m);
                setRotacionOrigen(null);
              }}
            >
              {modoRotacion
                ? rotacionOrigen
                  ? `Rotando ${rotacionOrigen.posicion} — toca el destino`
                  : 'Toca el caucho a rotar'
                : 'Registrar rotación'}
            </button>
          </div>

          <div className={styles.cauchosLayout}>
            <div className={styles.diagrama}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {cauchos.ejes.map((eje) => (
                  <div key={eje.numero} className={styles.eje}>
                    <div className={styles.ejeEtiqueta}>
                      <div className={styles.ejeNombre}>{eje.nombre}</div>
                      <div className={styles.ejeTipo}>
                        {eje.tipo === 'direccional' ? 'Direccional' : eje.tipo === 'traccion' ? 'Tracción · dual' : 'Porta · dual'}
                      </div>
                    </div>
                    <div className={styles.ejeCentro}>
                      <div className={styles.ladoCauchos}>
                        {eje.izquierda.map((p) => (
                          <button
                            key={p.posicion}
                            className={`${styles.caucho} ${claseCaucho(p.caucho)} ${cauchoSel?.posicion === p.posicion || rotacionOrigen?.posicion === p.posicion ? styles.cauchoSel : ''}`}
                            onClick={() => elegirCaucho(p.caucho, p.posicion)}
                          >
                            <span className={styles.cauchoPos}>{p.posicion}</span>
                            <span className={styles.cauchoDesgaste}>
                              {p.caucho?.desgastePct != null ? `${p.caucho.desgastePct}%` : '—'}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className={styles.barraEje} />
                      <div className={styles.ladoCauchos}>
                        {eje.derecha.map((p) => (
                          <button
                            key={p.posicion}
                            className={`${styles.caucho} ${claseCaucho(p.caucho)} ${cauchoSel?.posicion === p.posicion || rotacionOrigen?.posicion === p.posicion ? styles.cauchoSel : ''}`}
                            onClick={() => elegirCaucho(p.caucho, p.posicion)}
                          >
                            <span className={styles.cauchoPos}>{p.posicion}</span>
                            <span className={styles.cauchoDesgaste}>
                              {p.caucho?.desgastePct != null ? `${p.caucho.desgastePct}%` : '—'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.leyenda}>
                <span>
                  <span className={styles.muestra} style={{ background: 'var(--seat-free-bg)', border: '1.5px solid var(--seat-free-border)' }} />{' '}
                  Banda sana
                </span>
                <span>
                  <span className={styles.muestra} style={{ background: 'var(--warn-bg)', border: '1.5px solid var(--warn-border)' }} />{' '}
                  Rotación sugerida
                </span>
                <span>
                  <span className={styles.muestra} style={{ background: 'var(--bad-bg)', border: '1.5px solid var(--bad-border)' }} />{' '}
                  Reemplazo vencido
                </span>
              </div>
            </div>

            <div className={styles.detalleCaucho}>
              <div className={styles.detalleCabecera}>
                {cauchoSel ? `Caucho ${cauchoSel.posicion}` : 'Toca un caucho del diagrama'}
              </div>
              {cauchoSel && (
                <div className={styles.detalleCuerpo}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{cauchoSel.marca}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{cauchoSel.medida}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
                    <div className={styles.detalleFila}>
                      <span>Serial</span>
                      <span>{cauchoSel.serial}</span>
                    </div>
                    <div className={styles.detalleFila}>
                      <span>Instalado</span>
                      <span>{fechaVe(cauchoSel.fechaInstalacion)}</span>
                    </div>
                    <div className={styles.detalleFila}>
                      <span>Recorrido</span>
                      <span>{cauchoSel.recorridoKm.toLocaleString('es-VE')} km</span>
                    </div>
                    <div className={styles.detalleFila}>
                      <span>Profundidad</span>
                      <span>
                        {String(cauchoSel.profundidadMm).replace('.', ',')} de {cauchoSel.profundidadNuevaMm} mm
                      </span>
                    </div>
                    <div className={styles.detalleFila}>
                      <span>Reencauches</span>
                      <span>
                        {cauchoSel.reencauches} de {cauchoSel.maxReencauches}
                      </span>
                    </div>
                  </div>
                  <button
                    className={ui.btnPrimary}
                    style={{ width: '100%', marginTop: 16, padding: 13, fontSize: 14 }}
                    onClick={() => setModalReemplazo(true)}
                  >
                    Registrar reemplazo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Historial de mantenimiento */}
      {conMant && (
        <div className={styles.cardHistorial}>
          <div className={styles.historialCabecera}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Historial de mantenimiento</div>
            <button
              className={ui.btnPrimary}
              style={{ marginLeft: 'auto', fontSize: 13, padding: '11px 18px' }}
              onClick={() => setModalOrden(true)}
            >
              Nueva orden de trabajo
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Fecha</th>
                  <th style={{ width: 130 }}>Tipo</th>
                  <th>Intervención</th>
                  <th style={{ width: 110 }}>Km</th>
                  <th style={{ width: 150 }}>Taller</th>
                  <th style={{ width: 120 }}>Costo</th>
                </tr>
              </thead>
              <tbody>
                {(ordenes ?? []).map((o) => (
                  <tr key={o.documentId}>
                    <td>{fechaVe(o.fecha)}</td>
                    <td>
                      <StatusChip tono={o.tipo === 'correctivo' ? 'bad' : 'info'} size="sm">
                        {o.tipo === 'correctivo' ? 'Correctivo' : 'Preventivo'}
                      </StatusChip>
                    </td>
                    <td>{o.intervencion}</td>
                    <td style={{ color: 'var(--text-soft)' }}>{o.km?.toLocaleString('es-VE')}</td>
                    <td style={{ color: 'var(--text-soft)' }}>{o.taller}</td>
                    <td style={{ fontWeight: 700 }}>
                      $ {Number(o.costoUsd ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.pieHistorial}>
            <span>
              Costo {resumen?.anio} <strong>$ {resumen?.costoAnioUsd?.toLocaleString('es-VE', { minimumFractionDigits: 2 }) ?? '—'}</strong>
            </span>
            <span>
              Costo por km <strong>$ {resumen?.costoPorKmUsd != null ? String(resumen.costoPorKmUsd).replace('.', ',') : '—'}</strong>
            </span>
            <span className={styles.diasFuera}>
              Días fuera de servicio <strong>{resumen?.diasFueraServicio ?? 0}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Historial de viajes de la unidad */}
      {conBol && (
        <div className={styles.tarjeta} style={{ marginTop: 20 }}>
          <div className={styles.kicker}>Historial de viajes</div>
          <table className={styles.tablaOrdenes ?? ''} style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: 12, color: 'var(--text-faint)' }}>
                <th style={{ padding: '8px 6px' }}>Fecha</th>
                <th style={{ padding: '8px 6px' }}>Ruta</th>
                <th style={{ padding: '8px 6px' }}>Salida</th>
                <th style={{ padding: '8px 6px' }}>Llegada real</th>
                <th style={{ padding: '8px 6px' }}>Pasajeros</th>
                <th style={{ padding: '8px 6px' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {(viajes ?? []).map((v) => (
                <tr key={v.documentId} style={{ borderTop: '1px solid var(--border)', fontSize: 13 }}>
                  <td style={{ padding: '10px 6px', fontWeight: 600 }}>{fechaCorta(v.fechaHoraSalida)}</td>
                  <td style={{ padding: '10px 6px' }}>
                    {v.ruta?.origen} → {v.ruta?.destino}
                  </td>
                  <td style={{ padding: '10px 6px', color: 'var(--text-soft)' }}>{hora(v.fechaHoraSalida)}</td>
                  <td style={{ padding: '10px 6px', color: 'var(--text-soft)' }}>
                    {v.fechaHoraLlegadaReal ? `${fechaCorta(v.fechaHoraLlegadaReal)} ${hora(v.fechaHoraLlegadaReal)}` : '—'}
                  </td>
                  <td style={{ padding: '10px 6px', color: 'var(--text-soft)' }}>
                    {v.reporteSalida?.abordados ?? '—'}
                  </td>
                  <td style={{ padding: '10px 6px' }}>
                    {v.estado === 'finalizada' ? (
                      <StatusChip tono="ok" size="sm">Finalizada</StatusChip>
                    ) : v.estado === 'en_ruta' ? (
                      <StatusChip tono="info" size="sm">En Ruta</StatusChip>
                    ) : v.estado === 'cancelada' ? (
                      <StatusChip tono="bad" size="sm">Cancelada</StatusChip>
                    ) : v.estado === 'abordando' ? (
                      <StatusChip tono="info" size="sm">Abordando</StatusChip>
                    ) : (
                      <StatusChip tono="neutral" size="sm">Programada</StatusChip>
                    )}
                  </td>
                </tr>
              ))}
              {!viajes?.length && (
                <tr>
                  <td colSpan={6} style={{ padding: 18, textAlign: 'center', color: 'var(--text-soft)', fontSize: 13 }}>
                    Esta unidad aún no tiene viajes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOrden && (
        <ModalNuevaOrden
          unidadDocumentId={unidad.documentId}
          km={unidad.kilometraje}
          onCerrar={(creada) => {
            setModalOrden(false);
            if (creada) {
              queryClient.invalidateQueries({ queryKey: ['ordenes', unidadId] });
              queryClient.invalidateQueries({ queryKey: ['resumen-mant', unidadId] });
            }
          }}
        />
      )}
      {modalReemplazo && cauchoSel && (
        <ModalReemplazo
          caucho={cauchoSel}
          onCerrar={(hecho) => {
            setModalReemplazo(false);
            if (hecho) {
              setCauchoSel(null);
              queryClient.invalidateQueries({ queryKey: ['cauchos', unidadId] });
              queryClient.invalidateQueries({ queryKey: ['alertas', unidadId] });
            }
          }}
        />
      )}
    </div>
  );
}

function ModalNuevaOrden({
  unidadDocumentId,
  km,
  onCerrar,
}: {
  unidadDocumentId: string;
  km: number;
  onCerrar: (creada: boolean) => void;
}) {
  const [tipo, setTipo] = useState<'preventivo' | 'correctivo'>('preventivo');
  const [intervencion, setIntervencion] = useState('');
  const [taller, setTaller] = useState('Taller Central');
  const [costo, setCosto] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      const { api } = await import('../../lib/api/client');
      await api('/api/ordenes-mantenimiento', {
        method: 'POST',
        body: {
          data: {
            unidad: unidadDocumentId,
            fecha: new Date().toISOString().slice(0, 10),
            tipo,
            intervencion,
            km,
            taller,
            costoUsd: Number(costo) || 0,
            estado: 'cerrada',
          },
        },
      });
      onCerrar(true);
    } catch {
      setGuardando(false);
    }
  };

  return (
    <div className={styles.velo}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 20, fontWeight: 700 }}>Nueva orden de trabajo</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
          <div className={ui.pillGroup} style={{ alignSelf: 'flex-start' }}>
            {(['preventivo', 'correctivo'] as const).map((t) => (
              <button key={t} className={`${ui.pill} ${tipo === t ? ui.pillActive : ''}`} onClick={() => setTipo(t)}>
                {t === 'preventivo' ? 'Preventivo' : 'Correctivo'}
              </button>
            ))}
          </div>
          <Field label="Intervención" value={intervencion} onChange={(e) => setIntervencion(e.target.value)} autoFocus />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Taller" value={taller} onChange={(e) => setTaller(e.target.value)} />
            <Field label="Costo USD" type="number" value={costo} onChange={(e) => setCosto(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className={ui.btnSecondary} onClick={() => onCerrar(false)}>
              Cancelar
            </button>
            <button className={ui.btnPrimary} disabled={!intervencion.trim() || guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Registrar orden'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalReemplazo({ caucho, onCerrar }: { caucho: CauchoDto; onCerrar: (hecho: boolean) => void }) {
  const [serial, setSerial] = useState('');
  const [marca, setMarca] = useState(caucho.marca);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await reemplazarCaucho(caucho.documentId, { serialNuevo: serial, marca, profundidadNuevaMm: 16 });
      onCerrar(true);
    } catch {
      setGuardando(false);
    }
  };

  return (
    <div className={styles.velo}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 20, fontWeight: 700 }}>Reemplazo en {caucho.posicion}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>
          El caucho {caucho.serial} pasa a desecho con su historial; el nuevo queda instalado en la posición. Todo con
          evento auditable.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
          <Field label="Serial del caucho nuevo" value={serial} onChange={(e) => setSerial(e.target.value)} autoFocus />
          <Field label="Marca y modelo" value={marca} onChange={(e) => setMarca(e.target.value)} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className={ui.btnSecondary} onClick={() => onCerrar(false)}>
              Cancelar
            </button>
            <button className={ui.btnPrimary} disabled={!serial.trim() || guardando} onClick={guardar}>
              {guardando ? 'Registrando…' : 'Registrar reemplazo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
