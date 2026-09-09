import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'
import logo from '../assets/rcp-logo.png'
import { esCCA, tipoOrden, checklistSalidaPara } from '../ordenTipo.js'
import { siluetaPara, VISTAS_POR_TIPO } from './orden/DanosVisibles.jsx'
import { tallerApi } from '../api.js'

// Duplicado localmente (no importado de OrdenTrabajo.jsx) para evitar
// dependencia circular: OrdenTrabajo.jsx ya importa este componente.
const COMO_SUPO_VALUES = ['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'LINKEDIN', 'SMS', 'RADIO', 'EMAIL', 'REFERIDO', 'MANTA_ROTULO', 'GOOGLE', 'RECURRENTE', 'OTRO']
const SIMBOLO = { USD: 'US$', NIO: 'C$' }
const SD = '—'
const SI_NO = (v, t) => (v === true ? t('impresion.si') : v === false ? t('impresion.no') : SD)

// Convierte un grupo de checklist ({item: valor}) en una sola línea
// compacta "Etiqueta: Valor · Etiqueta: Valor…" en vez de una fila por
// ítem — así 5-14 ítems caben en 1-2 líneas de texto, no en una grilla.
// En el papel impreso el técnico va solo con inicial + un apellido (ej.
// "Jorge Eliezer Montiel Medina" -> "J. Montiel"), no el nombre completo —
// el nombre completo se guarda igual, esto es nada más para lo impreso.
// Asume el formato nicaragüense típico: nombre(s) + dos apellidos al
// final; con 2 palabras (un nombre, un apellido) usa la última tal cual.
function nombreCorto(nombreCompleto) {
  const palabras = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return ''
  if (palabras.length === 1) return palabras[0]
  const inicial = palabras[0][0].toUpperCase() + '.'
  const apellido = palabras.length >= 3 ? palabras[palabras.length - 2] : palabras[palabras.length - 1]
  return `${inicial} ${apellido}`
}

function resumenChecklist(valores, items, labelFn, valorFn) {
  return items
    .filter((item) => valores?.[item] !== undefined && valores[item] !== null && valores[item] !== '')
    .map((item) => `${labelFn(item)}: ${valorFn(valores[item])}`)
    .join(' · ')
}

// Casilla estilo formulario en papel: ☒/☐ + etiqueta, para que el SI/NO
// se vea como una casilla marcada en vez de solo texto.
function Casilla({ marcado, children }) {
  return <span className={`op-casilla${marcado ? ' op-on' : ''}`}>{marcado ? '☒' : '☐'} {children}</span>
}

function OrdenPreview({ orden, cliente, empresaNombre, onClose }) {
  const { t } = useTranslation(['ordenes', 'checklist', 'common'])
  const [generandoPdf, setGenerandoPdf] = useState(false)
  if (!orden) return null

  const verPdf = () => {
    setGenerandoPdf(true)
    tallerApi.verPdfOrden(orden.id).finally(() => setGenerandoPdf(false))
  }

  const esCelular = esCCA(orden.categoria_equipo)
  const tipo = tipoOrden(orden.categoria_equipo)
  const simbolo = SIMBOLO[orden.moneda] || 'US$'
  const detalle = orden.detalle_com || {}

  const repuestos = orden.repuestos || []
  const servicios = orden.servicios_realizados || []
  const totalRepuestos = repuestos.reduce((s, r) => s + Number(r.precio || 0), 0)
  const totalServicios = servicios.reduce((s, r) => s + Number(r.precio || 0), 0)
  const baseTotal = (totalRepuestos + totalServicios) > 0 ? (totalRepuestos + totalServicios) : Number(orden.costo_estimado || 0)
  const totalFinal = baseTotal - Number(orden.descuento || 0) + Number(orden.impuestos || 0)

  const marcaModelo = [orden.marca, orden.modelo].filter(Boolean).join(' ') || SD
  const serieImei = esCelular
    ? [orden.imei1 && `IMEI1: ${orden.imei1}`, orden.imei2 && `IMEI2: ${orden.imei2}`, orden.numero_chip && `${t('campos.numeroChip')}: ${orden.numero_chip}`].filter(Boolean).join(' · ') || SD
    : (orden.no_serie || SD)
  const encendidoTxt = orden.encendido ? t(`estadoEncendido.${orden.encendido}`) : SD
  const contrasenaTxt = orden.sin_contrasena ? t('campos.sinContrasena') : (orden.contrasena_equipo || SD)
  // Mismo número en la X del diagrama y en la lista de abajo — antes el
  // papel solo mostraba una X pelada en cada marca y todas las notas
  // amontonadas en un solo párrafo, sin forma de saber cuál nota era cuál
  // daño. El orden es por vista (mismo orden que las pestañas del
  // formulario) y dentro de cada vista, el orden en que se marcaron.
  const danosOrdenados = (VISTAS_POR_TIPO[tipo] || VISTAS_POR_TIPO.CCA)
    .flatMap((v) => (orden.danos_visibles || []).filter((p) => p.vista === v))
  const fechaHora = orden.fecha_hora_recepcion ? new Date(orden.fecha_hora_recepcion).toLocaleString() : SD

  const tiposServicioTxt = (orden.tipos_servicio || [])
    .map((s) => (s === 'OTRO' && orden.tipos_servicio_otro ? orden.tipos_servicio_otro : t(`tipoServicio.${s}`, s)))
    .join(' · ')

  const accesoriosDetalleTxt = (detalle.accesorios_detalle || [])
    .filter((a) => a.nombre?.trim())
    .map((a) => `${a.nombre}${a.estado ? ` (${a.estado}` : ''}${a.serial ? `${a.estado ? ', ' : ' ('}${a.serial}` : ''}${(a.estado || a.serial) ? ')' : ''}`)
    .join(' · ')

  const componentesTxt = resumenChecklist(
    detalle.componentes,
    ['bateria', 'cargador', 'adaptador', 'receptor_inalambrico', 'camara', 'microfono', 'wifi', 'bluetooth', 'usb', 'hdmi', 'ethernet', 'audio', 'lector_sd', 'otros'],
    (i) => t(`com.componentesItems.${i}`), (v) => t(`com.estadoComponente.${v}`),
  )
  const softwareTxt = [
    orden.sistema_operativo && `${t('campos.sistemaOperativo')}: ${orden.sistema_operativo}`,
    detalle.software?.version && `${t('com.softwareVersion')}: ${detalle.software.version}`,
    detalle.software?.licencia && `${t('com.softwareLicencia')}: ${detalle.software.licencia}`,
    detalle.software?.office && `${t('com.softwareOffice')}: ${detalle.software.office}`,
    detalle.software?.antivirus && `${t('com.softwareAntivirus')}: ${detalle.software.antivirus}`,
    detalle.software?.programas && `${t('com.softwareProgramas')}: ${detalle.software.programas}`,
  ].filter(Boolean).join(' · ')

  // Checklist técnico de entrada/salida: mismo set de ítems para ambos
  // (igual que en la hoja de papel), uno marcado al ingresar el equipo y
  // el otro al momento de entregarlo ya reparado.
  const checklistNs = esCelular ? 'ordenes' : 'checklist'
  const checklistPrefix = esCelular ? 'checklistSalida' : 'items'
  const checklistItems = checklistSalidaPara(orden.categoria_equipo)
  const checklistEntradaVals = orden.checklist_entrada || {}
  const checklistSalidaVals = orden.checklist_salida || {}

  const vistasDanos = VISTAS_POR_TIPO[tipo] || VISTAS_POR_TIPO.CCA
  const etiquetaVista = (v) => ({
    FRENTE: t('widgets.danos.frente'), ATRAS: t('widgets.danos.atras'),
    LATERAL_IZQ: t('widgets.danos.lateralIzq'), LATERAL_DER: t('widgets.danos.lateralDer'),
  }[v] || v)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, maxHeight: '92vh' }}>
        <div className="orden-print">
          <div className="orden-print-header">
            <img src={logo} alt="RCP" />
            <div className="orden-print-header-titulo">
              <h2>{t('titulo.existente')} <span className="orden-print-badge">{tipo}</span></h2>
              <div className="orden-print-header-meta">
                {t('campos.tecnicoAsignado')}: <strong>{orden.tecnico_nombre ? nombreCorto(orden.tecnico_nombre) : SD}</strong> · {t('titulo.otNo')} <strong className="op-hl">{orden.numero}</strong> · {orden.estado_display || t(`estadosOrden.${orden.estado}`, { ns: 'common' })}
              </div>
            </div>
          </div>

          {/* ===== 1.- DATOS GENERALES DEL CLIENTE ===== */}
          <div className="op-seccion">
            <div className="op-seccion-titulo">1.- {t('secciones.datosCliente')}</div>
            <div className="op-seccion-body">
              <div className="op-row">
                <div><span className="lbl">{t('campos.cliente')}:</span> <span className="val">{cliente?.nombre || orden.cliente_nombre || SD}</span></div>
                <div><span className="lbl">{t('campos.cedula')}:</span> <span className="val">{cliente?.cedula || SD}</span></div>
              </div>
              <div className="op-row">
                <Casilla marcado={!!(cliente?.empresa || empresaNombre)}>{t('impresion.empresaLabel')}</Casilla>
                <div><span className="lbl">{t('campos.correoElectronico')}:</span> <span className="val">{cliente?.email || SD}</span></div>
                <div><span className="lbl">{t('campos.fechaHoraRecepcion')}:</span> <span className="val">{fechaHora}</span></div>
              </div>
              {!esCelular && (
                <div className="op-row">
                  <Casilla marcado={detalle.empresa_controla_software === true}>{t('com.empresaControlaSoftware')}</Casilla>
                  <div><span className="lbl">{t('campos.ruc')}:</span> <span className="val">{cliente?.documento || SD}</span></div>
                </div>
              )}
              <div className="op-row">
                <div><span className="lbl">{t('campos.telefono')}:</span> <span className="val">{cliente?.telefono || SD}{cliente?.telefono2 ? ` / ${cliente.telefono2}` : ''}</span></div>
                <Casilla marcado={cliente?.operadora === 'CLARO'}>{t('operadora.CLARO')}</Casilla>
                <Casilla marcado={cliente?.operadora === 'TIGO'}>{t('operadora.TIGO')}</Casilla>
                <Casilla marcado={!!cliente?.whatsapp}>{t('impresion.whatsapp')}</Casilla>
              </div>
              <div className="op-row">
                <div><span className="lbl">{t('impresion.servicio')}:</span> <span className="val">{tiposServicioTxt || SD}</span></div>
                <div><span className="lbl">{t('impresion.valorUsd')}:</span> <span className="val">{simbolo}{Number(orden.costo_estimado || 0).toLocaleString()}</span></div>
                <div><span className="lbl">{t('impresion.adelanto')}:</span> <span className="val">{simbolo}{Number(orden.adelanto || 0).toLocaleString()}</span></div>
                <div><span className="lbl">{t('impresion.factRecibo')}:</span> <span className="val">{orden.factura_numero || SD}</span></div>
              </div>
              <div className="op-row" style={{ marginTop: 3, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <span className="lbl" style={{ display: 'block', marginBottom: 1 }}>{t('com.comoSupoLabel')}</span>
                  <div className="op-checkgrid">
                    {COMO_SUPO_VALUES.map((v) => (
                      <Casilla key={v} marcado={orden.como_supo === v}>{t(`com.comoSupo.${v}`)}</Casilla>
                    ))}
                  </div>
                </div>
                {!esCelular && (
                  <div>
                    <span className="lbl" style={{ display: 'block', marginBottom: 1 }}>{t('com.primeraVez')}</span>
                    <Casilla marcado={detalle.primera_vez === true}>{t('impresion.si')}</Casilla>{' '}
                    <Casilla marcado={detalle.primera_vez === false}>{t('impresion.no')}</Casilla>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="orden-print-texto" style={{ columnCount: 1 }}>
            <h4>{t('legal.diagnosticoTitulo', { ns: 'checklist' })}</h4>
            <p>{t('legal.diagnosticoA', { ns: 'checklist' })}</p>
            <p>{t('legal.diagnosticoB', { ns: 'checklist' })}</p>
            <p>{t('legal.diagnosticoC', { ns: 'checklist' })}</p>
          </div>

          {/* ===== 2.- DETALLES DE RECEPCIÓN ===== */}
          <div className="op-seccion">
            <div className="op-seccion-titulo">
              2.- {t('secciones.detallesRecepcion')}
              {!esCelular && <span className="op-hl op-hl-right">{t('com.bitlockerEstado')}: {SI_NO(detalle.bitlocker_activo, t)}</span>}
            </div>
            <div className="op-seccion-body">
              <div className="orden-print-grid" style={{ margin: '2px 0' }}>
                <div className="orden-print-box">
                  <h4>{t('campos.equipoRecibido')}</h4>
                  <div className="orden-print-fila"><span>{t('campos.equipoRecibido')}</span><span>{orden.equipo || SD}</span></div>
                  <div className="orden-print-fila"><span>{t('campos.marca')} / {t('campos.modelo')}</span><span>{marcaModelo}</span></div>
                  {!esCelular && <div className="orden-print-fila"><span>{t('com.procesador')}</span><span>{detalle.procesador_generacion || SD}</span></div>}
                  <div className="orden-print-fila"><span>{t('campos.color')}</span><span>{orden.color || SD}{orden.capacidad ? ` · ${orden.capacidad}` : ''}</span></div>
                  <div className="orden-print-fila"><span>{esCelular ? 'IMEI' : t('campos.numeroSerie')}</span><span>{serieImei}</span></div>
                </div>
                <div className="orden-print-box">
                  <h4>{t('campos.estadoEquipo')}</h4>
                  <div className="orden-print-fila"><span>{t('campos.estadoEquipo')}</span><span>{orden.estado_general ? t(`estadoEquipo.${orden.estado_general}`) : SD}</span></div>
                  <div className="orden-print-fila"><span>{t('campos.encendido')}</span><span>{encendidoTxt}</span></div>
                  <div className="orden-print-fila"><span>{t('campos.bateriaOriginal')}</span><span>{SI_NO(orden.bateria_original, t)}</span></div>
                  {!esCelular && <div className="orden-print-fila"><span>{t('com.compradoNuevo')}</span><span>{SI_NO(detalle.comprado_nuevo, t)}</span></div>}
                  {esCelular && <div className="orden-print-fila"><span>{t('campos.camaraFunciona')}</span><span>{SI_NO(orden.camara_funciona, t)}</span></div>}
                </div>
                {!esCelular && (
                  <div className="orden-print-box">
                    <h4>{t('com.especificacionesTitulo')}</h4>
                    <div className="orden-print-fila"><span>{t('com.ramTipo')} / {t('com.ramFrecuencia')}</span><span>{detalle.ram_tipo || SD}{detalle.ram_frecuencia ? ` / ${detalle.ram_frecuencia}` : ''}</span></div>
                    <div className="orden-print-fila"><span>{t('com.ramSlots')}</span><span>{detalle.ram_slots || SD}</span></div>
                    <div className="orden-print-fila"><span>{t('com.discoCapacidad')} / {t('com.tipoAlmacenamiento')}</span><span>{detalle.disco_capacidad || SD}{detalle.tipo_almacenamiento ? ` / ${detalle.tipo_almacenamiento}` : ''}</span></div>
                    <div className="orden-print-fila"><span>{t('com.marcaDisco')}</span><span>{detalle.marca_disco || SD}</span></div>
                    <div className="orden-print-fila"><span>{t('com.serialDisco')} / {t('com.tipoConector')}</span><span>{detalle.serial_disco || SD}{detalle.tipo_conector ? ` / ${detalle.tipo_conector}` : ''}</span></div>
                  </div>
                )}
              </div>

              {(componentesTxt || softwareTxt) && (
                <div className="orden-print-texto" style={{ columnCount: 1 }}>
                  {componentesTxt && <p><strong>{t('com.componentesTitulo')}:</strong> {componentesTxt}</p>}
                  {softwareTxt && <p><strong>{t('com.softwareTitulo')}:</strong> {softwareTxt}</p>}
                </div>
              )}

              <div className="op-row" style={{ marginTop: 3 }}>
                <div style={{ flex: 1 }}>
                  <span className="lbl">{esCelular ? t('impresion.accesorios') : t('com.accesoriosDetalleTitulo')}:</span>{' '}
                  <span className="val">{(esCelular ? orden.accesorios : accesoriosDetalleTxt) || SD}</span>
                </div>
                {!esCelular && (
                  <>
                    <Casilla marcado={detalle.respaldo_solicitado === true}>{t('com.respaldoSolicitado')}</Casilla>
                  </>
                )}
              </div>
              {!esCelular && (
                <p className="op-nota">{t('legal.notasRespaldos', { ns: 'checklist' })}</p>
              )}

              <div className="op-row" style={{ alignItems: 'flex-start', marginTop: 3 }}>
                <div style={{ flex: 1 }}>
                  <div><span className="lbl">{t('campos.contrasena')}:</span> <span className="val">{contrasenaTxt}</span></div>
                  <p className="op-nota">{t('legal.notasContrasena', { ns: 'checklist' })}</p>
                  <span className="op-hl" style={{ display: 'inline-block', marginTop: 2 }}>{t('impresion.noGarantiaSoftware')}</span>
                </div>
                <div className="op-danos">
                  <span className="lbl" style={{ display: 'block', marginBottom: 2 }}>{t('impresion.danosVisiblesTitulo')}</span>
                  <div className="op-danos-row">
                    {vistasDanos.map((v) => (
                      <div className="op-danos-item" key={v}>
                        <svg viewBox="0 0 160 240">
                          {siluetaPara(tipo, v)}
                          {(orden.danos_visibles || []).filter((p) => p.vista === v).map((p, i) => (
                            <g key={p.id || i}>
                              <line x1={p.x - 6} y1={p.y - 6} x2={p.x + 6} y2={p.y + 6} stroke="#dc2626" strokeWidth="4" />
                              <line x1={p.x - 6} y1={p.y + 6} x2={p.x + 6} y2={p.y - 6} stroke="#dc2626" strokeWidth="4" />
                              <circle cx={p.x + 8} cy={p.y - 8} r="6.5" fill="#dc2626" />
                              <text x={p.x + 8} y={p.y - 5.5} textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#fff">{danosOrdenados.indexOf(p) + 1}</text>
                            </g>
                          ))}
                        </svg>
                        <span>{etiquetaVista(v)}</span>
                      </div>
                    ))}
                  </div>
                  {danosOrdenados.length > 0 && (
                    <div className="op-danos-lista">
                      {danosOrdenados.map((d, i) => (
                        <div key={d.id || i} className="op-danos-lista-item">
                          <span className="op-danos-num">{i + 1}</span>
                          <span>{d.nota?.trim() || t('impresion.danoSinNota')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="orden-print-texto" style={{ columnCount: 1 }}>
            <h4>{t('legal.ingresoTitulo', { ns: 'checklist' })}</h4>
            <p>{t('legal.ingreso', { ns: 'checklist' })}</p>
            <p>{t('legal.ingreso2', { ns: 'checklist' })}</p>
            <p>{t('legal.ingreso3', { ns: 'checklist' })}</p>
            <p>{t('legal.ingreso4', { ns: 'checklist' })}</p>
            <p>{t('legal.ingresoNota', { ns: 'checklist' })}</p>
            <p>{t('legal.notasFallasOcultas', { ns: 'checklist' })}</p>
          </div>

          {/* ===== 3.- DIAGNÓSTICO Y PRESUPUESTO ===== */}
          <div className="op-seccion">
            <div className="op-seccion-titulo">3.- {t('secciones.diagnosticoPresupuesto')}</div>
            <div className="op-seccion-body">
              <div className="op-row" style={{ display: 'block' }}>
                {orden.problema_reportado && <p className="op-nota"><strong>{t('campos.fallaReportada')}:</strong> {orden.problema_reportado}</p>}
                {orden.comentarios && <p className="op-nota"><strong>{t('campos.comentarios')}:</strong> {orden.comentarios}</p>}
                {orden.diagnostico && <p className="op-nota"><strong>{t('campos.diagnostico')}:</strong> {orden.diagnostico}</p>}
                {orden.recomendaciones && <p className="op-nota"><strong>{t('campos.recomendaciones')}:</strong> {orden.recomendaciones}</p>}
              </div>

              <div className="op-checklist-doble">
                {orden.equipo_apagado_recepcion && (
                  <p className="op-nota">{t('campos.checklistNoAplicaApagado')}</p>
                )}
                <h5 className="op-checklist-titulo op-checklist-titulo-entrada">{t('subtitulos.checklistEntrada')}</h5>
                <div className="op-checklist-grid">
                  {checklistItems.map((item) => (
                    <span className={`op-checklist-grid-item ${checklistEntradaVals[item] ? 'on' : ''}`} key={`e-${item}`}>
                      {checklistEntradaVals[item] ? '☒' : '☐'} {t(`${checklistPrefix}.${item}`, { ns: checklistNs })}
                    </span>
                  ))}
                </div>
                <h5 className="op-checklist-titulo op-checklist-titulo-salida">{t('subtitulos.checklistSalida')}</h5>
                <div className="op-checklist-grid">
                  {checklistItems.map((item) => (
                    <span className={`op-checklist-grid-item salida ${checklistSalidaVals[item] ? 'on' : ''}`} key={`s-${item}`}>
                      {checklistSalidaVals[item] ? '☒' : '☐'} {t(`${checklistPrefix}.${item}`, { ns: checklistNs })}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {(repuestos.length > 0 || servicios.length > 0) && (
            <table className="orden-print-tabla">
              <thead>
                <tr><th>{t('tabla.descripcion')}</th><th>{t('tabla.tipo')}</th><th>{t('tabla.precio')}</th></tr>
              </thead>
              <tbody>
                {repuestos.map((r, i) => (
                  <tr key={`r${i}`}><td>{r.descripcion}</td><td>{t(`tipoRepuesto.${r.tipo}`, r.tipo)}</td><td>{simbolo}{Number(r.precio || 0).toLocaleString()}</td></tr>
                ))}
                {servicios.map((s, i) => (
                  <tr key={`s${i}`}><td>{s.descripcion}</td><td>{t('subtitulos.serviciosRealizados')}</td><td>{simbolo}{Number(s.precio || 0).toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="orden-print-total">
            <span>
              {t('campos.formaPago')}: {orden.forma_pago ? t(`formaPago.${orden.forma_pago}`) : SD}
              {(Number(orden.descuento) > 0 || Number(orden.impuestos) > 0) && ` · ${t('campos.descuento')}: ${simbolo}${Number(orden.descuento || 0).toLocaleString()} · ${t('campos.impuestos')}: ${simbolo}${Number(orden.impuestos || 0).toLocaleString()}`}
              {orden.repuesto_inmediato && ` · ${t('campos.repuestoInmediato')}`}
            </span>
            <strong>{t('impresion.totalOrden')}: {simbolo}{totalFinal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          </div>

          {/* ===== 4.- ACEPTACIÓN, RESPONSABLES Y ENTREGA FINAL ===== */}
          <div className="op-seccion">
            <div className="op-seccion-titulo">4.- {t('impresion.aceptacionResponsablesEntrega')}</div>
            <div className="op-seccion-body">
              <div className="op-row">
                <div><span className="lbl">{t('impresion.fechaHoraEntrega')}:</span> <span className="val">{orden.fecha_entrega_real || orden.fecha_entrega_estimada || SD}</span></div>
                <div><span className="lbl">{t('impresion.recibeTecnicoEntrega')}:</span> <span className="val">{orden.recibe || SD} / {orden.tecnico_nombre ? nombreCorto(orden.tecnico_nombre) : SD}</span></div>
                <div><span className="lbl">{t('campos.asesorAsignado')}:</span> <span className="val">{orden.asesor_nombre || SD}</span></div>
                {orden.tiempo_reparacion_estimado && <div><span className="lbl">{t('campos.tiempoReparacionEstimado')}:</span> <span className="val">{orden.tiempo_reparacion_estimado}</span></div>}
              </div>
              {orden.observaciones && <p className="op-nota"><strong>{t('secciones.observaciones')}:</strong> {orden.observaciones}</p>}

              <div className="orden-print-firmas" style={{ marginTop: 3 }}>
                <div className="orden-print-firma-box">
                  {orden.firma_cliente ? <img src={orden.firma_cliente} alt="" /> : <div className="orden-print-firma-espacio" />}
                  <div className="orden-print-firma-linea">{t('campos.firmaClienteRecepcion')}</div>
                </div>
                <div className="orden-print-firma-box">
                  {orden.firma_cliente_entrega ? <img src={orden.firma_cliente_entrega} alt="" /> : <div className="orden-print-firma-espacio" />}
                  <div className="orden-print-firma-linea">{t('campos.firmaClienteEntrega')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== 5.- OTROS ===== */}
          <div className="orden-print-clausulas" style={{ columnCount: 1 }}>
            <h3>5.- {t('impresion.otros')} — {t('legal.garantiaTitulo', { ns: 'checklist' })}</h3>
            <p>{t('legal.garantia', { ns: 'checklist' })}</p>
            <p>{t('legal.garantia2', { ns: 'checklist' })}</p>
            <p>{t('legal.garantia3', { ns: 'checklist' })}</p>
            <p>{t('legal.garantiaNota', { ns: 'checklist' })}</p>
          </div>

          <div className="op-footer">
            {t('impresion.footerEquipos')} · {t('impresion.footerPartners')} · {t('impresion.footerContacto')}: 8880 8260 / 7553 0443
          </div>
        </div>

        <div className="form-row no-print" style={{ marginTop: 16 }}>
          {/* Antes había un botón "Imprimir" separado que hacía
              window.print() directo sobre esta vista en pantalla — ese es
              justo el método que dependía de que el navegador y el driver
              de la impresora se pusieran de acuerdo en el tamaño de hoja
              (la razón por la que existe pdf_orden.py en el backend, ver
              ese archivo). El usuario seguía usando "Imprimir" de todos
              modos y el final de la orden (firmas y garantía) se le
              cortaba en carta. Ahora un solo botón: siempre abre el PDF
              real de tamaño carta fijo, y desde ahí se imprime con el
              ícono de impresora del propio visor de PDF del navegador —
              nunca depende de la negociación de window.print(). */}
          <button onClick={verPdf} disabled={generandoPdf} style={{ flex: 1 }}>
            <Printer size={15} /> {generandoPdf ? t('mensajes.cargando', { ns: 'common' }) : t('botones.verEImprimir', { ns: 'common' })}
          </button>
          <button className="secondary" onClick={onClose}>{t('botones.cerrar', { ns: 'common' })}</button>
        </div>
        <p className="no-print" style={{ marginTop: 6, fontSize: 12, color: 'var(--text)' }}>{t('impresion.avisoAbrePdf')}</p>
      </div>
    </div>
  )
}

export default OrdenPreview
