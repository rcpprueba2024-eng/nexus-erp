import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { inventarioApi, reportesApi } from '../api.js'

const TIPOS_CATEGORIA = [
  { value: 'PRODUCTO', labelKey: 'producto' },
  { value: 'REPUESTO', labelKey: 'repuesto' },
  { value: 'INSUMO', labelKey: 'insumo' },
  { value: 'ACCESORIO', labelKey: 'accesorio' },
  { value: 'OTRO', labelKey: 'otro' },
]

const COLORS = ['#1d4ed8', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4338ca']

const emptyCategoria = { nombre: '', tipo: 'PRODUCTO', descripcion: '' }
const emptySubcategoria = { categoria: '', nombre: '', descripcion: '' }

function VentasCategorias() {
  const { t } = useTranslation('ventasCategorias')
  const [categorias, setCategorias] = useState([])
  const [subcategorias, setSubcategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [vendidas, setVendidas] = useState(null)
  const [loading, setLoading] = useState(true)

  const [catForm, setCatForm] = useState(emptyCategoria)
  const [subcatForm, setSubcatForm] = useState(emptySubcategoria)

  const load = () => {
    setLoading(true)
    Promise.all([inventarioApi.categorias(), inventarioApi.subcategorias(), inventarioApi.productos(), reportesApi.categoriasVendidas()])
      .then(([c, s, p, v]) => {
        setCategorias(c.data)
        setSubcategorias(s.data)
        setProductos(p.data)
        setVendidas(v.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCatSubmit = (e) => {
    e.preventDefault()
    if (!catForm.nombre) return
    inventarioApi.crearCategoria(catForm).then(() => {
      setCatForm(emptyCategoria)
      load()
    })
  }

  const handleCatDelete = (id) => {
    inventarioApi.eliminarCategoria(id).then(load)
  }

  const handleSubcatSubmit = (e) => {
    e.preventDefault()
    if (!subcatForm.nombre || !subcatForm.categoria) return
    inventarioApi.crearSubcategoria(subcatForm).then(() => {
      setSubcatForm(emptySubcategoria)
      load()
    })
  }

  const handleSubcatDelete = (id) => {
    inventarioApi.eliminarSubcategoria(id).then(load)
  }

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      <div className="card">
        <h3>{t('chart.titulo')}</h3>
        {!vendidas && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
        {vendidas && vendidas.length === 0 && <div className="empty">{t('chart.sinDatos')}</div>}
        {vendidas && vendidas.length > 0 && (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={vendidas} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="categoria" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={55} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
              <Bar dataKey="total_vendido" radius={[4, 4, 0, 0]}>
                {vendidas.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <h3>{t('categoriasTitulo')}</h3>
        <form onSubmit={handleCatSubmit}>
          <div className="form-row">
            <input style={{ flex: '1 1 220px' }} placeholder={t('placeholderNombre')} value={catForm.nombre} onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })} />
            <select style={{ flex: '0 1 160px' }} value={catForm.tipo} onChange={(e) => setCatForm({ ...catForm, tipo: e.target.value })}>
              {TIPOS_CATEGORIA.map((tc) => <option key={tc.value} value={tc.value}>{t(`tiposCategoria.${tc.labelKey}`)}</option>)}
            </select>
            <button type="submit">{t('agregarCategoria')}</button>
          </div>
          <div className="form-row">
            <input style={{ flex: '1 1 260px', opacity: 0.85 }} placeholder={t('placeholderDescripcion')} value={catForm.descripcion} onChange={(e) => setCatForm({ ...catForm, descripcion: e.target.value })} />
          </div>
        </form>
        {!loading && (
          <table>
            <thead><tr><th>{t('columnas.nombre')}</th><th>{t('columnas.tipo')}</th><th>{t('columnas.descripcion')}</th><th>{t('columnas.productos')}</th><th></th></tr></thead>
            <tbody>
              {categorias.map((c) => (
                <tr key={c.id}>
                  <td>{c.nombre}</td>
                  <td>{(() => { const tc = TIPOS_CATEGORIA.find((x) => x.value === c.tipo); return tc ? t(`tiposCategoria.${tc.labelKey}`) : c.tipo })()}</td>
                  <td>{c.descripcion || '—'}</td>
                  <td>{productos.filter((p) => p.categoria === c.id).length}</td>
                  <td className="actions"><button className="danger" onClick={() => handleCatDelete(c.id)}>{t('botones.eliminar', { ns: 'common' })}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>{t('subcategoriasTitulo')}</h3>
        <form onSubmit={handleSubcatSubmit}>
          <div className="form-row">
            <select style={{ flex: '0 1 200px' }} value={subcatForm.categoria} onChange={(e) => setSubcatForm({ ...subcatForm, categoria: e.target.value })}>
              <option value="">{t('placeholderCategoriaSeleccionar')}</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <input style={{ flex: '1 1 220px' }} placeholder={t('placeholderNombreSubcategoria')} value={subcatForm.nombre} onChange={(e) => setSubcatForm({ ...subcatForm, nombre: e.target.value })} />
            <button type="submit">{t('agregarSubcategoria')}</button>
          </div>
          <div className="form-row">
            <input style={{ flex: '1 1 260px', opacity: 0.85 }} placeholder={t('placeholderDescripcion')} value={subcatForm.descripcion} onChange={(e) => setSubcatForm({ ...subcatForm, descripcion: e.target.value })} />
          </div>
        </form>
        {!loading && (
          <table>
            <thead><tr><th>{t('columnasSubcategoria.categoria')}</th><th>{t('columnasSubcategoria.subcategoria')}</th><th>{t('columnasSubcategoria.descripcion')}</th><th>{t('columnasSubcategoria.productos')}</th><th></th></tr></thead>
            <tbody>
              {subcategorias.map((s) => (
                <tr key={s.id}>
                  <td>{s.categoria_nombre}</td>
                  <td>{s.nombre}</td>
                  <td>{s.descripcion || '—'}</td>
                  <td>{productos.filter((p) => p.subcategoria === s.id).length}</td>
                  <td className="actions"><button className="danger" onClick={() => handleSubcatDelete(s.id)}>{t('botones.eliminar', { ns: 'common' })}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default VentasCategorias
