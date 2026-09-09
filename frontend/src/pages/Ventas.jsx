import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ventasApi, inventarioApi } from '../api.js'
import { useAuth } from '../AuthContext.jsx'

const emptyVenta = { numero: '', clienteNombre: '', producto: '', cantidad: 1 }

function Ventas() {
  const { t } = useTranslation('ventas')
  const { user } = useAuth()
  const [clientes, setClientes] = useState([])
  const [facturas, setFacturas] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyVenta)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([ventasApi.clientes(), ventasApi.facturas(), inventarioApi.productos()])
      .then(([c, f, p]) => {
        setClientes(c.data)
        setFacturas(f.data)
        setProductos(p.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const resolverCliente = async (nombreEscrito) => {
    const nombre = nombreEscrito.trim()
    const existente = clientes.find((c) => c.nombre.trim().toLowerCase() === nombre.toLowerCase())
    if (existente) return existente.id
    const res = await ventasApi.crearCliente({ nombre })
    return res.data.id
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.numero || !form.clienteNombre.trim() || !form.producto) {
      setError(t('form.errorObligatorio'))
      return
    }
    setGuardando(true)
    try {
      const clienteId = await resolverCliente(form.clienteNombre)
      const res = await ventasApi.crearFactura({ numero: form.numero, cliente: clienteId })
      const producto = productos.find((p) => p.id === Number(form.producto))
      await ventasApi.crearDetalle({
        factura: res.data.id, tipo: 'PRODUCTO', producto: form.producto,
        cantidad: form.cantidad, precio_unitario: producto.precio_venta,
      })
      setForm(emptyVenta)
      load()
    } catch {
      setError(t('form.errorGenerico'))
    } finally {
      setGuardando(false)
    }
  }

  const estadoBadge = (estado) => {
    if (estado === 'PAGADA') return <span className="badge ok">{t('estado.pagada', { ns: 'common' })}</span>
    if (estado === 'ANULADA') return <span className="badge off">{t('estado.anulada', { ns: 'common' })}</span>
    return <span className="badge pending">{t('estado.pendiente', { ns: 'common' })}</span>
  }

  const productosFiltrados = filtroCategoria ? productos.filter((p) => p.categoria_nombre === filtroCategoria) : productos
  const categoriasDisponibles = [...new Set(productos.map((p) => p.categoria_nombre).filter(Boolean))]

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>
          {t('subtitulo.texto')}{' '}
          <Link to="/ordenes/nueva" style={{ color: 'var(--accent)', fontWeight: 600 }}>{t('subtitulo.enlace')}</Link>.
        </p>
      </div>

      <div className="card">
        <h3>{t('form.titulo')}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <input placeholder={t('form.numero')} value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
            <input
              placeholder={t('form.cliente')} list="clientes-lista"
              value={form.clienteNombre} onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })}
            />
            <datalist id="clientes-lista">
              {clientes.map((c) => <option key={c.id} value={c.nombre} />)}
            </datalist>
            <div className="chip" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>{t('form.vendedor', { nombre: user.nombre })}</div>
          </div>
          <div className="form-row">
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
              <option value="">{t('form.todasCategorias')}</option>
              {categoriasDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.producto} onChange={(e) => setForm({ ...form, producto: e.target.value })}>
              <option value="">{t('form.producto')}</option>
              {productosFiltrados.map((p) => <option key={p.id} value={p.id}>{p.nombre} — ${Number(p.precio_venta).toLocaleString()}</option>)}
            </select>
            <input type="number" min="1" placeholder={t('form.cantidad')} value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <button type="submit" disabled={guardando}>{guardando ? t('botones.guardando', { ns: 'common' }) : t('form.registrar')}</button>
        </form>
      </div>

      <div className="card">
        {loading && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
        {!loading && facturas.length === 0 && <div className="empty">{t('tabla.sinVentas')}</div>}
        {!loading && facturas.length > 0 && (
          <table>
            <thead><tr><th>{t('tabla.numero')}</th><th>{t('tabla.cliente')}</th><th>{t('tabla.vendedor')}</th><th>{t('tabla.detalle')}</th><th>{t('tabla.fecha')}</th><th>{t('tabla.total')}</th><th>{t('tabla.estado')}</th></tr></thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.id}>
                  <td>{f.numero}</td>
                  <td>{f.cliente_nombre}</td>
                  <td>{f.vendedor_nombre || '—'}</td>
                  <td>
                    <div className="chip-list">
                      {f.detalles.map((d) => (
                        <span key={d.id} className="chip" style={d.tipo === 'SERVICIO' ? { background: 'rgba(220,38,38,.12)', color: 'var(--danger)' } : {}}>
                          {d.tipo === 'SERVICIO'
                            ? `${d.servicio_tipo} — ${d.equipo_descripcion}${d.orden_taller_numero ? ` (${d.orden_taller_numero})` : ''}`
                            : `${d.producto_nombre} x${d.cantidad}`}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{f.fecha}</td>
                  <td>${Number(f.total).toLocaleString()}</td>
                  <td>{estadoBadge(f.estado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Ventas
