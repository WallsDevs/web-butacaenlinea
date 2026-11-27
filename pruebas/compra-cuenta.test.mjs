import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const api = 'http://api.butaca.test';
const reloj = '2030-04-02T10:00:00-04:00';
const horaSalida = '2030-04-02T16:00:00-04:00';
const jwt = 'prueba.' + Buffer.from('{"exp":4102444800}').toString('base64url') + '.prueba';
const pasajero = { id: 81, documentId: 'cliente-prueba', username: 'viajera', nombreCorto: 'Ana Prueba', role: { type: 'cliente' } };
const empresas = { nacional: 'Línea Nacional de Prueba', extraurbano: 'Línea Regional de Prueba', tours: 'Excursiones de Prueba' };
const piso = { numero: 1, nombre: 'Ejecutivo', claseServicio: 'ejecutivo', layout: { izquierda: 1, derecha: 1 }, filas: ['A'], asientoInicial: 1 };
const tasas = { bcv: 100, cop: 4000, vigenteDesde: reloj, serverTime: reloj };

// Los tres servicios comparten origen y destino. Solo el tipo de viaje permite separarlos.
const salidas = Object.entries(empresas).map(([tipoViaje, nombre], i) => ({
  documentId: 'salida-' + tipoViaje, fechaHoraSalida: horaSalida, fechaHoraLlegada: '2030-04-02T19:00:00-04:00',
  rampa: 'Rampa 2', estado: 'programada', preciosUsd: { ejecutivo: 10 },
  ruta: { id: i + 1, documentId: 'ruta-' + tipoViaje, codigo: 'R-' + i, nombre: 'Ruta ' + tipoViaje, tipoViaje,
    origen: 'San Cristóbal', destino: 'Mérida', duracionMin: 180, distanciaKm: 200 },
  linea: { documentId: 'linea-' + tipoViaje, slug: tipoViaje, nombre },
  unidad: { documentId: 'unidad-' + tipoViaje, numero: 'U-' + i, marcaModelo: 'Autobús', configuracionAsientos: { pisos: [piso] } },
}));
const tour = salidas.find(s => s.ruta.tipoViaje === 'tours');
const tourPosterior = { ...tour, documentId: 'excursion-del-ocho', fechaHoraSalida: '2030-04-08T16:00:00-04:00',
  fechaHoraLlegada: '2030-04-08T19:00:00-04:00', linea: { ...tour.linea, nombre: 'Excursiones de la Sierra' } };
const otroDestino = { ...tour, documentId: 'excursion-a-valencia', fechaHoraSalida: '2030-04-04T16:00:00-04:00',
  fechaHoraLlegada: '2030-04-04T19:00:00-04:00', ruta: { ...tour.ruta, documentId: 'otra-ruta', destino: 'Valencia' } };
const nacionalPosterior = { ...salidas[0], documentId: 'nacional-del-diez', fechaHoraSalida: '2030-04-10T16:00:00-04:00',
  fechaHoraLlegada: '2030-04-10T19:00:00-04:00' };
const calendario = [...salidas, otroDestino, tourPosterior, nacionalPosterior];
const rutaUrbana = { documentId: 'circuito-prueba', nombre: 'Circuito del Mercado', linea: 'Busetas de Prueba',
  origen: 'Centro', destino: 'Mercado', paradas: 4, busetasEnCamino: 1, tarifaBs: 12, porTramos: false };

async function abrirCuenta(t, navegador, origen, ancho) {
  const pagina = await navegador.newPage({ viewport: { width: ancho, height: 850 }, timezoneId: 'America/Caracas', serviceWorkers: 'block' });
  t.after(() => pagina.close());
  pagina.setDefaultTimeout(8000);
  await pagina.clock.setFixedTime(new Date(reloj));
  await pagina.addInitScript(({ jwt, pasajero }) => {
    localStorage.setItem('bel-auth', JSON.stringify({ state: { jwt, usuario: pasajero }, version: 0 }));
    sessionStorage.setItem('bel-aviso-instalar-cerrado', '1');
  }, { jwt, pasajero });

  const consultas = [], reservas = [], emisiones = [], inesperadas = [];
  let boleto;
  await pagina.route('**/*', async (interceptada) => {
    const peticion = interceptada.request();
    const url = new URL(peticion.url());
    if (!url.pathname.startsWith('/api/')) return url.origin === origen ? interceptada.continue() : interceptada.abort();
    const ruta = url.pathname;
    const metodo = peticion.method();
    const respuesta = (data) => interceptada.fulfill({ json: { data } });
    const parametros = url.searchParams;
    if (url.origin === api && metodo === 'GET') {
      if (ruta === '/api/tasas/vigentes') return respuesta(tasas);
      if (ruta === '/api/wallet') return respuesta({ saldoBs: 2000, movimientos: [] });
      if (ruta === '/api/mis-boletos') return respuesta(boleto ? [boleto] : []);
      if (ruta === '/api/ajustes/datos-pago') return respuesta({});
      if (ruta === '/api/urbano/rutas') return respuesta([rutaUrbana]);
      if (ruta === '/api/rutas' || ruta === '/api/salidas') {
        const esSalida = ruta === '/api/salidas';
        const tipo = parametros.get(esSalida ? 'filters[ruta][tipoViaje][$eq]' : 'filters[tipoViaje][$eq]');
        consultas.push({ ruta, tipo });
        const porTipo = calendario.filter(s => !tipo || s.ruta.tipoViaje === tipo);
        if (!esSalida) return respuesta([...new Map(porTipo.map(s => [s.ruta.documentId, s.ruta])).values()]);
        const desde = parametros.get('filters[fechaHoraSalida][$gte]');
        const hasta = parametros.get('filters[fechaHoraSalida][$lte]');
        const origen = parametros.get('filters[ruta][origen][$eq]');
        const destino = parametros.get('filters[ruta][destino][$eq]');
        const filtradas = porTipo.filter(s => (!origen || s.ruta.origen === origen) && (!destino || s.ruta.destino === destino) &&
          (!desde || Date.parse(s.fechaHoraSalida) >= Date.parse(desde)) && (!hasta || Date.parse(s.fechaHoraSalida) <= Date.parse(hasta)));
        return respuesta(filtradas.slice(0, Number(parametros.get('pagination[pageSize]') ?? 50)));
      }
      if (ruta === '/api/salidas/ocupacion') return respuesta(Object.fromEntries((parametros.get('ids') ?? '').split(',').map(id => [id, 1])));
      const salida = calendario.find(s => ruta === '/api/salidas/' + s.documentId + '/mapa-asientos');
      if (salida) return respuesta({
        salida, pisos: [{ ...piso, totalAsientos: 2, filas: [{ fila: 'A',
          izquierda: [{ id: '01', estado: 'ocupado' }], derecha: [{ id: '02', estado: 'libre' }] }] }],
        preciosUsd: salida.preciosUsd, recargosUsd: { tasaTerminal: 0, seguro: 0 },
        resumen: { total: 2, libres: 1, ocupados: 1, reservados: 0 }, tasas, serverTime: reloj,
      });
      if (boleto && ruta === '/api/boletos/codigo/' + boleto.qrId && peticion.headers().authorization === 'Bearer ' + jwt) return respuesta(boleto);
    }
    if (url.origin === api && metodo === 'POST' && peticion.headers().authorization === 'Bearer ' + jwt) {
      if (ruta === '/api/reservas') {
        reservas.push(peticion.postDataJSON());
        return respuesta({ ok: true, token: 'reserva-prueba', expiraEn: '2030-04-02T10:10:00-04:00', ttlSegundos: 600, serverTime: reloj });
      }
      if (ruta === '/api/boletos/emitir') {
        const cuerpo = peticion.postDataJSON();
        emisiones.push(cuerpo);
        const salida = calendario.find(s => s.documentId === reservas.at(-1)?.salidaId);
        const [viajero] = cuerpo.pasajeros;
        boleto = { documentId: 'boleto-prueba', folio: 'QA-00021', qrId: 'qr-prueba', qr: 'qr-firmado-de-prueba',
          estado: 'emitido', estadoPago: 'verificado', asientoId: viajero.asientoId, piso: 1, claseServicio: 'ejecutivo',
          pasajeroNombre: viajero.nombre, pasajeroDocumento: viajero.documento, equipajePiezas: 1, totalUsd: 10,
          monedaPago: 'BS', montoCobrado: 1000, linea: salida.linea, salida };
        return respuesta({ ok: true, boletos: [boleto], resumen: { cantidad: 1, totalUsd: 10 } });
      }
    }
    inesperadas.push(metodo + ' ' + ruta);
    return interceptada.fulfill({ status: 404, json: { error: { message: 'ruta_no_simulada' } } });
  });
  t.after(() => assert.deepEqual(inesperadas, [], 'todas las peticiones API deben pertenecer a este escenario'));
  await pagina.goto(origen + '/cuenta');
  return { pagina, consultas, reservas, emisiones };
}

const modalidades = p => p.getByRole('group', { name: 'Tipo de viaje' });
const modalidad = (p, nombre) => modalidades(p).getByRole('button', { name: nombre, exact: true });
const resultado = (p, empresa) => p.getByRole('button', { name: new RegExp(empresa) });

test('comprar desde la cuenta del pasajero', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'butaca-compra-cuenta-'));
  const servidor = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), cacheDir, server: { host: '127.0.0.1', port: 0, hmr: false },
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify(api) }, logLevel: 'error',
  });
  t.after(async () => { await servidor.close(); await rm(cacheDir, { recursive: true, force: true }); });
  await servidor.listen();
  const origen = 'http://127.0.0.1:' + servidor.httpServer.address().port;
  const navegador = await chromium.launch();
  t.after(() => navegador.close());

  await t.test('en móvil separa las salidas por modalidad y lleva al escáner de la buseta', async t => {
    const { pagina, consultas, reservas, emisiones } = await abrirCuenta(t, navegador, origen, 390);
    await modalidades(pagina).waitFor();
    for (const nombre of ['Urbano', 'Extraurbano', 'Nacional', 'Tours']) {
      const boton = modalidad(pagina, nombre);
      const caja = await boton.boundingBox();
      assert(caja && caja.width > 0 && caja.x >= 0 && caja.x + caja.width <= 390, nombre + ' debe verse en el teléfono');
    }
    assert.equal(await modalidad(pagina, 'Nacional').getAttribute('aria-pressed'), 'true');
    for (const [nombre, tipo] of [['Nacional', 'nacional'], ['Extraurbano', 'extraurbano'], ['Tours', 'tours']]) {
      await modalidad(pagina, nombre).click();
      await resultado(pagina, empresas[tipo]).waitFor();
      assert.equal(await modalidad(pagina, nombre).getAttribute('aria-pressed'), 'true');
      for (const [otro, empresa] of Object.entries(empresas)) {
        if (otro !== tipo) assert.equal(await resultado(pagina, empresa).count(), 0);
      }
      for (const ruta of ['/api/rutas', '/api/salidas']) {
        assert(consultas.some(c => c.ruta === ruta && c.tipo === tipo), 'el catálogo debe filtrar ' + ruta + ' por ' + tipo);
      }
    }
    const fecha = pagina.getByLabel('Otra fecha', { exact: true });
    const sinSalidas = pagina.getByRole('heading', { name: 'No hay salidas para esta búsqueda' });
    const verPosterior = pagina.getByRole('button', { name: /^Ver salidas del / });
    await pagina.getByRole('combobox', { name: 'Desde', exact: true }).selectOption('San Cristóbal');
    await pagina.getByRole('combobox', { name: 'Hasta', exact: true }).selectOption('Mérida');
    await fecha.fill('2030-04-03');
    await sinSalidas.waitFor();
    await verPosterior.click();
    await resultado(pagina, tourPosterior.linea.nombre).waitFor();
    assert.equal(await fecha.inputValue(), '2030-04-08');
    assert.equal(await modalidad(pagina, 'Tours').getAttribute('aria-pressed'), 'true');
    const [proxima] = await Promise.all([
      pagina.waitForResponse(res => {
        const url = new URL(res.url());
        return url.pathname === '/api/salidas' && url.searchParams.get('filters[fechaHoraSalida][$gte]')?.startsWith('2030-04-10');
      }),
      fecha.fill('2030-04-09'),
    ]);
    assert.deepEqual((await proxima.json()).data, [], 'la salida nacional del 10 no corresponde al filtro de Tours');
    await sinSalidas.waitFor();
    assert.equal(await verPosterior.count(), 0);
    assert.equal(await resultado(pagina, empresas.tours).count(), 0);
    await modalidad(pagina, 'Urbano').click();
    await pagina.getByRole('heading', { name: rutaUrbana.nombre }).waitFor();
    assert.equal(await pagina.getByRole('button', { name: /Ver puestos/i }).count(), 0);
    const escanear = pagina.getByRole('link', { name: 'Escanear QR para pagar', exact: true });
    assert.equal(await escanear.getAttribute('href'), '/pagar');
    await escanear.click();
    await pagina.waitForURL(origen + '/pagar');
    await pagina.getByRole('heading', { name: 'Pagar pasaje' }).waitFor();
    await pagina.goBack();
    await modalidades(pagina).waitFor();
    assert.equal(await modalidad(pagina, 'Urbano').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(reservas, []);
    assert.deepEqual(emisiones, []);
  });

  for (const [etiqueta, tipo] of [['Nacional', 'nacional'], ['Tours', 'tours']]) {
    await t.test('en escritorio compra ' + etiqueta + ' y emite su boleto con la wallet de la cuenta', async t => {
      const { pagina, reservas, emisiones } = await abrirCuenta(t, navegador, origen, 1440);
      await modalidad(pagina, etiqueta).click();
      await resultado(pagina, empresas[tipo]).click();
      const puesto = nombre => pagina.getByRole('button', { name: nombre, exact: true });
      assert(await puesto('Puesto 01 (ocupado)').isDisabled());
      await puesto('Puesto 02').click();
      await puesto('Pagar boleto').click();
      await pagina.waitForURL(origen + '/checkout');
      await pagina.getByRole('heading', { name: 'Datos de los pasajeros' }).waitFor();
      await pagina.getByText(etiqueta, { exact: true }).waitFor();
      assert.deepEqual(reservas, [{ salidaId: 'salida-' + tipo, asientos: ['02'] }]);
      const nombre = pagina.getByLabel('Nombre y apellido', { exact: true });
      assert.equal(await nombre.inputValue(), pasajero.nombreCorto);
      const pagar = pagina.getByRole('button', { name: /Pagar .* con mi wallet/ });
      assert(await pagar.isDisabled(), 'el documento es obligatorio');
      await pagina.getByLabel('Cédula o pasaporte', { exact: true }).fill('QA-000001');
      await pagar.click();
      await pagina.waitForURL(origen + '/boleto/qr-prueba');
      await pagina.getByText('Pagado', { exact: true }).waitFor();
      await pagina.getByText(etiqueta, { exact: true }).waitFor();
      await pagina.getByText('QA-00021', { exact: true }).waitFor();
      await pagina.getByText('Presenta este código al abordar', { exact: true }).waitFor();
      assert.equal(emisiones.length, 1);
      assert.deepEqual(emisiones[0].pago, { metodoPago: 'wallet', monedaPago: 'BS' });
      assert.equal(emisiones[0].reservaToken, 'reserva-prueba');
      assert.deepEqual(emisiones[0].pasajeros.map(({ asientoId, nombre, documento }) => ({ asientoId, nombre, documento })),
        [{ asientoId: '02', nombre: pasajero.nombreCorto, documento: 'QA-000001' }]);
    });
  }
});
