import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const rutaNfc = '/api/admin/tarjetas-nfc';
const codigo = 'BUT-PRUE-GRAB-0001';
const ajena = 'BUT-PRUE-GRAB-0002';
const segunda = 'BUT-PRUE-GRAB-0003';
const secreto = 'Q2u_Codigo-De-Chip-de-Pruebas_01';
const secretoSegundo = 'Es_otro-Chip-de-Pruebas_03';
const exito = 'Tarjeta grabada y verificada.';

// Sustituye solo el lector físico. La interfaz, permisos de la ficha, escritura y
// verificación se ejecutan a través de los componentes reales de la aplicación.
function instalarLector(disponible) {
  const jwt = 'prueba.' + btoa(JSON.stringify({ exp: 4e9 })) + '.prueba';
  localStorage.setItem('bel-auth', JSON.stringify({ state: { jwt, usuario: { id: 1, role: { type: 'superadmin' } } }, version: 0 }));
  sessionStorage.setItem('bel-aviso-instalar-cerrado', '1');
  const nfc = { escrituras: [], lecturas: [], denegarLectura: false };
  window.nfcPrueba = nfc;
  class Lector {
    write(mensaje, { overwrite, signal }) {
      return new Promise((resolver, rechazar) => {
        nfc.escrituras.push({ mensaje, overwrite, signal, completar: resolver, fallar: (nombre) => rechazar(new DOMException('Prueba NFC', nombre)) });
      });
    }
    async scan({ signal }) {
      if (nfc.denegarLectura) {
        nfc.denegarLectura = false;
        throw new DOMException('Prueba NFC', 'NotAllowedError');
      }
      // Guardamos el callback para poder simular incluso un evento que llegue tras cancelar.
      const recibir = this.onreading;
      nfc.lecturas.push({
        signal,
        recibir(texto) {
          const data = new DataView(new TextEncoder().encode(texto).buffer);
          recibir({ message: { records: [{ recordType: 'text', encoding: 'utf-8', data }] }, serialNumber: '99:11' });
        },
      });
    }
  }
  Object.defineProperty(window, 'NDEFReader', { configurable: true, value: disponible ? Lector : undefined });
}

async function abrirInventario(t, navegador, origen, { lector = true, rechazarChip = false, alPedirChip } = {}) {
  const pagina = await navegador.newPage({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  t.after(() => pagina.close());
  pagina.setDefaultTimeout(8000);
  await pagina.addInitScript(instalarLector, lector);
  const fichasConsultadas = [];
  const chipsConsultados = [];
  const lecturasConsultadas = [];
  const inesperadas = [];
  const tarjetas = [codigo, ajena, segunda].map((codigoPublico) => ({
    codigoPublico, creadaEn: '2026-11-20T12:00:00Z', titular: null, puedeVerChip: codigoPublico !== ajena,
  }));
  await pagina.route('**/*', async (ruta) => {
    const url = new URL(ruta.request().url());
    if (!url.pathname.startsWith('/api/')) return url.origin === origen ? ruta.continue() : ruta.abort();
    const responder = (data) => ruta.fulfill({ json: { data } });
    const error = (message, status) => ruta.fulfill({ status, json: { error: { message } } });
    if (url.hostname === 'api.butaca.test' && url.pathname === rutaNfc + '/lecturas/consultar' && ruta.request().method() === 'POST') {
      const datos = ruta.request().postDataJSON();
      lecturasConsultadas.push(datos);
      const publico = datos?.codigoInterno === secreto ? codigo : datos?.codigoInterno === secretoSegundo ? segunda : null;
      return publico ? responder({ codigoPublico: publico, titular: null, saldoBs: null }) : error('tarjeta_no_encontrada', 404);
    }
    if (url.hostname !== 'api.butaca.test' || ruta.request().method() !== 'GET') {
      inesperadas.push(ruta.request().method() + ' ' + url.pathname);
      return error('ruta_no_prevista', 404);
    }
    if (!url.pathname.startsWith(rutaNfc)) return responder([]);
    if (url.pathname === rutaNfc) return responder({ tarjetas, total: tarjetas.length, pagina: 1, porPagina: 25 });
    if (url.pathname === rutaNfc + '/lotes/recientes') return responder([]);
    const [publico, recurso] = url.pathname.slice(rutaNfc.length + 1).split('/');
    const tarjeta = tarjetas.find((item) => item.codigoPublico === publico);
    if (tarjeta && !recurso) {
      fichasConsultadas.push(publico);
      return responder({ ...tarjeta, saldoBs: null });
    }
    if (tarjeta && recurso === 'chip') {
      chipsConsultados.push(publico);
      await alPedirChip?.(pagina, publico);
      const codigoInterno = publico === codigo ? secreto : secretoSegundo;
      return tarjeta.puedeVerChip && !rechazarChip ? responder({ codigoInterno }) : error('chip_no_autorizado', 403);
    }
    inesperadas.push('GET ' + url.pathname);
    return error('ruta_no_prevista', 404);
  });
  t.after(() => assert.deepEqual(inesperadas, []));
  await pagina.goto(origen + '/admin/tarjetas-nfc');
  return { pagina, fichasConsultadas, chipsConsultados, lecturasConsultadas };
}

const boton = (pagina, name) => pagina.getByRole('button', { name, exact: true });
const grabar = (p) => boton(p, 'Grabar tarjeta por NFC');
const grabarFila = (p, publico) => boton(p, 'Grabar NFC en ' + publico);
const dialogo = (p, publico) => p.getByRole('dialog', { name: 'Grabación NFC de ' + publico, exact: true });
const esperando = (panel) => panel.getByRole('heading', { name: /^Esperando la tarjeta\b/ });
const comprobando = (panel) => panel.getByRole('heading', { name: /^Vuelve a acercar la tarjeta\b/ });
const confirmado = (panel) => panel.getByRole('heading', { name: /^Tarjeta grabada y verificada\.?$/ });
const verificar = (p) => boton(p, 'Verificar tarjeta');

async function animacionesContinuas(panel) {
  return panel.evaluate((elemento) => elemento.getAnimations({ subtree: true }).filter((animacion) =>
    animacion.playState === 'running' && animacion.effect?.getTiming().iterations === Infinity).length);
}

async function sinEsperaDeTarjeta(panel) {
  assert.equal(await esperando(panel).count(), 0);
  assert.equal(await comprobando(panel).count(), 0);
  assert.equal(await animacionesContinuas(panel), 0);
}

async function preparar(p) {
  await boton(p, 'Ver ficha de ' + codigo).click();
  await boton(p, 'Preparar grabación').click();
}

async function iniciarEscritura(p) {
  await preparar(p);
  await grabar(p).click();
  await p.waitForFunction(() => window.nfcPrueba.escrituras.length === 1);
}

async function leer(p, texto, numeroLectura = 1) {
  await p.waitForFunction((numero) => window.nfcPrueba.lecturas.length >= numero, numeroLectura);
  await p.evaluate(({ numero, valor }) => window.nfcPrueba.lecturas[numero - 1].recibir(valor), { numero: numeroLectura, valor: texto });
}

test('grabar tarjetas NFC desde la ficha y el inventario', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'butaca-prueba-grabacion-'));
  const servidor = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), cacheDir,
    server: { host: '127.0.0.1', port: 0, hmr: false },
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify('http://api.butaca.test') },
    logLevel: 'error',
  });
  t.after(async () => { await servidor.close(); await rm(cacheDir, { force: true, recursive: true }); });
  await servidor.listen();
  const origen = 'http://127.0.0.1:' + servidor.httpServer.address().port;
  const navegador = await chromium.launch();
  t.after(() => navegador.close());

  await t.test('en móvil la hoja indica cuándo acercar y verificar la tarjeta elegida', async (t) => {
    const { pagina, fichasConsultadas, chipsConsultados } = await abrirInventario(t, navegador, origen);
    const accion = grabarFila(pagina, segunda);
    await accion.waitFor();
    assert.equal((await accion.innerText()).trim(), 'Grabar NFC');
    const caja = await accion.boundingBox();
    assert(caja && caja.x >= 0 && caja.x + caja.width <= 390);
    assert.equal(await grabarFila(pagina, ajena).count(), 0);
    assert.deepEqual(chipsConsultados, []);

    await accion.click();
    const panel = dialogo(pagina, segunda);
    await esperando(panel).waitFor();
    assert(await panel.evaluate((elemento) => elemento.matches('dialog:modal') && elemento.contains(document.activeElement)));
    await pagina.waitForFunction(() => {
      const caja = document.querySelector('dialog:modal').getBoundingClientRect();
      return caja.top > 0 && Math.abs(caja.bottom - window.innerHeight) <= 24 && caja.width >= window.innerWidth * .9;
    });
    assert(await animacionesContinuas(panel) > 0, 'la espera activa del chip tiene un indicador en movimiento');
    await pagina.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await animacionesContinuas(panel), 0, 'la instrucción sigue visible con movimiento reducido');
    assert(await esperando(panel).isVisible());
    await pagina.emulateMedia({ reducedMotion: 'no-preference' });
    await pagina.waitForFunction(() => window.nfcPrueba.escrituras.length > 0);
    const escrituras = await pagina.evaluate(() => window.nfcPrueba.escrituras.map(({ mensaje, overwrite }) => ({ mensaje, overwrite })));
    assert.equal(escrituras.length, 1);
    assert.equal(escrituras[0].overwrite, false);
    assert.deepEqual(escrituras[0].mensaje.records.map(({ recordType, data }) => ({ recordType, data })), [{ recordType: 'text', data: secretoSegundo }]);
    await pagina.evaluate(() => window.nfcPrueba.escrituras[0].completar());
    await comprobando(panel).waitFor();
    assert(await animacionesContinuas(panel) > 0, 'el lector indica la segunda espera al verificar el chip');
    assert.equal(await esperando(panel).count(), 0);
    assert.equal(await confirmado(panel).count(), 0);
    await leer(pagina, secretoSegundo);
    await confirmado(panel).waitFor();
    await sinEsperaDeTarjeta(panel);
    assert.equal(await pagina.getByText(secreto, { exact: true }).count(), 0);
    assert.equal(await pagina.getByText(secretoSegundo, { exact: true }).count(), 0);
    await boton(panel, 'Listo').click();
    await pagina.getByRole('heading', { name: 'Todas las tarjetas' }).waitFor();
    assert.deepEqual(chipsConsultados, [segunda]);
    assert.deepEqual(fichasConsultadas, []);
  });

  await t.test('Escape y cerrar el diálogo en escritorio cancelan y devuelven el foco a la fila', async (t) => {
    const { pagina, chipsConsultados, fichasConsultadas } = await abrirInventario(t, navegador, origen);
    await pagina.setViewportSize({ width: 1440, height: 900 });
    await grabarFila(pagina, codigo).click();
    const primero = dialogo(pagina, codigo);
    await esperando(primero).waitFor();
    assert(await primero.evaluate((elemento) => elemento.matches('dialog:modal') && elemento.contains(document.activeElement)));
    await pagina.waitForFunction(() => {
      const caja = document.querySelector('dialog:modal').getBoundingClientRect();
      return Math.abs(caja.x + caja.width / 2 - window.innerWidth / 2) <= 24 &&
        Math.abs(caja.y + caja.height / 2 - window.innerHeight / 2) <= 24;
    });
    await pagina.waitForFunction(() => window.nfcPrueba.escrituras.length === 1);
    await pagina.keyboard.press('Escape');
    await primero.waitFor({ state: 'hidden' });
    await grabarFila(pagina, codigo).and(pagina.locator(':focus')).waitFor();
    assert(await pagina.evaluate(() => window.nfcPrueba.escrituras[0].signal.aborted));
    await grabarFila(pagina, segunda).click();
    const siguiente = dialogo(pagina, segunda);
    await esperando(siguiente).waitFor();
    await pagina.waitForFunction(() => window.nfcPrueba.escrituras.length === 2);
    const registros = await pagina.evaluate(() => window.nfcPrueba.escrituras.map(({ mensaje, signal }) => ({ texto: mensaje.records[0].data, cancelada: signal.aborted })));
    assert.deepEqual(registros, [{ texto: secreto, cancelada: true }, { texto: secretoSegundo, cancelada: false }]);
    await pagina.evaluate(() => { window.nfcPrueba.escrituras[0].completar(); window.nfcPrueba.escrituras[1].completar(); });
    await pagina.waitForFunction(() => window.nfcPrueba.lecturas.length > 0);
    await comprobando(siguiente).waitFor();
    await boton(siguiente, 'Cerrar grabación').click();
    await siguiente.waitFor({ state: 'hidden' });
    await grabarFila(pagina, segunda).and(pagina.locator(':focus')).waitFor();
    assert.deepEqual(await pagina.evaluate(() => window.nfcPrueba.lecturas.map(({ signal }) => signal.aborted)), [true]);
    await leer(pagina, secretoSegundo);
    assert.equal(await pagina.getByText(exito, { exact: true }).count(), 0);
    assert.deepEqual(chipsConsultados, [codigo, segunda]);
    assert.deepEqual(fichasConsultadas, []);
  });

  await t.test('una respuesta de otra fila que llega tarde no cambia el código que se graba', async (t) => {
    const demora = Promise.withResolvers();
    t.after(() => demora.resolve());
    const { pagina } = await abrirInventario(t, navegador, origen, {
      alPedirChip: (_p, publico) => publico === codigo ? demora.promise : undefined,
    });
    const esPrimera = (peticion) => new URL(peticion.url()).pathname === rutaNfc + '/' + codigo + '/chip';
    const pedida = pagina.waitForRequest(esPrimera);
    const terminada = Promise.race([pagina.waitForEvent('requestfailed', esPrimera), pagina.waitForEvent('requestfinished', esPrimera)]);
    await grabarFila(pagina, codigo).click();
    await pedida;
    const anterior = dialogo(pagina, codigo);
    await anterior.waitFor();
    assert.equal(await esperando(anterior).count(), 0, 'el lector todavía no tiene el código que debe grabar');
    await boton(anterior, 'Cerrar grabación').click();
    await anterior.waitFor({ state: 'hidden' });
    await grabarFila(pagina, segunda).click();
    const vigente = dialogo(pagina, segunda);
    await esperando(vigente).waitFor();
    await pagina.waitForFunction(() => window.nfcPrueba.escrituras.length === 1);
    demora.resolve();
    await terminada;
    await pagina.evaluate(() => window.nfcPrueba.escrituras[0].completar());
    await leer(pagina, secretoSegundo);
    await confirmado(vigente).waitFor();
    assert.deepEqual(await pagina.evaluate(() => window.nfcPrueba.escrituras.map((e) => e.mensaje.records[0].data)), [secretoSegundo]);
    assert.equal(await pagina.getByText(secreto, { exact: true }).count(), 0);
  });

  await t.test('si expira la activación tras obtener el código, espera otro toque para escribir', async (t) => {
    const { pagina, fichasConsultadas, chipsConsultados } = await abrirInventario(t, navegador, origen, {
      alPedirChip: (p) => p.evaluate(() => {
        Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: false, hasBeenActive: true } });
      }),
    });
    await grabarFila(pagina, segunda).click();
    const panel = dialogo(pagina, segunda);
    await grabar(panel).waitFor();
    await sinEsperaDeTarjeta(panel);
    assert.equal(await pagina.evaluate(() => window.nfcPrueba.escrituras.length), 0);
    await pagina.evaluate(() => { delete navigator.userActivation; });
    await grabar(panel).click();
    await esperando(panel).waitFor();
    await pagina.waitForFunction(() => window.nfcPrueba.escrituras.length === 1);
    assert.equal(await pagina.evaluate(() => window.nfcPrueba.escrituras[0].mensaje.records[0].data), secretoSegundo);
    assert.deepEqual(chipsConsultados, [segunda]);
    assert.deepEqual(fichasConsultadas, []);
  });

  await t.test('sin Web NFC la fila ofrece el grabador externo y difiere la consulta del secreto', async (t) => {
    const { pagina, fichasConsultadas, chipsConsultados } = await abrirInventario(t, navegador, origen, { lector: false });
    await pagina.setViewportSize({ width: 1440, height: 900 });
    await grabarFila(pagina, segunda).click();
    const panel = dialogo(pagina, segunda);
    const alternativa = boton(panel, 'Ver código para grabador externo');
    await alternativa.waitFor();
    await sinEsperaDeTarjeta(panel);
    assert.deepEqual(chipsConsultados, []);
    assert.equal(await pagina.getByText(secretoSegundo, { exact: true }).count(), 0);
    await alternativa.click();
    await panel.getByText(secretoSegundo, { exact: true }).waitFor();
    await sinEsperaDeTarjeta(panel);
    assert.equal(await pagina.getByText(secreto, { exact: true }).count(), 0);
    assert.equal(await pagina.evaluate(() => window.nfcPrueba.escrituras.length), 0);
    assert.deepEqual(chipsConsultados, [segunda]);
    assert.deepEqual(fichasConsultadas, []);
  });

  await t.test('escribe un único registro de texto sin sobrescribir y verifica el contenido leído', async (t) => {
    const { pagina, chipsConsultados, lecturasConsultadas } = await abrirInventario(t, navegador, origen);
    await iniciarEscritura(pagina);
    const escritura = await pagina.evaluate(() => {
      const { mensaje, overwrite, signal } = window.nfcPrueba.escrituras[0];
      return { mensaje, overwrite, activa: signal instanceof AbortSignal && !signal.aborted };
    });
    assert.equal(escritura.activa, true);
    assert.equal(escritura.overwrite, false);
    assert.equal(escritura.mensaje.records.length, 1);
    const [registro] = escritura.mensaje.records;
    assert.equal(registro.recordType, 'text');
    assert.equal(registro.data, secreto, 'el chip lleva el código interno con sus mayúsculas y símbolos exactos');
    assert.equal(registro.encoding?.toLowerCase() ?? 'utf-8', 'utf-8');
    assert.equal(await pagina.evaluate(() => window.nfcPrueba.lecturas.length), 0);
    await pagina.evaluate(() => window.nfcPrueba.escrituras[0].completar());
    await boton(pagina, 'Cancelar verificación').waitFor();
    assert.equal(await pagina.getByText(exito, { exact: true }).count(), 0);
    await leer(pagina, registro.data);
    await pagina.getByText(exito, { exact: true }).waitFor();
    assert.deepEqual([...new Set(chipsConsultados)], [codigo]);

    await boton(pagina, 'Volver al inventario').click();
    await boton(pagina, 'Consultar por NFC').click();
    await boton(pagina, 'Leer tarjeta por NFC').click();
    await leer(pagina, registro.data, 2);
    await pagina.getByRole('heading', { name: codigo, exact: true }).waitFor();
    assert.deepEqual(lecturasConsultadas, [{ codigoInterno: secreto }], 'la consulta normal reconoce lo escrito en el chip');
  });

  await t.test('reintenta la lectura tras denegación o un chip distinto sin repetir la escritura', async (t) => {
    const { pagina } = await abrirInventario(t, navegador, origen);
    await iniciarEscritura(pagina);
    await pagina.evaluate(() => { window.nfcPrueba.denegarLectura = true; window.nfcPrueba.escrituras[0].completar(); });
    await verificar(pagina).click();
    await leer(pagina, secreto.toLowerCase());
    await pagina.getByText(/contenido leído no coincide/i).waitFor();
    assert.equal(await pagina.getByText(exito, { exact: true }).count(), 0);
    await verificar(pagina).click();
    await leer(pagina, secreto, 2);
    await pagina.getByText(exito, { exact: true }).waitFor();
    assert.equal(await pagina.evaluate(() => window.nfcPrueba.escrituras.length), 1);
  });

  await t.test('permite cancelar escritura y verificación e ignora respuestas tardías', async (t) => {
    const { pagina } = await abrirInventario(t, navegador, origen);
    await iniciarEscritura(pagina);
    await boton(pagina, 'Cancelar grabación').click();
    assert(await pagina.evaluate(() => window.nfcPrueba.escrituras[0].signal.aborted));
    await pagina.evaluate(() => window.nfcPrueba.escrituras[0].completar());
    await grabar(pagina).click();
    await pagina.waitForFunction(() => window.nfcPrueba.escrituras.length === 2);
    assert.equal(await pagina.evaluate(() => window.nfcPrueba.lecturas.length), 0);
    await pagina.evaluate(() => window.nfcPrueba.escrituras[1].completar());
    await pagina.waitForFunction(() => window.nfcPrueba.lecturas.length === 1);
    await boton(pagina, 'Cancelar verificación').click();
    assert(await pagina.evaluate(() => window.nfcPrueba.lecturas[0].signal.aborted));
    await leer(pagina, secreto);
    await verificar(pagina).waitFor();
    assert.equal(await pagina.getByText(exito, { exact: true }).count(), 0);
  });

  await t.test('una escritura denegada permite verificar sin acreditar una grabación', async (t) => {
    const { pagina } = await abrirInventario(t, navegador, origen);
    await iniciarEscritura(pagina);
    await pagina.evaluate(() => window.nfcPrueba.escrituras[0].fallar('NotAllowedError'));
    await pagina.getByText(/permiso NFC.*tarjeta en blanco/i).waitFor();
    assert(await grabar(pagina).isEnabled());
    assert.equal(await pagina.evaluate(() => window.nfcPrueba.lecturas.length), 0);
    await verificar(pagina).click();
    await leer(pagina, secreto);
    await pagina.getByText('Tarjeta verificada.', { exact: true }).waitFor();
    assert.equal(await pagina.evaluate(() => window.nfcPrueba.escrituras.length), 1);
    assert.equal(await pagina.getByText(exito, { exact: true }).count(), 0);
  });

  await t.test('sin lector ofrece el código al solicitarlo para un grabador externo', async (t) => {
    const { pagina } = await abrirInventario(t, navegador, origen, { lector: false });
    await preparar(pagina);
    const alternativa = pagina.getByText('Ver código para grabador externo', { exact: true });
    await alternativa.waitFor();
    assert(!(await grabar(pagina).isVisible() && await grabar(pagina).isEnabled()));
    assert.equal(await pagina.getByText(secreto, { exact: true }).isVisible(), false);
    await alternativa.click();
    await pagina.getByText(secreto, { exact: true }).waitFor();
    assert.equal(await pagina.evaluate(() => window.nfcPrueba.escrituras.length), 0);
  });

  await t.test('una tarjeta ajena o un permiso revocado no permiten iniciar una escritura', async (t) => {
    const { pagina, chipsConsultados } = await abrirInventario(t, navegador, origen, { rechazarChip: true });
    await boton(pagina, 'Ver ficha de ' + ajena).click();
    await pagina.getByRole('heading', { name: 'Vincular a un pasajero', exact: true }).waitFor();
    assert.equal(await boton(pagina, 'Preparar grabación').count(), 0);
    assert.deepEqual(chipsConsultados, []);
    await boton(pagina, 'Volver al inventario').click();
    await preparar(pagina);
    await pagina.getByRole('alert').waitFor();
    assert.equal(await grabar(pagina).count(), 0);
    assert.equal(await pagina.getByText(secreto, { exact: true }).count(), 0);
    assert.equal(await pagina.evaluate(() => window.nfcPrueba.escrituras.length), 0);
    assert.deepEqual([...new Set(chipsConsultados)], [codigo]);
  });
});
