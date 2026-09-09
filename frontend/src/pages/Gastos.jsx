import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Wallet, Pencil } from 'lucide-react'
import { gastosApi } from '../api.js'
import Pagination from '../components/Pagination.jsx'

const PAGE_SIZE = 15
const emptyGasto = { categoria: '', descripcion: '', monto: '' }
const emptyCategoria = { nombre: '', descripcion: '' }

function Gastos() {
  const { t } = useTranslation('gastos')
  const [caja, setCaja] = useState(null)
  const [gastos, setGastos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)

  const [gastoForm, setGastoForm] = useState(emptyGasto)
  const [catForm, setCatForm] = useState(emptyCategoria)
  const [editandoCaja, setEditandoCaja] = useState(false)
  const [saldoForm, setSaldoForm] = useState('')
  const [pagina, setPagina] = useState(1)

  const load = () => {
    setLoading(true)
    Promise.all([gastosApi.cajaChica(), gastosApi.gastos(), gastosApi.categorias()])
      .then(([c, g, cat]) => {
        setCaja(c.data)
        setGastos(g.data)
        setCategorias(cat.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleGastoSubmit = (e) => {
    e.preventDefault()
    if (!gastoForm.categoria || !gastoForm.descripcion || !gastoForm.monto) return
    gastosApi.crearGasto(gastoForm).then(() => {
      setGastoForm(emptyGasto)
      load()
    })
  }

  const handleGastoDelete = (id) => {
    gastosApi.eliminarGasto(id).then(load)
  }

  const handleCatSubmit = (e) => {
    e.preventDefault()
    if (!catForm.nombre) return
    gastosApi.crearCategoria(catForm).then(() => {
      setCatForm(emptyCategoria)
      load()
    })
  }

  const handleCatDelete = (id) => {
    gastosApi.eliminarCategoria(id).then(load)
  }

  const abrirEdicionCaja = () => {
    setSaldoForm(caja ? caja.saldo_actual : '')
    setEditandoCaja(true)
  }

  const handleSaldoSubmit = (e) => {
    e.preventDefault()
    if (saldoForm === '') return
    gastosApi.ajustarCajaChica(saldoForm).then(() => {
      setEditandoCaja(false)
      load()
    })
  }

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      <div className="card">
        <h3><Wallet size={18} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />{t('cajaChica.titulo')}</h3>
        {!caja && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
        {caja && !editandoCaja && (
          <div className="form-row" style={{ alignItems: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>${Number(caja.saldo_actual).toLocaleString()}</div>
            <button type="button" className="secondary" onClick={abrirEdicionCaja}>
              <Pencil size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />{t('cajaChica.ajustarSaldo')}
            </button>
          </div>
        )}
        {caja && editandoCaja && (
          <form onSubmit={handleSaldoSubmit} className="form-row">
            <input type="number" step="0.01" style={{ flex: '0 1 200px' }} value={saldoForm} onChange={(e) => setSaldoForm(e.target.value)} placeholder={t('cajaChica.placeholderSaldo')} autoFocus />
            <button type="submit">{t('botones.guardar', { ns: 'common' })}</button>
            <button type="button" className="secondary" onClick={() => setEditandoCaja(false)}>{t('botones.cancelar', { ns: 'common' })}</button>
          </form>
        )}
        <p style={{ opacity: 0.7, fontSize: '0.85rem', marginTop: 8 }}>{t('cajaChica.ayuda')}</p>
      </div>

      <div className="card">
        <h3>{t('registrarGasto')}</h3>
        <form onSubmit={handleGastoSubmit}>
          <div className="form-row">
            <select style={{ flex: '0 1 200px' }} value={gastoForm.categoria} onChange={(e) => setGastoForm({ ...gastoForm, categoria: e.target.value })}>
              <option value="">{t('placeholderCategoriaSeleccionar')}</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <input style={{ flex: '1 1 260px' }} placeholder={t('placeholderDescripcion')} value={gastoForm.descripcion} onChange={(e) => setGastoForm({ ...gastoForm, descripcion: e.target.value })} />
            <input type="number" step="0.01" style={{ flex: '0 1 150px' }} placeholder={t('placeholderMonto')} value={gastoForm.monto} onChange={(e) => setGastoForm({ ...gastoForm, monto: e.target.value })} />
            <button type="submit">{t('agregarGasto')}</button>
          </div>
        </form>
        {!loading && (
          <table>
            <thead>
              <tr>
                <th>{t('columnas.fecha')}</th>
                <th>{t('columnas.categoria')}</th>
                <th>{t('columnas.descripcion')}</th>
                <th>{t('columnas.monto')}</th>
                <th>{t('columnas.saldoResultante')}</th>
                <th>{t('columnas.registradoPor')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {gastos.length === 0 && (
                <tr><td colSpan={7} className="empty">{t('sinGastos')}</td></tr>
              )}
              {gastos.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE).map((g) => (
                <tr key={g.id}>
                  <td>{new Date(g.fecha).toLocaleString()}</td>
                  <td>{g.categoria_nombre}</td>
                  <td>{g.descripcion}</td>
                  <td>${Number(g.monto).toLocaleString()}</td>
                  <td>${Number(g.saldo_resultante).toLocaleString()}</td>
                  <td>{g.registrado_por_nombre || '—'}</td>
                  <td className="actions"><button className="danger" onClick={() => handleGastoDelete(g.id)}>{t('botones.eliminar', { ns: 'common' })}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && gastos.length > 0 && (
          <Pagination page={pagina} totalItems={gastos.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />
        )}
      </div>

      <div className="card">
        <h3>{t('categoriasTitulo')}</h3>
        <form onSubmit={handleCatSubmit}>
          <div className="form-row">
            <input style={{ flex: '1 1 220px' }} placeholder={t('placeholderNombre')} value={catForm.nombre} onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })} />
            <input style={{ flex: '1 1 260px', opacity: 0.85 }} placeholder={t('placeholderDescripcion')} value={catForm.descripcion} onChange={(e) => setCatForm({ ...catForm, descripcion: e.target.value })} />
            <button type="submit">{t('agregarCategoria')}</button>
          </div>
        </form>
        {!loading && (
          <table>
            <thead><tr><th>{t('columnas.nombre')}</th><th>{t('columnas.descripcion')}</th><th>{t('columnas.gastos')}</th><th></th></tr></thead>
            <tbody>
              {categorias.map((c) => (
                <tr key={c.id}>
                  <td>{c.nombre}</td>
                  <td>{c.descripcion || '—'}</td>
                  <td>{gastos.filter((g) => g.categoria === c.id).length}</td>
                  <td className="actions"><button className="danger" onClick={() => handleCatDelete(c.id)}>{t('botones.eliminar', { ns: 'common' })}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Gastos
