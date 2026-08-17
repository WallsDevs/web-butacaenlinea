import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { AppChrome } from './AppChrome';
import { RequireAuth } from './RequireAuth';

const MarketplaceHome = lazy(() => import('../features/public/MarketplaceHome'));
const Salidas = lazy(() => import('../features/public/Salidas'));
const Asientos = lazy(() => import('../features/public/Asientos'));
const Checkout = lazy(() => import('../features/public/Checkout'));
const Boleto = lazy(() => import('../features/public/Boleto'));
const Ingresar = lazy(() => import('../features/public/Ingresar'));
const Registro = lazy(() => import('../features/cuenta/Registro'));
const MisBoletos = lazy(() => import('../features/cuenta/MisBoletos'));
const MetodosPago = lazy(() => import('../features/cuenta/MetodosPago'));
const Pos = lazy(() => import('../features/pos/Pos'));
const CierreTurno = lazy(() => import('../features/pos/CierreTurno'));
const VerificacionPagos = lazy(() => import('../features/pos/VerificacionPagos'));
const MisVentas = lazy(() => import('../features/pos/MisVentas'));
const ReportesTurnos = lazy(() => import('../features/pos/ReportesTurnos'));
const TasasPos = lazy(() => import('../features/pos/TasasPos'));
const MiUnidad = lazy(() => import('../features/chofer/MiUnidad'));
const EmpresaLayout = lazy(() => import('../features/empresa/EmpresaLayout'));
const EmpresaDashboard = lazy(() => import('../features/empresa/EmpresaDashboard'));
const EmpresaSalidas = lazy(() => import('../features/empresa/EmpresaSalidas'));
const EmpresaRutas = lazy(() => import('../features/empresa/EmpresaRutas'));
const EmpresaPersonal = lazy(() => import('../features/empresa/EmpresaPersonal'));
const EmpresaBoletos = lazy(() => import('../features/empresa/EmpresaBoletos'));
const EmpresaReportes = lazy(() => import('../features/empresa/EmpresaReportes'));
const EmpresaConfiguracion = lazy(() => import('../features/empresa/EmpresaConfiguracion'));
const Escaner = lazy(() => import('../features/chofer/Escaner'));
const ManifiestoPage = lazy(() => import('../features/chofer/ManifiestoPage'));
const FlotaLista = lazy(() => import('../features/flota/FlotaLista'));
const AccesoPlataforma = lazy(() => import('../features/admin/AccesoPlataforma'));
const AdminDashboard = lazy(() => import('../features/admin/AdminDashboard'));
const AdminEmpresas = lazy(() => import('../features/admin/AdminEmpresas'));
const AdminLiquidaciones = lazy(() => import('../features/admin/AdminLiquidaciones'));
const AdminTasas = lazy(() => import('../features/admin/AdminTasas'));
const AdminAuditoria = lazy(() => import('../features/admin/AdminAuditoria'));
const AdminSeguridad = lazy(() => import('../features/admin/AdminSeguridad'));
const FichaUnidad = lazy(() => import('../features/flota/FichaUnidad'));

function Cargando() {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-soft)', fontSize: 14 }}>
      Cargando…
    </div>
  );
}

function AppLayout() {
  return (
    <>
      <AppChrome />
      <Suspense fallback={<Cargando />}>
        <Outlet />
      </Suspense>
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <MarketplaceHome /> },
      // Compra global (marketplace: todas las empresas)
      { path: '/salidas', element: <Salidas /> },
      { path: '/salidas/:id/asientos', element: <Asientos /> },
      { path: '/checkout', element: <Checkout /> },
      { path: '/boleto/:codigo', element: <Boleto /> },
      { path: '/ingresar', element: <Ingresar /> },
      { path: '/plataforma', element: <AccesoPlataforma /> },
      { path: '/registro', element: <Registro /> },
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
          { path: 'liquidaciones', element: <AdminLiquidaciones /> },
          { path: 'tasas', element: <AdminTasas /> },
          { path: 'auditoria', element: <AdminAuditoria /> },
          { path: 'seguridad', element: <AdminSeguridad /> },
        ],
      },
      {
        path: '/cuenta',
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
        path: '/pos',
        element: (
          <RequireAuth roles={['cajero', 'empresa']}>
            <Pos />
          </RequireAuth>
        ),
      },
      {
        path: '/pos/cierre',
        element: (
          <RequireAuth roles={['cajero', 'empresa']}>
            <CierreTurno />
          </RequireAuth>
        ),
      },
      {
        path: '/pos/pagos',
        element: (
          <RequireAuth roles={['cajero', 'empresa']}>
            <VerificacionPagos />
          </RequireAuth>
        ),
      },
      {
        path: '/pos/ventas',
        element: (
          <RequireAuth roles={['cajero', 'empresa']}>
            <MisVentas />
          </RequireAuth>
        ),
      },
      {
        path: '/pos/reportes',
        element: (
          <RequireAuth roles={['cajero', 'empresa']}>
            <ReportesTurnos />
          </RequireAuth>
        ),
      },
      {
        path: '/pos/tasas',
        element: (
          <RequireAuth roles={['cajero', 'empresa']}>
            <TasasPos />
          </RequireAuth>
        ),
      },
      {
        path: '/chofer/unidad',
        element: (
          <RequireAuth roles={['chofer', 'empresa']}>
            <MiUnidad />
          </RequireAuth>
        ),
      },
      {
        path: '/chofer',
        element: (
          <RequireAuth roles={['chofer', 'empresa']}>
            <Escaner />
          </RequireAuth>
        ),
      },
      {
        path: '/chofer/manifiesto',
        element: (
          <RequireAuth roles={['chofer', 'empresa']}>
            <ManifiestoPage />
          </RequireAuth>
        ),
      },
      {
        path: '/empresa',
        element: (
          <RequireAuth roles={['empresa']}>
            <EmpresaLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <EmpresaDashboard /> },
          { path: 'salidas', element: <EmpresaSalidas /> },
          { path: 'rutas', element: <EmpresaRutas /> },
          { path: 'unidades', element: <FlotaLista /> },
          { path: 'unidades/:unidadId', element: <FichaUnidad /> },
          { path: 'personal', element: <EmpresaPersonal /> },
          { path: 'pagos', element: <VerificacionPagos /> },
          { path: 'boletos', element: <EmpresaBoletos /> },
          { path: 'reportes', element: <EmpresaReportes /> },
          { path: 'configuracion', element: <EmpresaConfiguracion /> },
        ],
      },
      // Rutas legadas del módulo flota
      { path: '/flota', element: <Navigate to="/empresa/unidades" replace /> },
      { path: '/flota/:unidadId', element: <Navigate to="/empresa/unidades" replace /> },
      // Sin rutas huérfanas: cualquier URL desconocida vuelve al marketplace
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
