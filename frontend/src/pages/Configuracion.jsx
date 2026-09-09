import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { configApi, usuariosApi } from '../api.js'
import { useAuth } from '../AuthContext.jsx'
import { useTheme, TEMAS } from '../ThemeContext.jsx'
import { IDIOMAS } from '../i18n/index.js'
import Avatar from '../components/Avatar.jsx'

export const MODULOS_KEYS = ['dashboard', 'ordenes', 'clientes', 'inventario', 'taller', 'ventas', 'compras', 'contabilidad', 'rrhh', 'reportes', 'gastos', 'caja_chica']

const MODULOS_POR_ROL = {
  ADMIN: [...MODULOS_KEYS],
  // Pedido explícito: acceso al Arqueo/Cierre de Caja para Taller, Ventas
  // y RRHH además de Gerencia (que ya lo tiene por llevarse todos los
  // módulos arriba) — ver core.choices.MODULOS_POR_ROL (backend).
  TALLER: ['taller', 'caja_chica'],
  PASANTE: ['taller'],
  VENTAS: ['dashboard', 'ordenes', 'clientes', 'inventario', 'ventas', 'reportes', 'caja_chica'],
  RRHH: ['dashboard', 'rrhh', 'reportes', 'caja_chica'],
  // Backoffice analiza los procesos de la empresa: necesita ver la lista
  // de OTs (con hora de ingreso/salida de cada equipo), facturar OTs y ver
  // el registro de facturas, además de costos/insumos/productos/repuestos
  // — no opera el tablero visual de Taller (kanban de técnicos), solo
  // consulta y factura. Ver App.jsx (verOrdenes, bloqueaBackoffice).
  BACKOFFICE: ['dashboard', 'ordenes', 'taller', 'ventas', 'inventario', 'compras', 'contabilidad', 'reportes', 'gastos'],
  // Supervisor operativo por debajo de Gerencia: mismo alcance que ADMIN.
  JEFE_OPERACIONES: [...MODULOS_KEYS],
}

const ROLES_KEYS = ['TALLER', 'PASANTE', 'VENTAS', 'RRHH', 'BACKOFFICE', 'JEFE_OPERACIONES', 'ADMIN']

const emptyForm = () => ({ username: '', nombre: '', password: '', rol: 'VENTAS', modulos_permitidos: [...MODULOS_POR_ROL.VENTAS], is_active: true })

function horasRestantes(desde) {
  const transcurridas = (Date.now() - new Date(desde).getTime()) / 3600000
  return Math.max(0, Math.ceil(24 - transcurridas))
}

function AparienciaIdioma() {
  const { t, i18n } = useTranslation('configuracion')
  const { tema, setTema } = useTheme()

  return (
    <div className="card">
      <h3>{t('apariencia.titulo')}</h3>
      <p style={{ marginTop: -6, marginBottom: 16 }}>{t('apariencia.subtitulo')}</p>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
          {t('apariencia.idioma')}
        </div>
        <select value={i18n.resolvedLanguage || i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)} style={{ maxWidth: 220 }}>
          {IDIOMAS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text)' }}>
          {t('apariencia.tema')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {TEMAS.map((opt) => {
            const activo = tema === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTema(opt.value)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '10px 14px', borderRadius: 12, cursor: 'pointer', minWidth: 100,
                  background: 'var(--panel)', color: 'var(--text-h)',
                  border: activo ? `2px solid ${opt.accent}` : '1px solid var(--border)',
                  boxShadow: activo ? `0 0 0 3px ${opt.accent}33` : 'none',
                }}
              >
                <span style={{
                  display: 'flex', width: 44, height: 28, borderRadius: 8, overflow: 'hidden',
                  border: '1px solid rgba(0,0,0,.15)',
                }}>
                  <span style={{ flex: 1, background: opt.swatch[0] }} />
                  <span style={{ flex: 1, background: opt.swatch[1] }} />
                </span>
                <span style={{ fontSize: 12, fontWeight: activo ? 700 : 500 }}>
                  {t(`apariencia.temas.${opt.value}`, { defaultValue: opt.label })}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Configuracion() {
  const { t } = useTranslation('configuracion')
  const { user, refrescarUsuario } = useAuth()
  const esAdmin = user.is_superuser || user.rol === 'ADMIN'

  const [tasa, setTasa] = useState('')
  const [tasaInput, setTasaInput] = useState('')
  const [guardandoTasa, setGuardandoTasa] = useState(false)
  const [impresora, setImpresora] = useState(null)
  const [guardandoImpresora, setGuardandoImpresora] = useState(false)
  const [impresoraOk, setImpresoraOk] = useState(false)
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm())
  const [editandoId, setEditandoId] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardandoUsuario, setGuardandoUsuario] = useState(false)
  const [error, setError] = useState('')
  const [eliminandoId, setEliminandoId] = useState(null)

  const cargarUsuarios = () => {
    setLoading(true)
    usuariosApi.listar().then((r) => setUsuarios(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!esAdmin) return
    configApi.obtener().then((r) => {
      setTasa(r.data.tasa_cambio_usd)
      setTasaInput(r.data.tasa_cambio_usd)
      setImpresora(r.data)
    })
    cargarUsuarios()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAdmin])

  const guardarTasa = () => {
    setGuardandoTasa(true)
    configApi.actualizar({ tasa_cambio_usd: tasaInput }).then((r) => setTasa(r.data.tasa_cambio_usd)).finally(() => setGuardandoTasa(false))
  }

  const guardarImpresora = () => {
    setGuardandoImpresora(true)
    setImpresoraOk(false)
    configApi.actualizar({
      impresora_conexion: impresora.impresora_conexion,
      impresora_nombre: impresora.impresora_nombre,
      impresora_ip: impresora.impresora_ip,
      impresora_puerto: impresora.impresora_puerto,
      impresora_ancho_papel: impresora.impresora_ancho_papel,
    }).then((r) => { setImpresora(r.data); setImpresoraOk(true) }).finally(() => setGuardandoImpresora(false))
  }

  const cambiarRol = (rol) => {
    setForm((f) => ({ ...f, rol, modulos_permitidos: [...(MODULOS_POR_ROL[rol] || [])] }))
  }

  const toggleModulo = (key) => {
    setForm((f) => ({
      ...f,
      modulos_permitidos: f.modulos_permitidos.includes(key)
        ? f.modulos_permitidos.filter((m) => m !== key)
        : [...f.modulos_permitidos, key],
    }))
  }

  const nuevoUsuario = () => {
    setForm(emptyForm())
    setEditandoId(null)
    setMostrarForm(true)
    setError('')
  }

  const editarUsuario = (u) => {
    setForm({ username: u.username, nombre: u.nombre, password: '', rol: u.rol, modulos_permitidos: [...u.modulos_permitidos], is_active: u.is_active })
    setEditandoId(u.id)
    setMostrarForm(true)
    setError('')
  }

  const eliminarUsuario = async (u) => {
    if (!window.confirm(t('usuarios.confirmarEliminar'))) return
    setEliminandoId(u.id)
    try {
      await usuariosApi.solicitarEliminacion(u.id)
      cargarUsuarios()
    } catch (err) {
      const data = err?.response?.data
      window.alert(data?.detail || t('form.errorGenerico'))
    } finally {
      setEliminandoId(null)
    }
  }

  const subirFotoUsuario = async (u, file) => {
    await usuariosApi.subirFoto(u.id, file)
    cargarUsuarios()
    if (u.username === user.username) await refrescarUsuario()
  }

  const cancelarEliminacionUsuario = async (u) => {
    setEliminandoId(u.id)
    try {
      await usuariosApi.cancelarEliminacion(u.id)
      cargarUsuarios()
    } catch (err) {
      window.alert(t('form.errorGenerico'))
    } finally {
      setEliminandoId(null)
    }
  }

  const guardarUsuario = async (e) => {
    e.preventDefault()
    setError('')
    if (!editandoId && (!form.username.trim() || !form.password.trim())) {
      setError(t('form.errorObligatorio'))
      return
    }
    setGuardandoUsuario(true)
    try {
      if (editandoId) {
        if (!form.username.trim()) { setError(t('form.errorObligatorio')); setGuardandoUsuario(false); return }
        const payload = {
          username: form.username.trim(), nombre: form.nombre, rol: form.rol,
          modulos_permitidos: form.modulos_permitidos, is_active: form.is_active,
        }
        if (form.password.trim()) payload.password = form.password
        await usuariosApi.actualizar(editandoId, payload)
      } else {
        await usuariosApi.crear(form)
      }
      setMostrarForm(false)
      cargarUsuarios()
    } catch (err) {
      const data = err?.response?.data
      setError(data ? Object.values(data).flat().join(' ') : t('form.errorGenerico'))
    } finally {
      setGuardandoUsuario(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{esAdmin ? t('subtituloAdmin') : t('subtituloUsuario')}</p>
      </div>

      <AparienciaIdioma />

      {esAdmin && (
        <>
          <div className="card">
            <h3>{t('tasaCambio.titulo')}</h3>
            <div className="form-row">
              <input type="number" step="0.0001" value={tasaInput} onChange={(e) => setTasaInput(e.target.value)} style={{ maxWidth: 160 }} />
              <button onClick={guardarTasa} disabled={guardandoTasa}>{guardandoTasa ? t('tasaCambio.guardando') : t('tasaCambio.guardar')}</button>
              <div className="chip" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>{t('tasaCambio.actual', { monto: tasa })}</div>
            </div>
          </div>

          {impresora && (
            <div className="card">
              <h3>{t('impresora.titulo')}</h3>
              <p style={{ marginTop: -6, marginBottom: 16 }}>{t('impresora.subtitulo')}</p>
              <div className="form-row">
                <select value={impresora.impresora_conexion || ''} onChange={(e) => setImpresora({ ...impresora, impresora_conexion: e.target.value })}>
                  <option value="">{t('impresora.sinConfigurar')}</option>
                  <option value="WIN32">{t('impresora.win32')}</option>
                  <option value="RED">{t('impresora.red')}</option>
                </select>
                <select value={impresora.impresora_ancho_papel || 80} onChange={(e) => setImpresora({ ...impresora, impresora_ancho_papel: Number(e.target.value) })}>
                  <option value={58}>58 mm</option>
                  <option value={80}>80 mm</option>
                </select>
              </div>
              {impresora.impresora_conexion === 'WIN32' && (
                <div className="form-row">
                  <input placeholder={t('impresora.nombreWindows')} value={impresora.impresora_nombre || ''} onChange={(e) => setImpresora({ ...impresora, impresora_nombre: e.target.value })} />
                </div>
              )}
              {impresora.impresora_conexion === 'RED' && (
                <div className="form-row">
                  <input placeholder={t('impresora.ip')} value={impresora.impresora_ip || ''} onChange={(e) => setImpresora({ ...impresora, impresora_ip: e.target.value })} />
                  <input type="number" placeholder={t('impresora.puerto')} value={impresora.impresora_puerto || 9100} onChange={(e) => setImpresora({ ...impresora, impresora_puerto: Number(e.target.value) })} style={{ maxWidth: 120 }} />
                </div>
              )}
              <div className="form-row" style={{ alignItems: 'center' }}>
                <button onClick={guardarImpresora} disabled={guardandoImpresora}>{guardandoImpresora ? t('botones.guardando', { ns: 'common' }) : t('botones.guardar', { ns: 'common' })}</button>
                {impresoraOk && <span style={{ color: 'var(--success)', fontSize: 13 }}>{t('impresora.guardadoOk')}</span>}
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{t('usuarios.titulo')}</h3>
              <button onClick={nuevoUsuario}>{t('usuarios.añadir')}</button>
            </div>

            {loading && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
            {!loading && (
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>{t('usuarios.columnaUsuario')}</th>
                    <th>{t('usuarios.columnaNombre')}</th>
                    <th>{t('usuarios.columnaRol')}</th>
                    <th>{t('usuarios.columnaModulos')}</th>
                    <th>{t('usuarios.columnaEstado')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <Avatar nombre={u.nombre} foto={u.foto} size={32} editable onSubirFoto={(file) => subirFotoUsuario(u, file)} />
                      </td>
                      <td>{u.username}</td>
                      <td>{u.nombre}</td>
                      <td>{t(`roles.${u.rol}`, { ns: 'common' })}</td>
                      <td>
                        <div className="chip-list">
                          {u.modulos_permitidos.map((m) => (
                            <span key={m} className="chip">{t(`modulos.${m}`, { ns: 'common', defaultValue: m })}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {u.eliminacion_solicitada_en
                          ? <span className="badge off">{t('usuarios.pendienteEliminacion', { horas: horasRestantes(u.eliminacion_solicitada_en) })}</span>
                          : u.is_active ? <span className="badge ok">{t('estado.activo', { ns: 'common' })}</span> : <span className="badge off">{t('estado.inactivo', { ns: 'common' })}</span>}
                      </td>
                      <td className="actions">
                        {u.eliminacion_solicitada_en ? (
                          <button className="secondary" disabled={eliminandoId === u.id} onClick={() => cancelarEliminacionUsuario(u)}>{t('usuarios.cancelarEliminacion')}</button>
                        ) : (
                          <>
                            <button className="secondary" onClick={() => editarUsuario(u)}>{t('botones.editar', { ns: 'common' })}</button>
                            <button className="danger" disabled={eliminandoId === u.id} onClick={() => eliminarUsuario(u)}>{t('botones.eliminar', { ns: 'common' })}</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {mostrarForm && (
        <div className="modal-backdrop" onClick={() => setMostrarForm(false)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h2>{editandoId ? t('form.tituloEditar') : t('form.tituloNuevo')}</h2>
            <form onSubmit={guardarUsuario}>
              <div className="form-row">
                <input placeholder={t('form.usuario')} value={form.username} title={editandoId ? t('form.usuarioEditarAyuda') : undefined} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                <input placeholder={t('form.nombre')} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div className="form-row">
                <input type="password" placeholder={editandoId ? t('form.contrasenaOpcional') : t('form.contrasena')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <select value={form.rol} onChange={(e) => cambiarRol(e.target.value)}>
                  {ROLES_KEYS.map((r) => <option key={r} value={r}>{t(`roles.${r}`, { ns: 'common' })}</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> {t('form.activo')}
                </label>
              </div>

              <div style={{ margin: '14px 0' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>{t('form.modulosTitulo')}</div>
                <div className="chip-list">
                  {MODULOS_KEYS.map((m) => (
                    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--code-bg, var(--accent-bg))', border: '1px solid var(--border)', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.modulos_permitidos.includes(m)} onChange={() => toggleModulo(m)} />
                      {t(`modulos.${m}`, { ns: 'common' })}
                    </label>
                  ))}
                </div>
              </div>

              {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
              <div className="form-row">
                <button type="submit" disabled={guardandoUsuario}>{guardandoUsuario ? t('botones.guardando', { ns: 'common' }) : t('botones.guardar', { ns: 'common' })}</button>
                <button type="button" className="secondary" onClick={() => setMostrarForm(false)}>{t('botones.cancelar', { ns: 'common' })}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Configuracion
