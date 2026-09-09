import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ventasApi, tallerApi, contabilidadApi } from '../api.js'
import { capitalizarTexto } from '../textUtils.js'
import '../orden-tailwind.css'

const SIMBOLO = { USD: 'US$', NIO: 'C$' }

const CLIENTE_VACIO = {
  nombre: '', cedula: '', documento: '', email: '', telefono: '', telefono2: '',
  direccion: '', direccion_entrega: '', operadora: '', whatsapp: false,
  departamento_pais: '', empresa: '', tipo_cliente: 'PARTICULAR', notas: '',
  es_problematico: false, motivo_problematico: '',
}

const CXC_VACIA = { monto: '', fecha_vencimiento: '', numero_factura: '', asesor: '', referencia_ots: '' }

function ClienteDetalle() {
  const { t } = useTranslation('clientes')
  const { id } = useParams()
  const navigate = useNavigate()
  const esNuevo = id === 'nuevo'

  const [cliente, setCliente] = useState(esNuevo ? CLIENTE_VACIO : null)
  const [empresas, setEmpresas] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [facturas, setFacturas] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(!esNuevo)
  const [guardando, setGuardando] = useState(false)
  const [mostrarFormCxc, setMostrarFormCxc] = useState(false)
  const [cxcForm, setCxcForm] = useState(CXC_VACIA)
  const [guardandoCxc, setGuardandoCxc] = useState(false)

  useEffect(() => { ventasApi.empresas().then((res) => setEmpresas(res.data)) }, [])

  const cargarCliente = () => {
    setLoading(true)
    Promise.all([
      ventasApi.cliente(id),
      tallerApi.ordenesDeCliente(id),
      ventasApi.facturas(id),
      contabilidadApi.cuentasPorCobrar(id),
    ]).then(([c, o, f, cxc]) => {
      setCliente(c.data); setOrdenes(o.data); setFacturas(f.data); setCuentas(cxc.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (esNuevo) { setCliente(CLIENTE_VACIO); return }
    cargarCliente()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, esNuevo])

  const guardar = async (e) => {
    e.preventDefault()
    if (!cliente.nombre.trim()) return
    setGuardando(true)
    const esEmpresa = cliente.tipo_cliente === 'EMPRESA'
    const payload = {
      ...cliente,
      nombre: capitalizarTexto(cliente.nombre.trim()),
      empresa: esEmpresa ? (cliente.empresa || null) : null,
    }
    try {
      if (esNuevo) {
        const res = await ventasApi.crearCliente(payload)
        navigate(`/clientes/${res.data.id}`, { replace: true })
      } else {
        await ventasApi.actualizarCliente(id, payload)
        cargarCliente()
      }
    } finally {
      setGuardando(false)
    }
  }

  const agregarCuentaPorCobrar = async (e) => {
    e.preventDefault()
    if (!cxcForm.monto || !cxcForm.fecha_vencimiento) return
    setGuardandoCxc(true)
    try {
      await contabilidadApi.crearCuentaPorCobrar({
        cliente: id, estado: 'PENDIENTE',
        monto: cxcForm.monto, fecha_vencimiento: cxcForm.fecha_vencimiento,
        numero_factura: cxcForm.numero_factura, asesor: cxcForm.asesor, referencia_ots: cxcForm.referencia_ots,
      })
      setCxcForm(CXC_VACIA)
      setMostrarFormCxc(false)
      cargarCliente()
    } finally {
      setGuardandoCxc(false)
    }
  }

  const marcarCuentaPagada = (cuentaId) => {
    contabilidadApi.actualizarCuentaPorCobrar(cuentaId, { estado: 'PAGADO' }).then(cargarCliente)
  }

  if (!esNuevo && loading) {
    return <div className="orden-tw"><div className="min-h-screen bg-canvas p-6"><p className="text-sm text-muted">{t('mensajes.cargando', { ns: 'common' })}</p></div></div>
  }
  if (!cliente) return null

  const esEmpresa = cliente.tipo_cliente === 'EMPRESA'
  const cuentasPendientes = cuentas.filter((c) => c.estado === 'PENDIENTE')
  const totalPendiente = cuentasPendientes.reduce((s, c) => s + Number(c.monto), 0)

  const items = facturas.flatMap((f) => (f.detalles || []).map((d) => ({
    ...d,
    facturaId: f.id, facturaNumero: f.numero, fecha: f.fecha, moneda: f.moneda, tuvoCredito: f.tuvo_credito,
  })))

  return (
    <div className="orden-tw">
      <div className="min-h-screen bg-canvas p-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <button onClick={() => navigate('/clientes')} className="mb-1 text-sm text-muted hover:text-ink">← {t('botones.volver', { ns: 'common' })}</button>
              <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
                {esNuevo ? t('form.tituloNuevo') : (cliente.nombre || t('form.tituloEditar'))}
                {!esNuevo && cliente.es_problematico && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600" title={cliente.motivo_problematico || t('form.problematicoAyuda')}>
                    🚩 {t('form.problematicoBadge')}
                  </span>
                )}
              </h1>
            </div>
          </div>

          <div className={`grid grid-cols-1 gap-6 ${esNuevo ? '' : 'lg:grid-cols-3'}`}>
            <div className={`rounded-xl border border-line bg-surface p-5 shadow-card ${esNuevo ? '' : 'lg:col-span-1'}`}>
              <h3 className="mb-3 text-sm font-bold text-ink">{esNuevo ? t('form.tituloNuevo') : t('form.tituloEditar')}</h3>
              <form onSubmit={guardar} className="space-y-3">
                <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('form.nombre')} value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} onBlur={(e) => setCliente((p) => ({ ...p, nombre: capitalizarTexto(e.target.value) }))} />

                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={esEmpresa} onChange={(e) => setCliente({ ...cliente, tipo_cliente: e.target.checked ? 'EMPRESA' : 'PARTICULAR' })} />
                  {t('form.esEmpresa')}
                </label>

                {esEmpresa ? (
                  <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('form.ruc')} value={cliente.documento || ''} onChange={(e) => setCliente({ ...cliente, documento: e.target.value })} />
                ) : (
                  <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('form.cedula')} value={cliente.cedula || ''} onChange={(e) => setCliente({ ...cliente, cedula: e.target.value })} />
                )}

                {esEmpresa && (
                  <select className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" value={cliente.empresa || ''} onChange={(e) => setCliente({ ...cliente, empresa: e.target.value })}>
                    <option value="">{t('form.sinEmpresa')}</option>
                    {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                  </select>
                )}

                <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('form.correo')} value={cliente.email || ''} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} />

                <div className="flex gap-2">
                  <input className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('form.telefono')} value={cliente.telefono || ''} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} />
                  <select className="w-32 rounded-lg border border-line bg-surface px-2 py-2 text-sm text-ink" value={cliente.operadora || ''} onChange={(e) => setCliente({ ...cliente, operadora: e.target.value })}>
                    <option value="">{t('form.operadoraSeleccionar')}</option>
                    <option value="CLARO">Claro</option>
                    <option value="TIGO">Tigo</option>
                  </select>
                </div>
                <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('form.telefonoAlterno')} value={cliente.telefono2 || ''} onChange={(e) => setCliente({ ...cliente, telefono2: e.target.value })} />

                <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('form.departamentoPais')} value={cliente.departamento_pais || ''} onChange={(e) => setCliente({ ...cliente, departamento_pais: e.target.value })} />

                <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('form.direccion')} value={cliente.direccion || ''} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} onBlur={(e) => setCliente((p) => ({ ...p, direccion: capitalizarTexto(e.target.value) }))} />
                <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('form.direccionEntrega')} value={cliente.direccion_entrega || ''} onChange={(e) => setCliente({ ...cliente, direccion_entrega: e.target.value })} />

                <textarea
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                  rows={3}
                  placeholder={t('form.notasPlaceholder')}
                  value={cliente.notas || ''}
                  onChange={(e) => setCliente({ ...cliente, notas: e.target.value })}
                />
                <p className="-mt-2 text-xs text-muted">{t('form.notasAyuda')}</p>

                <div className="flex gap-4 pt-1 text-sm text-muted">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!cliente.whatsapp} onChange={(e) => setCliente({ ...cliente, whatsapp: e.target.checked })} /> {t('form.whatsapp')}</label>
                </div>

                <div className={`rounded-lg border p-3 ${cliente.es_problematico ? 'border-red-300 bg-red-50' : 'border-line'}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-red-600">
                    <input type="checkbox" checked={!!cliente.es_problematico} onChange={(e) => setCliente({ ...cliente, es_problematico: e.target.checked })} />
                    🚩 {t('form.problematico')}
                  </label>
                  {cliente.es_problematico && (
                    <textarea
                      className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                      rows={2}
                      placeholder={t('form.motivoProblematicoPlaceholder')}
                      value={cliente.motivo_problematico || ''}
                      onChange={(e) => setCliente({ ...cliente, motivo_problematico: e.target.value })}
                    />
                  )}
                </div>

                {!esNuevo && (
                  <div className="pt-1">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cliente.frecuente ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      {cliente.frecuente ? t('frecuenteSi') : t('frecuenteNo')}
                    </span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={guardando} className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    {guardando ? t('botones.guardando', { ns: 'common' }) : t('botones.guardar', { ns: 'common' })}
                  </button>
                  <button type="button" onClick={() => navigate('/clientes')} className="rounded-lg border border-line px-4 py-2 text-sm text-muted">{t('botones.cancelar', { ns: 'common' })}</button>
                </div>
              </form>
            </div>

            {!esNuevo && (
              <div className="space-y-6 lg:col-span-2">
                <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-ink">{t('detalle.saldoTitulo')}</h3>
                    <div className="flex items-center gap-2">
                      {totalPendiente > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">${totalPendiente.toLocaleString()}</span>}
                      <button type="button" onClick={() => setMostrarFormCxc((v) => !v)} className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-muted hover:bg-subtle">
                        {mostrarFormCxc ? t('botones.cancelar', { ns: 'common' }) : t('detalle.cxc.agregar')}
                      </button>
                    </div>
                  </div>

                  {mostrarFormCxc && (
                    <form onSubmit={agregarCuentaPorCobrar} className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-line bg-canvas p-3 sm:grid-cols-3">
                      <input type="number" step="0.01" min="0" required className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('detalle.cxc.monto')} value={cxcForm.monto} onChange={(e) => setCxcForm({ ...cxcForm, monto: e.target.value })} />
                      <input type="date" required className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" value={cxcForm.fecha_vencimiento} onChange={(e) => setCxcForm({ ...cxcForm, fecha_vencimiento: e.target.value })} />
                      <input className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('detalle.cxc.numeroFactura')} value={cxcForm.numero_factura} onChange={(e) => setCxcForm({ ...cxcForm, numero_factura: e.target.value })} />
                      <input className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('detalle.cxc.asesor')} value={cxcForm.asesor} onChange={(e) => setCxcForm({ ...cxcForm, asesor: e.target.value })} />
                      <input className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('detalle.cxc.referenciaOt')} value={cxcForm.referencia_ots} onChange={(e) => setCxcForm({ ...cxcForm, referencia_ots: e.target.value })} />
                      <button type="submit" disabled={guardandoCxc} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                        {guardandoCxc ? t('botones.guardando', { ns: 'common' }) : t('botones.guardar', { ns: 'common' })}
                      </button>
                    </form>
                  )}

                  {cuentasPendientes.length === 0 ? (
                    <p className="text-sm text-muted">{t('detalle.saldoSinDeuda')}</p>
                  ) : (
                    <div className="table-scroll">
                      <table className="w-full text-sm">
                        <thead className="bg-subtle text-xs uppercase text-muted">
                          <tr>
                            <th className="px-3 py-2 text-left">{t('detalle.cxc.numeroFactura')}</th>
                            <th className="px-3 py-2 text-left">{t('detalle.cxc.monto')}</th>
                            <th className="px-3 py-2 text-left">{t('detalle.cxc.vencimiento')}</th>
                            <th className="px-3 py-2 text-left">{t('detalle.cxc.asesor')}</th>
                            <th className="px-3 py-2 text-left">{t('detalle.cxc.referenciaOt')}</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {cuentasPendientes.map((c) => (
                            <tr key={c.id} className="border-t border-line">
                              <td className="px-3 py-2 text-ink">{c.numero_factura || '—'}</td>
                              <td className="px-3 py-2 font-medium text-ink">${Number(c.monto).toLocaleString()}</td>
                              <td className="px-3 py-2 text-muted">{c.fecha_vencimiento || '—'}</td>
                              <td className="px-3 py-2 text-muted">{c.asesor || '—'}</td>
                              <td className="px-3 py-2 text-muted">{c.referencia_ots || '—'}</td>
                              <td className="px-3 py-2 text-right">
                                <button type="button" onClick={() => marcarCuentaPagada(c.id)} className="text-emerald-600 hover:underline">{t('detalle.cxc.marcarPagado')}</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
                  <h3 className="mb-3 text-sm font-bold text-ink">{t('detalle.historialTitulo')}</h3>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted">{t('detalle.historialSinRegistros')}</p>
                  ) : (
                    <div className="table-scroll">
                      <table className="w-full text-sm">
                        <thead className="bg-subtle text-xs uppercase text-muted">
                          <tr>
                            <th className="px-3 py-2 text-left">{t('detalle.tabla.factura')}</th>
                            <th className="px-3 py-2 text-left">{t('detalle.tabla.fecha')}</th>
                            <th className="px-3 py-2 text-left">{t('detalle.tabla.item')}</th>
                            <th className="px-3 py-2 text-left">{t('detalle.tabla.cantidad')}</th>
                            <th className="px-3 py-2 text-left">{t('detalle.tabla.subtotal')}</th>
                            <th className="px-3 py-2 text-left">{t('detalle.tabla.forma')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((d) => (
                            <tr key={d.id} className="border-t border-line">
                              <td className="px-3 py-2 text-ink">{d.facturaNumero}</td>
                              <td className="px-3 py-2 text-muted">{d.fecha}</td>
                              <td className="px-3 py-2 text-muted">
                                <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${d.tipo === 'SERVICIO' ? 'bg-blue-100 text-blue-700' : 'bg-subtle text-ink'}`}>
                                  {d.tipo === 'SERVICIO' ? t('detalle.tipoServicio') : t('detalle.tipoProducto')}
                                </span>
                                {d.producto_nombre || d.equipo_descripcion || d.descripcion || '—'}
                              </td>
                              <td className="px-3 py-2 text-muted">{Number(d.cantidad)}</td>
                              <td className="px-3 py-2 font-medium text-ink">{SIMBOLO[d.moneda] || ''}{Number(d.subtotal).toLocaleString()}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${d.tuvoCredito ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {d.tuvoCredito ? t('detalle.credito') : t('detalle.contado')}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
                  <h4 className="mb-2 text-xs font-semibold uppercase text-muted">{t('historial.titulo')}</h4>
                  {ordenes.length === 0 ? (
                    <p className="text-sm text-muted">{t('historial.sinOrdenes')}</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {ordenes.map((o) => (
                        <li key={o.id} className="flex justify-between">
                          <button onClick={() => navigate(`/ordenes/${o.id}`)} className="text-brand hover:underline">{o.numero} — {o.equipo}</button>
                          <span className="text-muted">{t(`estadosOrden.${o.estado}`, { ns: 'common', defaultValue: o.estado_display })}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClienteDetalle
