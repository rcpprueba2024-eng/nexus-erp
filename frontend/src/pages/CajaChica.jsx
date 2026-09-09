import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, FileSpreadsheet, FileText, Pencil, Lock } from 'lucide-react'
import { cajaChicaApi } from '../api.js'
import Pagination from '../components/Pagination.jsx'

const PAGE_SIZE = 15

const TIPOS_PAGO = ['Efect.', 'Transf.', 'POS', 'Cheque', 'Crédito', 'Credex']
const BANCOS = ['BAC NIO', 'BAC U$', 'LAFISE NIO', 'LAFISE U$', 'FICOHSA NIO', 'FICOHSA U$']

const DENOM_USD = [
  ['billetes_usd_100', 100], ['billetes_usd_50', 50], ['billetes_usd_20', 20],
  ['billetes_usd_10', 10], ['billetes_usd_5', 5], ['billetes_usd_1', 1],
]
const DENOM_NIO = [
  ['billetes_nio_1000', 1000], ['billetes_nio_500', 500], ['billetes_nio_200', 200],
  ['billetes_nio_100', 100], ['billetes_nio_50', 50], ['billetes_nio_20', 20],
  ['billetes_nio_10', 10], ['billetes_nio_5', 5], ['billetes_nio_1', 1],
]

const emptyCredito = { cliente: '', factura: '', ot: '', monto: '', vence: '' }
const emptyIngreso = { descripcion: '', monto: '', tipo: '', banco: '', factura: '', ots: '', vendedor: '', empresa: '' }
const emptyGasto = { descripcion: '', monto: '' }
const emptyVendedorVenta = { vendedor: '', acumulado_semanal: '', semana_anterior: '' }
const emptyVendedorEquipo = { vendedor: '', clientes_atendidos: '', com: '', cca: '', repuestos: '' }

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function emptyForm() {
  const base = {
    fecha: hoyISO(), caja_chica_inicial: '', caja_chica_inicial_cordobas: '',
    pagos_cheque_cierre: '', pagos_transferencia_cierre: '', compras_credex_cierre: '', cierre_pos: '', creditos_cierre: '',
    recibos_caja_utilizados: '', comentarios: '',
    ventas_dia_anterior: '', total_com_anterior: '', total_cca_anterior: '',
    repuestos_uso_interno_anterior: '', rep_acc_insumo_externa_anterior: '', computadoras_anterior: '',
    meta_semanal: '', meta_mensual: '',
    dia_del_mes: '', dias_mes: 30, tipo_cambio: '',
  }
  for (const [k] of DENOM_USD) base[k] = 0
  for (const [k] of DENOM_NIO) base[k] = 0
  return base
}

function emptyApertura() {
  return { fecha: hoyISO(), caja_chica_inicial: '', caja_chica_inicial_cordobas: '', tipo_cambio: '' }
}

// Con cuánto se abre la caja, ya sumado en las dos monedas — la caja chica
// se arma con billetes de ambas, no solo dólares (que es como lo guarda
// internamente la plantilla real, ver backend/caja_chica/models.py). Es
// solo una vista previa en pantalla; lo que se guarda son los dos montos
// por separado.
function totalesApertura(form) {
  const cordobas = Number(form.caja_chica_inicial_cordobas) || 0
  const dolares = Number(form.caja_chica_inicial) || 0
  const tc = Number(form.tipo_cambio) || 0
  if (!tc) return null
  return {
    totalCordobas: cordobas + dolares * tc,
    totalDolares: dolares + cordobas / tc,
  }
}

// Los campos numéricos del modelo (Decimal/Entero) no aceptan '' como valor
// — DRF los rechaza con "Se requiere un número válido." Un campo que el
// usuario dejó en blanco se manda en 0 (o null en tipo_cambio, que sí
// acepta nulo y así toma la tasa de Configuración por defecto).
function sanearNumeros(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => {
    if (k === 'fecha') return [k, v]
    if (v === '' || v === null || v === undefined) return [k, k === 'tipo_cambio' ? null : 0]
    return [k, v]
  }))
}

function CajaChica() {
  const { t } = useTranslation(['cajaChica', 'common'])
  const [arqueos, setArqueos] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(1)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // ---- Modal chico: abrir caja (solo fecha + monto inicial) ----
  const [modalAperturaAbierto, setModalAperturaAbierto] = useState(false)
  const [aperturaForm, setAperturaForm] = useState(emptyApertura())

  // ---- Modal grande: cerrar (caja ya abierta) o editar (caja ya cerrada) ----
  const [modalFormAbierto, setModalFormAbierto] = useState(false)
  const [modo, setModo] = useState('cerrar') // 'cerrar' | 'editar'
  const [arqueoActivoId, setArqueoActivoId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [creditos, setCreditos] = useState([{ ...emptyCredito }])
  const [ingresos, setIngresos] = useState([{ ...emptyIngreso }])
  const [gastos, setGastos] = useState([{ ...emptyGasto }])
  const [ventasVendedor, setVentasVendedor] = useState([0, 1, 2, 3].map(() => ({ ...emptyVendedorVenta })))
  const [equiposVendedor, setEquiposVendedor] = useState([0, 1, 2].map(() => ({ ...emptyVendedorEquipo })))

  const load = () => {
    setLoading(true)
    cajaChicaApi.arqueos().then((r) => setArqueos(r.data)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  // ---- Abrir caja ----
  const abrirModalApertura = () => {
    setAperturaForm(emptyApertura())
    setError('')
    setModalAperturaAbierto(true)
  }

  const guardarApertura = async (e) => {
    e.preventDefault()
    setError('')
    setGuardando(true)
    try {
      await cajaChicaApi.crearArqueo(sanearNumeros(aperturaForm))
      setModalAperturaAbierto(false)
      load()
    } catch (err) {
      if (err?.response?.data?.fecha) {
        setError(t('form.errorFechaDuplicada'))
      } else {
        setError(err?.response?.data ? JSON.stringify(err.response.data) : t('form.errorGenerico'))
      }
    } finally {
      setGuardando(false)
    }
  }

  // ---- Cerrar / Editar (modal grande, comparten formulario) ----
  const precargarFormulario = (a) => {
    setForm({
      fecha: a.fecha, caja_chica_inicial: a.caja_chica_inicial, caja_chica_inicial_cordobas: a.caja_chica_inicial_cordobas,
      pagos_cheque_cierre: a.pagos_cheque_cierre, pagos_transferencia_cierre: a.pagos_transferencia_cierre,
      compras_credex_cierre: a.compras_credex_cierre, cierre_pos: a.cierre_pos, creditos_cierre: a.creditos_cierre,
      recibos_caja_utilizados: a.recibos_caja_utilizados || '', comentarios: a.comentarios || '',
      ventas_dia_anterior: a.ventas_dia_anterior, total_com_anterior: a.total_com_anterior, total_cca_anterior: a.total_cca_anterior,
      repuestos_uso_interno_anterior: a.repuestos_uso_interno_anterior, rep_acc_insumo_externa_anterior: a.rep_acc_insumo_externa_anterior,
      computadoras_anterior: a.computadoras_anterior,
      meta_semanal: a.meta_semanal, meta_mensual: a.meta_mensual,
      dia_del_mes: a.dia_del_mes, dias_mes: a.dias_mes, tipo_cambio: a.tipo_cambio,
      ...Object.fromEntries([...DENOM_USD, ...DENOM_NIO].map(([k]) => [k, a[k]])),
    })
    setCreditos(a.creditos && a.creditos.length > 0 ? a.creditos : [{ ...emptyCredito }])
    setIngresos(a.ingresos_ventas && a.ingresos_ventas.length > 0 ? a.ingresos_ventas : [{ ...emptyIngreso }])
    setGastos(a.gastos_caja_chica && a.gastos_caja_chica.length > 0 ? a.gastos_caja_chica : [{ ...emptyGasto }])
    setVentasVendedor([0, 1, 2, 3].map((i) => (a.ventas_por_vendedor || [])[i] || { ...emptyVendedorVenta }))
    setEquiposVendedor([0, 1, 2].map((i) => (a.equipos_por_vendedor || [])[i] || { ...emptyVendedorEquipo }))
  }

  const abrirCierre = (a) => {
    setModo('cerrar')
    setArqueoActivoId(a.id)
    precargarFormulario(a)
    setError('')
    setModalFormAbierto(true)
  }

  const abrirEdicion = (a) => {
    setModo('editar')
    setArqueoActivoId(a.id)
    precargarFormulario(a)
    setError('')
    setModalFormAbierto(true)
  }

  // ---- helpers genéricos para las tablas dinámicas ----
  const addRow = (setter, empty, max) => setter((rows) => (rows.length >= max ? rows : [...rows, { ...empty }]))
  const updRow = (setter, i, patch) => setter((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const delRow = (setter, i) => setter((rows) => rows.filter((_, idx) => idx !== i))

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    setGuardando(true)
    const limpiar = (arr, requiredKey) => arr.filter((r) => (r[requiredKey] || '').toString().trim() !== '')
    const payload = {
      ...sanearNumeros(form),
      creditos: limpiar(creditos, 'cliente'),
      ingresos_ventas: limpiar(ingresos, 'descripcion'),
      gastos_caja_chica: limpiar(gastos, 'descripcion'),
      ventas_por_vendedor: ventasVendedor.filter((v) => (v.vendedor || '').trim() !== ''),
      equipos_por_vendedor: equiposVendedor.filter((v) => (v.vendedor || '').trim() !== ''),
    }
    // Una caja "cerrando" pasa de ABIERTA a CERRADA en este mismo guardado
    // (ver caja_chica/views.py ArqueoCajaViewSet.perform_update) — al editar
    // una ya cerrada no se toca el estado.
    if (modo === 'cerrar') payload.estado = 'CERRADA'
    try {
      await cajaChicaApi.actualizarArqueo(arqueoActivoId, payload)
      setModalFormAbierto(false)
      setArqueoActivoId(null)
      load()
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data) : t('form.errorGenerico'))
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = (id) => {
    if (!window.confirm(t('confirmarEliminar'))) return
    cajaChicaApi.eliminarArqueo(id).then(load)
  }

  const visibles = arqueos.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={abrirModalApertura}><Plus size={15} /> {t('botonAbrir')}</button>
      </div>

      <div className="card">
        {loading && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
        {!loading && arqueos.length === 0 && <div className="empty">{t('vacio')}</div>}
        {!loading && arqueos.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>{t('columnas.fecha')}</th>
                <th>{t('columnas.estado')}</th>
                <th>{t('columnas.cajaChicaInicial')}</th>
                <th>{t('columnas.cierrePos')}</th>
                <th>{t('columnas.creadoPor')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((a) => {
                const abierta = a.estado === 'ABIERTA'
                return (
                  <tr key={a.id}>
                    <td>{a.fecha}</td>
                    <td>
                      {abierta
                        ? <span className="badge pending">{t('estado.ABIERTA')}</span>
                        : <span className="badge ok">{t('estado.CERRADA')}</span>}
                    </td>
                    <td>${Number(a.caja_chica_inicial).toLocaleString()}</td>
                    <td>{abierta ? '—' : `$${Number(a.cierre_pos).toLocaleString()}`}</td>
                    <td>{a.creado_por_nombre || '—'}</td>
                    <td className="actions">
                      {abierta ? (
                        <button onClick={() => abrirCierre(a)}><Lock size={14} /> {t('botonCerrar')}</button>
                      ) : (
                        <>
                          <button className="secondary" onClick={() => abrirEdicion(a)}><Pencil size={14} /> {t('botones.editar', { ns: 'common' })}</button>
                          <button className="secondary" onClick={() => cajaChicaApi.verPdfArqueo(a.id)}><FileText size={14} /> {t('pdf')}</button>
                          <button className="secondary" onClick={() => cajaChicaApi.exportarArqueoExcel(a.id, a.fecha)}><FileSpreadsheet size={14} /> {t('excel')}</button>
                        </>
                      )}
                      <button className="danger" onClick={() => eliminar(a.id)}>{t('botones.eliminar', { ns: 'common' })}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {!loading && arqueos.length > 0 && (
          <Pagination page={pagina} totalItems={arqueos.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />
        )}
      </div>

      {/* ---- Modal: abrir caja ---- */}
      {modalAperturaAbierto && (
        <div className="modal-backdrop" onClick={() => !guardando && setModalAperturaAbierto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 4 }}>{t('apertura.titulo')}</h3>
            <p style={{ marginTop: 0, marginBottom: 14, color: 'var(--text)', fontSize: 13 }}>{t('apertura.subtitulo')}</p>
            <form onSubmit={guardarApertura}>
              <div className="form-row">
                <input type="date" value={aperturaForm.fecha} onChange={(e) => setAperturaForm({ ...aperturaForm, fecha: e.target.value })} required />
              </div>
              <div className="form-row">
                <input type="number" step="0.01" placeholder={t('form.cajaChicaInicialCordobas')} value={aperturaForm.caja_chica_inicial_cordobas} onChange={(e) => setAperturaForm({ ...aperturaForm, caja_chica_inicial_cordobas: e.target.value })} autoFocus />
                <input type="number" step="0.01" placeholder={t('form.cajaChicaInicialDolares')} value={aperturaForm.caja_chica_inicial} onChange={(e) => setAperturaForm({ ...aperturaForm, caja_chica_inicial: e.target.value })} />
              </div>
              <div className="form-row">
                <input type="number" step="0.0001" placeholder={t('form.tipoCambio')} value={aperturaForm.tipo_cambio} onChange={(e) => setAperturaForm({ ...aperturaForm, tipo_cambio: e.target.value })} />
              </div>
              {(() => {
                const totales = totalesApertura(aperturaForm)
                if (!totales) return null
                return (
                  <p style={{ marginTop: -4, marginBottom: 14, fontSize: 12.5, color: 'var(--accent)' }}>
                    {t('apertura.totalCordobas')}: <strong>C${totales.totalCordobas.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                    {' · '}{t('apertura.totalDolares')}: <strong>${totales.totalDolares.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                  </p>
                )
              })()}
              {error && <div style={{ color: 'var(--danger)', fontSize: 13, margin: '14px 0' }}>{error}</div>}
              <div className="form-row" style={{ marginTop: 14 }}>
                <button type="submit" disabled={guardando} style={{ flex: 1 }}>{guardando ? t('botones.guardando', { ns: 'common' }) : t('botonAbrir')}</button>
                <button type="button" className="secondary" onClick={() => setModalAperturaAbierto(false)} disabled={guardando}>{t('botones.cancelar', { ns: 'common' })}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---- Modal: cerrar / editar (mismo formulario grande) ---- */}
      {modalFormAbierto && (
        <div className="modal-backdrop" onClick={() => !guardando && setModalFormAbierto(false)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 4 }}>{modo === 'cerrar' ? t('form.tituloCerrar', { fecha: form.fecha }) : t('form.tituloEditar')}</h3>
            <p style={{ marginTop: 0, marginBottom: 14, color: 'var(--text)', fontSize: 13 }}>{t('form.subtitulo')}</p>
            <form onSubmit={guardar}>

              {/* ---- Datos generales ---- */}
              <div className="form-row">
                <input type="date" value={form.fecha} disabled title={t('form.fechaBloqueadaAyuda')} />
                <input
                  type="number" step="0.01" placeholder={t('form.cajaChicaInicialCordobas')} value={form.caja_chica_inicial_cordobas}
                  disabled={modo === 'cerrar'} title={modo === 'cerrar' ? t('form.montoInicialBloqueadoAyuda') : undefined}
                  onChange={(e) => setForm({ ...form, caja_chica_inicial_cordobas: e.target.value })}
                />
                <input
                  type="number" step="0.01" placeholder={t('form.cajaChicaInicialDolares')} value={form.caja_chica_inicial}
                  disabled={modo === 'cerrar'} title={modo === 'cerrar' ? t('form.montoInicialBloqueadoAyuda') : undefined}
                  onChange={(e) => setForm({ ...form, caja_chica_inicial: e.target.value })}
                />
                <input type="number" step="0.0001" placeholder={t('form.tipoCambio')} value={form.tipo_cambio} onChange={(e) => setForm({ ...form, tipo_cambio: e.target.value })} style={{ maxWidth: 140 }} />
              </div>

              {/* ---- Créditos pendientes ---- */}
              <SeccionTitulo texto={t('form.seccionCreditos')} onAgregar={() => addRow(setCreditos, emptyCredito, 7)} t={t} />
              {creditos.map((c, i) => (
                <div key={i} className="form-row" style={{ marginBottom: 8 }}>
                  <input style={{ flex: '1 1 160px' }} placeholder={t('form.creditoCliente')} value={c.cliente} onChange={(e) => updRow(setCreditos, i, { cliente: e.target.value })} />
                  <input style={{ flex: '0 1 110px' }} placeholder={t('form.creditoFactura')} value={c.factura} onChange={(e) => updRow(setCreditos, i, { factura: e.target.value })} />
                  <input style={{ flex: '0 1 110px' }} placeholder={t('form.creditoOt')} value={c.ot} onChange={(e) => updRow(setCreditos, i, { ot: e.target.value })} />
                  <input type="number" step="0.01" style={{ flex: '0 1 100px' }} placeholder={t('form.creditoMonto')} value={c.monto} onChange={(e) => updRow(setCreditos, i, { monto: e.target.value })} />
                  <input type="date" style={{ flex: '0 1 150px' }} value={c.vence} onChange={(e) => updRow(setCreditos, i, { vence: e.target.value })} />
                  {creditos.length > 1 && <button type="button" className="danger" onClick={() => delRow(setCreditos, i)}><Trash2 size={14} /></button>}
                </div>
              ))}

              {/* ---- Cierre por canal (columna B) ---- */}
              <SeccionTitulo texto={t('form.seccionCierre')} t={t} />
              <div className="form-row">
                <input type="number" step="0.01" placeholder={t('form.pagosCheque')} value={form.pagos_cheque_cierre} onChange={(e) => setForm({ ...form, pagos_cheque_cierre: e.target.value })} />
                <input type="number" step="0.01" placeholder={t('form.pagosTransferencia')} value={form.pagos_transferencia_cierre} onChange={(e) => setForm({ ...form, pagos_transferencia_cierre: e.target.value })} />
                <input type="number" step="0.01" placeholder={t('form.comprasCredex')} value={form.compras_credex_cierre} onChange={(e) => setForm({ ...form, compras_credex_cierre: e.target.value })} />
                <input type="number" step="0.01" placeholder={t('form.cierrePos')} value={form.cierre_pos} onChange={(e) => setForm({ ...form, cierre_pos: e.target.value })} />
                <input type="number" step="0.01" placeholder={t('form.creditosCierre')} value={form.creditos_cierre} onChange={(e) => setForm({ ...form, creditos_cierre: e.target.value })} />
              </div>
              <p style={{ marginTop: -4, marginBottom: 10, fontSize: 12, color: 'var(--text)', opacity: 0.7 }}>{t('form.cierreAyuda')}</p>

              {/* ---- Ingresos por ventas ---- */}
              <SeccionTitulo texto={t('form.seccionIngresos')} onAgregar={() => addRow(setIngresos, emptyIngreso, 15)} t={t} />
              {ingresos.map((it, i) => (
                <div key={i} className="form-row" style={{ marginBottom: 8 }}>
                  <input style={{ flex: '1 1 200px' }} placeholder={t('form.ingresoDescripcion')} value={it.descripcion} onChange={(e) => updRow(setIngresos, i, { descripcion: e.target.value })} />
                  <input type="number" step="0.01" style={{ flex: '0 1 90px' }} placeholder={t('form.ingresoMonto')} value={it.monto} onChange={(e) => updRow(setIngresos, i, { monto: e.target.value })} />
                  <select style={{ flex: '0 1 110px' }} value={it.tipo} onChange={(e) => updRow(setIngresos, i, { tipo: e.target.value })}>
                    <option value="">{t('form.ingresoTipo')}</option>
                    {TIPOS_PAGO.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                  <select style={{ flex: '0 1 120px' }} value={it.banco} onChange={(e) => updRow(setIngresos, i, { banco: e.target.value })}>
                    <option value="">{t('form.ingresoBanco')}</option>
                    {BANCOS.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                  <input style={{ flex: '0 1 90px' }} placeholder={t('form.ingresoFactura')} value={it.factura} onChange={(e) => updRow(setIngresos, i, { factura: e.target.value })} />
                  <input style={{ flex: '0 1 100px' }} placeholder={t('form.ingresoOts')} value={it.ots} onChange={(e) => updRow(setIngresos, i, { ots: e.target.value })} />
                  <input style={{ flex: '0 1 100px' }} placeholder={t('form.ingresoVendedor')} value={it.vendedor} onChange={(e) => updRow(setIngresos, i, { vendedor: e.target.value })} />
                  <select style={{ flex: '0 1 90px' }} value={it.empresa} onChange={(e) => updRow(setIngresos, i, { empresa: e.target.value })}>
                    <option value="">{t('form.ingresoEmpresa')}</option>
                    <option value="SI">{t('form.si')}</option>
                    <option value="NO">{t('form.no')}</option>
                  </select>
                  {ingresos.length > 1 && <button type="button" className="danger" onClick={() => delRow(setIngresos, i)}><Trash2 size={14} /></button>}
                </div>
              ))}

              {/* ---- Gastos de caja chica ---- */}
              <SeccionTitulo texto={t('form.seccionGastos')} onAgregar={() => addRow(setGastos, emptyGasto, 10)} t={t} />
              {gastos.map((g, i) => (
                <div key={i} className="form-row" style={{ marginBottom: 8 }}>
                  <input style={{ flex: '1 1 260px' }} placeholder={t('form.gastoDescripcion')} value={g.descripcion} onChange={(e) => updRow(setGastos, i, { descripcion: e.target.value })} />
                  <input type="number" step="0.01" style={{ flex: '0 1 110px' }} placeholder={t('form.gastoMonto')} value={g.monto} onChange={(e) => updRow(setGastos, i, { monto: e.target.value })} />
                  {gastos.length > 1 && <button type="button" className="danger" onClick={() => delRow(setGastos, i)}><Trash2 size={14} /></button>}
                </div>
              ))}

              <div className="form-row" style={{ marginTop: 10 }}>
                <input style={{ flex: '1 1 100%' }} placeholder={t('form.recibosUtilizados')} value={form.recibos_caja_utilizados} onChange={(e) => setForm({ ...form, recibos_caja_utilizados: e.target.value })} />
              </div>
              <div className="form-row">
                <textarea style={{ flex: '1 1 100%', minHeight: 50 }} placeholder={t('form.comentarios')} value={form.comentarios} onChange={(e) => setForm({ ...form, comentarios: e.target.value })} />
              </div>

              {/* ---- Detalle de ventas del día (anterior) ---- */}
              <SeccionTitulo texto={t('form.seccionAnterior')} t={t} />
              <div className="form-row">
                <input type="number" step="0.01" placeholder={t('form.ventasDiaAnterior')} value={form.ventas_dia_anterior} onChange={(e) => setForm({ ...form, ventas_dia_anterior: e.target.value })} />
                <input type="number" step="0.01" placeholder={t('form.totalComAnterior')} value={form.total_com_anterior} onChange={(e) => setForm({ ...form, total_com_anterior: e.target.value })} />
                <input type="number" step="0.01" placeholder={t('form.totalCcaAnterior')} value={form.total_cca_anterior} onChange={(e) => setForm({ ...form, total_cca_anterior: e.target.value })} />
              </div>
              <div className="form-row">
                <input type="number" step="0.01" placeholder={t('form.repuestosInternoAnterior')} value={form.repuestos_uso_interno_anterior} onChange={(e) => setForm({ ...form, repuestos_uso_interno_anterior: e.target.value })} />
                <input type="number" step="0.01" placeholder={t('form.repAccInsumoAnterior')} value={form.rep_acc_insumo_externa_anterior} onChange={(e) => setForm({ ...form, rep_acc_insumo_externa_anterior: e.target.value })} />
                <input type="number" step="0.01" placeholder={t('form.computadorasAnterior')} value={form.computadoras_anterior} onChange={(e) => setForm({ ...form, computadoras_anterior: e.target.value })} />
              </div>

              {/* ---- Ventas por vendedor (4 filas fijas) ---- */}
              <SeccionTitulo texto={t('form.seccionVentasVendedor')} t={t} />
              <p style={{ marginTop: -4, marginBottom: 8, fontSize: 12, color: 'var(--text)', opacity: 0.7 }}>{t('form.ventasVendedorAyuda')}</p>
              {ventasVendedor.map((v, i) => (
                <div key={i} className="form-row" style={{ marginBottom: 8 }}>
                  <input style={{ flex: '0 1 140px' }} placeholder={t('form.vendedorNombre')} value={v.vendedor} onChange={(e) => updRow(setVentasVendedor, i, { vendedor: e.target.value })} />
                  <input type="number" step="0.01" style={{ flex: '0 1 150px' }} placeholder={t('form.acumuladoSemanal')} value={v.acumulado_semanal} onChange={(e) => updRow(setVentasVendedor, i, { acumulado_semanal: e.target.value })} />
                  <input type="number" step="0.01" style={{ flex: '0 1 150px' }} placeholder={t('form.semanaAnterior')} value={v.semana_anterior} onChange={(e) => updRow(setVentasVendedor, i, { semana_anterior: e.target.value })} />
                </div>
              ))}
              <div className="form-row">
                <input type="number" step="0.01" placeholder={t('form.metaSemanal')} value={form.meta_semanal} onChange={(e) => setForm({ ...form, meta_semanal: e.target.value })} />
                <input type="number" step="0.01" placeholder={t('form.metaMensual')} value={form.meta_mensual} onChange={(e) => setForm({ ...form, meta_mensual: e.target.value })} />
              </div>

              {/* ---- Equipos recibidos por vendedor (3 filas fijas) ---- */}
              <SeccionTitulo texto={t('form.seccionEquiposVendedor')} t={t} />
              {equiposVendedor.map((v, i) => (
                <div key={i} className="form-row" style={{ marginBottom: 8 }}>
                  <input style={{ flex: '0 1 140px' }} placeholder={t('form.vendedorNombre')} value={v.vendedor} onChange={(e) => updRow(setEquiposVendedor, i, { vendedor: e.target.value })} />
                  <input type="number" style={{ flex: '0 1 130px' }} placeholder={t('form.clientesAtendidos')} value={v.clientes_atendidos} onChange={(e) => updRow(setEquiposVendedor, i, { clientes_atendidos: e.target.value })} />
                  <input type="number" style={{ flex: '0 1 90px' }} placeholder="COMs" value={v.com} onChange={(e) => updRow(setEquiposVendedor, i, { com: e.target.value })} />
                  <input type="number" style={{ flex: '0 1 90px' }} placeholder="CCAs" value={v.cca} onChange={(e) => updRow(setEquiposVendedor, i, { cca: e.target.value })} />
                  <input type="number" style={{ flex: '0 1 100px' }} placeholder={t('form.repuestos')} value={v.repuestos} onChange={(e) => updRow(setEquiposVendedor, i, { repuestos: e.target.value })} />
                </div>
              ))}

              {/* ---- Proyección de cierre ---- */}
              <SeccionTitulo texto={t('form.seccionProyeccion')} t={t} />
              <div className="form-row">
                <input type="number" placeholder={t('form.diaDelMes')} value={form.dia_del_mes} onChange={(e) => setForm({ ...form, dia_del_mes: e.target.value })} style={{ maxWidth: 130 }} />
                <input type="number" placeholder={t('form.diasMes')} value={form.dias_mes} onChange={(e) => setForm({ ...form, dias_mes: e.target.value })} style={{ maxWidth: 130 }} />
              </div>

              {/* ---- Conteo físico de efectivo ---- */}
              <SeccionTitulo texto={t('form.seccionEfectivo')} t={t} />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', opacity: 0.7, margin: '4px 0' }}>{t('form.dolares')}</div>
              <div className="form-row">
                {DENOM_USD.map(([key, denom]) => (
                  <div key={key} style={{ flex: '0 1 90px' }}>
                    <label style={{ fontSize: 11, color: 'var(--text)', opacity: 0.7 }}>US${denom}</label>
                    <input type="number" min="0" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', opacity: 0.7, margin: '10px 0 4px' }}>{t('form.cordobas')}</div>
              <div className="form-row">
                {DENOM_NIO.map(([key, denom]) => (
                  <div key={key} style={{ flex: '0 1 90px' }}>
                    <label style={{ fontSize: 11, color: 'var(--text)', opacity: 0.7 }}>C${denom}</label>
                    <input type="number" min="0" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                  </div>
                ))}
              </div>

              {error && <div style={{ color: 'var(--danger)', fontSize: 13, margin: '14px 0' }}>{error}</div>}
              <div className="form-row" style={{ marginTop: 14 }}>
                <button type="submit" disabled={guardando} style={{ flex: 1 }}>
                  {guardando ? t('botones.guardando', { ns: 'common' }) : (modo === 'cerrar' ? t('botonCerrar') : t('botones.guardar', { ns: 'common' }))}
                </button>
                <button type="button" className="secondary" onClick={() => setModalFormAbierto(false)} disabled={guardando}>{t('botones.cancelar', { ns: 'common' })}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function SeccionTitulo({ texto, onAgregar, t }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 8px', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text)', opacity: 0.85 }}>{texto}</span>
      {onAgregar && (
        <button type="button" className="secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onAgregar}><Plus size={13} /> {t('form.agregarLinea')}</button>
      )}
    </div>
  )
}

export default CajaChica
