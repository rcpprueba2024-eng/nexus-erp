import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, ClipboardList, ArrowLeft } from 'lucide-react'
import { tallerApi, ventasApi, configApi } from '../api.js'
import ReciboPreview from '../components/ReciboPreview.jsx'
import OrdenPreview from '../components/OrdenPreview.jsx'
import FirmaDigital from '../components/orden/FirmaDigital.jsx'
import { esCCA, checklistSalidaPara } from '../ordenTipo.js'
import Pagination from '../components/Pagination.jsx'
import '../orden-tailwind.css'

const PAGE_SIZE = 15

function serviciosDe(o) {
  if ((o.servicios_realizados || []).length > 0) return o.servicios_realizados.map((s) => s.descripcion).filter(Boolean)
  if ((o.tipos_servicio || []).length > 0) return o.tipos_servicio
  return []
}

// El estado de facturación NO se basa en si la orden ya fue ENTREGADO —
// facturar() en el backend es independiente del estado de taller y solo
// exige que aún no tenga origen_venta. El equipo está listo para cobrarse
// en cuanto queda reparado (LISTO_ENTREGA), no hasta que el cliente ya se
// lo llevó.
function estadoFacturacion(o) {
  if (o.factura_numero) return 'PAGADA'
  if (o.estado === 'LISTO_ENTREGA' || o.estado === 'ENTREGADO') return 'LISTA_PARA_PAGAR'
  return 'EN_TALLER'
}

const COLOR_ESTADO = {
  EN_TALLER: 'bg-subtle text-muted',
  LISTA_PARA_PAGAR: 'bg-amber-100 text-amber-700',
  PAGADA: 'bg-emerald-100 text-emerald-700',
}

function FacturarOts() {
  const { t } = useTranslation(['facturarOts', 'common'])
  const navigate = useNavigate()
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [tab, setTab] = useState('LISTA_PARA_PAGAR')
  const [tasa, setTasa] = useState(1)
  const [pagina, setPagina] = useState(1)

  const [modalOrden, setModalOrden] = useState(null)
  const [montoTotal, setMontoTotal] = useState(0)
  const [moneda, setMoneda] = useState('USD')
  const [pagos, setPagos] = useState([{ metodo: 'EFECTIVO', monto: '', monto_recibido: '' }])
  const [checklistSalida, setChecklistSalida] = useState({})
  const [firmaEntrega, setFirmaEntrega] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [reciboFactura, setReciboFactura] = useState(null)
  const [eligiendoImpresion, setEligiendoImpresion] = useState(null)
  const [pdfOrden, setPdfOrden] = useState(null)

  const cargar = () => {
    setLoading(true)
    tallerApi.ordenes().then((r) => setOrdenes(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => {
    cargar()
    configApi.obtener().then((r) => setTasa(Number(r.data.tasa_cambio_usd) || 1))
  }, [])

  const conEstado = useMemo(() => ordenes.map((o) => ({ ...o, _estadoFact: estadoFacturacion(o) })), [ordenes])

  const conteos = useMemo(() => ({
    EN_TALLER: conEstado.filter((o) => o._estadoFact === 'EN_TALLER').length,
    LISTA_PARA_PAGAR: conEstado.filter((o) => o._estadoFact === 'LISTA_PARA_PAGAR').length,
    PAGADA: conEstado.filter((o) => o._estadoFact === 'PAGADA').length,
  }), [conEstado])

  // Con texto de búsqueda, se busca en TODAS las OTs sin importar la pestaña
  // — de lo contrario, si el usuario no sabe en qué estado está su OT (p.ej.
  // sigue en taller pero él está parado en "Lista para pagar"), la búsqueda
  // no encuentra nada aunque la OT sí exista.
  const q = buscar.trim().toLowerCase()
  const base = q ? conEstado : conEstado.filter((o) => o._estadoFact === tab)
  const visiblesTotal = q
    ? base.filter((o) => o.numero.toLowerCase().includes(q) || (o.cliente_nombre || '').toLowerCase().includes(q))
    : base
  const visibles = visiblesTotal.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)

  useEffect(() => { setPagina(1) }, [tab, buscar])

  const abrirFacturar = (orden) => {
    setModalOrden(orden)
    setMontoTotal(orden.total_final || 0)
    setMoneda(orden.moneda || 'USD')
    setPagos([{ metodo: 'EFECTIVO', monto: orden.total_final || '', monto_recibido: '' }])
    setChecklistSalida(orden.checklist_salida || {})
    setFirmaEntrega(orden.firma_cliente_entrega || '')
    setError('')
  }

  const totalPagado = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0)
  const saldo = modalOrden ? (Number(montoTotal) || 0) - totalPagado : 0
  const vueltoGlobal = saldo < 0 ? Math.abs(saldo) : 0
  const simbolo = moneda === 'NIO' ? 'C$' : 'US$'
  const otroSimbolo = moneda === 'NIO' ? 'US$' : 'C$'
  const aOtraMoneda = (monto) => moneda === 'USD' ? Number(monto) * tasa : Number(monto) / tasa

  const addPago = () => setPagos((p) => [...p, { metodo: 'EFECTIVO', monto: '', monto_recibido: '' }])
  const updPago = (i, patch) => setPagos((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  const delPago = (i) => setPagos((p) => p.filter((_, idx) => idx !== i))

  const confirmarFactura = async () => {
    setError('')
    if (totalPagado <= 0 && !window.confirm(t('modal.confirmarSinPago'))) return
    setGuardando(true)
    try {
      const ordenId = modalOrden.id
      // Al confirmar la factura ya se completó el checklist de salida y la
      // firma de "recibí conforme" — el equipo se está entregando en este
      // mismo momento, así que la orden pasa directo a Entregado (ya no lo
      // marca Taller, ver Taller.jsx).
      await tallerApi.actualizarOrden(ordenId, { checklist_salida: checklistSalida, firma_cliente_entrega: firmaEntrega, estado: 'ENTREGADO' })
      const pagosLimpios = pagos
        .filter((p) => Number(p.monto) > 0)
        .map((p) => ({
          metodo: p.metodo, monto: Number(p.monto),
          monto_recibido: p.metodo === 'EFECTIVO' && p.monto_recibido ? Number(p.monto_recibido) : null,
          cuotas: p.cuotas ? Number(p.cuotas) : null, banco: p.banco || '', referencia: p.referencia || '',
        }))
      const res = await tallerApi.facturarOrden(ordenId, { moneda, monto: Number(montoTotal) || 0, pagos: pagosLimpios })
      setModalOrden(null)
      cargar()
      setEligiendoImpresion({ factura: res.data, ordenId })
    } catch (err) {
      setError(err?.response?.data?.detail || t('modal.errorGenerico'))
    } finally {
      setGuardando(false)
    }
  }

  const elegirImprimirTicket = () => {
    setReciboFactura(eligiendoImpresion.factura)
    ventasApi.imprimirFactura(eligiendoImpresion.factura.id).catch(() => {})
    setEligiendoImpresion(null)
  }

  const elegirImprimirPdf = async () => {
    const { ordenId } = eligiendoImpresion
    setEligiendoImpresion(null)
    try {
      const ordenRes = await tallerApi.orden(ordenId)
      const ordenCompleta = ordenRes.data
      let clienteData = null
      let empresaNombre = ''
      if (ordenCompleta.cliente) {
        const cRes = await ventasApi.cliente(ordenCompleta.cliente)
        clienteData = cRes.data
        if (clienteData?.empresa) {
          const eRes = await ventasApi.empresas()
          empresaNombre = eRes.data.find((e) => e.id === clienteData.empresa)?.nombre || ''
        }
      }
      setPdfOrden({ orden: ordenCompleta, cliente: clienteData, empresaNombre })
    } catch {
      setError(t('modal.errorGenerico'))
    }
  }

  return (
    <>
    <div className="orden-tw">
      <div className="min-h-screen bg-canvas p-6">
      <div className="mx-auto max-w-6xl">
        <button onClick={() => navigate('/ventas/facturacion')} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft size={15} /> {t('botones.volver', { ns: 'common' })}
        </button>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-ink">{t('titulo')}</h1>
          <p className="text-sm text-muted">{t('subtitulo')}</p>
        </div>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={buscar} onChange={(e) => setBuscar(e.target.value)}
            placeholder={t('buscarPlaceholder')}
            className="w-full rounded-lg border border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div className={`mb-2 flex flex-wrap gap-2 transition-opacity ${q ? 'pointer-events-none opacity-40' : ''}`}>
          {['EN_TALLER', 'LISTA_PARA_PAGAR', 'PAGADA'].map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${tab === k ? 'bg-ink text-canvas' : 'bg-surface text-muted border border-line hover:border-brand'}`}>
              {t(`estados.${k}`)} ({conteos[k]})
            </button>
          ))}
        </div>
        {q && <p className="mb-4 text-xs text-muted">{t('buscandoEnTodas')}</p>}

        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          {loading && <div className="p-8 text-center text-muted">{t('mensajes.cargando', { ns: 'common' })}</div>}
          {!loading && visibles.length === 0 && (
            <div className="p-10 text-center text-muted">
              <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
              {q ? t('sinResultadosBusqueda') : t('sinResultados')}
            </div>
          )}
          {!loading && visibles.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-subtle text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 text-left">{t('tabla.numero')}</th>
                  <th className="px-4 py-3 text-left">{t('tabla.cliente')}</th>
                  <th className="px-4 py-3 text-left">{t('tabla.equipo')}</th>
                  <th className="px-4 py-3 text-left">{t('tabla.total')}</th>
                  <th className="px-4 py-3 text-left">{t('tabla.estado')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((o) => {
                  const invoiceable = o._estadoFact === 'LISTA_PARA_PAGAR'
                  return (
                    <tr key={o.id} onClick={() => invoiceable && abrirFacturar(o)}
                      className={`border-t border-line hover:bg-tint ${invoiceable ? 'cursor-pointer' : ''}`}>
                      <td className="px-4 py-3 font-medium text-ink">{o.numero}</td>
                      <td className="px-4 py-3 text-muted">{o.cliente_nombre}</td>
                      <td className="px-4 py-3 text-muted">{o.equipo}</td>
                      <td className="px-4 py-3 text-ink">${Number(o.total_final || 0).toLocaleString()}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${COLOR_ESTADO[o._estadoFact]}`}>{t(`estados.${o._estadoFact}`)}</span></td>
                      <td className="px-4 py-3 text-right">
                        {invoiceable && (
                          <button onClick={() => abrirFacturar(o)} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">{t('botonFacturar')}</button>
                        )}
                        {o._estadoFact === 'PAGADA' && <span className="text-xs text-muted">{o.factura_numero}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {!loading && visiblesTotal.length > 0 && (
          <Pagination page={pagina} totalItems={visiblesTotal.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />
        )}
      </div>
      </div>

      {modalOrden && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={() => setModalOrden(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-sm font-bold text-ink">{t('modal.titulo', { numero: modalOrden.numero })}</h3>
            <p className="mb-3 text-xs text-muted">{modalOrden.cliente_nombre} — {modalOrden.equipo}</p>

            <div className="mb-3 space-y-1.5 rounded-lg bg-subtle px-3 py-2.5 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t('modal.servicioRealizado')}</span>
                <span className="text-right font-medium text-ink">
                  {(() => {
                    const servicios = serviciosDe(modalOrden)
                    if (servicios.length > 0) return servicios.map((s) => t(`tipoServicio.${s}`, { ns: 'ordenes', defaultValue: s })).join(', ')
                    if (modalOrden.diagnostico) return modalOrden.diagnostico
                    return t('modal.sinDato')
                  })()}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t('modal.repuestosUsados')}</span>
                {Number(modalOrden.total_repuestos || 0) > 0 ? (
                  <span className="font-medium text-amber-600">{t('modal.si')} (${Number(modalOrden.total_repuestos).toLocaleString()})</span>
                ) : (
                  <span className="font-medium text-ink">{t('modal.no')}</span>
                )}
              </div>
            </div>

            <div className="mb-1 flex items-center justify-between gap-3 rounded-lg bg-subtle px-3 py-2 text-sm">
              <span className="text-muted">{t('modal.totalOrden')}</span>
              <input type="number" value={montoTotal} onChange={(e) => setMontoTotal(e.target.value)}
                className="w-28 rounded-lg border border-line bg-surface px-2 py-1 text-right text-sm font-semibold text-ink" />
            </div>
            <p className="mb-3 text-xs text-amber-600">
              {Number(modalOrden.total_final || 0) === 0 ? t('modal.avisoSinPrecio') : t('modal.avisoMontoEditable')}
            </p>

            <div className="mb-3 flex gap-2">
              <select className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                <option value="USD">{t('modal.dolares')}</option>
                <option value="NIO">{t('modal.cordobas')}</option>
              </select>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted">{t('modal.pagos')}</span>
              <button type="button" onClick={addPago} className="text-xs font-medium text-brand hover:underline">+ {t('modal.agregarPago')}</button>
            </div>
            <div className="mb-3 space-y-2">
              {pagos.map((p, i) => (
                <div key={i} className="rounded-lg border border-line/60 p-2">
                  <div className="flex items-center gap-2">
                    <select className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink" value={p.metodo} onChange={(e) => updPago(i, { metodo: e.target.value })}>
                      <option value="EFECTIVO">{t('modal.efectivo')}</option>
                      <option value="TARJETA">{t('modal.tarjeta')}</option>
                      <option value="CREDEX">{t('modal.credex')}</option>
                      <option value="TASA_CERO">{t('modal.tasaCero')}</option>
                      <option value="LINEA_CREDITO">{t('modal.lineaCredito')}</option>
                    </select>
                    <input type="number" placeholder={t('modal.monto')} value={p.monto} onChange={(e) => updPago(i, { monto: e.target.value })}
                      className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink" />
                    {p.metodo === 'EFECTIVO' && (
                      <input type="number" placeholder={t('modal.recibido')} value={p.monto_recibido} onChange={(e) => updPago(i, { monto_recibido: e.target.value })}
                        className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink" />
                    )}
                    {pagos.length > 1 && <button type="button" onClick={() => delPago(i)} className="text-red-500">✕</button>}
                  </div>
                  {['CREDEX', 'TASA_CERO', 'LINEA_CREDITO'].includes(p.metodo) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="number" min="1" placeholder={t('modal.cuotas')} value={p.cuotas || ''} onChange={(e) => updPago(i, { cuotas: e.target.value })}
                        className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink" />
                      <input type="text" placeholder={t('modal.banco')} value={p.banco || ''} onChange={(e) => updPago(i, { banco: e.target.value })}
                        className="w-28 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink" />
                      <input type="text" placeholder={t('modal.referencia')} value={p.referencia || ''} onChange={(e) => updPago(i, { referencia: e.target.value })}
                        className="w-32 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {pagos.some((p) => p.metodo === 'EFECTIVO' && Number(p.monto_recibido) > Number(p.monto)) && (
              <p className="mb-3 text-xs text-emerald-600">
                {t('modal.vuelto')}: ${pagos.reduce((s, p) => s + (p.metodo === 'EFECTIVO' && p.monto_recibido ? Math.max(Number(p.monto_recibido) - Number(p.monto), 0) : 0), 0).toLocaleString()}
              </p>
            )}

            <div className="mb-4 flex justify-between text-sm">
              <span className="text-muted">{vueltoGlobal > 0 ? t('modal.vuelto') : t('modal.saldoPendiente')}</span>
              <span className={`font-semibold ${saldo > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {simbolo}{Math.abs(saldo).toLocaleString()} ({otroSimbolo}{aOtraMoneda(Math.abs(saldo)).toLocaleString(undefined, { maximumFractionDigits: 2 })})
              </span>
            </div>
            {saldo > 0 && <p className="mb-4 -mt-2 text-xs text-amber-600">{t('modal.avisoCredito')}</p>}
            {vueltoGlobal > 0 && <p className="mb-4 -mt-2 text-xs text-emerald-600">{t('modal.avisoVuelto')}</p>}

            <div className="mb-2 text-xs font-semibold uppercase text-muted">{t('modal.checklistSalida')}</div>
            <div className="mb-4 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
              {checklistSalidaPara(modalOrden.categoria_equipo).map((item) => {
                const esCelular = esCCA(modalOrden.categoria_equipo)
                const ns = esCelular ? 'ordenes' : 'checklist'
                const prefix = esCelular ? 'checklistSalida' : 'items'
                return (
                  <label key={item} className="flex items-center gap-1.5 text-xs text-ink">
                    <input type="checkbox" checked={!!checklistSalida[item]}
                      onChange={(e) => setChecklistSalida((c) => ({ ...c, [item]: e.target.checked }))} />
                    {t(`${prefix}.${item}`, { ns })}
                  </label>
                )
              })}
            </div>

            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase text-muted">{t('modal.firmaEntrega')}</div>
              <div className="rounded-lg border border-line p-2">
                <FirmaDigital value={firmaEntrega} onChange={setFirmaEntrega} label={t('modal.firmaEntregaLabel')} />
              </div>
            </div>

            {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

            <div className="flex gap-2">
              <button onClick={confirmarFactura} disabled={guardando} className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {guardando ? t('modal.guardando', { ns: 'common' }) : t('modal.confirmar')}
              </button>
              <button onClick={() => setModalOrden(null)} className="rounded-lg border border-line px-4 py-2 text-sm text-muted">{t('botones.cancelar', { ns: 'common' })}</button>
            </div>
          </div>
        </div>
      )}
    </div>

    {reciboFactura && <ReciboPreview factura={reciboFactura} onClose={() => setReciboFactura(null)} />}

    {pdfOrden && (
      <OrdenPreview orden={pdfOrden.orden} cliente={pdfOrden.cliente} empresaNombre={pdfOrden.empresaNombre} onClose={() => setPdfOrden(null)} />
    )}

    {eligiendoImpresion && (
      <div className="modal-backdrop" onClick={() => setEligiendoImpresion(null)}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
          <h3 className="mb-1 text-base font-semibold text-ink">{t('modal.eligeImpresionTitulo')}</h3>
          <p className="mb-4 text-sm text-muted">{t('modal.eligeImpresionTexto')}</p>
          <div className="mb-2 flex flex-col gap-2">
            <button onClick={elegirImprimirPdf} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              {t('modal.imprimirPdf')}
            </button>
            <button onClick={elegirImprimirTicket} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-subtle">
              {t('modal.imprimirTicket')}
            </button>
            <button onClick={() => setEligiendoImpresion(null)} className="rounded-lg px-4 py-2 text-sm text-muted hover:underline">
              {t('modal.omitirImpresion')}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  )
}

export default FacturarOts
