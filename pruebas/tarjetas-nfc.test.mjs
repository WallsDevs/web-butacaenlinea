import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const rutaNfc = '/api/admin/tarjetas-nfc';
const solicitudAnterior = '32dc9bc5-b92a-4d24-a04d-850f716f2627';
const prefijoSecreto = 'secreto-chip-de-prueba-';
const secretoDe = (codigoPublico) => prefijoSecreto + codigoPublico;

function inventarioDePrueba() {
  const titular = { documentId: 'titular-de-prueba', nombre: 'Ana Salas' };
  const tarjetas = Array.from({ length: 120 }, (_, i) => ({
    codigoPublico: `BUT-${i % 2 === 0 ? 'AAAA' : 'BBBB'}-0000-${String(i + 1).padStart(4, '0')}`,
    creadaEn: new Date(Date.UTC(2026, 6, 1) - i * 60_000).toISOString(),
    titular: null,
    puedeVerChip: true,
  }));
  const manual = { codigoPublico: 'INVENTARIO-MANUAL-001', creadaEn: '2025-01-01T00:00:00.000Z', titular, puedeVerChip: false };
  tarjetas.push(manual);
  return { tarjetas, manual, generaciones: [], chipsConsultados: [], consultas: [], rutasInesperadas: [] };
}

async function simularApi(pagina, origen, datos) {
  await pagina.route('**/*', (ruta) => {
    const peticion = ruta.request();
    const url = new URL(peticion.url());
    if (url.origin === origen) return ruta.continue();
    if (url.hostname !== 'api.butaca.test') return ruta.abort();
    const responder = (data, status = 200) => ruta.fulfill({ status, json: { data } });
    if (!url.pathname.startsWith(rutaNfc)) return responder([]);
    // La solicitud individual guardada todavía no se entregó.
    if (url.pathname === rutaNfc + '/lotes/recientes' && peticion.method() === 'GET') return responder([]);

    if (url.pathname === rutaNfc && peticion.method() === 'GET') {
      const busqueda = (url.searchParams.get('busqueda') ?? '').toUpperCase();
      const numero = Number(url.searchParams.get('pagina') || 1);
      const porPagina = Number(url.searchParams.get('porPagina') || 20);
      datos.consultas.push({ busqueda, pagina: numero, porPagina });
      const filtradas = datos.tarjetas.filter((t) => t.codigoPublico.includes(busqueda));
      const inicio = (numero - 1) * porPagina;
      return responder({ tarjetas: filtradas.slice(inicio, inicio + porPagina), total: filtradas.length, pagina: numero, porPagina });
    }
    if (url.pathname === rutaNfc + '/lotes' && peticion.method() === 'POST') {
      const pedido = peticion.postDataJSON();
      datos.generaciones.push(pedido);
      const nuevas = Array.from({ length: pedido.cantidad }, (_, i) => ({
        codigoPublico: 'BUT-CCCC-0000-' + String(i + 1).padStart(4, '0'),
        creadaEn: new Date(Date.UTC(2026, 10, 1) - i * 1_000).toISOString(),
        titular: null, puedeVerChip: true,
      }));
      datos.tarjetas.unshift(...nuevas);
      return responder({ ...pedido, tarjetas: nuevas.map(({ codigoPublico }) => ({ codigoPublico, codigoInterno: secretoDe(codigoPublico) })) }, 201);
    }
    const [codigo, recurso] = url.pathname.slice(rutaNfc.length + 1).split('/');
    const tarjeta = datos.tarjetas.find((t) => t.codigoPublico === decodeURIComponent(codigo));
    if (peticion.method() === 'GET' && tarjeta) {
      if (!recurso) return responder({ codigoPublico: tarjeta.codigoPublico, titular: tarjeta.titular, saldoBs: tarjeta.titular ? 12.5 : null });
      if (recurso === 'chip' && tarjeta.puedeVerChip) {
        datos.chipsConsultados.push(codigo);
        return responder({ codigoInterno: secretoDe(codigo) });
      }
    }
    datos.rutasInesperadas.push(peticion.method() + ' ' + url.pathname);
    return ruta.fulfill({ status: 404, json: { error: { message: 'ruta_no_prevista' } } });
  });
}

async function sinSecretosEnLaPagina(pagina) {
  const expuesto = await pagina.evaluate((prefijo) =>
    [document.documentElement.outerHTML, JSON.stringify(localStorage), JSON.stringify(sessionStorage),
      ...Array.from(document.querySelectorAll('input, textarea'), (campo) => campo.value),
    ].some((valor) => valor.includes(prefijo)), prefijoSecreto);
  assert.equal(expuesto, false, 'los códigos internos requieren una consulta explícita por tarjeta');
}

test('el inventario reúne tarjetas de distintas emisiones y manuales, y se actualiza al generar en el teléfono', async (t) => {
  const servidor = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, hmr: false },
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify('http://api.butaca.test') },
    logLevel: 'error',
  });
  t.after(() => servidor.close());
  await servidor.listen();
  const origen = 'http://127.0.0.1:' + servidor.httpServer.address().port;
  const navegador = await chromium.launch();
  t.after(() => navegador.close());
  const pagina = await navegador.newPage({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  pagina.setDefaultTimeout(9000);
  await pagina.addInitScript((id) => {
    // Al abrir el panel por HTTP desde un teléfono en la LAN, solo está disponible getRandomValues.
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    const jwt = 'prueba.' + btoa(JSON.stringify({ exp: 4e9 })) + '.prueba';
    const usuario = { id: 1, role: { type: 'superadmin' } };
    localStorage.setItem('bel-auth', JSON.stringify({ state: { jwt, usuario }, version: 0 }));
    sessionStorage.setItem('bel-solicitud-nfc:1', id);
    sessionStorage.setItem('bel-aviso-instalar-cerrado', '1');
  }, solicitudAnterior);

  const datos = inventarioDePrueba();
  await simularApi(pagina, origen, datos);
  const boton = (name) => pagina.getByRole('button', { name, exact: true });
  const ficha = (codigo) => boton('Ver ficha de ' + codigo);
  const verChip = (codigo) => boton('Ver código del chip de ' + codigo);
  const inventario = pagina.getByRole('heading', { name: 'Todas las tarjetas', exact: true });
  const busqueda = pagina.getByLabel('Buscar por código público', { exact: true });

  await pagina.goto(origen + '/admin/tarjetas-nfc');
  await inventario.waitFor();
  await ficha(datos.tarjetas[0].codigoPublico).waitFor();
  await ficha(datos.tarjetas[1].codigoPublico).waitFor();
  assert.equal(await pagina.getByRole('heading', { name: 'Emisiones recientes' }).count(), 0);
  await sinSecretosEnLaPagina(pagina);
  assert.deepEqual(datos.chipsConsultados, []);
  const porPagina = datos.consultas.at(-1).porPagina;
  assert.ok(porPagina > 0 && porPagina < datos.tarjetas.length);
  await boton('Siguiente').click();
  const primeraDeLaSegunda = datos.tarjetas[porPagina].codigoPublico;
  await ficha(primeraDeLaSegunda).click();
  await pagina.getByRole('heading', { name: primeraDeLaSegunda, exact: true }).waitFor();
  await boton('Volver al inventario').click();
  await ficha(primeraDeLaSegunda).waitFor();
  assert.equal(await ficha(datos.tarjetas[0].codigoPublico).count(), 0, 'volver desde la ficha conserva la página');
  await boton('Anterior').click();
  await ficha(datos.tarjetas[0].codigoPublico).waitFor();

  for (const { codigoPublico } of datos.tarjetas.slice(0, 2)) {
    const anteriores = datos.chipsConsultados.length;
    await verChip(codigoPublico).click();
    await pagina.getByText(secretoDe(codigoPublico), { exact: true }).waitFor();
    assert.deepEqual([...new Set(datos.chipsConsultados.slice(anteriores))], [codigoPublico]);
  }
  const consultasExplicitas = datos.chipsConsultados.length;
  const manual = datos.manual.codigoPublico;
  assert.equal(await ficha(manual).count(), 0);
  await busqueda.fill(manual);
  await ficha(manual).waitFor();
  assert.ok(datos.consultas.some((c) => c.busqueda === manual && c.pagina === 1), 'la búsqueda consulta todo el inventario');
  assert.equal(await verChip(manual).count(), 0);
  await sinSecretosEnLaPagina(pagina);
  await ficha(manual).click();
  await pagina.getByText(datos.manual.titular.nombre, { exact: true }).waitFor();
  await boton('Volver al inventario').click();
  await ficha(manual).waitFor();
  assert.equal(await busqueda.inputValue(), manual);

  await boton('Generar tarjetas').click();
  const cantidad = pagina.getByLabel('Cantidad de tarjetas', { exact: true });
  await cantidad.waitFor();
  assert.equal(await cantidad.inputValue(), '1');
  assert(await cantidad.isEditable());
  await cantidad.fill('37');
  await boton('Generar 37 tarjetas').waitFor();
  await boton('200').click();
  await boton('Generar 200 tarjetas').click();
  await inventario.waitFor();
  assert.equal(datos.generaciones.length, 1);
  const [pedido] = datos.generaciones;
  assert.equal(pedido.cantidad, 200);
  assert.notEqual(pedido.solicitudId, solicitudAnterior);
  assert.match(pedido.solicitudId, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  const primeraGenerada = datos.tarjetas[0].codigoPublico;
  await ficha(primeraGenerada).waitFor();
  assert.equal(await busqueda.inputValue(), '', 'las tarjetas nuevas aparecen aunque antes hubiera un filtro');
  const primero = await pagina.getByText(primeraGenerada, { exact: true }).boundingBox();
  assert(primero && primero.y >= 0 && primero.y + primero.height < 844);
  await sinSecretosEnLaPagina(pagina);
  assert.equal(datos.chipsConsultados.length, consultasExplicitas, 'generar no consulta el chip de cada tarjeta');
  const ultimaGenerada = datos.tarjetas[199].codigoPublico;
  await busqueda.fill(ultimaGenerada);
  await ficha(ultimaGenerada).waitFor();
  await verChip(ultimaGenerada).click();
  await pagina.getByText(secretoDe(ultimaGenerada), { exact: true }).waitFor();
  assert.deepEqual(datos.rutasInesperadas, []);
});
