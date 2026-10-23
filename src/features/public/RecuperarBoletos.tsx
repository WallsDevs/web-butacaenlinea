import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { recuperarBoletos, type BoletoRecuperado } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { fechaCorta, hora } from '../../lib/time';
import ui from '../../components/ui/ui.module.css';
import { useSeo } from '../../lib/seo';

/**
 * Para quien compró sin cuenta y perdió el enlace del boleto: con la cédula del
 * pasajero y el teléfono (o el folio) que puso al comprar, aparecen sus boletos
 * de los últimos meses. Las dos pruebas juntas evitan que baste una cédula ajena.
 */
export default function RecuperarBoletos() {
  useSeo('Recuperar mis boletos — Butaca En Línea', 'Encuentra los boletos que compraste sin cuenta con tu cédula y tu teléfono.', { noindex: true });
  const [documento, setDocumento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [folio, setFolio] = useState('');
  const [error, setError] = useState<string | null>(null);

  const buscar = useMutation({
    mutationFn: () => recuperarBoletos({ documento, telefono: telefono || undefined, folio: folio || undefined }),
    onMutate: () => setError(null),
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'datos_insuficientes') setError('Escribe la cédula y además el teléfono o el folio que usaste al comprar.');
      else if (e instanceof ApiError && e.code === 'demasiados_intentos') setError('Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.');
      else setError('No pudimos buscar ahora. Revisa tu conexión e intenta de nuevo.');
    },
  });

  const digitos = (t: string) => t.replace(/\D/g, '').length;
  const listo = digitos(documento) >= 5 && (digitos(telefono) >= 7 || folio.trim().length >= 4);
  const resultado = buscar.data;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '28px 16px 72px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Recuperar mis boletos</h1>
      <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.55, color: 'var(--text-soft)' }}>
        ¿Compraste sin cuenta y perdiste el boleto? Escribe la cédula del pasajero y el teléfono o el folio que pusiste al comprar.
      </p>

      <form
        className={ui.card}
        style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (listo) buscar.mutate();
        }}
      >
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Cédula del pasajero</span>
          <input className={ui.fieldInput} inputMode="numeric" autoComplete="off" placeholder="V-12.345.678" value={documento} onChange={(e) => setDocumento(e.target.value)} />
        </label>
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Teléfono que usaste al comprar</span>
          <input className={ui.fieldInput} type="tel" inputMode="tel" autoComplete="tel" placeholder="0414 555 1234" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </label>
        <label className={ui.field}>
          <span className={ui.fieldLabel}>O el folio del boleto</span>
          <input className={ui.fieldInput} autoComplete="off" placeholder="A-000123" value={folio} onChange={(e) => setFolio(e.target.value)} />
        </label>
        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--bad-text, #B42318)' }}>{error}</p>}
        <button className={ui.btnPrimary} type="submit" disabled={!listo || buscar.isPending} style={{ padding: 13 }}>
          {buscar.isPending ? 'Buscando…' : 'Buscar mis boletos'}
        </button>
      </form>

      {resultado && resultado.length === 0 && (
        <p style={{ marginTop: 18, fontSize: 14, lineHeight: 1.55, color: 'var(--text-soft)' }}>
          No hay boletos con esos datos en los últimos cuatro meses. Revisa que la cédula y el teléfono sean los mismos que pusiste al comprar, o escríbenos por WhatsApp desde <Link to="/ayuda">Ayuda</Link>.
        </p>
      )}
      {resultado && resultado.length > 0 && (
        <section style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }} aria-label="Boletos encontrados">
          {resultado.map((b) => <Fila key={b.qrId ?? b.folio} b={b} />)}
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.5 }}>
            Para no perderlos otra vez, <Link to="/registro">crea tu cuenta</Link> con el mismo teléfono.
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
