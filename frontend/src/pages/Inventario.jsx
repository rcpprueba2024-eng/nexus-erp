import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Wrench, ShoppingBag, Briefcase, Archive, Tag, ArrowLeft } from 'lucide-react'
import { inventarioApi, MEDIA_BASE_URL } from '../api.js'
import { capitalizarTexto } from '../textUtils.js'
import Pagination from '../components/Pagination.jsx'

const PAGE_SIZE = 15

// Los 4 inventarios separados que pidió el negocio — cada uno es, por
// debajo, el mismo Producto de siempre filtrado por su `subgrupo` (no hay
// 4 tablas distintas: un mismo repuesto no debería poder "existir" en dos
// inventarios a la vez). El mapeo lo confirmó el jefe: Taller = insumos de
// taller, Ventas = repuestos/insumos/equipos para vender, Activos Fijos =
// equipo de uso interno del personal, Huesera = equipos abandonados de los
// que se sacan repuestos.
const INVENTARIOS = [
  { key: 'taller', subgrupo: 'INSUMO_TALLER', icon: Wrench },
  { key: 'ventas', subgrupo: 'REPUESTO', icon: ShoppingBag },
  { key: 'activosFijos', subgrupo: 'USO_PERSONAL', icon: Briefcase },
  { key: 'huesera', subgrupo: 'ABANDONADA', icon: Archive },
]

const MONEDAS = ['USD', 'NIO']
const SIMBOLO_MONEDA = { USD: 'US$', NIO: 'C$' }
const CONDICIONES = ['NUEVO', 'USADO', 'MAL_ESTADO']

const SUBTABS = ['productos', 'agregar', 'bajas']

const emptyBaja = { cantidad: '', origen: '', area_destino: '', entregado_a: '', motivo: '' }

function emptyProducto(subgrupo) {
  return {
    codigo: '', nombre: '', categoria: '', subcategoria: '', marca: '', modelo: '', no_serie: '', condicion: 'NUEVO',
    subgrupo, unidad_medida: '', ubicacion: '', nivel: '', asignacion: '',
    descripcion: '', detalles: '', moneda: 'USD', precio_compra: '', precio_venta: '', stock_actual: 0, stock_minimo: 0,
  }
}
const emptyMarca = { nombre: '' }
const emptyModelo = { marca: '', nombre: '' }

function Inventario() {
  const { t } = useTranslation('inventario')
  const [vista, setVista] = useState(null) // null | 'taller' | 'ventas' | 'activosFijos' | 'huesera' | 'marcas'

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      {vista === null && <SelectorInventarios onSelect={setVista} t={t} />}
      {INVENTARIOS.some((inv) => inv.key === vista) && (
        <VistaInventario config={INVENTARIOS.find((inv) => inv.key === vista)} onVolver={() => setVista(null)} t={t} />
      )}
      {vista === 'marcas' && <VistaMarcasModelos onVolver={() => setVista(null)} t={t} />}
    </div>
  )
}

function SelectorInventarios({ onSelect, t }) {
  return (
    <div className="area-selector-grid">
      {INVENTARIOS.map(({ key, icon: Icon }) => (
        <button key={key} className="area-selector-card" onClick={() => onSelect(key)}>
          <div className="area-selector-icon"><Icon /></div>
          <h3>{t(`selector.${key}.titulo`)}</h3>
          <p>{t(`selector.${key}.descripcion`)}</p>
        </button>
      ))}
      <button className="area-selector-card" onClick={() => onSelect('marcas')}>
        <div className="area-selector-icon"><Tag /></div>
        <h3>{t('selector.marcas.titulo')}</h3>
        <p>{t('selector.marcas.descripcion')}</p>
      </button>
    </div>
  )
}

function VolverBtn({ onVolver, t }) {
  return (
    <button className="secondary area-volver" onClick={onVolver}><ArrowLeft size={15} /> {t('selector.volver')}</button>
  )
}

// Un solo componente para los 4 inventarios (Taller/Ventas/Activos
// Fijos/Huesera) — cada uno es el mismo Producto de siempre, filtrado por
// `config.subgrupo`. Al crear un artículo desde acá, el subgrupo queda fijo
// (no hay que elegirlo a mano ni riesgo de que se cuele en el inventario
// equivocado).
function VistaInventario({ config, onVolver, t }) {
  const { subgrupo } = config
  const [subtab, setSubtab] = useState('productos')
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [subcategorias, setSubcategorias] = useState([])
  const [marcas, setMarcas] = useState([])
  const [modelos, setModelos] = useState([])
  const [unidades, setUnidades] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(1)

  const [form, setForm] = useState(emptyProducto(subgrupo))
  const [imagenFile, setImagenFile] = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)
  const fileInputRef = useRef(null)
  const [editandoId, setEditandoId] = useState(null)
  const [previewProducto, setPreviewProducto] = useState(null)

  const [modeloModal, setModeloModal] = useState(false)
  const [modeloForm, setModeloForm] = useState(emptyModelo)

  const [bajas, setBajas] = useState([])
  const [bajaProducto, setBajaProducto] = useState(null)
  const [bajaForm, setBajaForm] = useState(emptyBaja)

  const load = () => {
    setLoading(true)
    Promise.all([inventarioApi.productos(), inventarioApi.categorias(), inventarioApi.subcategorias(), inventarioApi.marcas(), inventarioApi.modelos(), inventarioApi.unidades(), inventarioApi.bajas()])
      .then(([p, c, s, m, mo, u, b]) => {
        setProductos(p.data.filter((x) => x.subgrupo === subgrupo))
        setCategorias(c.data)
        setSubcategorias(s.data)
        setMarcas(m.data)
        setModelos(mo.data)
        setUnidades(u.data)
        setBajas(b.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [subgrupo])
  useEffect(() => { setPagina(1) }, [buscar])

  const handleImagenChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImagenFile(file)
    setImagenPreview(URL.createObjectURL(file))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.codigo || !form.nombre) return
    const data = new FormData()
    Object.entries({ ...form, nombre: capitalizarTexto(form.nombre.trim()) }).forEach(([k, v]) => data.append(k, v ?? ''))
    if (imagenFile) data.append('imagen', imagenFile)
    const guardar = editandoId ? inventarioApi.actualizarProducto(editandoId, data) : inventarioApi.crearProducto(data)
    guardar.then(() => {
      setForm(emptyProducto(subgrupo))
      setImagenFile(null)
      setImagenPreview(null)
      setEditandoId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setSubtab('productos')
      load()
    })
  }

  const handleDelete = (id) => {
    inventarioApi.eliminarProducto(id).then(load)
  }

  const abrirEditar = (p) => {
    setForm({
      codigo: p.codigo, nombre: p.nombre, categoria: p.categoria ?? '', subcategoria: p.subcategoria ?? '',
      marca: p.marca ?? '', modelo: p.modelo ?? '', no_serie: p.no_serie ?? '', condicion: p.condicion || 'NUEVO',
      subgrupo, unidad_medida: p.unidad_medida ?? '', ubicacion: p.ubicacion ?? '',
      nivel: p.nivel ?? '', asignacion: p.asignacion ?? '', descripcion: p.descripcion ?? '', detalles: p.detalles ?? '',
      moneda: p.moneda || 'USD', precio_compra: p.precio_compra ?? '', precio_venta: p.precio_venta ?? '',
      stock_actual: p.stock_actual ?? 0, stock_minimo: p.stock_minimo ?? 0,
    })
    setImagenFile(null)
    setImagenPreview(p.imagen ? (p.imagen.startsWith('http') ? p.imagen : `${MEDIA_BASE_URL}${p.imagen}`) : null)
    setEditandoId(p.id)
    setSubtab('agregar')
  }

  const cancelarEdicion = () => {
    setForm(emptyProducto(subgrupo))
    setImagenFile(null)
    setImagenPreview(null)
    setEditandoId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setSubtab('productos')
  }

  const [errorBaja, setErrorBaja] = useState('')

  const abrirBaja = (p) => {
    setBajaProducto(p)
    setErrorBaja('')
    // Precargada con todo el stock actual — lo normal es dar de baja todo,
    // pero se puede bajar el numero si solo salen algunas unidades.
    setBajaForm({ ...emptyBaja, cantidad: p.stock_actual, origen: p.ubicacion || '' })
  }

  const handleBajaSubmit = (e) => {
    e.preventDefault()
    setErrorBaja('')
    if (!bajaForm.cantidad || Number(bajaForm.cantidad) <= 0) {
      setErrorBaja(t('bajas.errorCantidad'))
      return
    }
    inventarioApi.crearBaja({ producto: bajaProducto.id, ...bajaForm })
      .then(() => {
        setBajaProducto(null)
        setBajaForm(emptyBaja)
        load()
      })
      .catch((err) => setErrorBaja(err.response?.data?.non_field_errors?.[0] || err.response?.data?.detail || t('bajas.errorGenerico')))
  }

  const guardarModeloRapido = async (e) => {
    e.preventDefault()
    if (!modeloForm.nombre.trim() || !modeloForm.marca) return
    const res = await inventarioApi.crearModelo({ marca: modeloForm.marca, nombre: capitalizarTexto(modeloForm.nombre.trim()) })
    const nuevosModelos = await inventarioApi.modelos()
    setModelos(nuevosModelos.data)
    setForm((prev) => ({ ...prev, modelo: res.data.id }))
    setModeloForm(emptyModelo)
    setModeloModal(false)
  }

  // Un producto dado de baja sale del listado activo (ya no es inventario
  // disponible) y pasa a la pestaña "Bajas" como registro historico.
  const activos = productos.filter((p) => p.activo !== false)
  const q = buscar.trim().toLowerCase()
  const visiblesTotal = q
    ? activos.filter((p) => [p.codigo, p.nombre, p.marca_nombre, p.modelo_nombre].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
    : activos
  const visibles = visiblesTotal.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)
  const subcategoriasDeCategoria = subcategorias.filter((s) => String(s.categoria) === String(form.categoria))
  const modelosDeMarca = modelos.filter((m) => String(m.marca) === String(form.marca))
  const idsDelSubgrupo = new Set(productos.map((p) => p.id))
  const bajasDelSubgrupo = bajas.filter((b) => idsDelSubgrupo.has(b.producto))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <VolverBtn onVolver={onVolver} t={t} />
      </div>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{t(`selector.${config.key}.titulo`)}</h2>
      </div>

      <div className="subtabs">
        {SUBTABS.map((tab) => (
          <button key={tab} className={subtab === tab ? 'subtab active' : 'subtab'} onClick={() => setSubtab(tab)}>{t(`subtabs.${tab}`)}</button>
        ))}
      </div>

      {subtab === 'productos' && (
        <>
          <div className="form-row">
            <input
              value={buscar} onChange={(e) => setBuscar(e.target.value)}
              placeholder={t('productos.buscarPlaceholder')}
              style={{ flex: '1 1 320px', maxWidth: 420 }}
            />
          </div>

          <div className="card">
            {loading && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
            {!loading && visibles.length === 0 && <div className="empty">{t('productos.sinProductos')}</div>}
            {!loading && visibles.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t('tabla.item')}</th>
                      <th>{t('tabla.tipo')}</th>
                      <th>{t('tabla.articulo')}</th>
                      <th>{t('tabla.marca')}</th>
                      <th>{t('tabla.modelo')}</th>
                      <th>{t('tabla.noSerie')}</th>
                      <th>{t('tabla.caracteristicas')}</th>
                      <th>{t('tabla.existencia')}</th>
                      <th>{t('tabla.ubicacion')}</th>
                      <th>{t('tabla.asignacion')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((p) => (
                      <tr key={p.id}>
                        <td>{p.codigo}</td>
                        <td>{p.categoria_nombre || '—'}</td>
                        <td>{p.nombre}</td>
                        <td>{p.marca_nombre || '—'}</td>
                        <td>{p.modelo_nombre || '—'}</td>
                        <td>{p.no_serie || '—'}</td>
                        <td style={{ maxWidth: 220, whiteSpace: 'pre-wrap' }}>{p.detalles || '—'}</td>
                        <td>
                          {p.stock_actual}
                          {Number(p.stock_actual) <= Number(p.stock_minimo) && <span className="badge off" style={{ marginLeft: 6 }}>{t('productos.bajoStock')}</span>}
                        </td>
                        <td>{p.ubicacion || '—'}{p.nivel ? ` / ${p.nivel}` : ''}</td>
                        <td>{p.asignacion || '—'}</td>
                        <td className="actions">
                          <button className="secondary" onClick={() => setPreviewProducto(p)}>{t('productos.registro')}</button>
                          <button className="secondary" onClick={() => abrirEditar(p)}>{t('botones.editar', { ns: 'common' })}</button>
                          <button className="secondary" onClick={() => abrirBaja(p)}>{t('bajas.darDeBaja')}</button>
                          <button className="danger" onClick={() => handleDelete(p.id)}>{t('botones.eliminar', { ns: 'common' })}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={pagina} totalItems={visiblesTotal.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />
          </div>
        </>
      )}

      {subtab === 'agregar' && (
        <div className="card">
          <h3>{editandoId ? t('agregar.tituloEditar') : t('agregar.titulo')}</h3>
          <form onSubmit={handleSubmit}>
            <div className="producto-form-grid">
              <div>
                <label className="imagen-drop" onClick={() => fileInputRef.current?.click()}>
                  {imagenPreview ? <img src={imagenPreview} alt="" /> : <span>{t('agregar.fotoProducto')}<br />{t('agregar.clicSubir')}</span>}
                </label>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImagenChange} style={{ display: 'none' }} />
              </div>
              <div>
                <div className="form-row">
                  <input placeholder={t('agregar.placeholders.codigo')} value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
                  <input placeholder={t('agregar.placeholders.nombre')} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                  <select value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value, modelo: '' })}>
                    <option value="">{t('agregar.placeholders.marcaSeleccionar')}</option>
                    {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value, subcategoria: '' })}>
                    <option value="">{t('agregar.placeholders.categoriaSeleccionar')}</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  <select value={form.subcategoria} onChange={(e) => setForm({ ...form, subcategoria: e.target.value })} disabled={!form.categoria}>
                    <option value="">{t('agregar.placeholders.subcategoriaSeleccionar')}</option>
                    {subcategoriasDeCategoria.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                  <select value={form.unidad_medida} onChange={(e) => setForm({ ...form, unidad_medida: e.target.value })}>
                    <option value="">{t('agregar.placeholders.unidadSeleccionar')}</option>
                    {unidades.map((u) => <option key={u.id} value={u.id}>{u.nombre}{u.abreviatura ? ` (${u.abreviatura})` : ''}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <select value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} disabled={!form.marca}>
                    <option value="">{form.marca ? t('agregar.placeholders.modeloSeleccionar') : t('agregar.placeholders.modeloSeleccionaMarcaPrimero')}</option>
                    {modelosDeMarca.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                  <button type="button" onClick={() => { setModeloForm({ ...emptyModelo, marca: form.marca }); setModeloModal(true) }} disabled={!form.marca} title={t('agregar.nuevoModelo')}>+</button>
                  <input placeholder={t('agregar.placeholders.noSerie')} value={form.no_serie} onChange={(e) => setForm({ ...form, no_serie: e.target.value })} />
                  <select value={form.condicion} onChange={(e) => setForm({ ...form, condicion: e.target.value })}>
                    {CONDICIONES.map((c) => <option key={c} value={c}>{t(`condiciones.${c}`)}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })} style={{ maxWidth: 160 }}>
                    {MONEDAS.map((m) => <option key={m} value={m}>{t(`monedas.${m}`, { ns: 'common' })}</option>)}
                  </select>
                  <input type="number" placeholder={t('agregar.placeholders.precioCompra', { simbolo: SIMBOLO_MONEDA[form.moneda] })} value={form.precio_compra} onChange={(e) => setForm({ ...form, precio_compra: e.target.value })} />
                  <input type="number" placeholder={t('agregar.placeholders.precioVenta', { simbolo: SIMBOLO_MONEDA[form.moneda] })} value={form.precio_venta} onChange={(e) => setForm({ ...form, precio_venta: e.target.value })} />
                </div>
                <div className="form-row">
                  <div style={{ flex: '1 1 160px' }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{t('agregar.placeholders.stockInicial')}</label>
                    <input type="number" style={{ width: '100%' }} value={form.stock_actual} onChange={(e) => setForm({ ...form, stock_actual: e.target.value })} />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{t('agregar.placeholders.stockMinimo')}</label>
                    <input type="number" style={{ width: '100%' }} value={form.stock_minimo} onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <input placeholder={t('agregar.placeholders.ubicacion')} value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} />
                  <input placeholder={t('agregar.placeholders.nivel')} value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })} />
                  <input placeholder={t('agregar.placeholders.asignacion')} value={form.asignacion} onChange={(e) => setForm({ ...form, asignacion: e.target.value })} />
                </div>
                <div className="form-row">
                  <textarea style={{ flex: '1 1 100%', minHeight: 60 }} placeholder={t('agregar.placeholders.descripcion')} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
                </div>
                <div className="form-row">
                  <textarea style={{ flex: '1 1 100%', minHeight: 60 }} placeholder={t('agregar.placeholders.detalles')} value={form.detalles} onChange={(e) => setForm({ ...form, detalles: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="form-row" style={{ marginTop: 4 }}>
              <button type="submit">{editandoId ? t('agregar.guardarCambios') : t('agregar.guardarProducto')}</button>
              {editandoId && <button type="button" className="secondary" onClick={cancelarEdicion}>{t('botones.cancelar', { ns: 'common' })}</button>}
            </div>
          </form>
        </div>
      )}

      {subtab === 'bajas' && (
        <div className="card">
          <h3>{t('bajas.titulo')}</h3>
          <p style={{ marginTop: -6, marginBottom: 16, color: 'var(--text)', fontSize: 13 }}>{t('bajas.subtitulo')}</p>
          {!loading && bajasDelSubgrupo.length === 0 && <div className="empty">{t('bajas.sinBajas')}</div>}
          {!loading && bajasDelSubgrupo.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('bajas.columnas.fecha')}</th>
                    <th>{t('bajas.columnas.producto')}</th>
                    <th>{t('bajas.columnas.cantidad')}</th>
                    <th>{t('bajas.columnas.origen')}</th>
                    <th>{t('bajas.columnas.areaDestino')}</th>
                    <th>{t('bajas.columnas.entregadoA')}</th>
                    <th>{t('bajas.columnas.motivo')}</th>
                    <th>{t('bajas.columnas.registradoPor')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bajasDelSubgrupo.map((b) => (
                    <tr key={b.id}>
                      <td>{new Date(b.fecha).toLocaleString()}</td>
                      <td>{b.producto_codigo} — {b.producto_nombre}</td>
                      <td>{b.cantidad}</td>
                      <td>{b.origen || '—'}</td>
                      <td>{b.area_destino || '—'}</td>
                      <td>{b.entregado_a || '—'}</td>
                      <td style={{ maxWidth: 220, whiteSpace: 'pre-wrap' }}>{b.motivo || '—'}</td>
                      <td>{b.dado_de_baja_por_nombre || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {bajaProducto && (
        <div className="modal-backdrop" onClick={() => setBajaProducto(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 4 }}>{t('bajas.tituloModal')}</h3>
            <p style={{ marginBottom: 14, fontSize: 13, color: 'var(--text)' }}>{bajaProducto.codigo} — {bajaProducto.nombre}</p>
            <form onSubmit={handleBajaSubmit}>
              <div className="form-row">
                <div style={{ flex: '1 1 160px' }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                    {t('bajas.placeholders.cantidad', { stock: bajaProducto.stock_actual })}
                  </label>
                  <input
                    type="number" step="0.001" min="0.001" max={bajaProducto.stock_actual} style={{ width: '100%' }}
                    value={bajaForm.cantidad} onChange={(e) => setBajaForm({ ...bajaForm, cantidad: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <input placeholder={t('bajas.placeholders.origen')} value={bajaForm.origen} onChange={(e) => setBajaForm({ ...bajaForm, origen: e.target.value })} />
              </div>
              <div className="form-row">
                <input placeholder={t('bajas.placeholders.areaDestino')} value={bajaForm.area_destino} onChange={(e) => setBajaForm({ ...bajaForm, area_destino: e.target.value })} />
              </div>
              <div className="form-row">
                <input placeholder={t('bajas.placeholders.entregadoA')} value={bajaForm.entregado_a} onChange={(e) => setBajaForm({ ...bajaForm, entregado_a: e.target.value })} />
              </div>
              <div className="form-row">
                <textarea style={{ flex: '1 1 100%', minHeight: 60 }} placeholder={t('bajas.placeholders.motivo')} value={bajaForm.motivo} onChange={(e) => setBajaForm({ ...bajaForm, motivo: e.target.value })} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text)', opacity: 0.75, marginBottom: 10 }}>
                {Number(bajaForm.cantidad) >= Number(bajaProducto.stock_actual) ? t('bajas.avisoTotal') : t('bajas.avisoParcial')}
              </p>
              {errorBaja && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{errorBaja}</div>}
              <div className="form-row">
                <button type="submit" className="danger">{t('bajas.confirmarBaja')}</button>
                <button type="button" className="secondary" onClick={() => setBajaProducto(null)}>{t('botones.cancelar', { ns: 'common' })}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewProducto && (
        <div className="modal-backdrop" onClick={() => setPreviewProducto(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <span className="badge" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>{t('productos.registro')}</span>
              <button className="secondary" style={{ padding: '4px 10px' }} onClick={() => setPreviewProducto(null)}>{t('botones.cerrar', { ns: 'common' })}</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              {previewProducto.imagen
                ? <img src={previewProducto.imagen.startsWith('http') ? previewProducto.imagen : `${MEDIA_BASE_URL}${previewProducto.imagen}`} alt="" style={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)' }} />
                : <div style={{ width: 160, height: 160, borderRadius: 'var(--radius)', background: 'var(--accent-bg)' }} />}
            </div>
            <h2 style={{ fontSize: 19, marginBottom: 2 }}>{previewProducto.nombre}</h2>
            <p style={{ fontSize: 12, color: 'var(--text)', marginBottom: 12 }}>{t('tabla.item')}: {previewProducto.codigo}</p>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', marginBottom: 10 }}>
              {SIMBOLO_MONEDA[previewProducto.moneda || 'USD']}{Number(previewProducto.precio_venta).toLocaleString()}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-h)', marginBottom: 4 }}>
              {[previewProducto.categoria_nombre, previewProducto.subcategoria_nombre].filter(Boolean).join(' / ') || t('productos.registroSinCategoria')}
            </p>
            {(previewProducto.marca_nombre || previewProducto.modelo_nombre) && (
              <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>
                {[previewProducto.marca_nombre, previewProducto.modelo_nombre].filter(Boolean).join(' ')}
              </p>
            )}
            <div style={{ marginBottom: 12 }}>
              {Number(previewProducto.stock_actual) <= Number(previewProducto.stock_minimo)
                ? <span className="badge off">{t('productos.bajoStock')}</span>
                : <span className="badge ok">{t('productos.ok')}</span>}
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text)' }}>{t('productos.registroStock', { n: previewProducto.stock_actual })}</span>
            </div>
            {previewProducto.descripcion && <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginBottom: 10 }}>{previewProducto.descripcion}</p>}
            {previewProducto.detalles && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: 12.5, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{previewProducto.detalles}</div>
            )}
          </div>
        </div>
      )}

      {modeloModal && (
        <div className="modal-backdrop" onClick={() => setModeloModal(false)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12 }}>{t('agregar.nuevoModelo')}</h3>
            <form onSubmit={guardarModeloRapido}>
              <div className="form-row">
                <input autoFocus placeholder={t('agregar.placeholders.modelo')} value={modeloForm.nombre} onChange={(e) => setModeloForm({ ...modeloForm, nombre: e.target.value })} />
              </div>
              <div className="form-row">
                <button type="submit">{t('botones.guardar', { ns: 'common' })}</button>
                <button type="button" className="secondary" onClick={() => setModeloModal(false)}>{t('botones.cancelar', { ns: 'common' })}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Marcas y Modelos son catálogos compartidos por los 4 inventarios (una
// misma marca sirve para un insumo de taller y para un activo fijo), así
// que quedan como su propio apartado en vez de repetirse dentro de cada uno.
function VistaMarcasModelos({ onVolver, t }) {
  const [marcas, setMarcas] = useState([])
  const [modelos, setModelos] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [marcaForm, setMarcaForm] = useState(emptyMarca)
  const [modeloForm, setModeloForm] = useState(emptyModelo)

  const load = () => {
    setLoading(true)
    Promise.all([inventarioApi.marcas(), inventarioApi.modelos(), inventarioApi.productos()])
      .then(([m, mo, p]) => {
        setMarcas(m.data)
        setModelos(mo.data)
        setProductos(p.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleMarcaSubmit = (e) => {
    e.preventDefault()
    if (!marcaForm.nombre) return
    inventarioApi.crearMarca({ nombre: capitalizarTexto(marcaForm.nombre.trim()) }).then(() => {
      setMarcaForm(emptyMarca)
      load()
    })
  }

  const handleMarcaDelete = (id) => {
    inventarioApi.eliminarMarca(id).then(load)
  }

  const handleModeloSubmit = (e) => {
    e.preventDefault()
    if (!modeloForm.nombre.trim() || !modeloForm.marca) return
    inventarioApi.crearModelo({ marca: modeloForm.marca, nombre: capitalizarTexto(modeloForm.nombre.trim()) }).then(() => {
      setModeloForm({ ...emptyModelo, marca: modeloForm.marca })
      load()
    })
  }

  const handleModeloDelete = (id) => {
    inventarioApi.eliminarModelo(id).then(load)
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <VolverBtn onVolver={onVolver} t={t} />
      </div>

      <div className="card">
        <h3>{t('marcas.titulo')}</h3>
        <form onSubmit={handleMarcaSubmit}>
          <div className="form-row">
            <input placeholder={t('marcas.placeholderNombre')} value={marcaForm.nombre} onChange={(e) => setMarcaForm({ ...marcaForm, nombre: e.target.value })} />
            <button type="submit">{t('marcas.agregarMarca')}</button>
          </div>
        </form>
        {!loading && (
          <table>
            <thead><tr><th>{t('marcas.columnas.marca')}</th><th>{t('marcas.columnas.productos')}</th><th></th></tr></thead>
            <tbody>
              {marcas.map((m) => (
                <tr key={m.id}>
                  <td>{m.nombre}</td>
                  <td>{productos.filter((p) => p.marca === m.id).length}</td>
                  <td className="actions"><button className="danger" onClick={() => handleMarcaDelete(m.id)}>{t('botones.eliminar', { ns: 'common' })}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>{t('modelos.titulo')}</h3>
        <p style={{ marginBottom: 10, fontSize: 13, color: 'var(--text-muted)' }}>{t('modelos.ayuda')}</p>
        <form onSubmit={handleModeloSubmit}>
          <div className="form-row">
            <select value={modeloForm.marca} onChange={(e) => setModeloForm({ ...modeloForm, marca: e.target.value })}>
              <option value="">{t('modelos.placeholderMarca')}</option>
              {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
            <input placeholder={t('modelos.placeholderNombre')} value={modeloForm.nombre} onChange={(e) => setModeloForm({ ...modeloForm, nombre: e.target.value })} disabled={!modeloForm.marca} />
            <button type="submit" disabled={!modeloForm.marca}>{t('modelos.agregarModelo')}</button>
          </div>
        </form>
        {!loading && (
          <table>
            <thead><tr><th>{t('modelos.columnas.marca')}</th><th>{t('modelos.columnas.modelo')}</th><th>{t('modelos.columnas.productos')}</th><th></th></tr></thead>
            <tbody>
              {modelos.length === 0 && <tr><td colSpan={4} className="empty">{t('modelos.sinModelos')}</td></tr>}
              {modelos.map((mo) => (
                <tr key={mo.id}>
                  <td>{mo.marca_nombre}</td>
                  <td>{mo.nombre}</td>
                  <td>{productos.filter((p) => p.modelo === mo.id).length}</td>
                  <td className="actions"><button className="danger" onClick={() => handleModeloDelete(mo.id)}>{t('botones.eliminar', { ns: 'common' })}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Inventario
