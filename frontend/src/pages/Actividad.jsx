import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { actividadApi, usuariosApi } from '../api.js'

const ACCIONES = ['LOGIN', 'CREAR', 'EDITAR', 'ELIMINAR']
const MODULOS = [
  'auth', 'dashboard', 'ordenes', 'clientes', 'inventario', 'taller', 'ventas',
  'compras', 'contabilidad', 'rrhh', 'reportes', 'gastos', 'caja-chica',
]

const emptyFiltro = { usuario: '', accion: '', modulo: '', desde: '', hasta: '', buscar: '' }

// Bitácora de todo lo que crea/edita/elimina cada usuario, más cada inicio
// de sesión — la registra sola core.middleware.RegistroActividadMiddleware
// en el backend para TODA la API, así que esta pantalla es puro lector.
// Exclusiva del usuario SISTEMA.RCP (ver App.jsx: se muestra y se permite
// entrar solo si user.puede_ver_actividad, un campo que manda el backend).
function Actividad() {
  const { t } = useTranslation(['actividad', 'common'])
  const [usuarios, setUsuarios] = useState([])
  const [filtro, setFiltro] = useState(emptyFiltro)
  const [registros, setRegistros] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [siguiente, setSiguiente] = useState(null)
  const [anterior, setAnterior] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => { usuariosApi.listar().then((r) => setUsuarios(r.data)).catch(() => {}) }, [])

  const cargar = (paginaAConsultar = 1) => {
    setCargando(true)
    const params = { page: paginaAConsultar }
    Object.entries(filtro).forEach(([k, v]) => { if (v) params[k] = v })
    actividadApi.listar(params)
      .then((r) => {
        setRegistros(r.data.results)
        setTotal(r.data.count)
        setSiguiente(r.data.next)
        setAnterior(r.data.previous)
        setPagina(paginaAConsultar)
      })
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargar(1) }, [filtro])

  const aplicarFiltro = (campo, valor) => setFiltro((f) => ({ ...f, [campo]: valor }))

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      <div className="card">
        <div className="form-row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <select value={filtro.usuario} onChange={(e) => aplicarFiltro('usuario', e.target.value)}>
            <option value="">{t('filtro.todosUsuarios')}</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
          <select value={filtro.accion} onChange={(e) => aplicarFiltro('accion', e.target.value)}>
            <option value="">{t('filtro.todasAcciones')}</option>
            {ACCIONES.map((a) => <option key={a} value={a}>{t(`accion.${a}`)}</option>)}
          </select>
          <select value={filtro.modulo} onChange={(e) => aplicarFiltro('modulo', e.target.value)}>
            <option value="">{t('filtro.todosModulos')}</option>
            {MODULOS.map((m) => <option key={m} value={m}>{t(`modulos.${m}`, { ns: 'common', defaultValue: m })}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            {t('filtro.desde')}
            <input type="date" value={filtro.desde} onChange={(e) => aplicarFiltro('desde', e.target.value)} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            {t('filtro.hasta')}
            <input type="date" value={filtro.hasta} onChange={(e) => aplicarFiltro('hasta', e.target.value)} />
          </label>
          <input placeholder={t('filtro.buscarPlaceholder')} value={filtro.buscar} onChange={(e) => aplicarFiltro('buscar', e.target.value)} style={{ flex: '1 1 220px' }} />
          {(filtro.usuario || filtro.accion || filtro.modulo || filtro.desde || filtro.hasta || filtro.buscar) && (
            <button type="button" className="secondary" onClick={() => setFiltro(emptyFiltro)}>{t('filtro.limpiar')}</button>
          )}
        </div>

        <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--text)' }}>{t('totalRegistros', { n: total })}</div>

        {cargando && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
        {!cargando && registros.length === 0 && <div className="empty">{t('sinRegistros')}</div>}
        {!cargando && registros.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('tabla.fecha')}</th>
                  <th>{t('tabla.usuario')}</th>
                  <th>{t('tabla.accion')}</th>
                  <th>{t('tabla.modulo')}</th>
                  <th>{t('tabla.ruta')}</th>
                  <th>{t('tabla.resumen')}</th>
                  <th>{t('tabla.codigo')}</th>
                  <th>{t('tabla.ip')}</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.creado_en).toLocaleString()}</td>
                    <td>{r.usuario_nombre || t('tabla.usuarioBorrado')}</td>
                    <td>
                      <span className={`badge ${r.accion === 'ELIMINAR' ? 'off' : r.accion === 'LOGIN' ? 'pending' : 'ok'}`}>
                        {r.accion_display}
                      </span>
                    </td>
                    <td>{t(`modulos.${r.modulo}`, { ns: 'common', defaultValue: r.modulo || '—' })}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.metodo} {r.ruta}</td>
                    <td>{r.resumen || '—'}</td>
                    <td>{r.codigo_estado}</td>
                    <td>{r.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(siguiente || anterior) && (
          <div className="form-row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
            <button type="button" className="secondary" disabled={!anterior} onClick={() => cargar(pagina - 1)}>{t('paginacion.anterior', { ns: 'common' })}</button>
            <button type="button" className="secondary" disabled={!siguiente} onClick={() => cargar(pagina + 1)}>{t('paginacion.siguiente', { ns: 'common' })}</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Actividad
