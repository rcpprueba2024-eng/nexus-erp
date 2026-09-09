import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { rrhhApi, inventarioApi, usuariosApi, MEDIA_BASE_URL } from '../api.js'
import { useAuth } from '../AuthContext.jsx'
import Avatar from '../components/Avatar.jsx'
import PermisoPreview from '../components/PermisoPreview.jsx'

const AREAS = ['TALLER', 'PASANTE', 'VENTAS', 'RRHH', 'BACKOFFICE', 'JEFE_OPERACIONES', 'ADMIN', 'LIMPIEZA']
const TABS = ['reportes', 'trabajadores', 'horas', 'permisos', 'vacaciones']
const TIPOS_VINCULACION = ['FIJO', 'PASANTIA', 'PRUEBA']

const empty = {
  nombre: '', cedula: '', puestos: [], areas: ['TALLER'], salario: '', email: '', telefono: '', fecha_ingreso: '', equipos_asignados: [],
  uniforme_asignado: '', tipo_vinculacion: 'FIJO', crear_usuario: false, usuario_username: '', usuario_password: '',
}
const DIAS_SEMANA = [1, 2, 3, 4, 5, 6]
const emptyPermiso = { tipo: 'FIJO', porHoras: false, motivo: '', dia_semana: '1', hora_entrada: '', hora_salida: '', fecha_inicio: '', fecha_fin: '', empleado: '' }

const COLOR_CLASIFICACION = { VERDE: '#059669', AMARILLO: '#d97706', ROJO: '#dc2626' }

function inicioSemana(d) {
  const dia = d.getDay() || 7 // domingo=0 -> 7
  const lunes = new Date(d)
  lunes.setDate(d.getDate() - dia + 1)
  return lunes
}
function aFecha(d) { return d.toISOString().slice(0, 10) }

function horarioVacio() {
  return Object.fromEntries(DIAS_SEMANA.map((d) => [d, { hora_entrada: '', hora_salida: '' }]))
}

function extraerError(err) {
  const data = err?.response?.data
  if (!data || typeof data !== 'object') return null
  return Object.values(data).flat().join(' ')
}

function hoy() {
  return new Date().toISOString().slice(0, 10)
}

// El campo de hora es de 24 horas (sin a.m./p.m. visible en algunos
// navegadores) — es fácil escribir "05:00" queriendo decir 5:00 p.m. y que
// quede como 5:00 a.m., antes de la entrada. Si la salida cae antes que la
// entrada, casi siempre es esto (acá nadie hace turno nocturno) — se avisa
// en vez de solo mostrar "0.00 horas" sin explicación.
function esProbableConfusionAmPm(entrada, salida) {
  return !!(entrada && salida && salida < entrada)
}

function sumar12Horas(hora) {
  const [h, m] = hora.split(':').map(Number)
  return `${String((h + 12) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function horasRestantes(desde) {
  const transcurridas = (Date.now() - new Date(desde).getTime()) / 3600000
  return Math.max(0, Math.ceil(24 - transcurridas))
}

// Mismo criterio que _horas_pagables en backend/rrhh/views.py: la empresa no
// paga hora extra por llegar antes de las 8:00 a.m. o salir después de las
// 5:00 p.m. — solo lo que cae dentro de esa ventana cuenta, y si el turno
// cubre la hora de almuerzo (12:00-13:00) se descuenta esa hora sin goce de
// salario (jornada ordinaria completa = 8 horas, Art. 51 del Código del
// Trabajo — no las 9 que hay de corrido entre 8:00 y 17:00). El sábado es
// media jornada con otro horario (8:30 a.m.–1:00 p.m.) y sin bloque de
// almuerzo asignado, así que nunca se le descuenta esa hora. Se usa acá
// para mostrarle a RRHH el valor real ANTES de guardar, no solo al generar
// el reporte.
function esDiaSabado(fecha) {
  if (!fecha) return false
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() === 6
}

function ventanaPago(fecha) {
  return esDiaSabado(fecha)
    ? { inicio: '08:30', fin: '13:00', esSabado: true }
    : { inicio: '08:00', fin: '17:00', esSabado: false }
}

function horasPagables(entrada, salida, fecha) {
  if (!entrada || !salida) return null
  const { inicio, fin, esSabado } = ventanaPago(fecha)
  const [he, me] = entrada.split(':').map(Number)
  const [hs, ms] = salida.split(':').map(Number)
  const [vih, vim] = inicio.split(':').map(Number)
  const [vfh, vfm] = fin.split(':').map(Number)
  const ini = Math.max(he * 60 + me, vih * 60 + vim)
  const finM = Math.min(hs * 60 + ms, vfh * 60 + vfm)
  let horas = Math.max(0, (finM - ini) / 60)
  if (!esSabado && ini <= 12 * 60 && finM >= 13 * 60) horas = Math.max(0, horas - 1)
  return horas
}

function RRHH() {
  const { t } = useTranslation('rrhh')
  const { user } = useAuth()
  const esAdmin = user?.is_superuser || user?.rol === 'ADMIN'
  const [tab, setTab] = useState('reportes')
  const [empleados, setEmpleados] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(empty)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [errorForm, setErrorForm] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [seleccionado, setSeleccionado] = useState(null)
  const [editando, setEditando] = useState(false)
  const [formEdit, setFormEdit] = useState(empty)
  const [errorEdicion, setErrorEdicion] = useState('')
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [horarioDraft, setHorarioDraft] = useState(horarioVacio())
  const [guardandoHorario, setGuardandoHorario] = useState(false)
  const [horarioGuardadoOk, setHorarioGuardadoOk] = useState(false)
  const [crearUsuarioAbierto, setCrearUsuarioAbierto] = useState(false)
  const [usuarioQuick, setUsuarioQuick] = useState('')
  const [usuarioQuickPassword, setUsuarioQuickPassword] = useState('')
  const [errorUsuarioQuick, setErrorUsuarioQuick] = useState('')
  const [guardandoUsuarioQuick, setGuardandoUsuarioQuick] = useState(false)
  const [eliminandoUsuario, setEliminandoUsuario] = useState(false)

  const [reportePeriodo, setReportePeriodo] = useState('SEMANA')
  const [reporteAgrupar, setReporteAgrupar] = useState('empleado')
  // La semana actual se calcula directo en el estado inicial (no en un
  // useEffect al montar): si se corrigiera después de montar con el rango
  // por defecto (mes), el efecto que dispara el reporte alcanza a correr
  // una vez con el rango viejo antes de la corrección — carrera que a
  // veces mostraba el reporte del mes en vez de la semana al entrar.
  const [reporteDesde, setReporteDesde] = useState(() => aFecha(inicioSemana(new Date())))
  const [reporteHasta, setReporteHasta] = useState(() => {
    const lunes = inicioSemana(new Date())
    const sabado = new Date(lunes); sabado.setDate(lunes.getDate() + 5)
    return aFecha(sabado)
  })
  const [reporte, setReporte] = useState(null)
  const [cargandoReporte, setCargandoReporte] = useState(false)
  const [errorReporte, setErrorReporte] = useState('')

  const load = () => {
    setLoading(true)
    // allSettled, no all: si falla la carga de productos (equipos para
    // asignar) la lista de empleados no debe quedar en blanco por eso.
    Promise.allSettled([rrhhApi.empleados(), inventarioApi.productos()])
      .then(([e, p]) => {
        if (e.status === 'fulfilled') setEmpleados(e.value.data)
        if (p.status === 'fulfilled') setProductos(p.value.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorForm('')
    if (!form.nombre || !form.cedula || form.puestos.length === 0 || form.areas.length === 0 || !form.fecha_ingreso) return
    const quiereUsuario = esAdmin && form.crear_usuario
    if (quiereUsuario && (!form.usuario_username.trim() || !form.usuario_password.trim())) {
      setErrorForm(t('form.usuarioYContrasenaObligatorios'))
      return
    }
    setGuardando(true)
    const { crear_usuario, usuario_username, usuario_password, ...datosEmpleado } = form
    try {
      const resEmpleado = await rrhhApi.crearEmpleado(datosEmpleado)
      if (quiereUsuario) {
        try {
          // El usuario de acceso al sistema tiene un solo rol (Perfil.rol);
          // si el trabajador cubre varias áreas, se usa la primera como rol.
          const resUsuario = await usuariosApi.crear({
            username: usuario_username.trim(), nombre: form.nombre, password: usuario_password, rol: form.areas[0] || 'BACKOFFICE',
          })
          await rrhhApi.actualizarEmpleado(resEmpleado.data.id, { usuario: resUsuario.data.id })
        } catch (err) {
          window.alert(t('form.errorUsuario', { detalle: extraerError(err) || '' }))
        }
      }
      setForm(empty)
      setMostrarForm(false)
      load()
    } catch (err) {
      setErrorForm(extraerError(err) || t('form.errorGenerico'))
    } finally {
      setGuardando(false)
    }
  }

  const toggleArea = (a) => {
    setForm((f) => ({ ...f, areas: f.areas.includes(a) ? f.areas.filter((x) => x !== a) : [...f.areas, a] }))
  }

  const handleDelete = (id) => {
    rrhhApi.eliminarEmpleado(id).then(load)
  }

  const handleSubirFoto = (id, file) => {
    rrhhApi.subirFotoEmpleado(id, file).then((r) => {
      setSeleccionado(r.data)
      load()
    })
  }

  const abrirEmpleado = (emp) => {
    setSeleccionado(emp)
    setEditando(false)
    setErrorEdicion('')
    setCrearUsuarioAbierto(false)
    setUsuarioQuick('')
    setUsuarioQuickPassword('')
    setErrorUsuarioQuick('')
    setHorarioGuardadoOk(false)
    rrhhApi.horarios(emp.id).then((r) => {
      const draft = horarioVacio()
      r.data.forEach((h) => { draft[h.dia_semana] = { hora_entrada: h.hora_entrada || '', hora_salida: h.hora_salida || '' } })
      setHorarioDraft(draft)
    })
    if (esAdmin && emp.usuario) {
      usuariosApi.obtener(emp.usuario).then((r) => {
        setSeleccionado((s) => (s && s.id === emp.id ? { ...s, usuario_eliminacion_solicitada_en: r.data.eliminacion_solicitada_en } : s))
      })
    }
  }

  const guardarHorario = async () => {
    setGuardandoHorario(true)
    setHorarioGuardadoOk(false)
    try {
      await Promise.all(DIAS_SEMANA.map((dia) => rrhhApi.guardarHorario({
        empleado: seleccionado.id, dia_semana: dia,
        hora_entrada: horarioDraft[dia].hora_entrada || null,
        hora_salida: horarioDraft[dia].hora_salida || null,
      })))
      setHorarioGuardadoOk(true)
    } finally {
      setGuardandoHorario(false)
    }
  }

  const iniciarEdicion = () => {
    setFormEdit({
      nombre: seleccionado.nombre || '', cedula: seleccionado.cedula || '', puestos: seleccionado.puestos || [],
      areas: seleccionado.areas || [], salario: seleccionado.salario ?? '', email: seleccionado.email || '',
      telefono: seleccionado.telefono || '', fecha_ingreso: seleccionado.fecha_ingreso || '',
      equipos_asignados: seleccionado.equipos_asignados || [],
      uniforme_asignado: seleccionado.uniforme_asignado || '',
      tipo_vinculacion: seleccionado.tipo_vinculacion || 'FIJO',
    })
    setErrorEdicion('')
    setEditando(true)
  }

  const toggleAreaEdit = (a) => {
    setFormEdit((f) => ({ ...f, areas: f.areas.includes(a) ? f.areas.filter((x) => x !== a) : [...f.areas, a] }))
  }

  const guardarEdicion = async (e) => {
    e.preventDefault()
    setErrorEdicion('')
    if (!formEdit.nombre.trim() || !formEdit.cedula.trim() || formEdit.puestos.length === 0 || formEdit.areas.length === 0 || !formEdit.fecha_ingreso) return
    setGuardandoEdicion(true)
    try {
      const res = await rrhhApi.actualizarEmpleado(seleccionado.id, formEdit)
      setSeleccionado((s) => ({ ...s, ...res.data }))
      setEditando(false)
      load()
    } catch (err) {
      setErrorEdicion(extraerError(err) || t('form.errorGenerico'))
    } finally {
      setGuardandoEdicion(false)
    }
  }

  const abrirCrearUsuarioRapido = () => {
    setCrearUsuarioAbierto(true)
    setUsuarioQuickPassword(seleccionado.cedula || '')
  }

  const crearUsuarioRapido = async (e) => {
    e.preventDefault()
    setErrorUsuarioQuick('')
    if (!usuarioQuick.trim() || !usuarioQuickPassword.trim()) { setErrorUsuarioQuick(t('form.usuarioYContrasenaObligatorios')); return }
    setGuardandoUsuarioQuick(true)
    try {
      const resUsuario = await usuariosApi.crear({
        username: usuarioQuick.trim(), nombre: seleccionado.nombre, password: usuarioQuickPassword, rol: seleccionado.areas?.[0] || 'BACKOFFICE',
      })
      await rrhhApi.actualizarEmpleado(seleccionado.id, { usuario: resUsuario.data.id })
      setSeleccionado((s) => ({ ...s, usuario_username: resUsuario.data.username, usuario: resUsuario.data.id, usuario_eliminacion_solicitada_en: null }))
      setCrearUsuarioAbierto(false)
      setUsuarioQuick('')
      setUsuarioQuickPassword('')
      load()
    } catch (err) {
      setErrorUsuarioQuick(extraerError(err) || t('form.errorGenerico'))
    } finally {
      setGuardandoUsuarioQuick(false)
    }
  }

  const eliminarUsuarioVinculado = async () => {
    if (!window.confirm(t('form.confirmarEliminarUsuario'))) return
    setEliminandoUsuario(true)
    try {
      const res = await usuariosApi.solicitarEliminacion(seleccionado.usuario)
      setSeleccionado((s) => ({ ...s, usuario_eliminacion_solicitada_en: res.data.eliminacion_solicitada_en }))
    } catch (err) {
      window.alert(extraerError(err) || t('form.errorGenerico'))
    } finally {
      setEliminandoUsuario(false)
    }
  }

  const cancelarEliminarUsuario = async () => {
    setEliminandoUsuario(true)
    try {
      await usuariosApi.cancelarEliminacion(seleccionado.usuario)
      setSeleccionado((s) => ({ ...s, usuario_eliminacion_solicitada_en: null }))
    } catch (err) {
      window.alert(extraerError(err) || t('form.errorGenerico'))
    } finally {
      setEliminandoUsuario(false)
    }
  }

  const elegirPeriodo = (tipo) => {
    setReportePeriodo(tipo)
    const ahora = new Date()
    if (tipo === 'SEMANA') {
      const lunes = inicioSemana(ahora)
      const sabado = new Date(lunes); sabado.setDate(lunes.getDate() + 5)
      setReporteDesde(aFecha(lunes)); setReporteHasta(aFecha(sabado))
    } else if (tipo === 'QUINCENA') {
      const dia = ahora.getDate()
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), dia <= 15 ? 1 : 16)
      const fin = dia <= 15 ? new Date(ahora.getFullYear(), ahora.getMonth(), 15) : new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0)
      setReporteDesde(aFecha(inicio)); setReporteHasta(aFecha(fin))
    } else if (tipo === 'MES') {
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
      const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0)
      setReporteDesde(aFecha(inicio)); setReporteHasta(aFecha(fin))
    }
  }

  const generarReporte = () => {
    setCargandoReporte(true)
    setErrorReporte('')
    rrhhApi.reporteAsistencia({ desde: reporteDesde, hasta: reporteHasta, agrupar_por: reporteAgrupar })
      .then((r) => setReporte(r.data))
      .catch((err) => setErrorReporte(extraerError(err) || t('form.errorGenerico')))
      .finally(() => setCargandoReporte(false))
  }

  useEffect(() => { if (reporteDesde && reporteHasta) generarReporte() }, [reporteDesde, reporteHasta, reporteAgrupar])

  const filasReporte = reporte?.filas || []
  const totales = useMemo(() => filasReporte.reduce((acc, f) => ({
    dias_trabajados: acc.dias_trabajados + f.dias_trabajados,
    total_horas: acc.total_horas + f.total_horas,
    con_falta: acc.con_falta + (f.clasificacion !== 'VERDE' ? 1 : 0),
    tardanzas_count: acc.tardanzas_count + f.tardanzas_count,
    suma_tardanza: acc.suma_tardanza + f.promedio_tardanza_minutos * f.tardanzas_count,
  }), { dias_trabajados: 0, total_horas: 0, con_falta: 0, tardanzas_count: 0, suma_tardanza: 0 }), [filasReporte])
  const promedioTardanzaGeneral = totales.tardanzas_count > 0 ? Math.round(totales.suma_tardanza / totales.tardanzas_count) : 0

  const nombreFila = (f) => f.empleado_nombre || f.area_display || f.area
  const masPuntuales = useMemo(() => [...filasReporte].filter((f) => f.dias_trabajados > 0)
    .sort((a, b) => a.promedio_tardanza_minutos - b.promedio_tardanza_minutos).slice(0, 6)
    .map((f) => ({ nombre: nombreFila(f), minutos: f.promedio_tardanza_minutos })), [filasReporte])
  const masTardanzas = useMemo(() => [...filasReporte].filter((f) => f.tardanzas_count > 0)
    .sort((a, b) => b.promedio_tardanza_minutos - a.promedio_tardanza_minutos).slice(0, 6)
    .map((f) => ({ nombre: nombreFila(f), minutos: f.promedio_tardanza_minutos })), [filasReporte])
  const masHoras = useMemo(() => [...filasReporte].sort((a, b) => b.total_horas - a.total_horas).slice(0, 8)
    .map((f) => ({ nombre: nombreFila(f), horas: f.total_horas })), [filasReporte])

  const exportarReporteCsv = () => {
    if (filasReporte.length === 0) return
    const encabezados = reporteAgrupar === 'area'
      ? ['Área', 'Empleados', 'Días trabajados', 'Total horas', 'Faltas completas', 'Faltas parciales', 'Tardanzas', 'Clasificación']
      : ['Empleado', 'Días trabajados', 'Total horas', 'Faltas completas', 'Faltas parciales', 'Tardanzas', 'Clasificación']
    const filasCsv = filasReporte.map((f) => reporteAgrupar === 'area'
      ? [f.area_display, f.empleados_count, f.dias_trabajados, f.total_horas, f.dias_falta_completa, f.dias_falta_parcial, f.tardanzas_count, f.clasificacion]
      : [f.empleado_nombre, f.dias_trabajados, f.total_horas, f.dias_falta_completa, f.dias_falta_parcial, f.tardanzas_count, f.clasificacion])
    const csv = [encabezados, ...filasCsv].map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `asistencia_${reporteDesde}_${reporteHasta}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const activos = empleados.filter((e) => e.activo)
  const inactivos = empleados.filter((e) => !e.activo)

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1>{t('titulo')}</h1>
            <p>{t('subtitulo')}</p>
          </div>
          {tab === 'trabajadores' && <button onClick={() => setMostrarForm(true)}>{t('form.botonAgregar')}</button>}
        </div>
      </div>

      <div className="tabs">
        {TABS.map((tb) => (
          <button key={tb} className={tab === tb ? 'tab active' : 'tab'} onClick={() => setTab(tb)}>
            {t(`tabs.${tb}`)}
          </button>
        ))}
      </div>

      {tab === 'reportes' && (
        <div className="card">
          <h3>{t('reporteHoras.titulo')}</h3>
          <p style={{ marginTop: -6, marginBottom: 16, color: 'var(--text)', fontSize: 13 }}>{t('reporteHoras.subtitulo')}</p>

          <div className="form-row" style={{ alignItems: 'center', marginBottom: 10 }}>
            <div className="chip-list">
              {['SEMANA', 'QUINCENA', 'MES'].map((p) => (
                <label key={p} className="chip" style={{ cursor: 'pointer', background: reportePeriodo === p ? 'var(--accent)' : 'var(--accent-bg)', color: reportePeriodo === p ? '#fff' : 'var(--accent)' }}>
                  <input type="radio" style={{ display: 'none' }} checked={reportePeriodo === p} onChange={() => elegirPeriodo(p)} />
                  {t(`reporteHoras.periodo.${p}`)}
                </label>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              {t('reporteHoras.desde')}
              <input type="date" value={reporteDesde} onChange={(e) => { setReportePeriodo('PERSONALIZADO'); setReporteDesde(e.target.value) }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              {t('reporteHoras.hasta')}
              <input type="date" value={reporteHasta} onChange={(e) => { setReportePeriodo('PERSONALIZADO'); setReporteHasta(e.target.value) }} />
            </label>
          </div>
          <div className="form-row" style={{ alignItems: 'center' }}>
            <div className="chip-list">
              {[['empleado', 'reporteHoras.agruparPersona'], ['area', 'reporteHoras.agruparArea']].map(([v, key]) => (
                <label key={v} className="chip" style={{ cursor: 'pointer', background: reporteAgrupar === v ? 'var(--accent)' : 'var(--accent-bg)', color: reporteAgrupar === v ? '#fff' : 'var(--accent)' }}>
                  <input type="radio" style={{ display: 'none' }} checked={reporteAgrupar === v} onChange={() => setReporteAgrupar(v)} />
                  {t(key)}
                </label>
              ))}
            </div>
            {cargandoReporte && <span style={{ fontSize: 13, color: 'var(--text)' }}>{t('mensajes.cargando', { ns: 'common' })}</span>}
            {filasReporte.length > 0 && <button className="secondary" onClick={exportarReporteCsv}>⬇ {t('reporteHoras.exportarCsv')}</button>}
            <button onClick={() => rrhhApi.exportarReporteAsistencia(reporteDesde, reporteHasta)}>⬇ {t('reporteHoras.exportarExcel')}</button>
          </div>

          {errorReporte && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{errorReporte}</div>}

          {reporte && filasReporte.length === 0 && !cargandoReporte && <div className="empty" style={{ marginTop: 14 }}>{t('reporteHoras.sinDatos')}</div>}

          {filasReporte.length > 0 && (
            <>
              <div className="card-grid" style={{ marginTop: 18, marginBottom: 20 }}>
                <div className="stat">
                  <div className="stat-icon blue">📅</div>
                  <div className="stat-label">{t('reporteHoras.totalDias')}</div>
                  <div className="stat-value">{totales.dias_trabajados}</div>
                </div>
                <div className="stat">
                  <div className="stat-icon green">⏱️</div>
                  <div className="stat-label">{t('reporteHoras.totalHoras')}</div>
                  <div className="stat-value">{totales.total_horas.toFixed(1)}</div>
                </div>
                <div className="stat">
                  <div className="stat-icon" style={totales.con_falta > 0 ? { background: 'rgba(220, 38, 38, 0.12)', color: 'var(--danger)' } : undefined}>⚠️</div>
                  <div className="stat-label">{t('reporteHoras.conFalta')}</div>
                  <div className="stat-value" style={{ color: totales.con_falta > 0 ? 'var(--danger)' : 'inherit' }}>{totales.con_falta}</div>
                </div>
                <div className="stat">
                  <div className="stat-icon amber">🕒</div>
                  <div className="stat-label">{t('reporteHoras.promedioTardanza')}</div>
                  <div className="stat-value">{promedioTardanzaGeneral} {t('reporteHoras.min')}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div className="chart-card">
                  <h3>{t('reporteHoras.chartMasPuntuales')}</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={masPuntuales} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="nombre" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [`${v} ${t('reporteHoras.min')}`, t('reporteHoras.tardanzaPromedio')]} />
                      <Bar dataKey="minutos" fill="#059669" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-card">
                  <h3>{t('reporteHoras.chartMasTardanzas')}</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={masTardanzas} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="nombre" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [`${v} ${t('reporteHoras.min')}`, t('reporteHoras.tardanzaPromedio')]} />
                      <Bar dataKey="minutos" fill="#dc2626" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-card">
                  <h3>{t('reporteHoras.chartMasHoras')}</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={masHoras} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="nombre" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [v, t('reporteHoras.totalHoras')]} />
                      <Bar dataKey="horas" fill="#1d4ed8" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>{reporteAgrupar === 'area' ? t('reporteHoras.columnaArea') : t('tabla.columnas.nombre')}</th>
                    <th>{t('reporteHoras.columnaDias')}</th>
                    <th>{t('reporteHoras.totalHoras')}</th>
                    <th>{t('reporteHoras.columnaFaltaCompleta')}</th>
                    <th>{t('reporteHoras.columnaFaltaParcial')}</th>
                    <th>{t('reporteHoras.columnaTardanzas')}</th>
                    <th>{t('reporteHoras.columnaClasificacion')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filasReporte.map((f) => (
                    <tr key={f.empleado_id ?? f.area}>
                      <td>{nombreFila(f)}{reporteAgrupar === 'area' && <span style={{ color: 'var(--text)', fontSize: 12 }}> ({f.empleados_count})</span>}</td>
                      <td>{f.dias_trabajados} / {f.dias_programados}</td>
                      <td><strong>{f.total_horas.toFixed(1)}</strong></td>
                      <td>{f.dias_falta_completa}</td>
                      <td>{f.dias_falta_parcial}</td>
                      <td>{f.tardanzas_count > 0 ? `${f.tardanzas_count} (${f.promedio_tardanza_minutos} ${t('reporteHoras.min')})` : '—'}</td>
                      <td>
                        <span className="badge" style={{ background: `${COLOR_CLASIFICACION[f.clasificacion]}22`, color: COLOR_CLASIFICACION[f.clasificacion], fontWeight: 700 }}>
                          {t(`reporteHoras.clasificacion.${f.clasificacion}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {tab === 'trabajadores' && (
        <>
          <UniformeSemana t={t} />

          <div className="card">
            <h3>{t('tabla.tituloActivos')}</h3>
            {loading && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
            {!loading && activos.length === 0 && <div className="empty">{t('tabla.vacio')}</div>}
            {!loading && activos.length > 0 && (
              <div className="rrhh-grid">
                {activos.map((emp) => (
                  <button key={emp.id} className="rrhh-empleado-card" onClick={() => abrirEmpleado(emp)}>
                    <Avatar nombre={emp.nombre} foto={emp.foto} color={emp.avatar_color} size={56} />
                    <div className="rrhh-empleado-nombre">{emp.nombre}</div>
                    <div className="rrhh-empleado-puesto">{(emp.puestos || []).join(' · ')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                      {(emp.areas || []).map((a) => (
                        <span key={a} className="badge pending">{t(`areas.${a}`, { defaultValue: a })}</span>
                      ))}
                    </div>
                    {(emp.areas || []).some((a) => a === 'TALLER' || a === 'PASANTE') && (
                      <span className="rrhh-empleado-ordenes">{t('tablero.equiposCount', { ns: 'taller', n: emp.ordenes_activas_count ?? 0 })}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {inactivos.length > 0 && (
              <>
                <h3 style={{ marginTop: 24 }}>{t('tabla.tituloInactivos')}</h3>
                <div className="rrhh-grid">
                  {inactivos.map((emp) => (
                    <button key={emp.id} className="rrhh-empleado-card inactivo" onClick={() => abrirEmpleado(emp)}>
                      <Avatar nombre={emp.nombre} foto={emp.foto} color={emp.avatar_color} size={56} />
                      <div className="rrhh-empleado-nombre">{emp.nombre}</div>
                      <div className="rrhh-empleado-puesto">{(emp.puestos || []).join(' · ')}</div>
                      <span className="badge off">{t('estado.inactivo', { ns: 'common' })}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {tab === 'horas' && <HorasTab t={t} empleados={activos} />}

      {tab === 'permisos' && (
        <PermisoManager
          categoria="OTRO" mostrarTipoFijo empleados={activos} t={t}
          titulo={t('permisos.titulo')} subtitulo={t('permisos.subtitulo')}
        />
      )}

      {tab === 'vacaciones' && <VacacionesTab empleados={activos} t={t} />}

      {mostrarForm && (
        <div className="modal-backdrop" onClick={() => setMostrarForm(false)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h2>{t('form.tituloNuevo')}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <input placeholder={t('form.nombre')} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                <input placeholder={t('form.cedula')} value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, marginBottom: 6, color: 'var(--text-h)' }}>{t('form.area')}</div>
                <div className="chip-list">
                  {AREAS.map((a) => (
                    <label key={a} className="chip" style={{ cursor: 'pointer', background: form.areas.includes(a) ? 'var(--accent)' : 'var(--accent-bg)', color: form.areas.includes(a) ? '#fff' : 'var(--accent)' }}>
                      <input type="checkbox" style={{ display: 'none' }} checked={form.areas.includes(a)} onChange={() => toggleArea(a)} />
                      {t(`areas.${a}`, { defaultValue: a })}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, marginBottom: 6, color: 'var(--text-h)' }}>{t('form.puesto')}</div>
                <PuestosInput value={form.puestos} onChange={(puestos) => setForm({ ...form, puestos })} placeholder={t('form.puestoPlaceholder')} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, marginBottom: 6, color: 'var(--text-h)' }}>{t('form.tipoVinculacion')}</div>
                <select value={form.tipo_vinculacion} onChange={(e) => setForm({ ...form, tipo_vinculacion: e.target.value })}>
                  {TIPOS_VINCULACION.map((tv) => <option key={tv} value={tv}>{t(`tiposVinculacion.${tv}`)}</option>)}
                </select>
                {form.tipo_vinculacion === 'PASANTIA' && <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text)', opacity: 0.75 }}>{t('form.avisoPasantiaSinVacaciones')}</p>}
              </div>
              <div className="form-row">
                <input type="number" placeholder={t('form.salario')} value={form.salario} onChange={(e) => setForm({ ...form, salario: e.target.value })} />
                <input placeholder={t('form.correo')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input placeholder={t('form.telefono')} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                <input type="date" value={form.fecha_ingreso} onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, marginBottom: 6, color: 'var(--text-h)' }}>{t('equiposAsignados')}</div>
                <EquipoPicker productos={productos} value={form.equipos_asignados} onChange={(ids) => setForm({ ...form, equipos_asignados: ids })} placeholder={t('form.buscarEquipoPlaceholder')} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, marginBottom: 6, color: 'var(--text-h)' }}>{t('form.uniformeAsignado')}</div>
                <input placeholder={t('form.uniformeAsignadoPlaceholder')} value={form.uniforme_asignado} onChange={(e) => setForm({ ...form, uniforme_asignado: e.target.value })} />
              </div>
              {esAdmin && (
                <div style={{ marginBottom: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.crear_usuario}
                      onChange={(e) => setForm({ ...form, crear_usuario: e.target.checked, usuario_password: e.target.checked && !form.usuario_password ? form.cedula : form.usuario_password })} />
                    {t('form.asignarUsuario')}
                  </label>
                  {form.crear_usuario && (
                    <div className="form-row" style={{ marginTop: 10 }}>
                      <input placeholder={t('form.nombreUsuario')} value={form.usuario_username} onChange={(e) => setForm({ ...form, usuario_username: e.target.value })} />
                      <input type="text" placeholder={t('form.contrasena')} value={form.usuario_password} onChange={(e) => setForm({ ...form, usuario_password: e.target.value })} />
                    </div>
                  )}
                </div>
              )}

              {errorForm && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{errorForm}</div>}

              <div className="form-row">
                <button type="submit" disabled={guardando}>{guardando ? t('botones.guardando', { ns: 'common' }) : t('form.botonAgregar')}</button>
                <button type="button" className="secondary" onClick={() => setMostrarForm(false)} disabled={guardando}>{t('botones.cancelar', { ns: 'common' })}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {seleccionado && (
        <div className="modal-backdrop" onClick={() => setSeleccionado(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 10 }}>
              <Avatar nombre={seleccionado.nombre} foto={seleccionado.foto} color={seleccionado.avatar_color} size={64} editable onSubirFoto={(file) => handleSubirFoto(seleccionado.id, file)} />
              <div>
                <h2 style={{ margin: 0 }}>{seleccionado.nombre}</h2>
                <p style={{ color: 'var(--text)', margin: 0 }}>{(seleccionado.puestos || []).join(' · ')} — {(seleccionado.areas || []).map((a) => t(`areas.${a}`, { defaultValue: a })).join(', ')}</p>
              </div>
            </div>
            {editando ? (
              <form onSubmit={guardarEdicion} style={{ marginBottom: 14 }}>
                <div className="form-row">
                  <input placeholder={t('form.nombre')} value={formEdit.nombre} onChange={(e) => setFormEdit({ ...formEdit, nombre: e.target.value })} />
                  <input placeholder={t('form.cedula')} value={formEdit.cedula} onChange={(e) => setFormEdit({ ...formEdit, cedula: e.target.value })} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, marginBottom: 6, color: 'var(--text-h)' }}>{t('form.area')}</div>
                  <div className="chip-list">
                    {AREAS.map((a) => (
                      <label key={a} className="chip" style={{ cursor: 'pointer', background: formEdit.areas.includes(a) ? 'var(--accent)' : 'var(--accent-bg)', color: formEdit.areas.includes(a) ? '#fff' : 'var(--accent)' }}>
                        <input type="checkbox" style={{ display: 'none' }} checked={formEdit.areas.includes(a)} onChange={() => toggleAreaEdit(a)} />
                        {t(`areas.${a}`, { defaultValue: a })}
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, marginBottom: 6, color: 'var(--text-h)' }}>{t('form.puesto')}</div>
                  <PuestosInput value={formEdit.puestos} onChange={(puestos) => setFormEdit({ ...formEdit, puestos })} placeholder={t('form.puestoPlaceholder')} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, marginBottom: 6, color: 'var(--text-h)' }}>{t('form.tipoVinculacion')}</div>
                  <select value={formEdit.tipo_vinculacion} onChange={(e) => setFormEdit({ ...formEdit, tipo_vinculacion: e.target.value })}>
                    {TIPOS_VINCULACION.map((tv) => <option key={tv} value={tv}>{t(`tiposVinculacion.${tv}`)}</option>)}
                  </select>
                  {formEdit.tipo_vinculacion === 'PASANTIA' && <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text)', opacity: 0.75 }}>{t('form.avisoPasantiaSinVacaciones')}</p>}
                </div>
                <div className="form-row">
                  <input type="number" placeholder={t('form.salario')} value={formEdit.salario} onChange={(e) => setFormEdit({ ...formEdit, salario: e.target.value })} />
                  <input placeholder={t('form.correo')} value={formEdit.email} onChange={(e) => setFormEdit({ ...formEdit, email: e.target.value })} />
                  <input placeholder={t('form.telefono')} value={formEdit.telefono} onChange={(e) => setFormEdit({ ...formEdit, telefono: e.target.value })} />
                  <input type="date" value={formEdit.fecha_ingreso} onChange={(e) => setFormEdit({ ...formEdit, fecha_ingreso: e.target.value })} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, marginBottom: 6, color: 'var(--text-h)' }}>{t('equiposAsignados')}</div>
                  <EquipoPicker productos={productos} value={formEdit.equipos_asignados} onChange={(ids) => setFormEdit({ ...formEdit, equipos_asignados: ids })} placeholder={t('form.buscarEquipoPlaceholder')} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, marginBottom: 6, color: 'var(--text-h)' }}>{t('form.uniformeAsignado')}</div>
                  <input placeholder={t('form.uniformeAsignadoPlaceholder')} value={formEdit.uniforme_asignado || ''} onChange={(e) => setFormEdit({ ...formEdit, uniforme_asignado: e.target.value })} />
                </div>
                {errorEdicion && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{errorEdicion}</div>}
                <div className="form-row">
                  <button type="submit" disabled={guardandoEdicion}>{guardandoEdicion ? t('botones.guardando', { ns: 'common' }) : t('botones.guardar', { ns: 'common' })}</button>
                  <button type="button" className="secondary" onClick={() => setEditando(false)} disabled={guardandoEdicion}>{t('botones.cancelar', { ns: 'common' })}</button>
                </div>
              </form>
            ) : (
              <table style={{ marginBottom: 14 }}>
                <tbody>
                  <tr><td><strong>{t('modal.cedula')}</strong></td><td>{seleccionado.cedula}</td></tr>
                  <tr><td><strong>{t('modal.telefono')}</strong></td><td>{seleccionado.telefono || '—'}</td></tr>
                  <tr><td><strong>{t('modal.correo')}</strong></td><td>{seleccionado.email || '—'}</td></tr>
                  <tr><td><strong>{t('modal.salario')}</strong></td><td>${Number(seleccionado.salario).toLocaleString()}</td></tr>
                  <tr><td><strong>{t('modal.ingreso')}</strong></td><td>{seleccionado.fecha_ingreso}</td></tr>
                  <tr><td><strong>{t('modal.tipoVinculacion')}</strong></td><td>{t(`tiposVinculacion.${seleccionado.tipo_vinculacion || 'FIJO'}`)}</td></tr>
                </tbody>
              </table>
            )}

            {esAdmin && (
              <div style={{ marginBottom: 16 }}>
                <strong>{t('modal.usuarioSistema')}</strong>
                <div style={{ marginTop: 8 }}>
                  {seleccionado.usuario_username ? (
                    seleccionado.usuario_eliminacion_solicitada_en ? (
                      <div>
                        <span className="badge off">{t('form.pendienteEliminacion', { horas: horasRestantes(seleccionado.usuario_eliminacion_solicitada_en) })}</span>
                        <button type="button" className="secondary" style={{ marginLeft: 8 }} disabled={eliminandoUsuario} onClick={cancelarEliminarUsuario}>
                          {t('form.cancelarEliminacion')}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="badge ok">{seleccionado.usuario_username}</span>
                        <button type="button" className="danger" disabled={eliminandoUsuario} onClick={eliminarUsuarioVinculado}>{t('botones.eliminar', { ns: 'common' })}</button>
                      </div>
                    )
                  ) : crearUsuarioAbierto ? (
                    <form onSubmit={crearUsuarioRapido} className="form-row" style={{ alignItems: 'center' }}>
                      <input autoFocus placeholder={t('form.nombreUsuario')} value={usuarioQuick} onChange={(e) => setUsuarioQuick(e.target.value)} style={{ maxWidth: 200 }} />
                      <input type="text" placeholder={t('form.contrasena')} value={usuarioQuickPassword} onChange={(e) => setUsuarioQuickPassword(e.target.value)} style={{ maxWidth: 160 }} />
                      <button type="submit" disabled={guardandoUsuarioQuick}>{guardandoUsuarioQuick ? t('botones.guardando', { ns: 'common' }) : t('form.botonCrearUsuario')}</button>
                      <button type="button" className="secondary" onClick={() => setCrearUsuarioAbierto(false)}>{t('botones.cancelar', { ns: 'common' })}</button>
                    </form>
                  ) : (
                    <button type="button" className="secondary" onClick={abrirCrearUsuarioRapido}>{t('form.botonCrearUsuario')}</button>
                  )}
                  {errorUsuarioQuick && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 6 }}>{errorUsuarioQuick}</div>}
                </div>
              </div>
            )}

            {!editando && (
              <div style={{ marginBottom: 16 }}>
                <strong>{t('equiposAsignados')}</strong>
                <div className="chip-list" style={{ marginTop: 8 }}>
                  {seleccionado.equipos_detalle && seleccionado.equipos_detalle.length > 0
                    ? seleccionado.equipos_detalle.map((eq) => <span key={eq.id} className="chip">{eq.nombre}</span>)
                    : <span style={{ color: 'var(--text)', fontSize: 13 }}>{t('modal.sinEquipos')}</span>}
                </div>
              </div>
            )}

            {!editando && (
              <div style={{ marginBottom: 16 }}>
                <strong>{t('form.uniformeAsignado')}</strong>
                <p style={{ marginTop: 6, color: seleccionado.uniforme_asignado ? 'var(--text-h)' : 'var(--text)', fontSize: 13 }}>
                  {seleccionado.uniforme_asignado || t('modal.sinUniforme')}
                </p>
              </div>
            )}

            {!editando && (
              <DocumentosEmpleado empleadoId={seleccionado.id} t={t} />
            )}

            {!editando && (
              <div style={{ marginBottom: 20 }}>
                <strong>{t('horario.titulo')}</strong>
                <p style={{ marginTop: 2, marginBottom: 10, color: 'var(--text)', fontSize: 13 }}>{t('horario.subtitulo')}</p>
                <table>
                  <thead>
                    <tr><th></th><th>{t('horario.entrada')}</th><th>{t('horario.salida')}</th></tr>
                  </thead>
                  <tbody>
                    {DIAS_SEMANA.map((dia) => (
                      <tr key={dia}>
                        <td><strong>{t(`horario.dias.${dia}`)}</strong></td>
                        <td>
                          <input type="time" value={horarioDraft[dia].hora_entrada}
                            onChange={(e) => setHorarioDraft((h) => ({ ...h, [dia]: { ...h[dia], hora_entrada: e.target.value } }))} />
                        </td>
                        <td>
                          <input type="time" value={horarioDraft[dia].hora_salida}
                            onChange={(e) => setHorarioDraft((h) => ({ ...h, [dia]: { ...h[dia], hora_salida: e.target.value } }))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="form-row" style={{ alignItems: 'center', marginTop: 10 }}>
                  <button type="button" onClick={guardarHorario} disabled={guardandoHorario}>
                    {guardandoHorario ? t('horario.guardando') : t('horario.guardar')}
                  </button>
                  {horarioGuardadoOk && <span className="badge ok">{t('horario.guardado')}</span>}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              {!editando && <button className="secondary" onClick={iniciarEdicion}>{t('botones.editar', { ns: 'common' })}</button>}
              <button className="danger" onClick={() => { handleDelete(seleccionado.id); setSeleccionado(null) }}>{t('botones.eliminar', { ns: 'common' })}</button>
              <button className="secondary" onClick={() => setSeleccionado(null)}>{t('botones.cerrar', { ns: 'common' })}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Pestaña "Horas": planilla de un solo día para todos los trabajadores a la
// vez (en vez de tener que abrir la ficha de cada uno) — mismo criterio de
// "no se paga hora extra" que el reporte de asistencia, mostrado en vivo
// mientras se escribe la hora de entrada/salida, antes de guardar.
function HorasTab({ t, empleados }) {
  const [fecha, setFecha] = useState(hoy())
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [draft, setDraft] = useState({ empleado: '', hora_entrada: '', hora_salida: '', horas: '', nota: '' })
  const [guardando, setGuardando] = useState(false)

  const cargar = () => {
    setCargando(true)
    rrhhApi.registrosHoras({ desde: fecha, hasta: fecha }).then((r) => setRegistros(r.data)).finally(() => setCargando(false))
  }
  useEffect(cargar, [fecha])

  const actualizarDraft = (campo, valor) => {
    setDraft((d) => {
      const next = { ...d, [campo]: valor }
      if (next.hora_entrada && next.hora_salida) {
        const h = horasPagables(next.hora_entrada, next.hora_salida, fecha)
        if (h !== null) next.horas = h.toFixed(2)
      }
      return next
    })
  }

  const registrar = (e) => {
    e.preventDefault()
    if (!draft.empleado || !draft.horas) return
    setGuardando(true)
    rrhhApi.crearRegistroHoras({
      empleado: draft.empleado, fecha,
      hora_entrada: draft.hora_entrada || null, hora_salida: draft.hora_salida || null,
      horas: draft.horas, nota: draft.nota,
    }).then(() => {
      setDraft({ empleado: '', hora_entrada: '', hora_salida: '', horas: '', nota: '' })
      cargar()
    }).finally(() => setGuardando(false))
  }

  const eliminar = (id) => { rrhhApi.eliminarRegistroHoras(id).then(cargar) }

  const corregirDraftAmPm = () => actualizarDraft('hora_salida', sumar12Horas(draft.hora_salida))
  const corregirRegistroAmPm = (r) => {
    const salidaCorregida = sumar12Horas(r.hora_salida)
    rrhhApi.actualizarRegistroHoras(r.id, {
      hora_salida: salidaCorregida,
      horas: (horasPagables(r.hora_entrada, salidaCorregida, r.fecha || fecha) ?? 0).toFixed(2),
    }).then(cargar)
  }

  const ventana = ventanaPago(fecha)
  const previewHoras = draft.hora_entrada && draft.hora_salida ? horasPagables(draft.hora_entrada, draft.hora_salida, fecha) : null
  const previewConRecorte = previewHoras !== null && (draft.hora_entrada < ventana.inicio || draft.hora_salida > ventana.fin)
  const previewConfusionAmPm = esProbableConfusionAmPm(draft.hora_entrada, draft.hora_salida)

  return (
    <div className="card">
      <h3>{t('horas.titulo')}</h3>
      <p style={{ marginTop: -6, marginBottom: 16, color: 'var(--text)', fontSize: 13 }}>{t('horas.subtitulo')}</p>

      <div className="form-row" style={{ alignItems: 'center', marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          {t('horas.fecha')}
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        {ventana.esSabado && (
          <span className="badge" style={{ fontSize: 12 }}>{t('horas.avisoSabado')}</span>
        )}
      </div>

      <form onSubmit={registrar} className="form-row" style={{ alignItems: 'center', marginBottom: 6 }}>
        <select value={draft.empleado} onChange={(e) => setDraft({ ...draft, empleado: e.target.value })} required>
          <option value="">{t('permisos.seleccionaEmpleado')}</option>
          {empleados.map((emp) => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text)' }}>
          {t('modal.entrada')}
          <input type="time" value={draft.hora_entrada} onChange={(e) => actualizarDraft('hora_entrada', e.target.value)} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text)' }}>
          {t('modal.salida')}
          <input type="time" value={draft.hora_salida} onChange={(e) => actualizarDraft('hora_salida', e.target.value)} />
        </label>
        <input type="number" step="0.01" min="0" placeholder={t('modal.horas')} value={draft.horas} onChange={(e) => setDraft({ ...draft, horas: e.target.value })} style={{ maxWidth: 100 }} />
        <input placeholder={t('modal.nota')} value={draft.nota} onChange={(e) => setDraft({ ...draft, nota: e.target.value })} />
        <button type="submit" disabled={guardando}>{guardando ? t('horas.guardando') : t('modal.registrarHoras')}</button>
      </form>
      {previewConfusionAmPm ? (
        <p style={{ marginTop: 0, marginBottom: 14, fontSize: 12.5, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          ⚠️ {t('horas.avisoAmPm', { salida: draft.hora_salida, entrada: draft.hora_entrada })}
          <button type="button" className="secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={corregirDraftAmPm}>
            {t('horas.corregirA', { hora: sumar12Horas(draft.hora_salida) })}
          </button>
        </p>
      ) : previewHoras !== null && (
        <p style={{ marginTop: 0, marginBottom: 14, fontSize: 12.5, color: 'var(--accent)' }}>
          {t('horas.horasPagables')}: <strong>{previewHoras.toFixed(2)}</strong>{previewConRecorte ? ` (${t('horas.sinHoraExtra')})` : ''}
        </p>
      )}

      {cargando && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
      {!cargando && registros.length === 0 && <div className="empty">{t('modal.sinHoras')}</div>}
      {!cargando && registros.length > 0 && (
        <table style={{ marginTop: 10 }}>
          <thead><tr><th>{t('horas.columnaTrabajador')}</th><th>{t('modal.entrada')}</th><th>{t('modal.salida')}</th><th>{t('modal.horas')}</th><th>{t('modal.nota')}</th><th></th></tr></thead>
          <tbody>
            {registros.map((r) => {
              const confuso = esProbableConfusionAmPm(r.hora_entrada, r.hora_salida)
              return (
                <tr key={r.id}>
                  <td>{r.empleado_nombre}</td>
                  <td>{r.hora_entrada || '—'}</td>
                  <td style={confuso ? { color: 'var(--danger)' } : undefined}>{r.hora_salida || '—'}</td>
                  <td>{r.horas}</td>
                  <td>{r.nota || '—'}</td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {confuso && (
                      <button type="button" className="secondary" style={{ padding: '2px 8px', fontSize: 12 }} title={t('horas.avisoAmPm', { salida: r.hora_salida, entrada: r.hora_entrada })} onClick={() => corregirRegistroAmPm(r)}>
                        {t('horas.corregirA', { hora: sumar12Horas(r.hora_salida) })}
                      </button>
                    )}
                    <button className="danger" onClick={() => eliminar(r.id)}>{t('botones.eliminar', { ns: 'common' })}</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// Compartido por las pestañas "Permisos" y "Vacaciones" — misma mecánica
// (elegir trabajador, motivo, duración, imprimir con firma) pero cada una
// filtra/guarda su propia `categoria` (ver PermisoEmpleado.categoria en
// backend/rrhh/models.py) para no mezclarse entre sí.
function PermisoManager({ categoria, mostrarTipoFijo, permitirPorHora, empleados, titulo, subtitulo, motivoDefault, t, onCambio }) {
  const [permisos, setPermisos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState({ ...emptyPermiso, tipo: mostrarTipoFijo ? 'FIJO' : 'MOMENTANEO', motivo: motivoDefault || '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [previsualizar, setPrevisualizar] = useState(null)

  const cargar = () => {
    setCargando(true)
    rrhhApi.permisos({ categoria }).then((r) => setPermisos(r.data)).finally(() => setCargando(false))
  }
  useEffect(cargar, [categoria])

  const crear = (e) => {
    e.preventDefault()
    setError('')
    if (!form.empleado) { setError(t('permisos.seleccionaEmpleado')); return }
    setGuardando(true)
    const data = { empleado: form.empleado, tipo: form.tipo, categoria, motivo: form.motivo }
    if (form.tipo === 'FIJO') {
      data.dia_semana = form.dia_semana
      // "Todo el día" borra cualquier hora que haya quedado del toggle
      // anterior — un permiso fijo sin horas significa "no trabaja ese día".
      data.hora_entrada = form.porHoras ? (form.hora_entrada || null) : null
      data.hora_salida = form.porHoras ? (form.hora_salida || null) : null
    } else if (form.tipo === 'POR_HORA') {
      // Un solo día puntual con horario autorizado (ej. "sale a la 1:00
      // pm") — usa fecha_inicio como esa fecha; fecha_fin no aplica.
      data.fecha_inicio = form.fecha_inicio
      data.hora_entrada = form.hora_entrada || null
      data.hora_salida = form.hora_salida || null
    } else {
      data.fecha_inicio = form.fecha_inicio
      data.fecha_fin = form.fecha_fin
    }
    rrhhApi.crearPermiso(data)
      .then(() => {
        setForm({ ...emptyPermiso, tipo: mostrarTipoFijo ? 'FIJO' : 'MOMENTANEO', motivo: motivoDefault || '' })
        cargar()
        onCambio?.()
      })
      .catch((err) => setError(extraerError(err) || t('form.errorGenerico')))
      .finally(() => setGuardando(false))
  }

  const eliminar = (id) => {
    rrhhApi.eliminarPermiso(id).then(() => { cargar(); onCambio?.() })
  }

  return (
    <div className="card">
      <h3>{titulo}</h3>
      <p style={{ marginTop: -6, marginBottom: 16, color: 'var(--text)', fontSize: 13 }}>{subtitulo}</p>

      <form onSubmit={crear}>
        <div className="form-row">
          <select value={form.empleado} onChange={(e) => setForm({ ...form, empleado: e.target.value })} required>
            <option value="">{t('permisos.seleccionaEmpleado')}</option>
            {empleados.map((emp) => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
          </select>
        </div>

        {mostrarTipoFijo && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--text)' }}>{t('permisos.preguntaTipo')}</div>
            <div className="chip-list">
              {[['FIJO', 'permisos.tipoFijo'], ['MOMENTANEO', 'permisos.tipoPorDias'], ['POR_HORA', 'permisos.tipoPorHora']].map(([v, key]) => (
                <label key={v} className="chip" style={{ cursor: 'pointer', background: form.tipo === v ? 'var(--accent)' : 'var(--accent-bg)', color: form.tipo === v ? '#fff' : 'var(--accent)' }}>
                  <input type="radio" style={{ display: 'none' }} checked={form.tipo === v} onChange={() => setForm({ ...form, tipo: v })} />
                  {t(key)}
                </label>
              ))}
            </div>
          </div>
        )}

        {permitirPorHora && !mostrarTipoFijo && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--text)' }}>{t('permisos.preguntaTipoVacaciones')}</div>
            <div className="chip-list">
              {[['MOMENTANEO', 'permisos.tipoPorDias'], ['POR_HORA', 'permisos.tipoPorHora']].map(([v, key]) => (
                <label key={v} className="chip" style={{ cursor: 'pointer', background: form.tipo === v ? 'var(--accent)' : 'var(--accent-bg)', color: form.tipo === v ? '#fff' : 'var(--accent)' }}>
                  <input type="radio" style={{ display: 'none' }} checked={form.tipo === v} onChange={() => setForm({ ...form, tipo: v })} />
                  {t(key)}
                </label>
              ))}
            </div>
            {form.tipo === 'POR_HORA' && categoria === 'VACACIONES' && (
              <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text)', opacity: 0.75 }}>{t('vacaciones.avisoPorHoras')}</p>
            )}
          </div>
        )}

        {mostrarTipoFijo && form.tipo === 'FIJO' && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--text)' }}>{t('permisos.preguntaHoras')}</div>
            <div className="chip-list">
              {[[false, 'permisos.todoElDia'], [true, 'permisos.porHoras']].map(([v, key]) => (
                <label key={String(v)} className="chip" style={{ cursor: 'pointer', background: form.porHoras === v ? 'var(--accent)' : 'var(--accent-bg)', color: form.porHoras === v ? '#fff' : 'var(--accent)' }}>
                  <input type="radio" style={{ display: 'none' }} checked={form.porHoras === v} onChange={() => setForm({ ...form, porHoras: v })} />
                  {t(key)}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="form-row">
          <input placeholder={t('permisos.motivo')} value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} style={{ flex: '1 1 260px' }} />
        </div>
        {mostrarTipoFijo && form.tipo === 'FIJO' ? (
          <div className="form-row">
            <select value={form.dia_semana} onChange={(e) => setForm({ ...form, dia_semana: e.target.value })}>
              {DIAS_SEMANA.map((d) => <option key={d} value={d}>{t(`horario.dias.${d}`)}</option>)}
            </select>
            {form.porHoras && (
              <>
                <input type="time" value={form.hora_entrada} onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })} />
                <input type="time" value={form.hora_salida} onChange={(e) => setForm({ ...form, hora_salida: e.target.value })} />
              </>
            )}
          </div>
        ) : (mostrarTipoFijo || permitirPorHora) && form.tipo === 'POR_HORA' ? (
          <div className="form-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              {t('permisos.fecha')}
              <input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} required />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              {t('modal.entrada')}
              <input type="time" value={form.hora_entrada} onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })} required />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              {t('modal.salida')}
              <input type="time" value={form.hora_salida} onChange={(e) => setForm({ ...form, hora_salida: e.target.value })} required />
            </label>
          </div>
        ) : (
          <div className="form-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              {t('permisos.desde')}
              <input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              {t('permisos.hasta')}
              <input type="date" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
            </label>
          </div>
        )}
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button type="submit" disabled={guardando}>{guardando ? t('botones.guardando', { ns: 'common' }) : t('permisos.agregar')}</button>
      </form>

      {cargando && <div className="loading" style={{ marginTop: 14 }}>{t('mensajes.cargando', { ns: 'common' })}</div>}
      {!cargando && permisos.length === 0 && <div className="empty" style={{ marginTop: 14 }}>{t('permisos.sinPermisos')}</div>}
      {!cargando && permisos.length > 0 && (
        <table style={{ marginTop: 14 }}>
          <thead><tr><th>{t('permisos.empleado')}</th><th>{t('permisos.tipo')}</th><th>{t('permisos.columnaVigencia')}</th><th>{t('permisos.columnaHorario')}</th><th>{t('permisos.motivo')}</th><th></th></tr></thead>
          <tbody>
            {permisos.map((p) => (
              <tr key={p.id}>
                <td>{p.empleado_nombre}</td>
                <td>{p.tipo === 'FIJO' ? t('permisos.tipoFijo') : p.tipo === 'POR_HORA' ? t('permisos.tipoPorHora') : t('permisos.tipoMomentaneo')}</td>
                <td>{p.tipo === 'FIJO' ? t(`horario.dias.${p.dia_semana}`) : p.tipo === 'POR_HORA' ? p.fecha_inicio : `${p.fecha_inicio} — ${p.fecha_fin}`}</td>
                <td>{p.tipo === 'FIJO' && !p.hora_entrada && !p.hora_salida
                  ? t('permisos.libreTodoElDia')
                  : (p.hora_entrada && p.hora_salida ? `${p.hora_entrada} - ${p.hora_salida}` : '—')}</td>
                <td>{p.motivo || '—'}</td>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="secondary" onClick={() => setPrevisualizar(p)}>{t('permisos.imprimir')}</button>
                  <button className="danger" onClick={() => eliminar(p.id)}>{t('botones.eliminar', { ns: 'common' })}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {previsualizar && (
        <PermisoPreview permiso={previsualizar} empleadoNombre={previsualizar.empleado_nombre} t={t} onClose={() => setPrevisualizar(null)} />
      )}
    </div>
  )
}

// Pestaña "Vacaciones": arriba el saldo de cada trabajador (Art. 76 del
// Código del Trabajo — 15 días por cada 6 meses trabajados), abajo el mismo
// formulario/lista de PermisoManager pero fijo en categoria="VACACIONES".
function VacacionesTab({ empleados, t }) {
  const [saldo, setSaldo] = useState([])
  const [cargando, setCargando] = useState(true)
  // Los pasantes no tienen derecho a vacaciones — ni siquiera aparecen como
  // opción para registrarles una (el backend igual lo bloquea si se intenta
  // por API directa, ver PermisoEmpleadoSerializer.validate()).
  const empleadosConDerecho = empleados.filter((e) => e.tipo_vinculacion !== 'PASANTIA')

  const cargarSaldo = () => {
    setCargando(true)
    rrhhApi.saldoVacaciones().then((r) => setSaldo(r.data)).finally(() => setCargando(false))
  }
  useEffect(cargarSaldo, [])

  return (
    <>
      <div className="card">
        <h3>{t('vacaciones.titulo')}</h3>
        <p style={{ marginTop: -6, marginBottom: 16, color: 'var(--text)', fontSize: 13 }}>{t('vacaciones.subtitulo')}</p>
        {cargando && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
        {!cargando && saldo.length === 0 && <div className="empty">{t('tabla.vacio')}</div>}
        {!cargando && saldo.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>{t('vacaciones.columnaTrabajador')}</th>
                <th>{t('vacaciones.columnaIngreso')}</th>
                <th>{t('vacaciones.columnaMeses')}</th>
                <th>{t('vacaciones.columnaAcumulados')}</th>
                <th>{t('vacaciones.columnaTomados')}</th>
                <th>{t('vacaciones.columnaDisponibles')}</th>
              </tr>
            </thead>
            <tbody>
              {saldo.map((f) => (
                <tr key={f.empleado_id}>
                  <td>{f.empleado_nombre}</td>
                  <td>{f.fecha_ingreso}</td>
                  <td>{f.meses_trabajados}</td>
                  <td>{f.dias_acumulados}</td>
                  <td>{f.dias_tomados}</td>
                  <td><strong style={{ color: f.dias_disponibles < 0 ? 'var(--danger)' : 'var(--success)' }}>{f.dias_disponibles}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PermisoManager
        categoria="VACACIONES" mostrarTipoFijo={false} permitirPorHora empleados={empleadosConDerecho} t={t}
        titulo={t('vacaciones.formTitulo')} subtitulo={t('vacaciones.formSubtitulo')}
        motivoDefault={t('vacaciones.motivoDefault')} onCambio={cargarSaldo}
      />
    </>
  )
}

function PuestosInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState('')

  const agregar = () => {
    const v = draft.trim()
    if (!v || value.includes(v)) { setDraft(''); return }
    onChange([...value, v])
    setDraft('')
  }

  const quitar = (i) => onChange(value.filter((_, idx) => idx !== i))

  return (
    <div>
      <div className="form-row" style={{ marginBottom: value.length > 0 ? 8 : 0 }}>
        <input
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar() } }}
        />
        <button type="button" className="secondary" onClick={agregar} style={{ flex: '0 0 auto' }}>+</button>
      </div>
      {value.length > 0 && (
        <div className="chip-list">
          {value.map((p, i) => (
            <span key={p + i} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {p}
              <button
                type="button"
                onClick={() => quitar(i)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700, padding: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Buscador compacto para asignar equipos a un empleado — antes se listaban
// los ~400 productos del inventario completo como casillas, uno debajo del
// otro (imposible de usar). Ahora solo se muestran sugerencias mientras se
// escribe, y lo ya elegido queda como chips removibles.
function EquipoPicker({ productos, value, onChange, placeholder }) {
  const [buscar, setBuscar] = useState('')
  const q = buscar.trim().toLowerCase()
  const seleccionados = productos.filter((p) => value.includes(p.id))
  const sugeridos = q
    ? productos.filter((p) => !value.includes(p.id) && p.nombre.toLowerCase().includes(q)).slice(0, 8)
    : []

  const agregar = (id) => { onChange([...value, id]); setBuscar('') }
  const quitar = (id) => onChange(value.filter((v) => v !== id))

  return (
    <div>
      <input placeholder={placeholder} value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      {sugeridos.length > 0 && (
        <div className="chip-list" style={{ marginTop: 6 }}>
          {sugeridos.map((p) => (
            <button type="button" key={p.id} className="chip" style={{ cursor: 'pointer' }} onClick={() => agregar(p.id)}>
              + {p.nombre}
            </button>
          ))}
        </div>
      )}
      {seleccionados.length > 0 && (
        <div className="chip-list" style={{ marginTop: 8 }}>
          {seleccionados.map((p) => (
            <span key={p.id} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {p.nombre}
              <button
                type="button"
                onClick={() => quitar(p.id)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700, padding: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Archivos adjuntos del expediente de un empleado (contrato, cédula
// escaneada, constancias...) — se cargan aparte porque solo hacen falta
// cuando la ficha ya está abierta, no en la lista general.
function DocumentosEmpleado({ empleadoId, t }) {
  const [documentos, setDocumentos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [progresoSubida, setProgresoSubida] = useState(null)
  const [nombreNuevo, setNombreNuevo] = useState('')

  const cargar = () => {
    setCargando(true)
    rrhhApi.documentos(empleadoId).then((r) => setDocumentos(r.data)).finally(() => setCargando(false))
  }

  useEffect(cargar, [empleadoId])

  // Varios archivos a la vez (ej. cédula + constancia + contrato juntos):
  // se suben uno por uno al mismo endpoint (no hay uno "batch" en el
  // backend), mostrando cuál va en progreso. El nombre escrito a mano solo
  // tiene sentido si es un solo archivo — con varios, cada uno se queda
  // con su propio nombre de archivo.
  const handleArchivo = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setSubiendo(true)
    const nombreManual = files.length === 1 ? nombreNuevo.trim() : ''
    for (let i = 0; i < files.length; i++) {
      setProgresoSubida({ actual: i + 1, total: files.length })
      try {
        await rrhhApi.subirDocumentoEmpleado(empleadoId, files[i], nombreManual)
      } catch {
        // Sigue con los siguientes archivos aunque uno falle, para no
        // perder el resto de la tanda por un solo error.
      }
    }
    setNombreNuevo('')
    setSubiendo(false)
    setProgresoSubida(null)
    e.target.value = ''
    cargar()
  }

  const eliminar = (id) => {
    rrhhApi.eliminarDocumentoEmpleado(id).then(cargar)
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <strong>{t('documentos.titulo')}</strong>
      <p style={{ marginTop: 2, marginBottom: 10, color: 'var(--text)', fontSize: 13 }}>{t('documentos.subtitulo')}</p>

      {!cargando && documentos.length === 0 && <p style={{ fontSize: 13, color: 'var(--text)' }}>{t('documentos.sinDocumentos')}</p>}
      {documentos.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 10px' }}>
          {documentos.map((d) => (
            <li key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <a href={d.archivo.startsWith('http') ? d.archivo : `${MEDIA_BASE_URL}${d.archivo}`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                📎 {d.nombre || d.archivo.split('/').pop()}
              </a>
              <button type="button" className="danger" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => eliminar(d.id)}>
                {t('botones.eliminar', { ns: 'common' })}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="form-row" style={{ alignItems: 'center' }}>
        <input placeholder={t('documentos.nombrePlaceholder')} value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} style={{ flex: '1 1 200px' }} />
        <label className="secondary" style={{ cursor: subiendo ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center' }}>
          {subiendo
            ? t('documentos.subiendoProgreso', { actual: progresoSubida?.actual, total: progresoSubida?.total })
            : t('documentos.agregar')}
          <input type="file" multiple onChange={handleArchivo} disabled={subiendo} style={{ display: 'none' }} />
        </label>
      </div>
      <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12, color: 'var(--text)' }}>{t('documentos.notaVarios')}</p>
    </div>
  )
}

// Horario de colores de uniforme — un solo horario para toda la empresa
// (6 días, Lunes-Sábado), no por empleado. Se edita directo en la fila.
// Colores por defecto (rueda básica) para cuando un día todavía no tiene
// color_hex propio — así el swatch nunca aparece completamente vacío.
const COLOR_HEX_DEFAULT = '#94a3b8'

function UniformeSemana({ t }) {
  const [dias, setDias] = useState([])
  const [guardandoId, setGuardandoId] = useState(null)

  useEffect(() => {
    rrhhApi.uniformeDias().then((r) => setDias(r.data))
  }, [])

  const cambiarCampo = (id, campo, valor) => {
    setDias((ds) => ds.map((d) => (d.id === id ? { ...d, [campo]: valor } : d)))
  }

  const guardar = (dia) => {
    setGuardandoId(dia.id)
    rrhhApi.guardarUniformeDia(dia.id, { color: dia.color, color_hex: dia.color_hex }).finally(() => setGuardandoId(null))
  }

  if (dias.length === 0) return null

  return (
    <div className="card">
      <h3>{t('uniforme.titulo')}</h3>
      <p style={{ marginTop: 2, marginBottom: 12, color: 'var(--text)', fontSize: 13 }}>{t('uniforme.subtitulo')}</p>
      <div className="uniforme-grid">
        {dias.map((d) => (
          <div key={d.id} className="uniforme-dia-card">
            <div className="uniforme-dia-header">
              <span className="uniforme-dia-nombre">{d.dia_semana_display}</span>
              <label className="uniforme-swatch" style={{ background: d.color_hex || COLOR_HEX_DEFAULT }} title={t('uniforme.elegirColor')}>
                <input
                  type="color"
                  value={d.color_hex || COLOR_HEX_DEFAULT}
                  onChange={(e) => cambiarCampo(d.id, 'color_hex', e.target.value)}
                  onBlur={() => guardar(d)}
                  disabled={guardandoId === d.id}
                />
              </label>
            </div>
            <input
              className="uniforme-dia-input"
              value={d.color || ''}
              placeholder={t('uniforme.colorPlaceholder')}
              onChange={(e) => cambiarCampo(d.id, 'color', e.target.value)}
              onBlur={() => guardar(d)}
              disabled={guardandoId === d.id}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default RRHH
