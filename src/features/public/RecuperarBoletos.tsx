import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { recuperarBoletos, type BoletoRecuperado } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { fechaCorta, hora } from '../../lib/time';
import ui from '../../components/ui/ui.module.css';
import { useSeo } from '../../lib/seo';
import { BANCOS_VE } from '../../lib/bancos';
import { ComprobanteMuestra, type DatoComprobante } from './ComprobanteMuestra';
import css from './recuperar.module.css';

/**
 * Para quien compró sin cuenta y perdió el enlace del boleto: con los cuatro
 * datos de su comprobante de Pago Móvil (referencia, banco, teléfono y cédula
 * de quien pagó) aparecen los boletos de esa compra. Solo los tiene quien hizo
 * el pago. El formulario sigue el orden del comprobante, con sus mismos números.
 */
export default function RecuperarBoletos() {
  useSeo('Recuperar mis boletos — Butaca En Línea', 'Encuentra los boletos que compraste sin cuenta con los datos de tu comprobante de Pago Móvil.', { noindex: true });
  const [datos, setDatos] = useState<Record<DatoComprobante, string>>({ referencia: '', banco: '', telefono: '', documento: '' });
  const [activo, setActivo] = useState<DatoComprobante | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cambiar = (k: DatoComprobante, v: string) => setDatos((d) => ({ ...d, [k]: v }));

  const buscar = useMutation({
    mutationFn: () => recuperarBoletos({ referencia: datos.referencia.trim(), banco: datos.banco, telefono: datos.telefono.trim(), documento: datos.documento.trim() }),
    onMutate: () => setError(null),
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'datos_insuficientes') setError('Completa los cuatro datos tal como salen en tu comprobante.');
      else if (e instanceof ApiError && e.code === 'demasiados_intentos') setError('Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.');
      else setError('No pudimos buscar ahora. Revisa tu conexión e intenta de nuevo.');
    },
  });

  const digitos = (t: string) => t.replace(/\D/g, '').length;
  const listo = datos.referencia.replace(/[^0-9A-Za-z]/g, '').length >= 4 && Boolean(datos.banco) && digitos(datos.telefono) >= 10 && digitos(datos.documento) >= 5;
  const resultado = buscar.data;
  const campo = (k: DatoComprobante) => ({ onFocus: () => setActivo(k), onBlur: () => setActivo((a) => (a === k ? null : a)) });

  return (
    <main className={css.pagina}>
      <h1 className={css.titulo}>Recuperar mis boletos</h1>
      <p className={css.intro}>
        ¿Compraste sin cuenta y perdiste el enlace de tu boleto? Búscalo con los datos de tu <strong>comprobante de Pago Móvil</strong>: los mismos números que ves en la captura de tu banco.
      </p>

      <div className={css.rejilla}>
        <form
          className={css.formulario}
          onSubmit={(e) => {
            e.preventDefault();
            if (listo) buscar.mutate();
          }}
        >
          <label className={css.campo}>
            <span className={css.etiqueta}><span className={css.marca} aria-hidden>1</span>Referencia del pago</span>
            <input className={ui.fieldInput} autoComplete="off" inputMode="text" placeholder="Ej. 0004 8812 3371" value={datos.referencia} onChange={(e) => cambiar('referencia', e.target.value)} {...campo('referencia')} />
          </label>
          <label className={css.campo}>
            <span className={css.etiqueta}><span className={css.marca} aria-hidden>2</span>Banco desde el que pagaste</span>
            <select className={ui.fieldInput} value={datos.banco} onChange={(e) => cambiar('banco', e.target.value)} {...campo('banco')}>
              <option value="">Escoge tu banco</option>
              {BANCOS_VE.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <label className={css.campo}>
            <span className={css.etiqueta}><span className={css.marca} aria-hidden>3</span>Teléfono desde el que pagaste</span>
            <input className={ui.fieldInput} type="tel" inputMode="tel" autoComplete="tel" placeholder="0414-555.12.34" value={datos.telefono} onChange={(e) => cambiar('telefono', e.target.value)} {...campo('telefono')} />
          </label>
          <label className={css.campo}>
            <span className={css.etiqueta}><span className={css.marca} aria-hidden>4</span>Cédula de quien pagó</span>
            <input className={ui.fieldInput} inputMode="text" autoComplete="off" placeholder="V-12.345.678" value={datos.documento} onChange={(e) => cambiar('documento', e.target.value)} {...campo('documento')} />
          </label>
          {error && <p role="alert" className={css.error}>{error}</p>}
          <button className={ui.btnPrimary} type="submit" disabled={!listo || buscar.isPending} style={{ padding: 14, fontSize: 15 }}>
            {buscar.isPending ? 'Buscando…' : 'Buscar mis boletos'}
          </button>
          <p className={css.nota}>Por ahora se recuperan los boletos pagados con Pago Móvil. Si compraste con una cuenta de Butaca, tus boletos están en <Link to="/ingresar?next=%2Fcuenta%2Fboletos">Mis boletos</Link>.</p>
        </form>
        <ComprobanteMuestra activo={activo} />
      </div>

      {resultado && resultado.length === 0 && (
        <p className={css.vacio}>
          No encontramos boletos con esos cuatro datos. Revisa que sean los de tu comprobante: la referencia completa, el banco y el teléfono desde el que pagaste, y la cédula del titular de esa cuenta (no siempre es la del pasajero). Si no aparece, escríbenos por WhatsApp desde <Link to="/ayuda">Ayuda</Link>.
        </p>
      )}
      {resultado && resultado.length > 0 && (
        <section className={css.resultados} aria-label="Boletos encontrados">
          <h2>Tus boletos</h2>
          {resultado.map((b) => <Fila key={b.qrId ?? b.folio} b={b} />)}
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.5 }}>
            Para no perderlos otra vez, <Link to="/registro">crea tu cuenta</Link>: tus boletos quedan guardados en ella.
          </p>
        </section>
      )}
    </main>
  );
}

function Fila({ b }: { b: BoletoRecuperado }) {
  const s = b.salida;
  const anulado = b.estado === 'anulado';
  // Comprado con cuenta: no se abre desde aquí, se ve ingresando a esa cuenta
  const destino = b.qrId ? `/boleto/${b.qrId}` : `/ingresar?next=${encodeURIComponent('/cuenta/boletos')}`;
  return (
    <Link to={destino} className={ui.card} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', opacity: anulado ? 0.6 : 1 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>
          {s?.ruta?.origen ?? '—'} → {s?.ruta?.destino ?? '—'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>
          {s?.fechaHoraSalida ? `${fechaCorta(s.fechaHoraSalida)} · ${hora(s.fechaHoraSalida)}` : ''}
          {s?.linea?.nombre ? ` · ${s.linea.nombre}` : ''}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          {b.pasajeroNombre} · Puesto {b.asientoId} · {b.folio}
          {anulado ? ' · Anulado' : b.estadoPago === 'por_verificar' ? ' · Pago por verificar' : ''}
        </div>
        {!b.qrId && (
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue-700)', marginTop: 2 }}>
            Está en una cuenta de Butaca: ingresa para verlo
          </div>
        )}
      </div>
      <span aria-hidden style={{ fontSize: 18, color: 'var(--text-faint)' }}>›</span>
    </Link>
  );
}
