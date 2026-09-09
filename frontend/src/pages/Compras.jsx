import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShoppingCart, Users, ArrowLeft, Plus, Trash2, FileSpreadsheet, Pencil, FileText } from 'lucide-react'
import { comprasApi, inventarioApi } from '../api.js'
import Pagination from '../components/Pagination.jsx'

const PAGE_SIZE = 15
const emptyProveedor = { nombre: '', documento: '', email: '', telefono: '' }
const emptyOrden = { numero: '', proveedor: '', producto: '', cantidad: 1 }

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

const emptyCotCliForm = {
  ppto_numero: '', titulo: '', cliente_nombre: '', equipo_marca: '', servicio_producto: '',
  tipo_trabajo: '', periodo: '', fecha: '', contacto_nombre: '', contacto_puesto: '',
  contacto_telefono: '', contacto_email: '', ruc: '', tipo_cambio: '36.63',
  nota_garantia: '', observaciones: '',
}
const emptyLineaCliente = { descripcion: '', cantidad: 1, precio_unitario_usd: '', proveedor: '', costo_proveedor_unitario: '' }

function Compras() {
  const { t } = useTranslation('compras')
  const [vista, setVista] = useState(null)

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      {vista === null && <SelectorArea onSelect={setVista} t={t} />}
      {vista === 'compras' && <VistaCompras onVolver={() => setVista(null)} t={t} />}
      {vista === 'cotizaciones_clientes' && <VistaCotizacionesClientes onVolver={() => setVista(null)} t={t} />}
    </div>
  )
}

function SelectorArea({ onSelect, t }) {
  return (
    <div className="area-selector-grid">
      <button className="area-selector-card" onClick={() => onSelect('compras')}>
        <div className="area-selector-icon"><ShoppingCart /></div>
        <h3>{t('selector.compras.titulo')}</h3>
        <p>{t('selector.compras.descripcion')}</p>
      </button>
      <button className="area-selector-card" onClick={() => onSelect('cotizaciones_clientes')}>
        <div className="area-selector-icon"><Users /></div>
        <h3>{t('selector.cotizacionesClientes.titulo')}</h3>
        <p>{t('selector.cotizacionesClientes.descripcion')}</p>
      </button>
    </div>
  )
}

function VolverBtn({ onVolver, t }) {
  return (
    <button className="secondary area-volver" onClick={onVolver}><ArrowLeft size={15} /> {t('selector.volver')}</button>
  )
}

function VistaCompras({ onVolver, t }) {
  const [proveedores, setProveedores] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [proveedorForm, setProveedorForm] = useState(emptyProveedor)
  const [ordenForm, setOrdenForm] = useState(emptyOrden)
  const [paginaProveedores, setPaginaProveedores] = useState(1)
  const [paginaOrdenes, setPaginaOrdenes] = useState(1)

  const load = () => {
    setLoading(true)
    Promise.all([comprasApi.proveedores(), comprasApi.ordenes(), inventarioApi.productos()])
      .then(([pr, oc, p]) => {
        setProveedores(pr.data)
        setOrdenes(oc.data)
        setProductos(p.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleProveedorSubmit = (e) => {
    e.preventDefault()
    if (!proveedorForm.nombre) return
    comprasApi.crearProveedor(proveedorForm).then(() => {
      setProveedorForm(emptyProveedor)
      load()
    })
  }

  const handleOrdenSubmit = (e) => {
    e.preventDefault()
    if (!ordenForm.numero || !ordenForm.proveedor || !ordenForm.producto) return
    const producto = productos.find((p) => p.id === Number(ordenForm.producto))
    comprasApi.crearOrden({ numero: ordenForm.numero, proveedor: ordenForm.proveedor }).then((res) => {
      comprasApi.crearDetalle({
        orden: res.data.id,
        producto: ordenForm.producto,
        cantidad: ordenForm.cantidad,
        precio_unitario: producto.precio_compra,
      }).then(() => {
        setOrdenForm(emptyOrden)
        load()
      })
    })
  }

  const estadoBadge = (estado) => {
    if (estado === 'RECIBIDA') return <span className="badge ok">{t('estados.RECIBIDA')}</span>
    if (estado === 'CANCELADA') return <span className="badge off">{t('estados.CANCELADA')}</span>
    return <span className="badge pending">{t('estados.PENDIENTE')}</span>
  }

  return (
    <div>
      <VolverBtn onVolver={onVolver} t={t} />

      <div className="card">
        <h3>{t('proveedores.tituloNuevo')}</h3>
        <form onSubmit={handleProveedorSubmit}>
          <div className="form-row">
            <input placeholder={t('proveedores.nombre')} value={proveedorForm.nombre} onChange={(e) => setProveedorForm({ ...proveedorForm, nombre: e.target.value })} />
            <input placeholder={t('proveedores.documento')} value={proveedorForm.documento} onChange={(e) => setProveedorForm({ ...proveedorForm, documento: e.target.value })} />
            <input placeholder={t('proveedores.email')} value={proveedorForm.email} onChange={(e) => setProveedorForm({ ...proveedorForm, email: e.target.value })} />
            <input placeholder={t('proveedores.telefono')} value={proveedorForm.telefono} onChange={(e) => setProveedorForm({ ...proveedorForm, telefono: e.target.value })} />
            <button type="submit">{t('proveedores.botonAgregar')}</button>
          </div>
        </form>
        {!loading && (
          <table>
            <thead><tr><th>{t('proveedores.columnas.nombre')}</th><th>{t('proveedores.columnas.documento')}</th><th>{t('proveedores.columnas.email')}</th><th>{t('proveedores.columnas.telefono')}</th></tr></thead>
            <tbody>
              {proveedores.slice((paginaProveedores - 1) * PAGE_SIZE, paginaProveedores * PAGE_SIZE).map((p) => (
                <tr key={p.id}><td>{p.nombre}</td><td>{p.documento}</td><td>{p.email}</td><td>{p.telefono}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && proveedores.length > 0 && (
          <Pagination page={paginaProveedores} totalItems={proveedores.length} pageSize={PAGE_SIZE} onPageChange={setPaginaProveedores} />
        )}
      </div>

      <div className="card">
        <h3>{t('ordenes.tituloNueva')}</h3>
        <form onSubmit={handleOrdenSubmit}>
          <div className="form-row">
            <input placeholder={t('ordenes.numero')} value={ordenForm.numero} onChange={(e) => setOrdenForm({ ...ordenForm, numero: e.target.value })} />
            <select value={ordenForm.proveedor} onChange={(e) => setOrdenForm({ ...ordenForm, proveedor: e.target.value })}>
              <option value="">{t('ordenes.proveedorPlaceholder')}</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <select value={ordenForm.producto} onChange={(e) => setOrdenForm({ ...ordenForm, producto: e.target.value })}>
              <option value="">{t('ordenes.productoPlaceholder')}</option>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <input type="number" min="1" placeholder={t('ordenes.cantidad')} value={ordenForm.cantidad} onChange={(e) => setOrdenForm({ ...ordenForm, cantidad: e.target.value })} />
            <button type="submit">{t('ordenes.botonCrear')}</button>
          </div>
        </form>

        {loading && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
        {!loading && ordenes.length === 0 && <div className="empty">{t('ordenes.vacio')}</div>}
        {!loading && ordenes.length > 0 && (
          <table>
            <thead><tr><th>{t('ordenes.columnas.numero')}</th><th>{t('ordenes.columnas.proveedor')}</th><th>{t('ordenes.columnas.fecha')}</th><th>{t('ordenes.columnas.total')}</th><th>{t('ordenes.columnas.estado')}</th></tr></thead>
            <tbody>
              {ordenes.slice((paginaOrdenes - 1) * PAGE_SIZE, paginaOrdenes * PAGE_SIZE).map((o) => (
                <tr key={o.id}>
                  <td>{o.numero}</td>
                  <td>{o.proveedor_nombre}</td>
                  <td>{o.fecha}</td>
                  <td>${Number(o.total).toLocaleString()}</td>
                  <td>{estadoBadge(o.estado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && ordenes.length > 0 && (
          <Pagination page={paginaOrdenes} totalItems={ordenes.length} pageSize={PAGE_SIZE} onPageChange={setPaginaOrdenes} />
        )}
      </div>
    </div>
  )
}

// Cotización a CLIENTE (no a proveedor) — llena la plantilla real de Excel
// que RCP ya usaba a mano (mismo formato "PPTO", ver
// backend/compras/plantillas_excel/cotizacion_cliente.xlsx), en vez de
// escribirla a mano cada vez.
function totalUsdCliente(cot) {
  return (cot.items || []).reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario_usd), 0)
}

function VistaCotizacionesClientes({ onVolver, t }) {
  const [cotizaciones, setCotizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState(emptyCotCliForm)
  const [lineas, setLineas] = useState([{ ...emptyLineaCliente }])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [pagina, setPagina] = useState(1)
  const [editandoId, setEditandoId] = useState(null)
  const [itemsOriginalesIds, setItemsOriginalesIds] = useState([])

  const load = () => {
    setLoading(true)
    comprasApi.cotizacionesClientes().then((r) => setCotizaciones(r.data)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const abrirModal = () => {
    setEditandoId(null)
    setItemsOriginalesIds([])
    setForm({ ...emptyCotCliForm, fecha: hoyISO() })
    setLineas([{ ...emptyLineaCliente }])
    setError('')
    setModalAbierto(true)
  }

  const abrirModalEdicion = (c) => {
    setEditandoId(c.id)
    setItemsOriginalesIds((c.items || []).map((it) => it.id))
    setForm({
      ppto_numero: c.ppto_numero || '', titulo: c.titulo || '', cliente_nombre: c.cliente_nombre || '',
      equipo_marca: c.equipo_marca || '', servicio_producto: c.servicio_producto || '', tipo_trabajo: c.tipo_trabajo || '',
      periodo: c.periodo || '', fecha: c.fecha || hoyISO(), contacto_nombre: c.contacto_nombre || '',
      contacto_puesto: c.contacto_puesto || '', contacto_telefono: c.contacto_telefono || '', contacto_email: c.contacto_email || '',
      ruc: c.ruc || '', tipo_cambio: c.tipo_cambio || '36.63', nota_garantia: c.nota_garantia || '', observaciones: c.observaciones || '',
    })
    setLineas(
      (c.items && c.items.length > 0)
        ? c.items.map((it) => ({
            descripcion: it.descripcion, cantidad: it.cantidad, precio_unitario_usd: it.precio_unitario_usd,
            proveedor: it.proveedor || '', costo_proveedor_unitario: it.costo_proveedor_unitario ?? '',
          }))
        : [{ ...emptyLineaCliente }]
    )
    setError('')
    setModalAbierto(true)
  }

  const addLinea = () => setLineas((l) => [...l, { ...emptyLineaCliente }])
  const updLinea = (i, patch) => setLineas((l) => l.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  const delLinea = (i) => setLineas((l) => l.filter((_, idx) => idx !== i))

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.cliente_nombre.trim() || !form.fecha) return
    const validas = lineas.filter((l) => l.descripcion.trim() && Number(l.precio_unitario_usd) > 0)
    if (validas.length === 0) { setError(t('cotizacionesClientes.form.errorSinLineas')); return }
    setGuardando(true)
    try {
      const cotizacionId = editandoId
        ? (await comprasApi.actualizarCotizacionCliente(editandoId, form)).data.id
        : (await comprasApi.crearCotizacionCliente(form)).data.id
      if (editandoId) {
        // Más simple y confiable que diferenciar línea por línea: se
        // borran los ítems que ya existían y se vuelven a crear desde el
        // formulario, igual que al crear una cotización nueva.
        for (const itemId of itemsOriginalesIds) {
          await comprasApi.eliminarItemCotizacionCliente(itemId)
        }
      }
      for (const [i, l] of validas.entries()) {
        await comprasApi.crearItemCotizacionCliente({
          cotizacion: cotizacionId, descripcion: l.descripcion.trim(), cantidad: l.cantidad,
          precio_unitario_usd: l.precio_unitario_usd, proveedor: l.proveedor,
          costo_proveedor_unitario: l.costo_proveedor_unitario || null, orden: i,
        })
      }
      setModalAbierto(false)
      setEditandoId(null)
      load()
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data) : t('cotizacionesClientes.form.errorGenerico'))
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = (id) => {
    if (!window.confirm(t('cotizacionesClientes.confirmarEliminar'))) return
    comprasApi.eliminarCotizacionCliente(id).then(load)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <VolverBtn onVolver={onVolver} t={t} />
        <button onClick={abrirModal}><Plus size={15} /> {t('cotizacionesClientes.botonNueva')}</button>
      </div>

      <div className="card">
        {loading && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
        {!loading && cotizaciones.length === 0 && <div className="empty">{t('cotizacionesClientes.vacio')}</div>}
        {!loading && cotizaciones.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>{t('cotizacionesClientes.columnas.numero')}</th>
                <th>{t('cotizacionesClientes.columnas.cliente')}</th>
                <th>{t('cotizacionesClientes.columnas.fecha')}</th>
                <th>{t('cotizacionesClientes.columnas.totalUsd')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cotizaciones.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE).map((c) => (
                <tr key={c.id}>
                  <td>{c.ppto_numero || '—'}</td>
                  <td>{c.cliente_nombre}</td>
                  <td>{c.fecha}</td>
                  <td>${totalUsdCliente(c).toLocaleString()}</td>
                  <td className="actions">
                    <button className="secondary" onClick={() => abrirModalEdicion(c)}><Pencil size={14} /> {t('botones.editar', { ns: 'common' })}</button>
                    <button className="secondary" onClick={() => comprasApi.verPdfCotizacionCliente(c.id)}><FileText size={14} /> {t('cotizacionesClientes.pdf')}</button>
                    <button className="secondary" onClick={() => comprasApi.exportarCotizacionClienteExcel(c.id, c.ppto_numero)}><FileSpreadsheet size={14} /> {t('cotizacionesClientes.excel')}</button>
                    <button className="danger" onClick={() => eliminar(c.id)}>{t('botones.eliminar', { ns: 'common' })}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && cotizaciones.length > 0 && (
          <Pagination page={pagina} totalItems={cotizaciones.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />
        )}
      </div>

      {modalAbierto && (
        <div className="modal-backdrop" onClick={() => !guardando && setModalAbierto(false)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 4 }}>{editandoId ? t('cotizacionesClientes.botonEditar') : t('cotizacionesClientes.botonNueva')}</h3>
            <p style={{ marginTop: 0, marginBottom: 14, color: 'var(--text)', fontSize: 13 }}>{t('cotizacionesClientes.form.subtitulo')}</p>
            <form onSubmit={guardar}>
              <div className="form-row">
                <input placeholder={t('cotizacionesClientes.form.pptoNumero')} value={form.ppto_numero} onChange={(e) => setForm({ ...form, ppto_numero: e.target.value })} />
                <input placeholder={t('cotizacionesClientes.form.titulo')} style={{ flex: '1 1 260px' }} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </div>
              <div className="form-row">
                <input placeholder={t('cotizacionesClientes.form.cliente')} style={{ flex: '1 1 200px' }} value={form.cliente_nombre} onChange={(e) => setForm({ ...form, cliente_nombre: e.target.value })} />
                <input placeholder={t('cotizacionesClientes.form.equipoMarca')} value={form.equipo_marca} onChange={(e) => setForm({ ...form, equipo_marca: e.target.value })} />
                <input placeholder={t('cotizacionesClientes.form.servicioProducto')} value={form.servicio_producto} onChange={(e) => setForm({ ...form, servicio_producto: e.target.value })} />
              </div>
              <div className="form-row">
                <input placeholder={t('cotizacionesClientes.form.tipoTrabajo')} value={form.tipo_trabajo} onChange={(e) => setForm({ ...form, tipo_trabajo: e.target.value })} />
                <input placeholder={t('cotizacionesClientes.form.periodo')} value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} style={{ maxWidth: 100 }} />
                <input type="number" step="0.01" placeholder={t('cotizacionesClientes.form.tipoCambio')} value={form.tipo_cambio} onChange={(e) => setForm({ ...form, tipo_cambio: e.target.value })} style={{ maxWidth: 130 }} />
                <input placeholder={t('cotizacionesClientes.form.ruc')} value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} />
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text)', opacity: 0.8, margin: '12px 0 6px' }}>{t('cotizacionesClientes.form.datosContacto')}</div>
              <div className="form-row">
                <input placeholder={t('cotizacionesClientes.form.contactoNombre')} value={form.contacto_nombre} onChange={(e) => setForm({ ...form, contacto_nombre: e.target.value })} />
                <input placeholder={t('cotizacionesClientes.form.contactoPuesto')} value={form.contacto_puesto} onChange={(e) => setForm({ ...form, contacto_puesto: e.target.value })} />
                <input placeholder={t('cotizacionesClientes.form.contactoTelefono')} value={form.contacto_telefono} onChange={(e) => setForm({ ...form, contacto_telefono: e.target.value })} />
                <input placeholder={t('cotizacionesClientes.form.contactoEmail')} value={form.contacto_email} onChange={(e) => setForm({ ...form, contacto_email: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 8px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text)', opacity: 0.8 }}>{t('cotizacionesClientes.form.lineas')}</span>
                <button type="button" className="secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={addLinea}><Plus size={13} /> {t('cotizacionesClientes.form.agregarLinea')}</button>
              </div>
              {lineas.map((l, i) => (
                <div key={i} className="form-row" style={{ marginBottom: 8 }}>
                  <input style={{ flex: '1 1 220px' }} placeholder={t('cotizacionesClientes.form.descripcion')} value={l.descripcion} onChange={(e) => updLinea(i, { descripcion: e.target.value })} />
                  <input type="number" min="1" style={{ flex: '0 1 70px' }} placeholder={t('ordenes.cantidad')} value={l.cantidad} onChange={(e) => updLinea(i, { cantidad: e.target.value })} />
                  <input type="number" min="0" step="0.01" style={{ flex: '0 1 110px' }} placeholder={t('cotizacionesClientes.form.precioUsd')} value={l.precio_unitario_usd} onChange={(e) => updLinea(i, { precio_unitario_usd: e.target.value })} />
                  <input style={{ flex: '0 1 130px' }} placeholder={t('cotizacionesClientes.form.proveedorOpcional')} value={l.proveedor} onChange={(e) => updLinea(i, { proveedor: e.target.value })} />
                  <input type="number" min="0" step="0.01" style={{ flex: '0 1 110px' }} placeholder={t('cotizacionesClientes.form.costoProveedorOpcional')} value={l.costo_proveedor_unitario} onChange={(e) => updLinea(i, { costo_proveedor_unitario: e.target.value })} />
                  {lineas.length > 1 && <button type="button" className="danger" onClick={() => delLinea(i)}><Trash2 size={14} /></button>}
                </div>
              ))}

              <div className="form-row" style={{ marginTop: 10 }}>
                <textarea style={{ flex: '1 1 100%', minHeight: 40 }} placeholder={t('cotizacionesClientes.form.notaGarantia')} value={form.nota_garantia} onChange={(e) => setForm({ ...form, nota_garantia: e.target.value })} />
              </div>
              <div className="form-row">
                <textarea style={{ flex: '1 1 100%', minHeight: 50 }} placeholder={t('cotizacionesClientes.form.observaciones')} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
              </div>

              {error && <div style={{ color: 'var(--danger)', fontSize: 13, margin: '10px 0' }}>{error}</div>}
              <div className="form-row" style={{ marginTop: 14 }}>
                <button type="submit" disabled={guardando} style={{ flex: 1 }}>{guardando ? t('botones.guardando', { ns: 'common' }) : t('botones.guardar', { ns: 'common' })}</button>
                <button type="button" className="secondary" onClick={() => setModalAbierto(false)} disabled={guardando}>{t('botones.cancelar', { ns: 'common' })}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Compras
