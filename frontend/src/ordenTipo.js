// Las órdenes de taller se procesan bajo dos flujos distintos según el
// equipo: CCA (celulares/tablets) y COM (computadoras/otros). Cada tipo
// tiene sus propios campos técnicos y su propio checklist de salida —
// no deben tratarse de forma genérica. Debe reflejar backend/core/choices.py.
export const CATEGORIAS_CCA = ['CELULAR', 'TABLET']
export const CATEGORIAS_COM = ['COMPUTADORA', 'OTRO']

export const esCCA = (categoriaEquipo) => CATEGORIAS_CCA.includes(categoriaEquipo)

export const tipoOrden = (categoriaEquipo) => (esCCA(categoriaEquipo) ? 'CCA' : 'COM')

// Checklist de salida para celulares/tablets (CCA): claves = ns 'ordenes', checklistSalida.*
export const CHECKLIST_SALIDA_CCA = [
  'Carga', 'Llamadas', 'Red móvil', 'WiFi', 'Limpieza', 'Cámara frontal', 'Cámara trasera',
  'Micrófono', 'Auricular', 'Speaker', 'Brillo', 'Cuentas', 'Accesorios',
]

// Checklist de salida para computadoras/otros (COM): claves = ns 'checklist', items.*
export const CHECKLIST_SALIDA_COM = [
  'carga', 'mousepad', 'microfono', 'pantallaBrillo', 'puertoCarga', 'teclado', 'auricular',
  'puntosPixelesMuertos', 'puertosUsb', 'botonPower', 'speakers', 'lineasManchas', 'puertosHdmi',
  'huella', 'jackAudio', 'tactil', 'camaras', 'wifi', 'sensores', 'fanCoolers', 'leds',
  'bluetooth', 'bisagras', 'apagarEncender',
]

export const checklistSalidaPara = (categoriaEquipo) =>
  esCCA(categoriaEquipo) ? CHECKLIST_SALIDA_CCA : CHECKLIST_SALIDA_COM

// Vista simplificada de 3 estados para el tablero del taller (los técnicos
// no necesitan ver los 9 estados detallados que usa Backoffice/Recepción).
export const ESTADO_SIMPLE_MAP = {
  RECIBIDO: 'EN_ESPERA',
  DIAGNOSTICO: 'EN_PROCESO',
  ESPERANDO_AUTORIZACION: 'EN_PROCESO',
  EN_REPARACION: 'EN_PROCESO',
  IMPORTACION: 'EN_PROCESO',
  REINGRESO: 'EN_PROCESO',
  LISTO_ENTREGA: 'TERMINADO',
  ENTREGADO: 'TERMINADO',
  CANCELADO: 'TERMINADO',
}
export const ESTADOS_SIMPLES = ['EN_ESPERA', 'EN_PROCESO', 'TERMINADO']
export const estadoSimplificado = (estado) => ESTADO_SIMPLE_MAP[estado] || 'EN_ESPERA'
