import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import esCommon from './locales/es/common.json'
import esLogin from './locales/es/login.json'
import esDashboard from './locales/es/dashboard.json'
import esConfiguracion from './locales/es/configuracion.json'
import esInventario from './locales/es/inventario.json'
import esVentas from './locales/es/ventas.json'
import esCompras from './locales/es/compras.json'
import esContabilidad from './locales/es/contabilidad.json'
import esRrhh from './locales/es/rrhh.json'
import esTaller from './locales/es/taller.json'
import esReportes from './locales/es/reportes.json'
import esClientes from './locales/es/clientes.json'
import esOrdenes from './locales/es/ordenes.json'
import esChecklist from './locales/es/checklist.json'
import esPos from './locales/es/pos.json'
import esBackoffice from './locales/es/backoffice.json'
import esFacturarOts from './locales/es/facturarOts.json'
import esVentasUnidades from './locales/es/ventasUnidades.json'
import esVentasCategorias from './locales/es/ventasCategorias.json'
import esVentasImportar from './locales/es/ventasImportar.json'
import esRecibo from './locales/es/recibo.json'
import esRegistroFacturas from './locales/es/registroFacturas.json'
import esEquiposListos from './locales/es/equiposListos.json'
import esEquiposAbandonados from './locales/es/equiposAbandonados.json'
import esHistorialTecnicos from './locales/es/historialTecnicos.json'
import esTecnicoDetalle from './locales/es/tecnicoDetalle.json'
import esActividad from './locales/es/actividad.json'
import esFacturacion from './locales/es/facturacion.json'
import esGastos from './locales/es/gastos.json'
import esCajaChica from './locales/es/cajaChica.json'

import enCommon from './locales/en/common.json'
import enLogin from './locales/en/login.json'
import enDashboard from './locales/en/dashboard.json'
import enConfiguracion from './locales/en/configuracion.json'
import enInventario from './locales/en/inventario.json'
import enVentas from './locales/en/ventas.json'
import enCompras from './locales/en/compras.json'
import enContabilidad from './locales/en/contabilidad.json'
import enRrhh from './locales/en/rrhh.json'
import enTaller from './locales/en/taller.json'
import enReportes from './locales/en/reportes.json'
import enClientes from './locales/en/clientes.json'
import enOrdenes from './locales/en/ordenes.json'
import enChecklist from './locales/en/checklist.json'
import enPos from './locales/en/pos.json'
import enBackoffice from './locales/en/backoffice.json'
import enFacturarOts from './locales/en/facturarOts.json'
import enVentasUnidades from './locales/en/ventasUnidades.json'
import enVentasCategorias from './locales/en/ventasCategorias.json'
import enVentasImportar from './locales/en/ventasImportar.json'
import enRecibo from './locales/en/recibo.json'
import enRegistroFacturas from './locales/en/registroFacturas.json'
import enEquiposListos from './locales/en/equiposListos.json'
import enEquiposAbandonados from './locales/en/equiposAbandonados.json'
import enHistorialTecnicos from './locales/en/historialTecnicos.json'
import enTecnicoDetalle from './locales/en/tecnicoDetalle.json'
import enActividad from './locales/en/actividad.json'
import enFacturacion from './locales/en/facturacion.json'
import enGastos from './locales/en/gastos.json'
import enCajaChica from './locales/en/cajaChica.json'

import zhCommon from './locales/zh/common.json'
import zhLogin from './locales/zh/login.json'
import zhDashboard from './locales/zh/dashboard.json'
import zhConfiguracion from './locales/zh/configuracion.json'
import zhInventario from './locales/zh/inventario.json'
import zhVentas from './locales/zh/ventas.json'
import zhCompras from './locales/zh/compras.json'
import zhContabilidad from './locales/zh/contabilidad.json'
import zhRrhh from './locales/zh/rrhh.json'
import zhTaller from './locales/zh/taller.json'
import zhReportes from './locales/zh/reportes.json'
import zhClientes from './locales/zh/clientes.json'
import zhOrdenes from './locales/zh/ordenes.json'
import zhChecklist from './locales/zh/checklist.json'
import zhPos from './locales/zh/pos.json'
import zhBackoffice from './locales/zh/backoffice.json'
import zhFacturarOts from './locales/zh/facturarOts.json'
import zhVentasUnidades from './locales/zh/ventasUnidades.json'
import zhVentasCategorias from './locales/zh/ventasCategorias.json'
import zhVentasImportar from './locales/zh/ventasImportar.json'
import zhRecibo from './locales/zh/recibo.json'
import zhRegistroFacturas from './locales/zh/registroFacturas.json'
import zhEquiposListos from './locales/zh/equiposListos.json'
import zhEquiposAbandonados from './locales/zh/equiposAbandonados.json'
import zhHistorialTecnicos from './locales/zh/historialTecnicos.json'
import zhTecnicoDetalle from './locales/zh/tecnicoDetalle.json'
import zhActividad from './locales/zh/actividad.json'
import zhFacturacion from './locales/zh/facturacion.json'
import zhGastos from './locales/zh/gastos.json'
import zhCajaChica from './locales/zh/cajaChica.json'

import frCommon from './locales/fr/common.json'
import frLogin from './locales/fr/login.json'
import frDashboard from './locales/fr/dashboard.json'
import frConfiguracion from './locales/fr/configuracion.json'
import frInventario from './locales/fr/inventario.json'
import frVentas from './locales/fr/ventas.json'
import frCompras from './locales/fr/compras.json'
import frContabilidad from './locales/fr/contabilidad.json'
import frRrhh from './locales/fr/rrhh.json'
import frTaller from './locales/fr/taller.json'
import frReportes from './locales/fr/reportes.json'
import frClientes from './locales/fr/clientes.json'
import frOrdenes from './locales/fr/ordenes.json'
import frChecklist from './locales/fr/checklist.json'
import frPos from './locales/fr/pos.json'
import frBackoffice from './locales/fr/backoffice.json'
import frFacturarOts from './locales/fr/facturarOts.json'
import frVentasUnidades from './locales/fr/ventasUnidades.json'
import frVentasCategorias from './locales/fr/ventasCategorias.json'
import frVentasImportar from './locales/fr/ventasImportar.json'
import frRecibo from './locales/fr/recibo.json'
import frRegistroFacturas from './locales/fr/registroFacturas.json'
import frEquiposListos from './locales/fr/equiposListos.json'
import frEquiposAbandonados from './locales/fr/equiposAbandonados.json'
import frHistorialTecnicos from './locales/fr/historialTecnicos.json'
import frTecnicoDetalle from './locales/fr/tecnicoDetalle.json'
import frActividad from './locales/fr/actividad.json'
import frFacturacion from './locales/fr/facturacion.json'
import frGastos from './locales/fr/gastos.json'
import frCajaChica from './locales/fr/cajaChica.json'

export const NAMESPACES = [
  'common', 'login', 'dashboard', 'configuracion', 'inventario', 'ventas',
  'compras', 'contabilidad', 'rrhh', 'taller', 'reportes', 'clientes', 'ordenes', 'checklist',
  'pos', 'backoffice', 'facturarOts', 'ventasUnidades', 'ventasCategorias', 'ventasImportar',
  'recibo', 'registroFacturas', 'equiposListos', 'equiposAbandonados', 'historialTecnicos',
  'tecnicoDetalle', 'actividad', 'facturacion', 'gastos', 'cajaChica',
]

export const IDIOMAS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'fr', label: 'Français' },
]

const resources = {
  es: { common: esCommon, login: esLogin, dashboard: esDashboard, configuracion: esConfiguracion, inventario: esInventario, ventas: esVentas, compras: esCompras, contabilidad: esContabilidad, rrhh: esRrhh, taller: esTaller, reportes: esReportes, clientes: esClientes, ordenes: esOrdenes, checklist: esChecklist, pos: esPos, backoffice: esBackoffice, facturarOts: esFacturarOts, ventasUnidades: esVentasUnidades, ventasCategorias: esVentasCategorias, ventasImportar: esVentasImportar, recibo: esRecibo, registroFacturas: esRegistroFacturas, equiposListos: esEquiposListos, equiposAbandonados: esEquiposAbandonados, historialTecnicos: esHistorialTecnicos, tecnicoDetalle: esTecnicoDetalle, actividad: esActividad, facturacion: esFacturacion, gastos: esGastos, cajaChica: esCajaChica },
  en: { common: enCommon, login: enLogin, dashboard: enDashboard, configuracion: enConfiguracion, inventario: enInventario, ventas: enVentas, compras: enCompras, contabilidad: enContabilidad, rrhh: enRrhh, taller: enTaller, reportes: enReportes, clientes: enClientes, ordenes: enOrdenes, checklist: enChecklist, pos: enPos, backoffice: enBackoffice, facturarOts: enFacturarOts, ventasUnidades: enVentasUnidades, ventasCategorias: enVentasCategorias, ventasImportar: enVentasImportar, recibo: enRecibo, registroFacturas: enRegistroFacturas, equiposListos: enEquiposListos, equiposAbandonados: enEquiposAbandonados, historialTecnicos: enHistorialTecnicos, tecnicoDetalle: enTecnicoDetalle, actividad: enActividad, facturacion: enFacturacion, gastos: enGastos, cajaChica: enCajaChica },
  zh: { common: zhCommon, login: zhLogin, dashboard: zhDashboard, configuracion: zhConfiguracion, inventario: zhInventario, ventas: zhVentas, compras: zhCompras, contabilidad: zhContabilidad, rrhh: zhRrhh, taller: zhTaller, reportes: zhReportes, clientes: zhClientes, ordenes: zhOrdenes, checklist: zhChecklist, pos: zhPos, backoffice: zhBackoffice, facturarOts: zhFacturarOts, ventasUnidades: zhVentasUnidades, ventasCategorias: zhVentasCategorias, ventasImportar: zhVentasImportar, recibo: zhRecibo, registroFacturas: zhRegistroFacturas, equiposListos: zhEquiposListos, equiposAbandonados: zhEquiposAbandonados, historialTecnicos: zhHistorialTecnicos, tecnicoDetalle: zhTecnicoDetalle, actividad: zhActividad, facturacion: zhFacturacion, gastos: zhGastos, cajaChica: zhCajaChica },
  fr: { common: frCommon, login: frLogin, dashboard: frDashboard, configuracion: frConfiguracion, inventario: frInventario, ventas: frVentas, compras: frCompras, contabilidad: frContabilidad, rrhh: frRrhh, taller: frTaller, reportes: frReportes, clientes: frClientes, ordenes: frOrdenes, checklist: frChecklist, pos: frPos, backoffice: frBackoffice, facturarOts: frFacturarOts, ventasUnidades: frVentasUnidades, ventasCategorias: frVentasCategorias, ventasImportar: frVentasImportar, recibo: frRecibo, registroFacturas: frRegistroFacturas, equiposListos: frEquiposListos, equiposAbandonados: frEquiposAbandonados, historialTecnicos: frHistorialTecnicos, tecnicoDetalle: frTecnicoDetalle, actividad: frActividad, facturacion: frFacturacion, gastos: frGastos, cajaChica: frCajaChica },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    supportedLngs: ['es', 'en', 'zh', 'fr'],
    ns: NAMESPACES,
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'rcp_idioma',
    },
  })

export default i18n
