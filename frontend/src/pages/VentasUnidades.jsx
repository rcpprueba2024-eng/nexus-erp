import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { inventarioApi } from '../api.js'
import { capitalizarTexto } from '../textUtils.js'

const emptyUnidad = { nombre: '', abreviatura: '', permite_fraccion: false }

function VentasUnidades() {
  const { t } = useTranslation('ventasUnidades')
  const [unidades, setUnidades] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyUnidad)
  const [error, setError] = useState('')

  const cargar = () => {
    setLoading(true)
    inventarioApi.unidades().then((r) => setUnidades(r.data)).finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!form.nombre.trim()) return
    inventarioApi.crearUnidad({ ...form, nombre: capitalizarTexto(form.nombre.trim()) })
      .then(() => { setForm(emptyUnidad); cargar() })
      .catch((err) => setError(err?.response?.data?.nombre?.[0] || t('errorGenerico')))
  }

  const handleDelete = (id) => {
    inventarioApi.eliminarUnidad(id).then(cargar).catch(() => setError(t('errorEnUso')))
  }

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      <div className="card">
        <h3>{t('form.titulo')}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <input placeholder={t('form.nombre')} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <input placeholder={t('form.abreviatura')} value={form.abreviatura} onChange={(e) => setForm({ ...form, abreviatura: e.target.value })} style={{ maxWidth: 140 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)' }}>
              <input type="checkbox" checked={form.permite_fraccion} onChange={(e) => setForm({ ...form, permite_fraccion: e.target.checked })} />
              {t('form.permiteFraccion')}
            </label>
            <button type="submit">{t('form.agregar')}</button>
          </div>
        </form>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: -6, marginBottom: 10 }}>{error}</div>}
      </div>

      <div className="card">
        {loading && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
        {!loading && unidades.length === 0 && <div className="empty">{t('sinUnidades')}</div>}
        {!loading && unidades.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>{t('columnas.nombre')}</th>
                <th>{t('columnas.abreviatura')}</th>
                <th>{t('columnas.fraccion')}</th>
                <th>{t('columnas.productos')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {unidades.map((u) => (
                <tr key={u.id}>
                  <td>{u.nombre}</td>
                  <td>{u.abreviatura || '—'}</td>
                  <td>{u.permite_fraccion ? <span className="badge ok">{t('columnas.si')}</span> : <span className="badge off">{t('columnas.no')}</span>}</td>
                  <td>{u.productos_count ?? '—'}</td>
                  <td className="actions"><button className="danger" onClick={() => handleDelete(u.id)}>{t('botones.eliminar', { ns: 'common' })}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default VentasUnidades
