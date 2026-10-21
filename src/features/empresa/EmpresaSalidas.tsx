import { useState } from 'react';
import { useModulos } from '../../lib/useModulos';
import { AvisoIntegracion } from '../../components/ui/AvisoIntegracion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelarSalida,
  getChoferes,
  getRutas,
  getSalidas,
  getUnidades,
  programarSalida,
} from '../../lib/api/endpoints';
import { fechaCorta, hora, hoyISO, rangoDia } from '../../lib/time';
import { useAuth } from '../../stores/auth';
import { ApiError } from '../../lib/api/client';
import { Field } from '../../components/ui/Field';
import { PillTabs } from '../../components/ui/PillTabs';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

type ModoFiltro = 'dia' | 'rango' | 'todas';

/** Programación de salidas de la empresa. */
export default function EmpresaSalidas() {
  const queryClient = useQueryClient();
  const slug = useAuth((s) => s.usuario)?.linea?.slug;
  const [modo, setModo] = useState<ModoFiltro>('todas');
  const [fecha, setFecha] = useState(hoyISO());
  const [rango, setRango] = useState({ desde: hoyISO(), hasta: hoyISO() });
  const { integracionActiva } = useModulos();
  const [form, setForm] = useState({ rutaId: '', unidadId: '', choferId: '', fecha: hoyISO(), hora: '20:30', rampa: 'Rampa 03', sentido: 'ida' as 'ida' | 'vuelta', sinPasajeros: false });
  const [mensaje, setMensaje] = useState<string | null>(null);
  // Cuando el bus quedó en otra ciudad: la línea decide cuándo regresó (sin pasajeros) y se registra aquí
  const [regreso, setRegreso] = useState<{ rutaId: string; desde: string; hacia: string; fecha: string; hora: string } | null>(null);

  const filtro =
    modo === 'dia'
      ? rangoDia(fecha)
      : modo === 'rango'
        ? { desde: rangoDia(rango.desde).desde, hasta: rangoDia(rango.hasta).hasta }
        : {};
  const { data: salidas } = useQuery({
    queryKey: ['empresa-salidas', slug, modo, fecha, rango.desde, rango.hasta],
    queryFn: () =>
      getSalidas({
        ...filtro,
        lineaSlug: slug,
        estados: ['programada', 'abordando', 'en_ruta', 'finalizada', 'cancelada'],
      }),
  });
  const conFecha = modo !== 'dia';
  const { data: rutas } = useQuery({ queryKey: ['rutas', slug], queryFn: () => getRutas(slug) });
  // Una ruta de ida y vuelta se ofrece una sola vez (la de id menor); el sentido elige cuál se programa
  const porId = new Map((rutas ?? []).map((r) => [r.id, r]));
  const rutasVisibles = (rutas ?? []).filter((r) => !r.inversaId || !porId.has(r.inversaId) || r.id < r.inversaId);
  const rutaBase = (rutas ?? []).find((r) => r.documentId === form.rutaId);
  const rutaVuelta = rutaBase?.inversaId ? porId.get(rutaBase.inversaId) : undefined;
  const rutaEfectiva = form.sentido === 'vuelta' && rutaVuelta ? rutaVuelta : rutaBase;
  const { data: unidades } = useQuery({ queryKey: ['unidades', slug], queryFn: () => getUnidades(slug) });
  const { data: choferes } = useQuery({ queryKey: ['choferes'], queryFn: getChoferes });

  const programar = useMutation({
    mutationFn: () =>
      programarSalida({
        rutaId: rutaEfectiva?.documentId ?? form.rutaId,
        unidadId: form.unidadId,
        choferId: form.choferId || undefined,
        fechaHoraSalida: new Date(`${form.fecha}T${form.hora}:00`).toISOString(),
        rampa: form.rampa,
        sinPasajeros: form.sinPasajeros || undefined,
      }),
    onSuccess: () => {
      setRegreso(null);
      setMensaje(
        form.sinPasajeros
          ? `Viaje sin pasajeros registrado para el ${fechaCorta(`${form.fecha}T12:00:00`)} a las ${form.hora}. No sale a la venta.`
          : `Salida programada para el ${fechaCorta(`${form.fecha}T12:00:00`)} a las ${form.hora}. Ya está en venta.`
      );
      setModo('dia');
      setFecha(form.fecha); // la lista salta al día programado
      queryClient.invalidateQueries({ queryKey: ['empresa-salidas'] });
    },
    onError: (e) => {
      const d = (e instanceof ApiError ? e.details : {}) as {
        faltantes?: string[];
        conflicto?: { fechaHoraSalida?: string; destino?: string };
        ubicacion?: string;
        llegaAlli?: string;
        origenRuta?: string;
        proximoOrigen?: string;
        proximaSalida?: string;
        destinoRuta?: string;
      };
      const cuando = (iso?: string) => (iso ? `el ${fechaCorta(iso)} a las ${hora(iso)}` : '');
      if (e instanceof ApiError && e.code === 'tarifas_incompletas') {
        setMensaje(`La ruta no tiene precio para los puestos "${(d.faltantes ?? []).join(', ')}" de esa unidad. Edita la ruta en la pestaña Rutas y ponle un precio del pasaje (vale para todos) o uno para esa clase.`);
      } else if (e instanceof ApiError && e.code === 'fecha_invalida') {
        setMensaje('La fecha y hora ya pasaron. Programa una salida futura.');
      } else if (e instanceof ApiError && e.code === 'unidad_ocupada') {
        setMensaje(`Esa unidad ya tiene un viaje ${cuando(d.conflicto?.fechaHoraSalida)}${d.conflicto?.destino ? ` hacia ${d.conflicto.destino}` : ''} y estará ocupada a esa hora. Escoge otra unidad u otro horario.`);
      } else if (e instanceof ApiError && e.code === 'unidad_en_otra_ciudad') {
        setMensaje(`A esa hora la unidad estará en ${d.ubicacion}${d.llegaAlli ? ` (llega ${cuando(d.llegaAlli)})` : ''}, así que no puede salir desde ${d.origenRuta}.`);
        // ¿Volvió vacío? Se ofrece registrar el regreso sin pasajeros por la ruta que una esas ciudades
        const ruta = (rutas ?? []).find((r) => r.origen === d.ubicacion && r.destino === d.origenRuta);
        if (ruta) {
          const base = d.llegaAlli ? new Date(new Date(d.llegaAlli).getTime() + 30 * 60_000) : new Date();
          const dos = (n: number) => String(n).padStart(2, '0');
          setRegreso({
            rutaId: ruta.documentId,
            desde: d.ubicacion ?? '',
            hacia: d.origenRuta ?? '',
            fecha: `${base.getFullYear()}-${dos(base.getMonth() + 1)}-${dos(base.getDate())}`,
            hora: `${dos(base.getHours())}:${dos(base.getMinutes())}`,
          });
        } else {
          setRegreso(null);
          setMensaje((m) => `${m} Crea la ruta ${d.ubicacion} → ${d.origenRuta} (o márcala de ida y vuelta) para registrar el regreso.`);
        }
      } else if (e instanceof ApiError && e.code === 'descuadra_itinerario') {
        setMensaje(`Ese viaje deja la unidad en ${d.destinoRuta}, pero tiene programada una salida desde ${d.proximoOrigen} ${cuando(d.proximaSalida)}. Ajusta el itinerario.`);
      } else if (e instanceof ApiError && e.code === 'conductor_ocupado') {
        setMensaje(`Ese conductor ya tiene un viaje ${cuando(d.conflicto?.fechaHoraSalida)}. Asigna otro conductor o cambia la hora.`);
      } else {
        setMensaje('No se pudo programar. Revisa ruta, unidad, fecha y hora.');
      }
    },
  });

  const registrarRegreso = useMutation({
    mutationFn: () =>
      programarSalida({
        rutaId: regreso!.rutaId,
        unidadId: form.unidadId,
        fechaHoraSalida: new Date(`${regreso!.fecha}T${regreso!.hora}:00`).toISOString(),
        sinPasajeros: true,
      }),
    onSuccess: () => {
      setMensaje(`Regreso sin pasajeros registrado: ${regreso!.desde} → ${regreso!.hacia} el ${fechaCorta(`${regreso!.fecha}T12:00:00`)} a las ${regreso!.hora}. Ahora puedes programar la salida.`);
      setRegreso(null);
      queryClient.invalidateQueries({ queryKey: ['empresa-salidas'] });
    },
    onError: (e) => setMensaje(`No se pudo registrar el regreso (${e instanceof ApiError ? e.code : 'sin conexión'}). Revisa la hora: tiene que ser después de que llega.`),
  });

  // Unidad fija del conductor escogido (si tiene): se preselecciona sola
  const unidadFijaDe = (choferId: string) =>
    (unidades ?? []).find((u) => u.choferAsignado?.documentId === choferId);
  const escogerConductor = (choferId: string) => {
    const fija = choferId ? unidadFijaDe(choferId) : undefined;
    setForm({ ...form, choferId, unidadId: fija ? fija.documentId : form.unidadId });
  };
  const fijaDelSeleccionado = form.choferId ? unidadFijaDe(form.choferId) : undefined;

  const cancelar = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => cancelarSalida(id, force),
    onSuccess: (r) => {
      setMensaje(
        r.afectados
          ? `Salida cancelada. ${r.afectados} boleto${r.afectados === 1 ? '' : 's'} anulado${r.afectados === 1 ? '' : 's'}; ${r.reembolsosPendientes} con dinero por devolver — están en Pagos como "Reembolsos pendientes".`
          : 'Salida cancelada.'
      );
      queryClient.invalidateQueries({ queryKey: ['empresa-salidas'] });
    },
    onError: (e, vars) => {
      if (e instanceof ApiError && e.code === 'tiene_boletos') {
        const d = e.details as { afectados?: number; pagados?: number };
        if (
          confirm(
            `Esta salida tiene ${d.afectados} boleto${d.afectados === 1 ? '' : 's'} vendido${d.afectados === 1 ? '' : 's'} (${d.pagados} con pago cobrado).\n\nAl cancelar se anulan todos; los cobrados quedan como REEMBOLSO PENDIENTE: debes devolver el dinero al pasajero y marcarlo en Pagos.\n\n¿Cancelar la salida de todas formas?`
          )
        ) {
          cancelar.mutate({ id: vars.id, force: true });
        }
      } else {
        setMensaje('No se pudo cancelar la salida.');
      }
    },
  });

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20, alignItems: 'start' }}>
        {/* Lista del día */}
        <div className={ui.card} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Salidas programadas</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <PillTabs
                variant="loose"
                items={[
                  { id: 'todas', label: 'Todas' },
                  { id: 'dia', label: 'Día' },
                  { id: 'rango', label: 'Rango' },
                ]}
                value={modo}
                onChange={setModo}
              />
              {modo === 'dia' && (
                <input
                  className={ui.fieldInput}
                  style={{ width: 160 }}
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              )}
              {modo === 'rango' && (
                <>
                  <input
                    className={ui.fieldInput}
                    style={{ width: 160 }}
                    type="date"
                    value={rango.desde}
                    onChange={(e) => setRango({ ...rango, desde: e.target.value })}
                  />
                  <span style={{ color: 'var(--text-faint)' }}>—</span>
                  <input
                    className={ui.fieldInput}
                    style={{ width: 160 }}
                    type="date"
                    value={rango.hasta}
                    onChange={(e) => setRango({ ...rango, hasta: e.target.value })}
                  />
                </>
              )}
            </div>
          </div>
          <table className={styles.tabla}>
            <thead>
              <tr>
                {conFecha && <th>Fecha</th>}
                <th>Hora</th>
                <th>Destino</th>
                <th>Unidad</th>
                <th>Rampa</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(salidas ?? []).map((s) => (
                <tr key={s.documentId}>
                  {conFecha && <td style={{ fontWeight: 600 }}>{fechaCorta(s.fechaHoraSalida)}</td>}
                  <td style={{ fontWeight: 700, fontSize: 16 }}>{hora(s.fechaHoraSalida)}</td>
                  <td style={{ fontWeight: 600 }}>
                    {s.ruta?.destino}
                    {s.sinPasajeros && (
                      <span style={{ marginLeft: 8 }}>
                        <StatusChip tono="neutral" size="sm">Sin pasajeros</StatusChip>
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-soft)' }}>{s.unidad?.numero}</td>
                  <td style={{ color: 'var(--text-soft)' }}>{s.rampa}</td>
                  <td>
                    {s.estado === 'abordando' ? (
                      <StatusChip tono="info" size="sm">Abordando</StatusChip>
                    ) : s.estado === 'en_ruta' ? (
                      <StatusChip tono="info" size="sm">En Ruta</StatusChip>
                    ) : s.estado === 'finalizada' ? (
                      <StatusChip tono="ok" size="sm">Finalizada</StatusChip>
                    ) : s.estado === 'cancelada' ? (
                      <StatusChip tono="bad" size="sm">Cancelada</StatusChip>
                    ) : (
                      <StatusChip tono="neutral" size="sm">Programada</StatusChip>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {['programada', 'abordando'].includes(s.estado) && (
                      <button
                        style={{ fontSize: 12, fontWeight: 600, color: 'var(--bad-text)' }}
                        onClick={() => {
                          if (confirm(`¿Cancelar la salida de ${hora(s.fechaHoraSalida)} a ${s.ruta?.destino}?`)) {
                            cancelar.mutate({ id: s.documentId });
                          }
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!salidas?.length && (
                <tr>
                  <td colSpan={conFecha ? 7 : 6} style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 24 }}>
                    {modo === 'dia' ? 'Sin salidas ese día.' : modo === 'rango' ? 'Sin salidas en ese rango.' : 'Sin salidas programadas.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Programar */}
        {integracionActiva ? (
          <AvisoIntegracion que="salidas" />
        ) : (
        <div className={ui.card} style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 14 }}>Programar salida</div>
          {mensaje && (
            <div style={{ fontSize: 13, color: 'var(--blue-700)', background: 'var(--tint-50)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
              {mensaje}
            </div>
          )}
          {regreso && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>¿Volvió sin pasajeros?</div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)', margin: '2px 0 10px' }}>
                Registra cuándo salió de {regreso.desde} hacia {regreso.hacia}. No sale a la venta.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Field label="Fecha" type="date" value={regreso.fecha} onChange={(e) => setRegreso({ ...regreso, fecha: e.target.value })} />
                <Field label="Hora" type="time" value={regreso.hora} onChange={(e) => setRegreso({ ...regreso, hora: e.target.value })} />
              </div>
              <button className={ui.btnSecondary} style={{ width: '100%', marginTop: 10 }} disabled={registrarRegreso.isPending} onClick={() => registrarRegreso.mutate()}>
                {registrarRegreso.isPending ? 'Registrando…' : `Registrar regreso ${regreso.desde} → ${regreso.hacia}`}
              </button>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Ruta</span>
              <select className={ui.fieldInput} value={form.rutaId} onChange={(e) => setForm({ ...form, rutaId: e.target.value, sentido: 'ida' })}>
                <option value="">Escoge la ruta…</option>
                {rutasVisibles.map((r) => (
                  <option key={r.documentId} value={r.documentId}>
                    {r.origen} {r.inversaId && porId.has(r.inversaId) ? '⇄' : '→'} {r.destino}
                  </option>
                ))}
              </select>
            </label>
            {rutaBase && rutaVuelta && (
              <div>
                <div className={ui.fieldLabel} style={{ marginBottom: 6 }}>Sentido</div>
                <div role="tablist" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, borderRadius: 12, background: 'var(--pill-bg, #EEF2F9)' }}>
                  {([['ida', `${rutaBase.origen} → ${rutaBase.destino}`], ['vuelta', `${rutaVuelta.origen} → ${rutaVuelta.destino}`]] as ['ida' | 'vuelta', string][]).map(([id, etiqueta]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={form.sentido === id}
                      onClick={() => setForm({ ...form, sentido: id })}
                      style={{
                        padding: '9px 10px',
                        borderRadius: 9,
                        fontSize: 13,
                        fontWeight: 700,
                        color: form.sentido === id ? 'var(--blue-700)' : 'var(--text-soft)',
                        background: form.sentido === id ? 'var(--surface)' : 'transparent',
                        boxShadow: form.sentido === id ? '0 1px 2px rgba(15, 23, 42, 0.08), 0 0 0 1px var(--border)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {etiqueta}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Conductor (opcional)</span>
              <select className={ui.fieldInput} value={form.choferId} onChange={(e) => escogerConductor(e.target.value)}>
                <option value="">Sin asignar</option>
                {(choferes ?? []).map((c) => (
                  <option key={c.documentId} value={c.documentId}>
                    {c.nombre}
                    {unidadFijaDe(c.documentId) ? ` · unidad ${unidadFijaDe(c.documentId)!.numero}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className={ui.field}>
              <span className={ui.fieldLabel}>Unidad</span>
              <select className={ui.fieldInput} value={form.unidadId} onChange={(e) => setForm({ ...form, unidadId: e.target.value })}>
                <option value="">Escoge la unidad…</option>
                {(unidades ?? [])
                  .filter((u) => u.estado === 'disponible' || u.estado === 'en_ruta')
                  .map((u) => (
                    <option key={u.documentId} value={u.documentId}>
                      {u.numero} · {u.marcaModelo}
                    </option>
                  ))}
              </select>
              {form.choferId && (
                <span style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
                  {fijaDelSeleccionado
                    ? form.unidadId === fijaDelSeleccionado.documentId
                      ? `Unidad fija del conductor. Puedes cambiarla solo para este viaje.`
                      : `Ojo: la unidad fija de este conductor es la ${fijaDelSeleccionado.numero}; este viaje irá con otra.`
                    : 'Este conductor no tiene unidad fija: la que escojas aplica solo a este viaje. Para fijarla: Unidades → ficha.'}
                </span>
              )}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Fecha" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              <Field label="Hora de salida" type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
            </div>
            <Field label="Rampa" value={form.rampa} onChange={(e) => setForm({ ...form, rampa: e.target.value })} />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.sinPasajeros} onChange={(e) => setForm({ ...form, sinPasajeros: e.target.checked })} style={{ marginTop: 3 }} />
              <span>
                Sin pasajeros
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-soft)' }}>
                  El bus viaja vacío (por ejemplo, regresa). No sale a la venta, pero cuenta para saber dónde queda.
                </span>
              </span>
            </label>
            <button
              className={`${ui.btnPrimary} ${ui.btnPrimaryLg}`}
              disabled={!form.rutaId || !form.unidadId || programar.isPending}
              onClick={() => programar.mutate()}
            >
              {programar.isPending ? 'Programando…' : form.sinPasajeros ? 'Registrar viaje sin pasajeros' : 'Programar salida'}
            </button>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              Las tarifas de la ruta quedan congeladas en la salida (snapshot); cambiarlas después no
              afecta lo ya programado.
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
