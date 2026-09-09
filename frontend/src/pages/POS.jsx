import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Package, Wrench, FlaskConical, Cable, Tag, Laptop, ArrowLeft, ShoppingCart, Trash2, X } from 'lucide-react'
import { inventarioApi, ventasApi, configApi } from '../api.js'
import ReciboPreview from '../components/ReciboPreview.jsx'

const ICONO_TIPO = {
  PRODUCTO: Package,
  REPUESTO: Wrench,
  INSUMO: FlaskConical,
  EQUIPO: Laptop,
  ACCESORIO: Cable,
  OTRO: Tag,
}

const SIN_CATEGORIA = '__sin_categoria__'

function numeroVenta() {
  return `POS-${Date.now().toString().slice(-8)}`
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function POS() {
  const { t } = useTranslation('pos')
  const navigate = useNavigate()
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [categoriaId, setCategoriaId] = useState(null)
  const [buscar, setBuscar] = useState('')
  const [carrito, setCarrito] = useState([])
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTipo, setClienteTipo] = useState('')
  const [clienteCedula, setClienteCedula] = useState('')
  const [clienteRuc, setClienteRuc] = useState('')
  const [clientes, setClientes] = useState([])
  const [cobrando, setCobrando] = useState(false)
  const [reciboFactura, setReciboFactura] = useState(null)
  const [moneda, setMoneda] = useState('USD')
  const [tasa, setTasa] = useState(1)

  const [pagoModal, setPagoModal] = useState(false)
  const [tipoVenta, setTipoVenta] = useState('CONTADO')
  const [pagos, setPagos] = useState([{ metodo: 'EFECTIVO', monto: '', monto_recibido: '' }])
  const [pagoError, setPagoError] = useState('')

  useEffect(() => {
    inventarioApi.productos().then((r) => setProductos(r.data))
    inventarioApi.categorias().then((r) => setCategorias(r.data))
    ventasApi.clientes().then((r) => setClientes(r.data))
    configApi.obtener().then((r) => setTasa(Number(r.data.tasa_cambio_usd) || 1))
  }, [])

  // Los precios de Producto siempre viven en US$ (precio de lista); al
  // cobrar en córdobas se convierten aquí solo para mostrar y registrar la
  // venta — el catálogo de precios no se toca.
  const simbolo = moneda === 'NIO' ? 'C$' : '$'
  const otroSimbolo = moneda === 'NIO' ? '$' : 'C$'
  const factor = moneda === 'NIO' ? tasa : 1
  const enMoneda = (usd) => round2(Number(usd) * factor)

  // Herramientas de taller (categoría vendible=false) quedan fuera de POS a
  // propósito: son uso interno, no se venden — se administran en
  // Inventario, no en Facturación.
  const categoriasVendibles = useMemo(() => categorias.filter((c) => c.vendible !== false), [categorias])
  const idsNoVendibles = useMemo(() => new Set(categorias.filter((c) => c.vendible === false).map((c) => c.id)), [categorias])
  const productosVendibles = useMemo(() => productos.filter((p) => !idsNoVendibles.has(p.categoria)), [productos, idsNoVendibles])

  const q = buscar.trim().toLowerCase()
  const productosBuscados = useMemo(() => {
    if (!q) return []
    return productosVendibles.filter((p) => p.nombre.toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q))
  }, [productosVendibles, q])

  const categoriaActual = categoriasVendibles.find((c) => c.id === categoriaId)
  const productosDeCategoria = useMemo(() => {
    if (categoriaId === SIN_CATEGORIA) return productosVendibles.filter((p) => !p.categoria)
    return productosVendibles.filter((p) => p.categoria === categoriaId)
  }, [productosVendibles, categoriaId])

  const categoriasConConteo = useMemo(() => {
    const conteos = categoriasVendibles.map((c) => ({ ...c, count: productosVendibles.filter((p) => p.categoria === c.id).length }))
    const sinCategoria = productosVendibles.filter((p) => !p.categoria).length
    return sinCategoria > 0 ? [...conteos, { id: SIN_CATEGORIA, nombre: t('categorias.sinCategoria'), tipo: 'OTRO', count: sinCategoria }] : conteos
  }, [categoriasVendibles, productosVendibles, t])

  const agregar = (producto) => {
    setCarrito((c) => {
      const existe = c.find((i) => i.producto.id === producto.id)
      if (existe) return c.map((i) => (i.producto.id === producto.id ? { ...i, cantidad: round2(i.cantidad + 1) } : i))
      return [...c, { producto, cantidad: 1, precio: enMoneda(producto.precio_venta) }]
    })
  }

  const cambiarCantidad = (id, cantidad) => {
    const n = Math.max(0.001, Number(cantidad) || 0.001)
    setCarrito((c) => c.map((i) => (i.producto.id === id ? { ...i, cantidad: n } : i)))
  }

  const cambiarPrecio = (id, precio) => {
    const n = Math.max(0, Number(precio) || 0)
    setCarrito((c) => c.map((i) => (i.producto.id === id ? { ...i, precio: n } : i)))
  }

  const quitar = (id) => setCarrito((c) => c.filter((i) => i.producto.id !== id))
  const vaciar = () => setCarrito([])

  const cambiarMoneda = (nueva) => {
    if (nueva === moneda) return
    setCarrito((c) => c.map((i) => ({ ...i, precio: nueva === 'NIO' ? round2(i.precio * tasa) : round2(i.precio / tasa) })))
    setMoneda(nueva)
  }

  const total = carrito.reduce((s, i) => s + i.cantidad * i.precio, 0)
  const totalOtraMoneda = moneda === 'USD' ? total * tasa : total / tasa

  const resolverCliente = async () => {
    const nombre = clienteNombre.trim() || t('clienteGenerico')
    const existente = clientes.find((c) => c.nombre.trim().toLowerCase() === nombre.toLowerCase())
    if (existente) {
      const patch = {}
      if (clienteTipo && !existente.tipo_cliente) patch.tipo_cliente = clienteTipo
      if (clienteTipo === 'PARTICULAR' && clienteCedula.trim() && !existente.cedula) patch.cedula = clienteCedula.trim()
      if (clienteTipo === 'EMPRESA' && clienteRuc.trim() && !existente.documento) patch.documento = clienteRuc.trim()
      if (Object.keys(patch).length > 0) await ventasApi.actualizarCliente(existente.id, patch)
      return existente.id
    }
    const payload = { nombre }
    if (clienteTipo) payload.tipo_cliente = clienteTipo
    if (clienteTipo === 'PARTICULAR' && clienteCedula.trim()) payload.cedula = clienteCedula.trim()
    if (clienteTipo === 'EMPRESA' && clienteRuc.trim()) payload.documento = clienteRuc.trim()
    const res = await ventasApi.crearCliente(payload)
    return res.data.id
  }

  const seleccionarTipoVenta = (tipo) => {
    setTipoVenta(tipo)
    if (tipo === 'CONTADO') setPagos([{ metodo: 'EFECTIVO', monto: round2(total), monto_recibido: '' }])
    else if (tipo === 'TARJETA') setPagos([{ metodo: 'TARJETA', monto: round2(total), monto_recibido: '' }])
    else if (tipo === 'CREDITO') setPagos([{ metodo: 'EFECTIVO', monto: '', monto_recibido: '' }])
    else setPagos([{ metodo: 'EFECTIVO', monto: '', monto_recibido: '' }, { metodo: 'TARJETA', monto: '', monto_recibido: '' }])
  }

  const abrirPago = () => {
    if (carrito.length === 0) return
    seleccionarTipoVenta('CONTADO')
    setPagoError('')
    setPagoModal(true)
  }

  const totalPagado = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0)
  const saldo = round2(total - totalPagado)
  const addPago = () => setPagos((p) => [...p, { metodo: 'EFECTIVO', monto: '', monto_recibido: '' }])
  const updPago = (i, patch) => setPagos((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  const delPago = (i) => setPagos((p) => p.filter((_, idx) => idx !== i))
  const vueltoTotal = pagos.reduce((s, p) => s + (p.metodo === 'EFECTIVO' && p.monto_recibido ? Math.max(Number(p.monto_recibido) - Number(p.monto || 0), 0) : 0), 0)

  const cobrar = async () => {
    setPagoError('')
    if (saldo > 0 && !window.confirm(t('pago.confirmarCredito'))) return
    setCobrando(true)
    try {
      const clienteId = await resolverCliente()
      const factura = await ventasApi.crearFactura({ numero: numeroVenta(), cliente: clienteId, moneda })
      for (const item of carrito) {
        await ventasApi.crearDetalle({
          factura: factura.data.id, tipo: 'PRODUCTO', producto: item.producto.id,
          cantidad: item.cantidad, precio_unitario: item.precio,
        })
      }
      const pagosLimpios = pagos.filter((p) => Number(p.monto) > 0)
      for (const p of pagosLimpios) {
        await ventasApi.crearPago({
          factura: factura.data.id, metodo: p.metodo, monto: Number(p.monto),
          monto_recibido: p.metodo === 'EFECTIVO' && p.monto_recibido ? Number(p.monto_recibido) : null,
          cuotas: p.cuotas ? Number(p.cuotas) : null, banco: p.banco || '', referencia: p.referencia || '',
        })
      }
      setCarrito([])
      setClienteNombre('')
      setClienteTipo('')
      setClienteCedula('')
      setClienteRuc('')
      setPagoModal(false)
      const completa = await ventasApi.factura(factura.data.id)
      setReciboFactura(completa.data)
      // Intento silencioso a la impresora térmica configurada, además del
      // recibo en pantalla — si no hay una impresora térmica real (ej.
      // "Microsoft Print to PDF", que no entiende ESC/POS), esto simplemente
      // no hace nada visible; el recibo en pantalla es la vía confiable.
      ventasApi.imprimirFactura(factura.data.id).catch(() => {})
    } catch {
      setPagoError(t('mensajes.errorCobro'))
    } finally {
      setCobrando(false)
    }
  }

  const renderProductos = (lista) => (
    <div className="pos-grid-productos">
      {lista.map((p) => (
        <button key={p.id} className="pos-producto-card" onClick={() => agregar(p)} disabled={p.stock_actual <= 0}>
          <div className="pos-producto-nombre">{p.nombre}</div>
          <div className="pos-producto-precio">{simbolo}{enMoneda(p.precio_venta).toLocaleString()}</div>
          <div className="pos-producto-stock">{t('stock', { n: p.stock_actual })}</div>
        </button>
      ))}
      {lista.length === 0 && <div className="empty">{t('sinProductos')}</div>}
    </div>
  )

  return (
    <div>
      <button className="secondary area-volver" onClick={() => navigate('/ventas/facturacion')}><ArrowLeft size={15} /> {t('botones.volver', { ns: 'common' })}</button>

      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      <div className="pos-layout">
        <div className="card pos-productos">
          <input placeholder={t('buscarPlaceholder')} value={buscar} onChange={(e) => setBuscar(e.target.value)} style={{ marginBottom: 14 }} />

          {buscar ? (
            renderProductos(productosBuscados)
          ) : categoriaId === null ? (
            <div className="pos-categorias-grid">
              {categoriasConConteo.map((c) => {
                const Icono = ICONO_TIPO[c.tipo] || Tag
                return (
                  <button key={c.id} className="pos-categoria-card" onClick={() => setCategoriaId(c.id)}>
                    <div className="pos-categoria-icon"><Icono /></div>
                    <div className="pos-categoria-nombre">{c.nombre}</div>
                    <div className="pos-categoria-count">{t('categorias.productos', { n: c.count })}</div>
                  </button>
                )
              })}
              {categoriasConConteo.length === 0 && <div className="empty">{t('categorias.sinCategorias')}</div>}
            </div>
          ) : (
            <>
              <div className="pos-breadcrumb">
                <button className="pos-breadcrumb-back" onClick={() => setCategoriaId(null)}><ArrowLeft size={14} /> {t('categorias.volver')}</button>
                <span className="pos-breadcrumb-titulo">{categoriaActual?.nombre || t('categorias.sinCategoria')}</span>
              </div>
              {renderProductos(productosDeCategoria)}
            </>
          )}
        </div>

        <div className="card pos-carrito">
          <div className="pos-carrito-header">
            <h3><ShoppingCart /> {t('carrito.titulo')}</h3>
            {carrito.length > 0 && <span className="pos-carrito-badge">{t('carrito.items', { n: carrito.length })}</span>}
          </div>
          <div className="form-row" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('moneda.etiqueta')}</span>
            <select value={moneda} onChange={(e) => cambiarMoneda(e.target.value)} style={{ flex: 1 }}>
              <option value="USD">{t('moneda.usd')}</option>
              <option value="NIO">{t('moneda.nio')}</option>
            </select>
          </div>
          <div className="pos-cliente-tipo">
            <button type="button" className={clienteTipo === 'PARTICULAR' ? 'tab active' : 'tab'} onClick={() => setClienteTipo(clienteTipo === 'PARTICULAR' ? '' : 'PARTICULAR')}>{t('carrito.clienteParticular')}</button>
            <button type="button" className={clienteTipo === 'EMPRESA' ? 'tab active' : 'tab'} onClick={() => setClienteTipo(clienteTipo === 'EMPRESA' ? '' : 'EMPRESA')}>{t('carrito.clienteEmpresa')}</button>
          </div>
          {clienteTipo ? (
            <>
              <input
                placeholder={t('carrito.clienteNombrePlaceholder')} value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)}
                list="pos-clientes" style={{ marginBottom: 8 }}
              />
              {clienteTipo === 'PARTICULAR'
                ? <input placeholder={t('carrito.cedula')} value={clienteCedula} onChange={(e) => setClienteCedula(e.target.value)} style={{ marginBottom: 12 }} />
                : <input placeholder={t('carrito.ruc')} value={clienteRuc} onChange={(e) => setClienteRuc(e.target.value)} style={{ marginBottom: 12 }} />}
            </>
          ) : (
            <p className="pos-cliente-hint">{t('carrito.clienteHint')}</p>
          )}
          <datalist id="pos-clientes">{clientes.map((c) => <option key={c.id} value={c.nombre} />)}</datalist>

          {carrito.length === 0 ? (
            <div className="empty">
              <div className="empty-icon"><ShoppingCart /></div>
              {t('carrito.vacio')}
            </div>
          ) : (
            <div className="pos-carrito-lista">
              {carrito.map((i) => (
                <div key={i.producto.id} className="pos-carrito-item">
                  <div className="pos-carrito-item-top">
                    <div className="pos-carrito-item-nombre" title={i.producto.nombre}>{i.producto.nombre}</div>
                    <button className="pos-carrito-item-remove" onClick={() => quitar(i.producto.id)} title={t('botones.eliminar', { ns: 'common' })}><X /></button>
                  </div>
                  <div className="pos-carrito-item-detalle">
                    <input
                      type="number" min="0.001" step={i.producto.unidad_permite_fraccion ? '0.001' : '1'}
                      value={i.cantidad} onChange={(e) => cambiarCantidad(i.producto.id, e.target.value)} className="pos-carrito-item-cantidad"
                    />
                    <span className="pos-carrito-item-signo">×</span>
                    <input type="number" min="0" step="0.01" value={i.precio} onChange={(e) => cambiarPrecio(i.producto.id, e.target.value)} className="pos-carrito-item-precio" />
                    <span className="pos-carrito-item-signo">=</span>
                    <span className="pos-carrito-item-subtotal">{simbolo}{round2(i.cantidad * i.precio).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pos-total">
            <div className="pos-total-principal">
              <span>{t('carrito.total')}</span>
              <span>{simbolo}{round2(total).toLocaleString()}</span>
            </div>
            <div className="pos-total-secundario">≈ {otroSimbolo}{round2(totalOtraMoneda).toLocaleString()}</div>
          </div>

          <div className="form-row" style={{ marginTop: 14 }}>
            <button onClick={abrirPago} disabled={carrito.length === 0} style={{ flex: 1 }}>
              {t('carrito.cobrarImprimir')}
            </button>
            {carrito.length > 0 && <button className="secondary" onClick={vaciar} title={t('carrito.vaciar')}><Trash2 size={15} /></button>}
          </div>
        </div>
      </div>

      {pagoModal && (
        <div className="modal-backdrop" onClick={() => !cobrando && setPagoModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 14 }}>{t('pago.titulo')}</h3>

            <div className="pos-pago-resumen">
              <span>{t('carrito.total')}</span>
              <strong>{simbolo}{round2(total).toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>(≈ {otroSimbolo}{round2(totalOtraMoneda).toLocaleString()})</span></strong>
            </div>

            <div className="tabs" style={{ marginBottom: 14 }}>
              {['CONTADO', 'TARJETA', 'CREDITO', 'MULTIPLE'].map((tv) => (
                <button key={tv} type="button" className={tipoVenta === tv ? 'tab active' : 'tab'} onClick={() => seleccionarTipoVenta(tv)}>
                  {t(`pago.tipoVenta.${tv}`)}
                </button>
              ))}
            </div>

            {(tipoVenta === 'CONTADO' || tipoVenta === 'TARJETA') && pagos[0] && (
              <div className="pos-pago-fila-simple">
                <span className="pos-pago-metodo-fijo">{tipoVenta === 'CONTADO' ? t('pago.efectivo') : t('pago.tarjeta')}</span>
                <span className="pos-pago-monto-fijo">{simbolo}{round2(total).toLocaleString()}</span>
                {tipoVenta === 'CONTADO' && (
                  <input type="number" placeholder={t('pago.recibido')} value={pagos[0].monto_recibido} onChange={(e) => updPago(0, { monto_recibido: e.target.value })} />
                )}
              </div>
            )}

            {tipoVenta === 'CREDITO' && pagos[0] && (
              <>
                <p className="pos-pago-label-sm" style={{ marginBottom: 8 }}>{t('pago.abonoInicial')}</p>
                <div className="pos-pago-fila">
                  <select value={pagos[0].metodo} onChange={(e) => updPago(0, { metodo: e.target.value })}>
                    <option value="EFECTIVO">{t('pago.efectivo')}</option>
                    <option value="TARJETA">{t('pago.tarjeta')}</option>
                    <option value="CREDEX">{t('pago.credex')}</option>
                    <option value="TASA_CERO">{t('pago.tasaCero')}</option>
                    <option value="LINEA_CREDITO">{t('pago.lineaCredito')}</option>
                  </select>
                  <input type="number" placeholder={t('pago.monto')} value={pagos[0].monto} onChange={(e) => updPago(0, { monto: e.target.value })} />
                  {pagos[0].metodo === 'EFECTIVO' ? (
                    <input type="number" placeholder={t('pago.recibido')} value={pagos[0].monto_recibido} onChange={(e) => updPago(0, { monto_recibido: e.target.value })} />
                  ) : <span />}
                </div>
                {['CREDEX', 'TASA_CERO', 'LINEA_CREDITO'].includes(pagos[0].metodo) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: 4 }}>
                    <input type="number" min="1" placeholder={t('pago.cuotas')} value={pagos[0].cuotas || ''} onChange={(e) => updPago(0, { cuotas: e.target.value })} style={{ maxWidth: 110 }} />
                    <input type="text" placeholder={t('pago.banco')} value={pagos[0].banco || ''} onChange={(e) => updPago(0, { banco: e.target.value })} style={{ maxWidth: 150 }} />
                    <input type="text" placeholder={t('pago.referencia')} value={pagos[0].referencia || ''} onChange={(e) => updPago(0, { referencia: e.target.value })} style={{ maxWidth: 170 }} />
                  </div>
                )}
              </>
            )}

            {tipoVenta === 'MULTIPLE' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="pos-pago-label-sm">{t('pago.pagos')}</span>
                  <button type="button" className="pos-pago-agregar" onClick={addPago}>+ {t('pago.agregarPago')}</button>
                </div>
                {pagos.map((p, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <div className="pos-pago-fila">
                      <select value={p.metodo} onChange={(e) => updPago(i, { metodo: e.target.value })}>
                        <option value="EFECTIVO">{t('pago.efectivo')}</option>
                        <option value="TARJETA">{t('pago.tarjeta')}</option>
                        <option value="CREDEX">{t('pago.credex')}</option>
                        <option value="TASA_CERO">{t('pago.tasaCero')}</option>
                        <option value="LINEA_CREDITO">{t('pago.lineaCredito')}</option>
                      </select>
                      <input type="number" placeholder={t('pago.monto')} value={p.monto} onChange={(e) => updPago(i, { monto: e.target.value })} />
                      {p.metodo === 'EFECTIVO' ? (
                        <input type="number" placeholder={t('pago.recibido')} value={p.monto_recibido} onChange={(e) => updPago(i, { monto_recibido: e.target.value })} />
                      ) : <span />}
                      {pagos.length > 1 && <button type="button" className="danger" onClick={() => delPago(i)}>✕</button>}
                    </div>
                    {['CREDEX', 'TASA_CERO', 'LINEA_CREDITO'].includes(p.metodo) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                        <input type="number" min="1" placeholder={t('pago.cuotas')} value={p.cuotas || ''} onChange={(e) => updPago(i, { cuotas: e.target.value })} style={{ maxWidth: 110 }} />
                        <input type="text" placeholder={t('pago.banco')} value={p.banco || ''} onChange={(e) => updPago(i, { banco: e.target.value })} style={{ maxWidth: 150 }} />
                        <input type="text" placeholder={t('pago.referencia')} value={p.referencia || ''} onChange={(e) => updPago(i, { referencia: e.target.value })} style={{ maxWidth: 170 }} />
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {vueltoTotal > 0 && <div className="pos-vuelto">{t('pago.vuelto')}: {simbolo}{round2(vueltoTotal).toLocaleString()}</div>}

            <div className="pos-saldo-fila">
              <span>{t('pago.saldoPendiente')}</span>
              <strong style={{ color: saldo > 0 ? '#d97706' : 'var(--success)' }}>{simbolo}{Math.max(saldo, 0).toLocaleString()}</strong>
            </div>
            {saldo > 0 && <p className="pos-saldo-credito">{t('pago.avisoCredito')}</p>}

            {pagoError && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{pagoError}</div>}

            <div className="form-row" style={{ marginTop: 4 }}>
              <button onClick={cobrar} disabled={cobrando} style={{ flex: 1 }}>
                {cobrando ? t('carrito.cobrando') : t('pago.confirmar')}
              </button>
              <button className="secondary" onClick={() => setPagoModal(false)} disabled={cobrando}>{t('botones.cancelar', { ns: 'common' })}</button>
            </div>
          </div>
        </div>
      )}

      {reciboFactura && <ReciboPreview factura={reciboFactura} onClose={() => setReciboFactura(null)} />}
    </div>
  )
}

export default POS
