import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  configurarEjes,
  desmontarCaucho,
  getCauchos,
  instalarCaucho,
  medirCaucho,
  montarCaucho,
  reemplazarCaucho,
  reencaucharCaucho,
  rotarCauchos,
} from '../../../lib/api/endpoints';
import type { CauchoDto } from '../../../lib/api/types';
import { Field } from '../../../components/ui/Field';
import ui from '../../../components/ui/ui.module.css';
import styles from '../flota.module.css';
import { ErrorLinea, Modal, fechaCortaVe, km, mensajeError, numeroDe } from './comun';

type Eje = { numero: number; nombre: string; tipo: 'direccional' | 'traccion' | 'porta'; porLado: number };
const PRESETS: { titulo: string; nota: string; ejes: Eje[] }[] = [
  { titulo: 'Buseta', nota: '2 ejes · 4 cauchos', ejes: [{ numero: 1, nombre: 'Delantero', tipo: 'direccional', porLado: 1 }, { numero: 2, nombre: 'Trasero', tipo: 'traccion', porLado: 1 }] },
  { titulo: 'Autobús', nota: '2 ejes · 6 cauchos (trasero doble)', ejes: [{ numero: 1, nombre: 'Delantero', tipo: 'direccional', porLado: 1 }, { numero: 2, nombre: 'Tracción', tipo: 'traccion', porLado: 2 }] },
  { titulo: 'Autobús de 3 ejes', nota: '3 ejes · 8 cauchos (porta sencillo)', ejes: [{ numero: 1, nombre: 'Delantero', tipo: 'direccional', porLado: 1 }, { numero: 2, nombre: 'Tracción', tipo: 'traccion', porLado: 2 }, { numero: 3, nombre: 'Porta', tipo: 'porta', porLado: 1 }] },
  { titulo: 'Autobús de 3 ejes', nota: '3 ejes · 10 cauchos (todos dobles atrás)', ejes: [{ numero: 1, nombre: 'Delantero', tipo: 'direccional', porLado: 1 }, { numero: 2, nombre: 'Tracción', tipo: 'traccion', porLado: 2 }, { numero: 3, nombre: 'Porta', tipo: 'porta', porLado: 2 }] },
];
const ESTADO_TEXTO: Record<string, string> = { sano: 'Banda sana', rotacion_sugerida: 'Toca rotar', reemplazo_vencido: 'Reemplazar ya' };

type Seleccion = { posicion: string; caucho: CauchoDto | null } | null;

/**
 * Cauchos por posición. Tocar una posición vacía permite montar uno nuevo o
 * uno del depósito; tocar un caucho muestra su ficha y sus acciones. Para
 * mover: «Mover», luego la posición destino (si está ocupada, se intercambian).
 * El color sale solo: banda medida y km desde la última rotación.
 */
export function CauchosCard({ unidadId, esEmpresa }: { unidadId: string; esEmpresa: boolean }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['cauchos', unidadId], queryFn: () => getCauchos(unidadId) });
  const [sel, setSel] = useState<Seleccion>(null);
  const [moviendo, setMoviendo] = useState<CauchoDto | null>(null);
  const [modal, setModal] = useState<'instalar' | 'montar' | 'reemplazar' | 'desmontar' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refrescar = () => {
    for (const k of ['cauchos', 'alertas', 'plan']) void queryClient.invalidateQueries({ queryKey: [k, unidadId] });
  };
  const rotar = useMutation({
    mutationFn: rotarCauchos,
    onSuccess: () => {
      refrescar();
      setMoviendo(null);
      setSel(null);
    },
    onError: (e) => setError(mensajeError(e)),
  });
  const ejes = useMutation({
    mutationFn: (e: Eje[]) => configurarEjes(unidadId, e),
    onSuccess: () => refrescar(),
    onError: (e) => setError(mensajeError(e)),
  });

  if (!data) return null;

  if (data.ejes.length === 0) {
    if (!esEmpresa) return null;
    return (
      <div className={styles.cardCauchos}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Cauchos por posición</div>
        <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>¿Cómo son los ejes de esta unidad? Con eso se dibujan las posiciones de los cauchos.</p>
        <div className={styles.presetsEjes}>
          {PRESETS.map((p) => (
            <button key={p.nota} className={styles.presetEje} disabled={ejes.isPending} onClick={() => ejes.mutate(p.ejes)}>
              <strong>{p.titulo}</strong>
              <span>{p.nota}</span>
            </button>
          ))}
        </div>
        <ErrorLinea texto={error} />
      </div>
    );
  }

  const tocar = (posicion: string, caucho: CauchoDto | null) => {
    setError(null);
    if (moviendo) {
      if (posicion === moviendo.posicion) return setMoviendo(null);
      const movimientos = [{ cauchoId: moviendo.documentId, posicionNueva: posicion }];
      if (caucho) movimientos.push({ cauchoId: caucho.documentId, posicionNueva: moviendo.posicion });
      return rotar.mutate(movimientos);
    }
    setSel({ posicion, caucho });
  };

  const clase = (c: CauchoDto | null) =>
    !c ? styles.cauchoVacio : c.estado === 'reemplazo_vencido' ? styles.cauchoBad : c.estado === 'rotacion_sugerida' ? styles.cauchoWarn : styles.cauchoSano;
  const boton = (p: { posicion: string; caucho: CauchoDto | null }) => (
    <button
      key={p.posicion}
      className={`${styles.caucho} ${clase(p.caucho)} ${sel?.posicion === p.posicion || moviendo?.posicion === p.posicion ? styles.cauchoSel : ''} ${moviendo && p.posicion !== moviendo.posicion ? styles.cauchoDestino : ''}`}
      onClick={() => tocar(p.posicion, p.caucho)}
      aria-label={p.caucho ? `${p.posicion}: ${p.caucho.serial}, ${ESTADO_TEXTO[p.caucho.estado] ?? p.caucho.estado}` : `${p.posicion}: vacía`}
    >
      <span className={styles.cauchoPos}>{p.posicion}</span>
      <span className={styles.cauchoDesgaste}>{p.caucho ? (p.caucho.profundidadMm != null ? `${String(p.caucho.profundidadMm).replace('.', ',')} mm` : '—') : '+'}</span>
    </button>
  );

  const c = sel?.caucho ?? null;

  return (
    <div className={styles.cardCauchos}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Cauchos por posición</div>
          <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
            {data.ejes.length} ejes · {data.totalPosiciones} posiciones · rotación cada {km(data.reglas.kmRotacion)} km
          </div>
        </div>
        {moviendo && (
          <div className={styles.avisoMover} role="status">
            Moviendo {moviendo.serial} desde {moviendo.posicion}: toca la posición destino.
            <button className={ui.btnGhost} style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setMoviendo(null)}>Cancelar</button>
          </div>
        )}
      </div>
      <ErrorLinea texto={error} />

      <div className={styles.cauchosLayout}>
        <div className={styles.diagrama}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {data.ejes.map((eje) => (
              <div key={eje.numero} className={styles.eje}>
                <div className={styles.ejeEtiqueta}>
                  <div className={styles.ejeNombre}>{eje.nombre}</div>
                  <div className={styles.ejeTipo}>{eje.tipo === 'direccional' ? 'Direccional' : eje.tipo === 'traccion' ? 'Tracción' : 'Porta'}{eje.izquierda.length > 1 ? ' · doble' : ''}</div>
                </div>
                <div className={styles.ejeCentro}>
                  <div className={styles.ladoCauchos}>{eje.izquierda.map(boton)}</div>
                  <div className={styles.barraEje} />
                  <div className={styles.ladoCauchos}>{eje.derecha.map(boton)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.leyenda}>
            <span><span className={`${styles.muestra} ${styles.cauchoSano}`} /> Banda sana</span>
            <span><span className={`${styles.muestra} ${styles.cauchoWarn}`} /> Toca rotar ({km(data.reglas.kmRotacion)} km o {data.reglas.mmRotacion} mm)</span>
            <span><span className={`${styles.muestra} ${styles.cauchoBad}`} /> Reemplazar ({data.reglas.mmReemplazo} mm o menos)</span>
            <span><span className={`${styles.muestra} ${styles.cauchoVacio}`} /> Vacía: tócala para montar</span>
          </div>
        </div>

        <div className={styles.detalleCaucho}>
          <div className={styles.detalleCabecera}>
            {!sel ? 'Toca una posición del diagrama' : c ? `Caucho en ${sel.posicion}` : `${sel.posicion} está vacía`}
          </div>
          {sel && !c && (
            <div className={styles.detalleCuerpo} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className={ui.btnPrimary} onClick={() => setModal('instalar')}>Montar caucho nuevo</button>
              <button className={ui.btnSecondary} disabled={!data.deposito.length} onClick={() => setModal('montar')}>
                Montar del depósito{data.deposito.length ? ` (${data.deposito.length})` : ''}
              </button>
              {!data.deposito.length && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>No hay cauchos en el depósito.</span>}
            </div>
          )}
          {c && sel && <FichaCaucho c={c} unidadId={unidadId} onMover={() => { setMoviendo(c); setSel(null); }} onModal={setModal} onCambio={() => { refrescar(); setSel(null); }} />}
        </div>
      </div>

      {data.deposito.length > 0 && <Deposito cauchos={data.deposito} onCambio={refrescar} />}

      {modal === 'instalar' && sel && <ModalInstalar unidadId={unidadId} posicion={sel.posicion} onCerrar={(ok) => { setModal(null); if (ok) { refrescar(); setSel(null); } }} />}
      {modal === 'montar' && sel && <ModalMontar unidadId={unidadId} posicion={sel.posicion} deposito={data.deposito} onCerrar={(ok) => { setModal(null); if (ok) { refrescar(); setSel(null); } }} />}
      {modal === 'reemplazar' && c && <ModalReemplazo caucho={c} onCerrar={(ok) => { setModal(null); if (ok) { refrescar(); setSel(null); } }} />}
      {modal === 'desmontar' && c && <ModalDesmontar caucho={c} onCerrar={(ok) => { setModal(null); if (ok) { refrescar(); setSel(null); } }} />}
    </div>
  );
}

function FichaCaucho({ c, onMover, onModal, onCambio }: { c: CauchoDto; unidadId: string; onMover: () => void; onModal: (m: 'reemplazar' | 'desmontar') => void; onCambio: () => void }) {
  const [banda, setBanda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const medir = useMutation({
    mutationFn: () => medirCaucho(c.documentId, numeroDe(banda)!),
    onSuccess: () => { setBanda(''); onCambio(); },
    onError: (e) => setError(mensajeError(e)),
  });
  return (
    <div className={styles.detalleCuerpo}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{c.marca || 'Sin marca'}</div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{c.medida || 'Medida sin anotar'} · {ESTADO_TEXTO[c.estado] ?? c.estado}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
        <div className={styles.detalleFila}><span>Serial</span><span>{c.serial}</span></div>
        <div className={styles.detalleFila}><span>Montado</span><span>{fechaCortaVe(c.fechaInstalacion)}</span></div>
        <div className={styles.detalleFila}><span>Recorrido aquí</span><span>{km(c.recorridoKm)} km</span></div>
        <div className={styles.detalleFila}><span>Desde la última rotación</span><span>{km(c.kmDesdeRotacion)} km</span></div>
        <div className={styles.detalleFila}><span>Banda</span><span>{c.profundidadMm != null ? String(c.profundidadMm).replace('.', ',') : '—'} de {c.profundidadNuevaMm} mm</span></div>
        <div className={styles.detalleFila}><span>Reencauches</span><span>{c.reencauches} de {c.maxReencauches}</span></div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'flex-end' }}>
        <Field label="Medir banda (mm)" inputMode="decimal" value={banda} onChange={(e) => { setBanda(e.target.value); setError(null); }} placeholder="Ej.: 9,5" />
        <button className={ui.btnSecondary} style={{ flex: 'none' }} disabled={numeroDe(banda) == null || medir.isPending} onClick={() => medir.mutate()}>Guardar</button>
      </div>
      <ErrorLinea texto={error} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
        <button className={ui.btnSecondary} onClick={onMover}>Mover</button>
        <button className={ui.btnSecondary} onClick={() => onModal('desmontar')}>Desmontar</button>
        <button className={ui.btnPrimary} style={{ gridColumn: '1 / -1' }} onClick={() => onModal('reemplazar')}>Reemplazar por uno nuevo</button>
      </div>
    </div>
  );
}

function Deposito({ cauchos, onCambio }: { cauchos: CauchoDto[]; onCambio: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const reencauchar = useMutation({ mutationFn: reencaucharCaucho, onSuccess: onCambio, onError: (e) => setError(mensajeError(e)) });
  return (
    <div style={{ marginTop: 20 }}>
      <div className={styles.kicker}>Depósito de la línea</div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '2px 0 10px' }}>Cauchos desmontados que todavía sirven. Para montar uno, toca una posición vacía.</p>
      <ErrorLinea texto={error} />
      <div className={styles.listaDeposito}>
        {cauchos.map((c) => (
          <div key={c.documentId} className={styles.itemDeposito}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{c.serial}</div>
              <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                {[c.marca, c.medida].filter(Boolean).join(' · ') || 'Sin datos'} · {c.profundidadMm != null ? `${String(c.profundidadMm).replace('.', ',')} mm` : 'banda sin medir'} · {c.reencauches}/{c.maxReencauches} reencauches
              </div>
            </div>
            <button className={ui.btnGhost} style={{ fontSize: 12 }} disabled={c.reencauches >= c.maxReencauches || reencauchar.isPending} onClick={() => reencauchar.mutate(c.documentId)}>
              Reencauchar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Pie({ onCerrar, listo, pendiente, accion }: { onCerrar: () => void; listo: boolean; pendiente: boolean; accion: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
      <button className={ui.btnSecondary} onClick={onCerrar}>Cancelar</button>
      <button className={ui.btnPrimary} type="submit" disabled={!listo || pendiente}>{pendiente ? 'Guardando…' : accion}</button>
    </div>
  );
}

function ModalInstalar({ unidadId, posicion, onCerrar }: { unidadId: string; posicion: string; onCerrar: (ok: boolean) => void }) {
  const [serial, setSerial] = useState('');
  const [marca, setMarca] = useState('');
  const [medida, setMedida] = useState('');
  const [nueva, setNueva] = useState('16');
  const [actual, setActual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => instalarCaucho({ unidad: unidadId, posicion, serial: serial.trim(), marca: marca.trim() || undefined, medida: medida.trim() || undefined, profundidadNuevaMm: numeroDe(nueva) ?? 16, profundidadMm: numeroDe(actual) ?? undefined }),
    onSuccess: () => onCerrar(true),
    onError: (e) => setError(mensajeError(e)),
  });
  return (
    <Modal titulo={`Montar caucho en ${posicion}`} nota="Queda registrado con el km actual de la unidad; desde ahí se cuenta su recorrido." onCerrar={() => onCerrar(false)}>
      <form style={{ display: 'contents' }} onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <Field label="Serial" value={serial} onChange={(e) => setSerial(e.target.value)} autoFocus />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Marca y modelo" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ej.: Firestone FS400" />
          <Field label="Medida" value={medida} onChange={(e) => setMedida(e.target.value)} placeholder="Ej.: 295/80 R22.5" />
          <Field label="Banda nueva (mm)" inputMode="decimal" value={nueva} onChange={(e) => setNueva(e.target.value)} />
          <Field label="Banda actual (mm)" inputMode="decimal" value={actual} onChange={(e) => setActual(e.target.value)} placeholder="Si es nuevo, déjalo vacío" />
        </div>
        <ErrorLinea texto={error} />
        <Pie onCerrar={() => onCerrar(false)} listo={Boolean(serial.trim())} pendiente={m.isPending} accion="Montar caucho" />
      </form>
    </Modal>
  );
}

function ModalMontar({ unidadId, posicion, deposito, onCerrar }: { unidadId: string; posicion: string; deposito: CauchoDto[]; onCerrar: (ok: boolean) => void }) {
  const [elegido, setElegido] = useState(deposito[0]?.documentId ?? '');
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({ mutationFn: () => montarCaucho(elegido, unidadId, posicion), onSuccess: () => onCerrar(true), onError: (e) => setError(mensajeError(e)) });
  return (
    <Modal titulo={`Montar en ${posicion} desde el depósito`} onCerrar={() => onCerrar(false)}>
      <form style={{ display: 'contents' }} onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} role="radiogroup">
          {deposito.map((c) => (
            <label key={c.documentId} className={`${styles.opcionLista} ${elegido === c.documentId ? styles.opcionListaSel : ''}`}>
              <input type="radio" name="caucho" checked={elegido === c.documentId} onChange={() => setElegido(c.documentId)} />
              <span><strong>{c.serial}</strong> · {[c.marca, c.medida].filter(Boolean).join(' · ') || 'sin datos'} · {c.profundidadMm != null ? `${String(c.profundidadMm).replace('.', ',')} mm` : 'sin medir'}</span>
            </label>
          ))}
        </div>
        <ErrorLinea texto={error} />
        <Pie onCerrar={() => onCerrar(false)} listo={Boolean(elegido)} pendiente={m.isPending} accion="Montar" />
      </form>
    </Modal>
  );
}

function ModalDesmontar({ caucho, onCerrar }: { caucho: CauchoDto; onCerrar: (ok: boolean) => void }) {
  const [destino, setDestino] = useState<'en_deposito' | 'desechado'>('en_deposito');
  const [banda, setBanda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({ mutationFn: () => desmontarCaucho(caucho.documentId, destino, numeroDe(banda) ?? undefined), onSuccess: () => onCerrar(true), onError: (e) => setError(mensajeError(e)) });
  return (
    <Modal titulo={`Desmontar ${caucho.serial} de ${caucho.posicion}`} nota="La posición queda libre. Su historial se conserva." onCerrar={() => onCerrar(false)}>
      <form style={{ display: 'contents' }} onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <div className={ui.pillGroup} style={{ alignSelf: 'flex-start' }} role="group" aria-label="A dónde va">
          <button type="button" className={`${ui.pill} ${destino === 'en_deposito' ? ui.pillActive : ''}`} onClick={() => setDestino('en_deposito')}>Al depósito (sirve o va a reencauche)</button>
          <button type="button" className={`${ui.pill} ${destino === 'desechado' ? ui.pillActive : ''}`} onClick={() => setDestino('desechado')}>A desecho</button>
        </div>
        <Field label="Banda al desmontar (mm, opcional)" inputMode="decimal" value={banda} onChange={(e) => setBanda(e.target.value)} />
        <ErrorLinea texto={error} />
        <Pie onCerrar={() => onCerrar(false)} listo pendiente={m.isPending} accion="Desmontar" />
      </form>
    </Modal>
  );
}

function ModalReemplazo({ caucho, onCerrar }: { caucho: CauchoDto; onCerrar: (ok: boolean) => void }) {
  const [serial, setSerial] = useState('');
  const [marca, setMarca] = useState(caucho.marca ?? '');
  const [medida, setMedida] = useState(caucho.medida ?? '');
  const [nueva, setNueva] = useState(String(caucho.profundidadNuevaMm ?? 16));
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => reemplazarCaucho(caucho.documentId, { serialNuevo: serial.trim(), marca: marca.trim() || undefined, medida: medida.trim() || undefined, profundidadNuevaMm: numeroDe(nueva) ?? 16 }),
    onSuccess: () => onCerrar(true),
    onError: (e) => setError(mensajeError(e)),
  });
  return (
    <Modal titulo={`Reemplazo en ${caucho.posicion}`} nota={`${caucho.serial} pasa a desecho con su historial y el nuevo queda montado en la posición.`} onCerrar={() => onCerrar(false)}>
      <form style={{ display: 'contents' }} onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <Field label="Serial del caucho nuevo" value={serial} onChange={(e) => setSerial(e.target.value)} autoFocus />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Marca y modelo" value={marca} onChange={(e) => setMarca(e.target.value)} />
          <Field label="Medida" value={medida} onChange={(e) => setMedida(e.target.value)} />
          <Field label="Banda nueva (mm)" inputMode="decimal" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </div>
        <ErrorLinea texto={error} />
        <Pie onCerrar={() => onCerrar(false)} listo={Boolean(serial.trim())} pendiente={m.isPending} accion="Registrar reemplazo" />
      </form>
    </Modal>
  );
}
