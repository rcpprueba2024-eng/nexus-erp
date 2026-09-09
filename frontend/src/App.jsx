import { useEffect, useState, Suspense, lazy } from 'react'
import { Routes, Route, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from './AuthContext.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'
import Avatar from './components/Avatar.jsx'
import logo from './assets/rcp-logo.png'
import './App.css'

// Cada página se carga en su propio archivo (code-splitting) en vez de ir
// todas empaquetadas en un solo .js — antes, entrar a Login descargaba el
// mismo bundle de 1.3MB que las 24 páginas del sistema juntas, algo
// especialmente lento en conexiones 2G/rurales. Ahora solo se descarga la
// página que el usuario realmente abre.
const Login = lazy(() => import('./pages/Login.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Inventario = lazy(() => import('./pages/Inventario.jsx'))
const Ventas = lazy(() => import('./pages/Ventas.jsx'))
const POS = lazy(() => import('./pages/POS.jsx'))
const Compras = lazy(() => import('./pages/Compras.jsx'))
const Gastos = lazy(() => import('./pages/Gastos.jsx'))
const CajaChica = lazy(() => import('./pages/CajaChica.jsx'))
const Contabilidad = lazy(() => import('./pages/Contabilidad.jsx'))
const RRHH = lazy(() => import('./pages/RRHH.jsx'))
const Taller = lazy(() => import('./pages/Taller.jsx'))
const EquiposListos = lazy(() => import('./pages/EquiposListos.jsx'))
const EquiposAbandonados = lazy(() => import('./pages/EquiposAbandonados.jsx'))
const HistorialTecnicos = lazy(() => import('./pages/HistorialTecnicos.jsx'))
const TecnicoDetalle = lazy(() => import('./pages/TecnicoDetalle.jsx'))
const Actividad = lazy(() => import('./pages/Actividad.jsx'))
const Reportes = lazy(() => import('./pages/Reportes.jsx'))
const BackOfficeFlujo = lazy(() => import('./pages/BackOfficeFlujo.jsx'))
const ReporteFinanciero = lazy(() => import('./pages/ReporteFinanciero.jsx'))
const Ordenes = lazy(() => import('./pages/Ordenes.jsx'))
const OrdenTrabajo = lazy(() => import('./pages/OrdenTrabajo.jsx'))
const NuevaOrden = lazy(() => import('./pages/NuevaOrden.jsx'))
const Facturacion = lazy(() => import('./pages/Facturacion.jsx'))
const FacturarOts = lazy(() => import('./pages/FacturarOts.jsx'))
const RegistroFacturas = lazy(() => import('./pages/RegistroFacturas.jsx'))
const VentasCategorias = lazy(() => import('./pages/VentasCategorias.jsx'))
const VentasUnidades = lazy(() => import('./pages/VentasUnidades.jsx'))
const VentasImportar = lazy(() => import('./pages/VentasImportar.jsx'))
const Clientes = lazy(() => import('./pages/Clientes.jsx'))
const ClienteDetalle = lazy(() => import('./pages/ClienteDetalle.jsx'))
const Configuracion = lazy(() => import('./pages/Configuracion.jsx'))

// Color fijo por rol para el avatar del sidebar — da una identidad visual
// consistente sin depender de que el usuario tenga foto subida.
const COLOR_POR_ROL = {
  ADMIN: '#0f6b5c',
  TALLER: '#b45309',
  PASANTE: '#b45309',
  VENTAS: '#1d4ed8',
  RRHH: '#7c3aed',
  BACKOFFICE: '#0891b2',
}

const NAV_ITEMS = [
  { to: '/', end: true, modulo: 'dashboard' },
  { to: '/clientes', modulo: 'clientes' },
]

const NAV_GRUPO_TALLER = {
  key: 'taller', modulos: ['taller'], tituloKey: 'grupoTaller',
  items: [
    { to: '/taller', label: 'tablero' },
    { to: '/taller/equipos-listos', label: 'equiposListos' },
    { to: '/taller/abandonados', label: 'abandonados' },
    { to: '/taller/historial-tecnicos', label: 'historialTecnicos' },
  ],
}

const NAV_GRUPO_VENTAS = {
  key: 'ventas', modulos: ['ordenes', 'ventas'], tituloKey: 'grupoVentas',
  items: [
    { to: '/ordenes', label: 'ordenesTrabajo' },
    { to: '/ventas/facturacion', label: 'facturacion' },
    { to: '/ventas/facturar-ots', label: 'facturarOts' },
    { to: '/ventas/equipos-listos', label: 'equiposListos' },
    { to: '/ventas/registro-facturas', label: 'registroFacturas' },
    { to: '/ventas/categorias', label: 'categorias' },
    { to: '/ventas/unidades', label: 'unidades' },
  ],
}

const NAV_GRUPO_BACKOFFICE = {
  key: 'backoffice', modulos: ['inventario', 'contabilidad', 'reportes', 'gastos'], tituloKey: 'grupoBackoffice',
  items: [
    // Productos, Flujo diario, Importar productos y Contabilidad dependen
    // cada uno de su propio módulo; un usuario con solo "reportes" (p.ej.
    // RRHH) entraba a una pantalla en blanco llena de 403. Se exigen por
    // separado del módulo que abre la carpeta.
    { to: '/inventario', label: 'inventario', requiereModulo: 'inventario' },
    { to: '/backoffice/flujo', label: 'flujoDiario', requiereModulo: 'inventario' },
    { to: '/ventas/importar', label: 'importarProductos', requiereModulo: 'inventario' },
    { to: '/contabilidad', label: 'contabilidad', requiereModulo: 'contabilidad' },
    { to: '/gastos', label: 'gastos', requiereModulo: 'gastos' },
    { to: '/reportes', label: 'reportes' },
    // Calcula utilidad neta a partir de planilla y cuentas por cobrar: son
    // datos financieros sensibles, solo Backoffice/Gerencia lo ven.
    { to: '/backoffice/financiero', label: 'reporteFinanciero', soloBackoffice: true },
  ],
}

const NAV_ITEMS_FINAL = [
  { to: '/compras', modulo: 'compras' },
  { to: '/rrhh', modulo: 'rrhh' },
  { to: '/caja-chica', modulo: 'caja_chica' },
]

const LOCALE_POR_IDIOMA = { es: 'es-NI', en: 'en-US', zh: 'zh-CN', fr: 'fr-FR' }

function Reloj() {
  const { i18n } = useTranslation('common')
  const [ahora, setAhora] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const locale = LOCALE_POR_IDIOMA[i18n.resolvedLanguage] || 'es-NI'
  const diaTexto = ahora.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const fecha = diaTexto.charAt(0).toUpperCase() + diaTexto.slice(1)
  const hora = ahora.toLocaleTimeString(locale, { hour12: true })

  return (
    <div className="clock">
      <span className="dot"></span>
      <span>{fecha}</span>
      <span className="time">{hora}</span>
    </div>
  )
}

// Aplana un item (con o sin subItems) a su lista de rutas navegables, para
// poder decidir si el grupo/subgrupo contiene la página activa.
function rutasDe(item) {
  return item.subItems ? item.subItems.map((s) => s.to) : [item.to]
}

function SubGrupo({ item, t, nivel }) {
  const location = useLocation()
  const rutas = rutasDe(item)
  const contieneActiva = rutas.some((to) => location.pathname === to || location.pathname.startsWith(`${to}/`))
  const [abierto, setAbierto] = useState(contieneActiva)
  useEffect(() => { if (contieneActiva) setAbierto(true) }, [contieneActiva])

  return (
    <div className="nav-subgrupo">
      <button type="button" className="nav-link nav-link-sub nav-subgrupo-titulo" onClick={() => setAbierto((a) => !a)}>
        <span>{t(`nav.${item.label}`)}</span>
        <span className={`nav-grupo-flecha ${abierto ? 'abierta' : ''}`}>›</span>
      </button>
      {abierto && item.subItems.map((sub) => (
        <NavLink key={sub.to} to={sub.to} className={({ isActive }) => (isActive ? 'nav-link nav-link-sub2 active' : 'nav-link nav-link-sub2')}>
          {t(`nav.${sub.label}`)}
        </NavLink>
      ))}
    </div>
  )
}

function NavGrupo({ titulo, items, t, puedeBackoffice, esAdmin, modulos }) {
  const location = useLocation()
  const visibles = items.filter((item) => {
    if (item.soloBackoffice && !puedeBackoffice) return false
    if (item.requiereModulo && !esAdmin && !modulos.includes(item.requiereModulo)) return false
    return true
  })
  const contieneActiva = visibles.some((item) => rutasDe(item).some((to) => location.pathname === to || location.pathname.startsWith(`${to}/`)))
  const [abierto, setAbierto] = useState(contieneActiva)

  // Si el usuario navega directo a un enlace de este grupo (recarga de
  // página, enlace externo), el grupo se abre solo para no "esconder" la
  // página en la que ya está.
  useEffect(() => { if (contieneActiva) setAbierto(true) }, [contieneActiva])

  return (
    <div className="nav-grupo">
      <button type="button" className="nav-grupo-titulo" onClick={() => setAbierto((a) => !a)}>
        <span>{titulo}</span>
        <span className={`nav-grupo-flecha ${abierto ? 'abierta' : ''}`}>›</span>
      </button>
      {abierto && visibles.map((item) => (
        item.subItems
          ? <SubGrupo key={item.label} item={item} t={t} />
          : (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-link nav-link-sub active' : 'nav-link nav-link-sub')}>
              {t(`nav.${item.label}`)}
            </NavLink>
          )
      ))}
    </div>
  )
}

function Shell() {
  const { t } = useTranslation('common')
  const { user, logout, roleLabel } = useAuth()
  // En celular el menú lateral no cabe fijo (se comía más de la mitad de la
  // pantalla): se oculta fuera de pantalla y se abre como panel encima del
  // contenido con este botón. En escritorio esta clase no hace nada (el CSS
  // solo la usa dentro de los @media de ancho angosto).
  const [menuAbierto, setMenuAbierto] = useState(false)
  const location = useLocation()
  useEffect(() => { setMenuAbierto(false) }, [location.pathname])
  const esAdmin = user.is_superuser || user.rol === 'ADMIN'
  // Backoffice conserva los módulos "taller"/"ventas" solo para que sus
  // propios reportes (Flujo diario, Reporte financiero) puedan leer esos
  // datos por API — pero el tablero operativo de Taller y la carpeta de
  // Órdenes de Trabajo/Ventas/POS son del piso de venta y taller, no de
  // Backoffice, así que se ocultan explícitamente para este rol.
  const esBackoffice = user.rol === 'BACKOFFICE'
  const modulos = user.modulos_permitidos || []
  const puede = (m) => esAdmin || modulos.includes(m)
  const visibleItems = NAV_ITEMS.filter((item) => puede(item.modulo))
  const visibleFinal = NAV_ITEMS_FINAL.filter((item) => puede(item.modulo))
  const verTaller = !esBackoffice && (esAdmin || NAV_GRUPO_TALLER.modulos.some((m) => modulos.includes(m)))
  // Backoffice sí ve este grupo (OTs, facturación, registro de facturas) —
  // necesita esos datos para analizar los procesos de la empresa. Lo que
  // NO ve es el tablero operativo de Taller (verTaller, abajo).
  const verOrdenes = esAdmin || esBackoffice || NAV_GRUPO_VENTAS.modulos.some((m) => modulos.includes(m))
  const verBackoffice = esAdmin || NAV_GRUPO_BACKOFFICE.modulos.some((m) => modulos.includes(m))

  return (
    <div className="layout">
      {menuAbierto && <div className="sidebar-backdrop" onClick={() => setMenuAbierto(false)} />}
      <aside className={`sidebar ${menuAbierto ? 'abierto' : ''}`}>
        <img src={logo} alt="RCP" className="sidebar-logo" />
        <div className="brand" style={{ justifyContent: 'center', paddingTop: 0 }}>
          <span className="brand-sub">{t('app.eslogan')}</span>
        </div>
        <nav>
          {visibleItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {t(`nav.${item.modulo}`)}
            </NavLink>
          ))}
          {verTaller && <NavGrupo titulo={t(`nav.${NAV_GRUPO_TALLER.tituloKey}`)} items={NAV_GRUPO_TALLER.items} t={t} esAdmin={esAdmin} modulos={modulos} />}
          {verOrdenes && <NavGrupo titulo={t(`nav.${NAV_GRUPO_VENTAS.tituloKey}`)} items={NAV_GRUPO_VENTAS.items} t={t} esAdmin={esAdmin} modulos={modulos} />}
          {visibleFinal.filter((i) => i.to === '/compras').map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {t(`nav.${item.modulo}`)}
            </NavLink>
          ))}
          {verBackoffice && <NavGrupo titulo={t(`nav.${NAV_GRUPO_BACKOFFICE.tituloKey}`)} items={NAV_GRUPO_BACKOFFICE.items} t={t} esAdmin={esAdmin} modulos={modulos} puedeBackoffice={esAdmin || user.rol === 'BACKOFFICE'} />}
          {visibleFinal.filter((i) => i.to !== '/compras').map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {t(`nav.${item.modulo}`)}
            </NavLink>
          ))}
          {user.puede_ver_actividad && (
            <NavLink to="/actividad" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {t('nav.actividad')}
            </NavLink>
          )}
          <NavLink to="/configuracion" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            {t('nav.configuracion')}
          </NavLink>
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <Avatar nombre={user.nombre} foto={user.foto} color={COLOR_POR_ROL[user.rol]} size={38} />
            <div className="sidebar-user-text">
              <div className="sidebar-user-name">{user.nombre}</div>
              <div className="sidebar-user-role">{roleLabel}</div>
            </div>
          </div>
          <button className="secondary" onClick={logout}>{t('nav.cerrarSesion')}</button>
        </div>
      </aside>
      <main className="content">
        <div className="topbar">
          <button type="button" className="menu-toggle" onClick={() => setMenuAbierto(true)} aria-label={t('nav.abrirMenu')}>
            ☰
          </button>
          <Reloj />
        </div>
        <Outlet />
      </main>
    </div>
  )
}

// Taller/Pasante no tienen acceso a ningún módulo salvo Taller (y su propia
// Configuración de idioma/tema). Es la única puerta de entrada tras login y
// también el candado para quien intente escribir otra ruta a mano.
function soloTaller(rol) {
  return rol === 'TALLER' || rol === 'PASANTE'
}

function inicioPara(user) {
  return soloTaller(user.rol) ? '/taller' : '/'
}

// Cada ruta del resto de roles exige su propio módulo — quien no lo tenga
// (por ejemplo Ventas escribiendo "/rrhh" a mano) rebota a su Panel en vez
// de ver una pantalla rota llena de 403. Es la misma idea del candado de
// Taller, generalizada: "cada usuario, acceso solo a su área".
function RutaProtegida({ modulo, soloBackoffice, bloqueaBackoffice, children }) {
  const { user } = useAuth()
  const esAdmin = user.is_superuser || user.rol === 'ADMIN'
  const modulos = user.modulos_permitidos || []
  // bloqueaBackoffice: páginas operativas de Taller/Ventas que Backoffice
  // NO debe abrir aunque conserve el módulo (lo tiene solo para que sus
  // propios reportes lean esos datos por API) — igual que se ocultan del
  // menú, se bloquea también si escriben la URL a mano.
  const permitido = esAdmin || (
    (soloBackoffice ? user.rol === 'BACKOFFICE' : modulos.includes(modulo)) &&
    !(bloqueaBackoffice && user.rol === 'BACKOFFICE')
  )
  if (!permitido) return <Navigate to={inicioPara(user)} replace />
  return children
}

function App() {
  const { user } = useAuth()
  const inicio = user ? inicioPara(user) : '/'

  return (
    <Suspense fallback={<div className="loading">Cargando…</div>}>
    <Routes>
      <Route path="/login" element={user ? <Navigate to={inicio} replace /> : <Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Shell />}>
          {user && soloTaller(user.rol) ? (
            <>
              <Route path="/taller" element={<Taller />} />
              {/* Taller/Pasante ven todo el apartado de Taller (tablero,
                  equipos listos, abandonados, historial de técnicos) — antes
                  el menú mostraba estos enlaces pero la ruta no existía para
                  este rol y el catch-all los rebotaba de vuelta a /taller. */}
              <Route path="/taller/equipos-listos" element={<EquiposListos />} />
              <Route path="/taller/abandonados" element={<EquiposAbandonados />} />
              <Route path="/taller/historial-tecnicos" element={<HistorialTecnicos />} />
              <Route path="/taller/tecnico/:id" element={<TecnicoDetalle />} />
              {/* Pedido explícito: Taller también tiene acceso al Arqueo/Cierre
                  de Caja (ver core.choices.MODULOS_POR_ROL["TALLER"]) — Pasante
                  no lo tiene, pero comparte este mismo árbol de rutas; el
                  backend igual lo bloquea (role_permission exige el módulo
                  "caja_chica", que Pasante no trae). */}
              <Route path="/caja-chica" element={<CajaChica />} />
              <Route path="/configuracion" element={<Configuracion />} />
              <Route path="*" element={<Navigate to="/taller" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ordenes" element={<RutaProtegida modulo="ordenes"><Ordenes /></RutaProtegida>} />
              <Route path="/ordenes/nueva" element={<RutaProtegida modulo="ordenes"><NuevaOrden /></RutaProtegida>} />
              <Route path="/ordenes/:id" element={<RutaProtegida modulo="ordenes"><OrdenTrabajo /></RutaProtegida>} />
              <Route path="/clientes" element={<RutaProtegida modulo="clientes"><Clientes /></RutaProtegida>} />
              <Route path="/clientes/:id" element={<RutaProtegida modulo="clientes"><ClienteDetalle /></RutaProtegida>} />
              <Route path="/inventario" element={<RutaProtegida modulo="inventario"><Inventario /></RutaProtegida>} />
              <Route path="/taller" element={<RutaProtegida modulo="taller" bloqueaBackoffice><Taller /></RutaProtegida>} />
              <Route path="/taller/equipos-listos" element={<RutaProtegida modulo="taller" bloqueaBackoffice><EquiposListos /></RutaProtegida>} />
              <Route path="/taller/abandonados" element={<RutaProtegida modulo="taller" bloqueaBackoffice><EquiposAbandonados /></RutaProtegida>} />
              <Route path="/taller/historial-tecnicos" element={<RutaProtegida modulo="taller" bloqueaBackoffice><HistorialTecnicos /></RutaProtegida>} />
              <Route path="/taller/tecnico/:id" element={<RutaProtegida modulo="taller" bloqueaBackoffice><TecnicoDetalle /></RutaProtegida>} />
              {/* /ventas (piso de venta/POS) sigue bloqueado para Backoffice — no
                  opera ventas directamente. El resto de este grupo (OTs,
                  facturación, registro de facturas) sí lo necesita para
                  analizar los procesos — ver verOrdenes más arriba. */}
              <Route path="/ventas" element={<RutaProtegida modulo="ventas" bloqueaBackoffice><Ventas /></RutaProtegida>} />
              <Route path="/ventas/facturacion" element={<RutaProtegida modulo="ventas"><Facturacion /></RutaProtegida>} />
              <Route path="/ventas/facturar-ots" element={<RutaProtegida modulo="ventas"><FacturarOts /></RutaProtegida>} />
              <Route path="/ventas/equipos-listos" element={<RutaProtegida modulo="ventas"><EquiposListos /></RutaProtegida>} />
              <Route path="/ventas/registro-facturas" element={<RutaProtegida modulo="ventas"><RegistroFacturas /></RutaProtegida>} />
              <Route path="/ventas/categorias" element={<RutaProtegida modulo="ventas"><VentasCategorias /></RutaProtegida>} />
              <Route path="/ventas/unidades" element={<RutaProtegida modulo="ventas"><VentasUnidades /></RutaProtegida>} />
              <Route path="/ventas/importar" element={<RutaProtegida modulo="inventario"><VentasImportar /></RutaProtegida>} />
              <Route path="/pos" element={<RutaProtegida modulo="ventas" bloqueaBackoffice><POS /></RutaProtegida>} />
              <Route path="/compras" element={<RutaProtegida modulo="compras"><Compras /></RutaProtegida>} />
              <Route path="/gastos" element={<RutaProtegida modulo="gastos"><Gastos /></RutaProtegida>} />
              <Route path="/contabilidad" element={<RutaProtegida modulo="contabilidad"><Contabilidad /></RutaProtegida>} />
              <Route path="/rrhh" element={<RutaProtegida modulo="rrhh"><RRHH /></RutaProtegida>} />
              <Route path="/caja-chica" element={<RutaProtegida modulo="caja_chica"><CajaChica /></RutaProtegida>} />
              <Route path="/reportes" element={<RutaProtegida modulo="reportes"><Reportes /></RutaProtegida>} />
              <Route path="/backoffice/flujo" element={<RutaProtegida modulo="inventario"><BackOfficeFlujo /></RutaProtegida>} />
              <Route path="/backoffice/financiero" element={<RutaProtegida soloBackoffice><ReporteFinanciero /></RutaProtegida>} />
              {/* Bitácora de actividad: pedido explícito de Gerencia — solo
                  el usuario SISTEMA.RCP la puede abrir, ni siquiera otras
                  cuentas de Gerencia (ADMIN/superusuario). `puede_ver_actividad`
                  lo manda el backend (ver core.permissions.SistemaRcpOnly), no
                  se decide acá con el rol. */}
              <Route path="/actividad" element={user?.puede_ver_actividad ? <Actividad /> : <Navigate to="/" replace />} />
              <Route path="/configuracion" element={<Configuracion />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Route>
      </Route>
    </Routes>
    </Suspense>
  )
}

export default App
