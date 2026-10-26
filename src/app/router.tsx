import { lazy as lazyReact, Suspense, type ComponentType } from 'react';

/**
 * Como `lazy`, pero si el archivo de la pantalla ya no existe (se desplegó una
 * versión nueva y esta página es de la anterior), recarga una vez para traer
 * la nueva en vez de mostrar «Algo salió mal».
 */
const CLAVE_RECARGA = 'bel-recarga-version';
function lazy<T extends ComponentType<any>>(cargar: () => Promise<{ default: T }>) {
  return lazyReact(() =>
    cargar().then(
      (m) => {
        sessionStorage.removeItem(CLAVE_RECARGA);
        return m;
      },
      (e: unknown) => {
        const yaRecargo = Number(sessionStorage.getItem(CLAVE_RECARGA) ?? 0) > Date.now() - 30_000;
        if (!yaRecargo) {
          sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()));
          window.location.reload();
          return new Promise<never>(() => {});
        }
        throw e;
      }
    )
  );
}
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { AppChrome } from './AppChrome';
import { AvisoInstalar } from '../components/AvisoInstalar';
import { GuiaActiva } from '../features/guia/GuiaActiva';
import { PantallaCarga } from '../components/ui/PantallaCarga';
import { ErrorPantalla } from '../features/public/NoEncontrada';
import { RequireAuth } from './RequireAuth';

const MarketplaceHome = lazy(() => import('../features/public/MarketplaceHome'));
const Salidas = lazy(() => import('../features/public/Salidas'));
const Asientos = lazy(() => import('../features/public/Asientos'));
const Checkout = lazy(() => import('../features/public/Checkout'));
const Boleto = lazy(() => import('../features/public/Boleto'));
const Acceso = lazy(() => import('../features/public/Acceso'));
const NoEncontrada = lazy(() => import('../features/public/NoEncontrada'));
const Perfil = lazy(() => import('../features/cuenta/Perfil'));
const MisBoletos = lazy(() => import('../features/cuenta/MisBoletos'));
const CuentaViajar = lazy(() => import('../features/cuenta/CuentaViajar'));
const Ayuda = lazy(() => import('../features/public/Ayuda'));
const RecuperarBoletos = lazy(() => import('../features/public/RecuperarBoletos'));
const Pasajes = lazy(() => import('../features/public/Pasajes'));
const PasajesLinea = lazy(() => import('../features/public/PasajesLinea'));
const PreciosHoy = lazy(() => import('../features/public/PreciosHoy'));
const PasajesTemporada = lazy(() => import('../features/public/PasajesTemporada'));
const PaginaTerminal = lazy(() => import('../features/public/PaginaTerminal'));
const MetodosPago = lazy(() => import('../features/cuenta/MetodosPago'));
const MiWallet = lazy(() => import('../features/cuenta/MiWallet'));
const Pos = lazy(() => import('../features/pos/Pos'));
const CierreTurno = lazy(() => import('../features/pos/CierreTurno'));
const VerificacionPagos = lazy(() => import('../features/pos/VerificacionPagos'));
const MisVentas = lazy(() => import('../features/pos/MisVentas'));
const ReportesTurnos = lazy(() => import('../features/pos/ReportesTurnos'));
const TasasPos = lazy(() => import('../features/pos/TasasPos'));
const EmpresaLayout = lazy(() => import('../features/empresa/EmpresaLayout'));
const EmpresaDashboard = lazy(() => import('../features/empresa/EmpresaDashboard'));
const EmpresaProgramacion = lazy(() => import('../features/empresa/EmpresaProgramacion'));
const EmpresaPersonal = lazy(() => import('../features/empresa/EmpresaPersonal'));
const EmpresaBoletos = lazy(() => import('../features/empresa/EmpresaBoletos'));
const EmpresaReportes = lazy(() => import('../features/empresa/EmpresaReportes'));
const EmpresaWallet = lazy(() => import('../features/empresa/EmpresaWallet'));
const EmpresaConfiguracion = lazy(() => import('../features/empresa/EmpresaConfiguracion'));
const SoloApp = lazy(() => import('../features/chofer/SoloApp'));
const AccesoPlataforma = lazy(() => import('../features/admin/AccesoPlataforma'));
const AdminDashboard = lazy(() => import('../features/admin/AdminDashboard'));
const AdminEmpresas = lazy(() => import('../features/admin/AdminEmpresas'));
const AdminLiquidaciones = lazy(() => import('../features/admin/AdminLiquidaciones'));
const AdminTasas = lazy(() => import('../features/admin/AdminTasas'));
const AdminAuditoria = lazy(() => import('../features/admin/AdminAuditoria'));
const AdminSeguridad = lazy(() => import('../features/admin/AdminSeguridad'));
const AdminWallet = lazy(() => import('../features/admin/AdminWallet'));
const AdminPagos = lazy(() => import('../features/admin/AdminPagos'));
const EmpresaFlota = lazy(() => import('../features/empresa/EmpresaFlota'));
const AdminPasajeros = lazy(() => import('../features/admin/AdminPasajeros'));
const AdminDemanda = lazy(() => import('../features/admin/AdminDemanda'));
const AdminCiudades = lazy(() => import('../features/admin/AdminCiudades'));
const AdminIntegraciones = lazy(() => import('../features/admin/AdminIntegraciones'));
const AdminConectores = lazy(() => import('../features/admin/AdminConectores'));
const AdminContratos = lazy(() => import('../features/admin/AdminContratos'));
const AdminFacturas = lazy(() => import('../features/admin/AdminFacturas'));
const EmpresaFacturas = lazy(() => import('../features/empresa/EmpresaFacturas'));
const FichaUnidad = lazy(() => import('../features/flota/FichaUnidad'));
const PagoUrbano = lazy(() => import('../features/urbano/PagoUrbano'));
const EscanerPago = lazy(() => import('../features/urbano/EscanerPago'));
const MapaRuta = lazy(() => import('../features/urbano/MapaRuta'));
const Busetas = lazy(() => import('../features/urbano/Busetas'));
const PagoTaquilla = lazy(() => import('../features/caja/PagoTaquilla'));
const PagoEquipaje = lazy(() => import('../features/equipaje/PagoEquipaje'));
const Colector = lazy(() => import('../features/urbano/Colector'));

function AppLayout() {
  return (
    <>
      <AppChrome />
      {/* Arriba, debajo de la cabecera: en el flujo de la página, no flota ni tapa nada */}
      <AvisoInstalar />
      <Suspense fallback={<PantallaCarga />}>
        <Outlet />
      </Suspense>
      {/* La guía paso a paso, encima de la web real */}
      <GuiaActiva />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <ErrorPantalla />,
    children: [
      { path: '/', element: <MarketplaceHome /> },
      // Compra global (marketplace: todas las empresas)
      { path: '/salidas', element: <Salidas /> },
      { path: '/salidas/:id/asientos', element: <Asientos /> },
      { path: '/checkout', element: <Checkout /> },
      { path: '/boleto/:codigo', element: <Boleto /> },
      { path: '/recuperar-boletos', element: <RecuperarBoletos /> },
      { path: '/ingresar', element: <Acceso modo="login" /> },
      { path: '/plataforma', element: <AccesoPlataforma /> },
      { path: '/registro', element: <Acceso modo="registro" /> },
      // Pasaje urbano: escáner del pasajero + la página del QR pegado en la buseta
      { path: '/pagar', element: <EscanerPago /> },
      { path: '/pagar/:unidadId', element: <PagoUrbano /> },
      { path: '/mapa/:rutaId', element: <MapaRuta /> },
      // El que ESPERA en la parada: llega sin escanear ningún QR
      { path: '/busetas', element: <Busetas /> },
      { path: '/ayuda', element: <Ayuda /> },
      // Páginas de pasajes para buscadores: todas, por ciudad y por ruta
      { path: '/pasajes', element: <Pasajes /> },
      { path: '/pasajes/precios', element: <PreciosHoy /> },
      { path: '/lineas/:slug', element: <PasajesLinea /> },
      { path: '/temporada/:slug', element: <PasajesTemporada /> },
      { path: '/terminales/:slug', element: <PaginaTerminal /> },
      { path: '/pasajes/:ciudad', element: <Pasajes /> },
      { path: '/pasajes/:origen/:destino', element: <Pasajes /> },
      // QR fijo de la taquilla: el pasajero paga la venta en curso con su wallet
      { path: '/caja/:taquillaId', element: <PagoTaquilla /> },
      // QR que muestra el conductor para cobrar la pieza de equipaje extra
      { path: '/equipaje/:token', element: <PagoEquipaje /> },
      {
        path: '/colector',
        element: (
          <RequireAuth roles={['colector']}>
            <Colector />
          </RequireAuth>
        ),
      },
      {
        path: '/admin',
        element: (
          <RequireAuth roles={['superadmin']}>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <AdminDashboard /> },
          { path: 'empresas', element: <AdminEmpresas /> },
          { path: 'pasajeros', element: <AdminPasajeros /> },
          { path: 'demanda', element: <AdminDemanda /> },
          { path: 'contratos', element: <AdminContratos /> },
          { path: 'integraciones', element: <AdminIntegraciones /> },
          { path: 'conectores', element: <AdminConectores /> },
          { path: 'liquidaciones', element: <AdminLiquidaciones /> },
          { path: 'facturas', element: <AdminFacturas /> },
          { path: 'tasas', element: <AdminTasas /> },
          { path: 'ciudades', element: <AdminCiudades /> },
          { path: 'auditoria', element: <AdminAuditoria /> },
          { path: 'wallet', element: <AdminWallet /> },
          { path: 'pagos', element: <AdminPagos /> },
          { path: 'seguridad', element: <AdminSeguridad /> },
        ],
      },
      {
        path: '/cuenta',
        element: (
          <RequireAuth roles={['cliente']}>
            <CuentaViajar />
          </RequireAuth>
        ),
      },
      {
        path: '/cuenta/boletos',
        element: (
          <RequireAuth roles={['cliente']}>
            <MisBoletos />
          </RequireAuth>
        ),
      },
      {
        path: '/cuenta/metodos',
        element: (
          <RequireAuth roles={['cliente']}>
            <MetodosPago />
          </RequireAuth>
        ),
      },
      {
        path: '/cuenta/wallet',
        element: (
          <RequireAuth roles={['cliente']}>
            <MiWallet />
          </RequireAuth>
        ),
      },
      {
        path: '/pos',
        element: (
          <RequireAuth roles={['cajero']}>
            <Pos />
          </RequireAuth>
        ),
      },
      {
        path: '/pos/cierre',
        element: (
          <RequireAuth roles={['cajero']}>
            <CierreTurno />
          </RequireAuth>
        ),
      },
      // «Pagos web» era lo mismo que «Mis ventas»; la verificación es del administrador (/empresa/pagos)
      { path: '/pos/pagos', element: <Navigate to="/pos/ventas" replace /> },
      {
        path: '/pos/ventas',
        element: (
          <RequireAuth roles={['cajero']}>
            <MisVentas />
          </RequireAuth>
        ),
      },
      {
        path: '/pos/reportes',
        element: (
          <RequireAuth roles={['cajero']}>
            <ReportesTurnos />
          </RequireAuth>
        ),
      },
      {
        path: '/pos/tasas',
        element: (
          <RequireAuth roles={['cajero']}>
            <TasasPos />
          </RequireAuth>
        ),
      },
      // El conductor trabaja desde la app: en la web solo se le dice dónde está lo suyo
      {
        path: '/app-conductor',
        element: (
          <RequireAuth roles={['chofer']}>
            <SoloApp />
          </RequireAuth>
        ),
      },
      { path: '/chofer/*', element: <Navigate to="/app-conductor" replace /> },
      {
        path: '/empresa',
        element: (
          <RequireAuth roles={['empresa']}>
            <EmpresaLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <EmpresaDashboard /> },
          { path: 'salidas', element: <EmpresaProgramacion /> },
          { path: 'rutas', element: <Navigate to="/empresa/salidas?tab=rutas" replace /> },
          { path: 'flota', element: <EmpresaFlota /> },
          { path: 'flota/:unidadId', element: <FichaUnidad /> },
          // Rutas anteriores de la flota: siguen funcionando
          { path: 'unidades', element: <Navigate to="/empresa/flota?tab=unidades" replace /> },
          { path: 'unidades/:unidadId', element: <FichaUnidad /> },
          { path: 'personal', element: <EmpresaPersonal /> },
          { path: 'pagos', element: <VerificacionPagos /> },
          { path: 'boletos', element: <EmpresaBoletos /> },
          { path: 'reportes', element: <EmpresaReportes /> },
          { path: 'flota-en-vivo', element: <Navigate to="/empresa/flota" replace /> },
          { path: 'wallet', element: <EmpresaWallet /> },
          { path: 'facturas', element: <EmpresaFacturas /> },
          { path: 'configuracion', element: <EmpresaConfiguracion /> },
        ],
      },
      // Rutas legadas del módulo flota
      { path: '/flota', element: <Navigate to="/empresa/flota" replace /> },
      { path: '/flota/:unidadId', element: <Navigate to="/empresa/flota" replace /> },
      // Sin rutas huérfanas: cualquier URL desconocida vuelve al marketplace
      {
        path: '/perfil',
        element: (
          <RequireAuth roles={['cliente', 'empresa', 'cajero', 'chofer', 'colector', 'superadmin']}>
            <Perfil />
          </RequireAuth>
        ),
      },
      { path: '*', element: <NoEncontrada /> },
    ],
  },
]);
