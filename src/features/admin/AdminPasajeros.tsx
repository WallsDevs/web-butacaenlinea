import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdminPasajero, getAdminPasajeros, type AdminPasajero } from '../../lib/api/endpoints';
import { fechaCorta, hora } from '../../lib/time';
import { Money } from '../../components/ui/Money';
import { StatusChip } from '../../components/ui/StatusChip';
import ui from '../../components/ui/ui.module.css';
import styles from '../flota/flota.module.css';

const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;

const NOMBRE_MOV: Record<string, string> = { recarga: 'Recarga', pasaje: 'Pasaje urbano', retiro: 'Retiro', ajuste: 'Ajuste', comision: 'Comisión', reparto: 'Reparto' };
const TONO_ESTADO: Record<string, 'ok' | 'warn' | 'bad' | 'neutral'> = { confirmado: 'ok', pendiente: 'warn', rechazado: 'bad' };
const NOMBRE_BOLETO: Record<string, string> = { emitido: 'Emitido', abordado: 'Abordado', no_show: 'No abordó', anulado: 'Anulado' };
const TONO_BOLETO: Record<string, 'ok' | 'warn' | 'bad' | 'neutral' | 'info'> = { emitido: 'info', abordado: 'ok', no_show: 'warn', anulado: 'bad' };

/**
 * Plataforma → Pasajeros: quiénes se registraron, cuánto recargaron y qué
 * compraron. Solo lectura; las recargas se verifican en Wallet.
 */
export default function AdminPasajeros() {
  const [buscar, setBuscar] = useState('');
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const { data: pasajeros, isLoading } = useQuery({
    queryKey: ['admin-pasajeros', buscar],
    queryFn: () => getAdminPasajeros(buscar.trim() || undefined),
    refetchInterval: 30_000,
  });
  const { data: ficha, isLoading: cargandoFicha } = useQuery({
    queryKey: ['admin-pasajero', seleccionado],
    queryFn: () => getAdminPasajero(seleccionado!),
    enabled: Boolean(seleccionado),
  });

  const totales = (pasajeros ?? []).reduce(
    (t, p) => ({ saldo: t.saldo + p.saldoBs, recargado: t.recargado + p.recargadoBs, pendientes: t.pendientes + p.recargasPendientes, boletos: t.boletos + p.boletos, urbanos: t.urbanos + p.pasajesUrbanos }),
    { saldo: 0, recargado: 0, pendientes: 0, boletos: 0, urbanos: 0 }
  );

  const nombreDe = (p: Pick<AdminPasajero, 'nombreCorto' | 'username'>) => p.nombreCorto || p.username;

  return (
    <div className={styles.contenido}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Pasajeros</h2>
        {!isLoading && <StatusChip tono="neutral">{pasajeros?.length ?? 0} registrados</StatusChip>}
        <input
          className={ui.fieldInput}
          style={{ marginLeft: 'auto', width: 'min(100%, 320px)' }}
          placeholder="Buscar por nombre, usuario, correo, teléfono o cédula"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
      </div>

      {/* Totales de lo que se ve */}
      <div className={ui.card} style={{ padding: 18, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        {[
          ['Saldo en wallets', bs(totales.saldo)],
          ['Recargado (confirmado)', bs(totales.recargado)],
          ['Recargas pendientes', String(totales.pendientes)],
          ['Boletos comprados', String(totales.boletos)],
          ['Pasajes urbanos', String(totales.urbanos)],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{k}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: seleccionado ? 'minmax(0, 1fr) minmax(0, 1.2fr)' : 'minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(pasajeros ?? []).map((p) => (
            <button
              key={p.documentId}
              className={ui.card}
              onClick={() => setSeleccionado(p.documentId === seleccionado ? null : p.documentId)}
              style={{ padding: 16, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', border: p.documentId === seleccionado ? '1.5px solid var(--blue-600)' : undefined }}
            >
              <div style={{ minWidth: 150, flex: '1 1 150px' }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {nombreDe(p)}{' '}
                  {p.bloqueado && <StatusChip tono="bad" size="sm">Bloqueado</StatusChip>}
                  {!p.confirmado && !p.bloqueado && <StatusChip tono="warn" size="sm">Sin confirmar</StatusChip>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                  @{p.username}{p.telefono ? ` · ${p.telefono}` : ''}{p.email ? ` · ${p.email}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  Registro {p.registradoEn ? fechaCorta(p.registradoEn) : '—'}
                  {p.ultimoMovimiento ? ` · último movimiento ${fechaCorta(p.ultimoMovimiento)}` : ' · sin movimientos'}
                </div>
              </div>
              <div style={{ minWidth: 92 }}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Saldo</div>
                <div style={{ fontWeight: 700 }}>{bs(p.saldoBs)}</div>
              </div>
              <div style={{ minWidth: 100 }}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Recargado</div>
                <div style={{ fontWeight: 700 }}>{bs(p.recargadoBs)}</div>
                {p.recargasPendientes > 0 && <div style={{ fontSize: 12, color: 'var(--warn-text, #92400E)' }}>{p.recargasPendientes} por verificar</div>}
              </div>
              <div style={{ minWidth: 60 }}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Boletos</div>
                <div style={{ fontWeight: 700 }}>{p.boletos}</div>
              </div>
              <div style={{ minWidth: 60 }}>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Urbanos</div>
                <div style={{ fontWeight: 700 }}>{p.pasajesUrbanos}</div>
              </div>
            </button>
          ))}
          {!isLoading && !pasajeros?.length && (
            <div className={ui.card} style={{ padding: 28, textAlign: 'center', color: 'var(--text-soft)' }}>
              {buscar ? 'Ningún pasajero coincide.' : 'Todavía no se ha registrado ningún pasajero.'}
            </div>
          )}
        </div>

        {seleccionado && (
          <div className={ui.card} style={{ padding: 20, position: 'sticky', top: 16 }}>
            {cargandoFicha || !ficha ? (
              <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>Cargando ficha…</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{nombreDe(ficha)}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 2 }}>
                      @{ficha.username}{ficha.documento ? ` · ${ficha.documento}` : ''}{ficha.telefono ? ` · ${ficha.telefono}` : ''}{ficha.email ? ` · ${ficha.email}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
                      Registrado {ficha.registradoEn ? `${fechaCorta(ficha.registradoEn)} ${hora(ficha.registradoEn)}` : '—'}
                    </div>
                  </div>
                  <button className={ui.btnGhost} onClick={() => setSeleccionado(null)}>Cerrar</button>
                </div>

                <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Saldo en wallet</div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{bs(ficha.wallet.saldoBs)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Boletos</div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{ficha.boletos.filter((b) => b.estado !== 'anulado').length}</div>
                  </div>
                </div>

                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '20px 0 8px' }}>Wallet: recargas y pasajes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                  {ficha.wallet.movimientos.map((m) => (
                    <div key={m.documentId} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>
                          {NOMBRE_MOV[m.tipo] ?? m.tipo}{m.unidad ? ` · unidad ${m.unidad}` : ''}{m.contraparte && m.tipo !== 'recarga' ? ` · ${m.contraparte}` : ''}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                          {fechaCorta(m.fecha)} {hora(m.fecha)}{m.referencia ? ` · ref ${m.referencia}` : ''}
                        </div>
                      </div>
                      <StatusChip tono={TONO_ESTADO[m.estado] ?? 'neutral'} size="sm">{m.estado}</StatusChip>
                      <div style={{ fontWeight: 700, color: m.direccion === 'entrada' ? 'var(--ok-text)' : 'var(--text)', minWidth: 110, textAlign: 'right' }}>
                        {m.direccion === 'entrada' ? '+' : '−'}{bs(m.montoBs)}
                      </div>
                    </div>
                  ))}
                  {!ficha.wallet.movimientos.length && <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Sin movimientos en la wallet.</div>}
                </div>

                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '20px 0 8px' }}>Boletos comprados</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                  {ficha.boletos.map((b) => (
                    <div key={b.qrId} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>
                          {b.salida?.ruta ? `${b.salida.ruta.origen} → ${b.salida.ruta.destino}` : 'Salida'}{b.linea ? ` · ${b.linea.nombre}` : ''}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                          {b.salida?.fechaHoraSalida ? `${fechaCorta(b.salida.fechaHoraSalida)} ${hora(b.salida.fechaHoraSalida)}` : ''}
                          {b.salida?.unidad?.numero ? ` · unidad ${b.salida.unidad.numero}` : ''} · puesto {b.asientoId} · {b.pasajeroNombre} · folio {b.folio}
                        </div>
                      </div>
                      <StatusChip tono={TONO_BOLETO[b.estado] ?? 'neutral'} size="sm">{NOMBRE_BOLETO[b.estado] ?? b.estado}</StatusChip>
                      <Money usd={b.totalUsd} style={{ fontWeight: 700, minWidth: 90, textAlign: 'right' }} />
                    </div>
                  ))}
                  {!ficha.boletos.length && <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>No ha comprado boletos.</div>}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
