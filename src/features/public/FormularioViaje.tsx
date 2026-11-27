import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import { MODALIDADES, type Modalidad } from '../../lib/api/types';
import { IconoNav } from '../../app/iconos';
import { fechaCorta, fechaParaInput, hoyISO } from '../../lib/time';
import styles from './FormularioViaje.module.css';

const ICONOS: Record<Modalidad, ReactNode> = {
  Urbano: <><rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 12h14M7 18v3m10-3v3M3 7v4m18-4v4"/><path d="M8 15h1m6 0h1"/></>,
  Extraurbano: <><path d="m3 13 3.3-7A2 2 0 0 1 8 5h9a2 2 0 0 1 1.9 1.3L21 13v4h-2m-4 0H9m-4 0H2v-3Z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></>,
  Nacional: <><rect x="5" y="2.5" width="14" height="16" rx="3"/><path d="m5 13 3 1h8l3-1M7 19v2m10-2v2M3 7v3m18-3v3M9 16.5h6"/></>,
  Tours: <><circle cx="15" cy="5" r="2"/><path d="m2 20 7-11 4 5 4-4 5 10H2Z"/></>,
};

function Icono({ children }: { children: ReactNode }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

export function IconoModalidad({ modalidad }: { modalidad: Modalidad }) {
  return <Icono>{ICONOS[modalidad]}</Icono>;
}

const EJEMPLOS: Record<Modalidad, [string, string]> = {
  Urbano: ['Barrio Obrero', 'Centro'],
  Extraurbano: ['San Cristóbal', 'Táriba'],
  Nacional: ['Barinas', 'San Cristóbal'],
  Tours: ['Mérida', 'Laguna de Mucubají'],
};

function CampoTrayecto({ titulo, valor, opciones, ejemplo, editable, opcional, cambiar }: {
  titulo: string;
  valor: string;
  opciones: string[];
  ejemplo: string;
  editable: boolean;
  opcional?: string;
  cambiar: (valor: string) => void;
}) {
  return (
    <label className={styles.ciudad}>
      <i aria-hidden="true"/>
      <span>{titulo}
        {editable ? (
          <input aria-label={titulo} value={valor} placeholder={ejemplo} maxLength={100}
            onChange={e => cambiar(e.target.value)}/>
        ) : (
          <select aria-label={titulo} disabled={!opciones.length} value={valor} onChange={e => cambiar(e.target.value)}>
            {opcional ? <option value="">{opcional}</option> : !opciones.length && <option value="">{ejemplo}</option>}
            {opciones.map(o => <option key={o}>{o}</option>)}
          </select>
        )}
      </span>
    </label>
  );
}

interface Props {
  modalidad: Modalidad;
  elegirModalidad?: (m: Modalidad) => void;
  enPanel: boolean;
  origenes: string[];
  destinos: string[];
  origen: string;
  destino: string;
  invertir: boolean;
  cambiarTrayecto: (origen: string, destino: string) => void;
  fecha: string;
  pasajeros: number;
  cambiarFecha: (fecha: string) => void;
  cambiarPasajeros: (n: number) => void;
  consultaLibre: boolean;
}

export function FormularioViaje({ modalidad, elegirModalidad, enPanel, origenes, destinos, origen, destino, invertir, cambiarTrayecto, fecha, pasajeros, cambiarFecha, cambiarPasajeros, consultaLibre }: Props) {
  const id = useId();
  const hoy = hoyISO();
  const dias = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(hoy + 'T12:00:00');
    d.setDate(d.getDate() + i);
    const valor = fechaParaInput(d);
    return { valor, dia: i === 0 ? 'Hoy' : ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()], num: d.getDate() };
  });
  const otraFecha = !dias.some(d => d.valor === fecha);
  const [ejemploOrigen, ejemploDestino] = EJEMPLOS[modalidad];

  return (
    <div id={enPanel ? undefined : 'buscar-pasajes'} className={enPanel ? styles.enPanel : styles.portada}>
      <div className={styles.silueta}>
        {enPanel && <h2 className={styles.tipoTitulo}>Tipo de viaje</h2>}
        {elegirModalidad && (
          <div className={styles.selector} role="group" aria-label="Tipo de viaje" data-guia="buscar-modalidad">
            {!enPanel && <svg className={styles.curva} viewBox="0 0 1000 64" preserveAspectRatio="none" aria-hidden="true">
              <path fill="white" d="M0 64C22 64 35 54 44 34C54 11 65 0 90 0H910C935 0 946 11 956 34C965 54 978 64 1000 64Z"/>
            </svg>}
            {MODALIDADES.map(m => (
              <button key={m} type="button" aria-pressed={modalidad === m} onClick={() => elegirModalidad(m)}>
                <IconoModalidad modalidad={m}/>{m}
              </button>
            ))}
          </div>
        )}
        <div className={styles.formulario}>
          {enPanel && modalidad === 'Urbano' && (
            <div className={styles.pagoUrbano}>
              <div><h3>Pagar al subir</h3><p>Escanea el QR de la buseta y confirma el pasaje con tu saldo.</p></div>
              <Link to="/pagar"><IconoNav id="escaner" size={20}/>Escanear QR para pagar</Link>
            </div>
          )}
          <div className={styles.ciudades} data-guia="buscar-ciudades">
            <CampoTrayecto titulo="Desde" valor={origen} opciones={origenes} ejemplo={`Ej. ${ejemploOrigen}`}
              opcional={modalidad === 'Urbano' ? 'Todas las paradas' : enPanel ? 'Todos los orígenes' : undefined} editable={consultaLibre} cambiar={valor => cambiarTrayecto(valor, consultaLibre ? destino : '')}/>
            <button type="button" className={styles.invertir} disabled={!invertir} aria-label="Invertir origen y destino" onClick={() => cambiarTrayecto(destino, origen)}>
              <Icono><path d="M3 7h16m-4-4 4 4-4 4M21 17H5m4-4-4 4 4 4"/></Icono>
            </button>
            <CampoTrayecto titulo="Hasta" valor={destino} opciones={destinos} ejemplo={`Ej. ${ejemploDestino}`}
              opcional={modalidad === 'Urbano' ? 'Todas las paradas' : enPanel ? 'Todos los destinos' : undefined} editable={consultaLibre} cambiar={valor => cambiarTrayecto(origen, valor)}/>
          </div>
          {modalidad !== 'Urbano' && (
            <div className={styles.controles}>
              <div className={styles.fechas} data-guia="buscar-dias" role="group" aria-label="Fecha del viaje">
                {enPanel && <span className={styles.fechaTitulo}>Fecha del viaje</span>}
                {dias.map(d => <button key={d.valor} type="button" aria-pressed={fecha === d.valor} className={styles.dia} onClick={() => cambiarFecha(d.valor)}>
                  <span>{d.dia}</span><strong>{d.num}</strong>
                </button>)}
                <label className={styles.calendario} data-activa={otraFecha} htmlFor={id}>
                  <Icono><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v5m10-5v5M3 10h18"/></Icono>
                  {otraFecha ? fechaCorta(fecha + 'T12:00:00') : 'Otra fecha'}
                  <input id={id} type="date" aria-label="Otra fecha" min={hoy} value={fecha}
                    onClick={e => e.currentTarget.showPicker?.()}
                    onChange={e => { if (e.target.value && e.target.validity.valid) cambiarFecha(e.target.value); }}/>
                </label>
              </div>
              <div className={styles.pasajeros} data-guia="buscar-pasajeros">
                <span>Pasajeros</span>
                <div>
                  <button type="button" disabled={pasajeros <= 1} aria-label="Menos pasajeros" onClick={() => cambiarPasajeros(pasajeros - 1)}>−</button>
                  <strong aria-live="polite">{pasajeros}</strong>
                  <button type="button" disabled={pasajeros >= 6} aria-label="Más pasajeros" onClick={() => cambiarPasajeros(pasajeros + 1)}>+</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
