import axios from 'axios'

// Rutas relativas: el frontend y la API se sirven desde el MISMO origen.
// - En producción lo hace Caddy (https://SRV-RCP/ -> SPA, /api y /media -> Django).
// - En desarrollo lo hace el proxy de Vite (ver vite.config.js).
// Así funciona igual por LAN, por HTTPS y por túnel, sin hardcodear host ni puerto.
const BASE_URL = '/api'
export const MEDIA_BASE_URL = ''

export const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('rcp_token')
  if (token) cfg.headers.Authorization = `Token ${token}`
  return cfg
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('rcp_token')
      localStorage.removeItem('rcp_user')
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export const authApi = {
  login: (username, password) => api.post('/auth/login/', { username, password }),
  me: () => api.get('/auth/me/'),
  actualizarIdioma: (idioma) => api.patch('/auth/me/', { idioma }),
  actualizarTema: (tema) => api.patch('/auth/me/', { tema }),
}

export const configApi = {
  obtener: () => api.get('/auth/configuracion/'),
  actualizar: (data) => api.patch('/auth/configuracion/', data),
}

export const usuariosApi = {
  listar: () => api.get('/auth/usuarios/'),
  obtener: (id) => api.get(`/auth/usuarios/${id}/`),
  crear: (data) => api.post('/auth/usuarios/', data),
  actualizar: (id, data) => api.patch(`/auth/usuarios/${id}/`, data),
  solicitarEliminacion: (id) => api.post(`/auth/usuarios/${id}/solicitar_eliminacion/`),
  cancelarEliminacion: (id) => api.post(`/auth/usuarios/${id}/cancelar_eliminacion/`),
  subirFoto: (id, file) => {
    const form = new FormData()
    form.append('foto', file)
    return api.patch(`/auth/usuarios/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

export const actividadApi = {
  // Pagina de verdad en el servidor (no como el resto de la API, que
  // devuelve todo y pagina en el frontend) — esta tabla crece sin techo.
  // `params` puede traer: usuario, accion, modulo, desde, hasta, buscar, page.
  listar: (params) => api.get('/auth/actividad/', { params }),
}

export const inventarioApi = {
  productos: () => api.get('/inventario/productos/'),
  crearProducto: (data) => api.post('/inventario/productos/', data, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined),
  actualizarProducto: (id, data) => api.patch(`/inventario/productos/${id}/`, data, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined),
  eliminarProducto: (id) => api.delete(`/inventario/productos/${id}/`),
  categorias: () => api.get('/inventario/categorias/'),
  crearCategoria: (data) => api.post('/inventario/categorias/', data),
  actualizarCategoria: (id, data) => api.patch(`/inventario/categorias/${id}/`, data),
  eliminarCategoria: (id) => api.delete(`/inventario/categorias/${id}/`),
  subcategorias: () => api.get('/inventario/subcategorias/'),
  crearSubcategoria: (data) => api.post('/inventario/subcategorias/', data),
  eliminarSubcategoria: (id) => api.delete(`/inventario/subcategorias/${id}/`),
  marcas: () => api.get('/inventario/marcas/'),
  crearMarca: (data) => api.post('/inventario/marcas/', data),
  eliminarMarca: (id) => api.delete(`/inventario/marcas/${id}/`),
  modelos: (marcaId) => api.get(`/inventario/modelos/${marcaId ? `?marca=${marcaId}` : ''}`),
  crearModelo: (data) => api.post('/inventario/modelos/', data),
  eliminarModelo: (id) => api.delete(`/inventario/modelos/${id}/`),
  unidades: () => api.get('/inventario/unidades/'),
  crearUnidad: (data) => api.post('/inventario/unidades/', data),
  actualizarUnidad: (id, data) => api.patch(`/inventario/unidades/${id}/`, data),
  eliminarUnidad: (id) => api.delete(`/inventario/unidades/${id}/`),
  importarMasivo: (file) => {
    const form = new FormData()
    form.append('archivo', file)
    return api.post('/inventario/importar/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  bajas: () => api.get('/inventario/bajas/'),
  crearBaja: (data) => api.post('/inventario/bajas/', data),
}

export const ventasApi = {
  clientes: () => api.get('/ventas/clientes/'),
  cliente: (id) => api.get(`/ventas/clientes/${id}/`),
  crearCliente: (data) => api.post('/ventas/clientes/', data),
  actualizarCliente: (id, data) => api.patch(`/ventas/clientes/${id}/`, data),
  eliminarCliente: (id) => api.delete(`/ventas/clientes/${id}/`),
  empresas: () => api.get('/ventas/empresas/'),
  crearEmpresa: (data) => api.post('/ventas/empresas/', data),
  actualizarEmpresa: (id, data) => api.patch(`/ventas/empresas/${id}/`, data),
  eliminarEmpresa: (id) => api.delete(`/ventas/empresas/${id}/`),
  equipos: (clienteId) => api.get(`/ventas/equipos/${clienteId ? `?cliente=${clienteId}` : ''}`),
  crearEquipo: (data) => api.post('/ventas/equipos/', data),
  facturas: (clienteId) => api.get(`/ventas/facturas/${clienteId ? `?cliente=${clienteId}` : ''}`),
  factura: (id) => api.get(`/ventas/facturas/${id}/`),
  crearFactura: (data) => api.post('/ventas/facturas/', data),
  eliminarFactura: (id) => api.delete(`/ventas/facturas/${id}/`),
  crearDetalle: (data) => api.post('/ventas/detalles/', data),
  imprimirFactura: (id) => api.post(`/ventas/facturas/${id}/imprimir/`),
  crearPago: (data) => api.post('/ventas/pagos/', data),
}

export const comprasApi = {
  proveedores: () => api.get('/compras/proveedores/'),
  crearProveedor: (data) => api.post('/compras/proveedores/', data),
  eliminarProveedor: (id) => api.delete(`/compras/proveedores/${id}/`),
  ordenes: () => api.get('/compras/ordenes/'),
  crearOrden: (data) => api.post('/compras/ordenes/', data),
  eliminarOrden: (id) => api.delete(`/compras/ordenes/${id}/`),
  crearDetalle: (data) => api.post('/compras/detalles/', data),
  // Cotizaciones a CLIENTES (no a proveedores) — llena la plantilla real de
  // Excel que RCP ya usaba a mano (ver backend/compras/plantillas_excel).
  cotizacionesClientes: () => api.get('/compras/cotizaciones-clientes/'),
  crearCotizacionCliente: (data) => api.post('/compras/cotizaciones-clientes/', data),
  actualizarCotizacionCliente: (id, data) => api.patch(`/compras/cotizaciones-clientes/${id}/`, data),
  eliminarCotizacionCliente: (id) => api.delete(`/compras/cotizaciones-clientes/${id}/`),
  crearItemCotizacionCliente: (data) => api.post('/compras/items-cotizacion-cliente/', data),
  eliminarItemCotizacionCliente: (id) => api.delete(`/compras/items-cotizacion-cliente/${id}/`),
  exportarCotizacionClienteExcel: (id, numero) => descargar(`/compras/cotizaciones-clientes/${id}/excel/`, `${numero || 'PPTO'}.xlsx`),
  verPdfCotizacionCliente: (id) => {
    const ventana = window.open('', '_blank')
    return api.get(`/compras/cotizaciones-clientes/${id}/pdf/`, { responseType: 'blob' }).then((res) => {
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      if (ventana && !ventana.closed) ventana.location.href = blobUrl
      else window.open(blobUrl, '_blank')
    })
  },
}

export const gastosApi = {
  cajaChica: () => api.get('/gastos/caja-chica/'),
  ajustarCajaChica: (saldo_actual) => api.patch('/gastos/caja-chica/', { saldo_actual }),
  gastos: () => api.get('/gastos/gastos/'),
  crearGasto: (data) => api.post('/gastos/gastos/', data),
  eliminarGasto: (id) => api.delete(`/gastos/gastos/${id}/`),
  categorias: () => api.get('/gastos/categorias/'),
  crearCategoria: (data) => api.post('/gastos/categorias/', data),
  eliminarCategoria: (id) => api.delete(`/gastos/categorias/${id}/`),
}

// Arqueo/Cierre de Caja — llena el mismo Excel real (con fórmulas) que ya
// usa RCP a mano (ver backend/caja_chica/plantillas_excel/arqueo_caja.xlsx).
// Distinto del saldo simple de "Caja chica" de arriba (gastosApi.cajaChica).
export const cajaChicaApi = {
  arqueos: () => api.get('/caja-chica/arqueos/'),
  arqueo: (id) => api.get(`/caja-chica/arqueos/${id}/`),
  crearArqueo: (data) => api.post('/caja-chica/arqueos/', data),
  actualizarArqueo: (id, data) => api.patch(`/caja-chica/arqueos/${id}/`, data),
  eliminarArqueo: (id) => api.delete(`/caja-chica/arqueos/${id}/`),
  exportarArqueoExcel: (id, fecha) => descargar(`/caja-chica/arqueos/${id}/excel/`, `Arqueo_Caja_${fecha}.xlsx`),
  verPdfArqueo: (id) => {
    const ventana = window.open('', '_blank')
    return api.get(`/caja-chica/arqueos/${id}/pdf/`, { responseType: 'blob' }).then((res) => {
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      if (ventana && !ventana.closed) ventana.location.href = blobUrl
      else window.open(blobUrl, '_blank')
    })
  },
}

export const contabilidadApi = {
  cuentasPorCobrar: (clienteId) => api.get(`/contabilidad/cuentas-por-cobrar/${clienteId ? `?cliente=${clienteId}` : ''}`),
  crearCuentaPorCobrar: (data) => api.post('/contabilidad/cuentas-por-cobrar/', data),
  actualizarCuentaPorCobrar: (id, data) => api.patch(`/contabilidad/cuentas-por-cobrar/${id}/`, data),
  eliminarCuentaPorCobrar: (id) => api.delete(`/contabilidad/cuentas-por-cobrar/${id}/`),
  cuentasPorPagar: () => api.get('/contabilidad/cuentas-por-pagar/'),
}

export const rrhhApi = {
  empleados: () => api.get('/rrhh/empleados/'),
  crearEmpleado: (data) => api.post('/rrhh/empleados/', data),
  actualizarEmpleado: (id, data) => api.patch(`/rrhh/empleados/${id}/`, data),
  eliminarEmpleado: (id) => api.delete(`/rrhh/empleados/${id}/`),
  subirFotoEmpleado: (id, file) => {
    const form = new FormData()
    form.append('foto', file)
    return api.patch(`/rrhh/empleados/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  registrosHoras: (params) => api.get('/rrhh/registros-horas/', { params }),
  crearRegistroHoras: (data) => api.post('/rrhh/registros-horas/', data),
  actualizarRegistroHoras: (id, data) => api.patch(`/rrhh/registros-horas/${id}/`, data),
  eliminarRegistroHoras: (id) => api.delete(`/rrhh/registros-horas/${id}/`),
  reporteHoras: (params) => api.get('/rrhh/reporte-horas/', { params }),
  reporteAsistencia: (params) => api.get('/rrhh/reporte-asistencia/', { params }),
  exportarReporteAsistencia: (desde, hasta) => descargar(`/rrhh/reporte-asistencia/exportar/?desde=${desde}&hasta=${hasta}`, `rrhh_completo_${desde}_${hasta}.xlsx`),
  horarios: (empleado) => api.get('/rrhh/horarios/', { params: { empleado } }),
  guardarHorario: (data) => api.post('/rrhh/horarios/', data),
  // `params` es un objeto libre ({empleado} y/o {categoria}) — la pestaña de
  // Permisos/Vacaciones lista a través de todos los empleados a la vez, no
  // solo el de una ficha puntual.
  permisos: (params) => api.get('/rrhh/permisos/', { params }),
  crearPermiso: (data) => api.post('/rrhh/permisos/', data),
  eliminarPermiso: (id) => api.delete(`/rrhh/permisos/${id}/`),
  saldoVacaciones: () => api.get('/rrhh/vacaciones/saldo/'),
  documentos: (empleado) => api.get('/rrhh/documentos/', { params: { empleado } }),
  subirDocumentoEmpleado: (empleado, file, nombre) => {
    const form = new FormData()
    form.append('empleado', empleado)
    form.append('archivo', file)
    if (nombre) form.append('nombre', nombre)
    return api.post('/rrhh/documentos/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  eliminarDocumentoEmpleado: (id) => api.delete(`/rrhh/documentos/${id}/`),
  uniformeDias: () => api.get('/rrhh/uniforme-dias/'),
  guardarUniformeDia: (id, data) => api.patch(`/rrhh/uniforme-dias/${id}/`, data),
}

export const tallerApi = {
  ordenes: (buscar) => api.get(`/taller/ordenes/${buscar ? `?buscar=${encodeURIComponent(buscar)}` : ''}`),
  ordenesDeCliente: (clienteId) => api.get(`/taller/ordenes/?cliente=${clienteId}`),
  orden: (id) => api.get(`/taller/ordenes/${id}/`),
  crearOrden: (data) => api.post('/taller/ordenes/', data),
  actualizarOrden: (id, data) => api.patch(`/taller/ordenes/${id}/`, data),
  eliminarOrden: (id) => api.delete(`/taller/ordenes/${id}/`),
  crearInsumo: (data) => api.post('/taller/insumos/', data),
  subirFoto: (orden, momento, file, diagnosticoOrden) => {
    const form = new FormData()
    form.append('orden', orden)
    form.append('momento', momento)
    form.append('imagen', file)
    if (diagnosticoOrden) form.append('diagnostico_orden', diagnosticoOrden)
    return api.post('/taller/fotos/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  eliminarFoto: (id) => api.delete(`/taller/fotos/${id}/`),
  crearDiagnostico: (orden, texto) => api.post('/taller/diagnosticos/', { orden, texto }),
  // PDF generado en el servidor (tamaño de hoja fijo, no depende del
  // navegador ni del driver de la impresora del cliente al imprimir) — se
  // abre en una pestaña nueva en vez de forzar la descarga, para que se
  // pueda imprimir de una con el botón del propio visor de PDF.
  // La pestaña se abre YA (en blanco) antes del await: si se abriera
  // recién dentro del .then(), la mayoría de navegadores la bloquean por
  // "ventana emergente" al no verla como reacción directa al clic.
  verPdfOrden: (id) => {
    const ventana = window.open('', '_blank')
    return api.get(`/taller/ordenes/${id}/pdf/`, { responseType: 'blob' }).then((res) => {
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      if (ventana && !ventana.closed) ventana.location.href = blobUrl
      else window.open(blobUrl, '_blank')
    })
  },
  exportarOrdenes: () => descargar('/taller/ordenes/exportar/', 'ordenes_taller.xlsx'),
  duplicarOrden: (id) => api.post(`/taller/ordenes/${id}/duplicar/`),
  facturarOrden: (id, data) => api.post(`/taller/ordenes/${id}/facturar/`, data),
  historialCliente: (clienteId, excluirId) => api.get(`/taller/ordenes/?cliente=${clienteId}&excluir=${excluirId}`),
  historialSerie: (noSerie, excluirId) => api.get(`/taller/ordenes/?no_serie=${encodeURIComponent(noSerie)}&excluir=${excluirId}`),
}

async function descargar(url, filename) {
  const res = await api.get(url, { responseType: 'blob' })
  const blobUrl = window.URL.createObjectURL(new Blob([res.data]))
  const link = document.createElement('a')
  link.href = blobUrl
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(blobUrl)
}

export const reportesApi = {
  ventasPeriodo: (agrupacion) => api.get(`/reportes/ventas-periodo/?agrupacion=${agrupacion}`),
  ventasVendedores: () => api.get('/reportes/ventas-vendedores/'),
  categoriasVendidas: () => api.get('/reportes/categorias-vendidas/'),
  gastosInsumos: () => api.get('/reportes/gastos-insumos/'),
  gastosPersonal: () => api.get('/reportes/gastos-personal/'),
  gastosProveedor: () => api.get('/reportes/gastos-proveedor/'),
  gastosDia: () => api.get('/reportes/gastos-dia/'),
  estadoResultados: () => api.get('/reportes/estado-resultados/'),
  inventarioMovimiento: () => api.get('/reportes/inventario-movimiento/'),
  cuentasPorCobrar: () => api.get('/reportes/cuentas-por-cobrar/'),
  clientesEmpresas: () => api.get('/reportes/clientes-empresas/'),
  tallerEficiencia: () => api.get('/reportes/taller-eficiencia/'),
  exportarVentasPeriodo: (agrupacion) => descargar(`/reportes/ventas-periodo/exportar/?agrupacion=${agrupacion}`, `ventas_${agrupacion}.xlsx`),
  exportarVentasPeriodoPdf: (agrupacion) => descargar(`/reportes/ventas-periodo/exportar-pdf/?agrupacion=${agrupacion}`, `ventas_${agrupacion}.pdf`),
  exportarVentasVendedores: () => descargar('/reportes/ventas-vendedores/exportar/', 'ventas_por_vendedor.xlsx'),
  exportarVentasVendedoresPdf: () => descargar('/reportes/ventas-vendedores/exportar-pdf/', 'ventas_por_vendedor.pdf'),
  exportarGastos: () => descargar('/reportes/gastos/exportar/', 'gastos.xlsx'),
  exportarGastosPdf: () => descargar('/reportes/gastos/exportar-pdf/', 'gastos.pdf'),
  exportarGastosProveedor: () => descargar('/reportes/gastos-proveedor/exportar/', 'gastos_por_proveedor.xlsx'),
  exportarGastosProveedorPdf: () => descargar('/reportes/gastos-proveedor/exportar-pdf/', 'gastos_por_proveedor.pdf'),
  exportarInventarioMovimiento: () => descargar('/reportes/inventario-movimiento/exportar/', 'inventario_movimiento.xlsx'),
  exportarInventarioMovimientoPdf: () => descargar('/reportes/inventario-movimiento/exportar-pdf/', 'inventario_movimiento.pdf'),
  exportarCuentasPorCobrar: () => descargar('/reportes/cuentas-por-cobrar/exportar/', 'cuentas_por_cobrar.xlsx'),
  exportarCuentasPorCobrarPdf: () => descargar('/reportes/cuentas-por-cobrar/exportar-pdf/', 'cuentas_por_cobrar.pdf'),
  exportarTallerEficiencia: () => descargar('/reportes/taller-eficiencia/exportar/', 'taller_eficiencia.xlsx'),
  exportarTallerEficienciaPdf: () => descargar('/reportes/taller-eficiencia/exportar-pdf/', 'taller_eficiencia.pdf'),
}
