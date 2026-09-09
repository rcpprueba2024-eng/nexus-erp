import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { tallerApi, ventasApi, rrhhApi, configApi, inventarioApi, MEDIA_BASE_URL } from '../api.js'
import { useAuth, esRolSinAccesoCliente } from '../AuthContext.jsx'
import PatronDesbloqueo from '../components/orden/PatronDesbloqueo.jsx'
import DanosVisibles from '../components/orden/DanosVisibles.jsx'
import FirmaDigital from '../components/orden/FirmaDigital.jsx'
import SeccionComputadora from '../components/orden/SeccionComputadora.jsx'
import OrdenPreview from '../components/OrdenPreview.jsx'
import logo from '../assets/rcp-logo.png'
import { esCCA, tipoOrden, checklistSalidaPara, CATEGORIAS_CCA, CATEGORIAS_COM } from '../ordenTipo.js'
import '../orden-tailwind.css'

const ESTADOS_COLOR = {
  RECIBIDO: 'bg-subtle text-ink',
  DIAGNOSTICO: 'bg-amber-100 text-amber-700',
  ESPERANDO_AUTORIZACION: 'bg-fuchsia-100 text-fuchsia-700',
  EN_REPARACION: 'bg-blue-100 text-blue-700',
  IMPORTACION: 'bg-cyan-100 text-cyan-700',
  LISTO_ENTREGA: 'bg-emerald-100 text-emerald-700',
  ENTREGADO: 'bg-emerald-600 text-white',
  CANCELADO: 'bg-red-100 text-red-700',
  REINGRESO: 'bg-purple-100 text-purple-700',
}
export const ESTADO_EQUIPO_VALUES = ['BUENO', 'REGULAR', 'MALO', 'ENCIENDE_CON_FALLA']
export const ESTADOS_ENCENDIDO_VALUES = ['ENCIENDE_OK', 'ENCIENDE_CON_FALLA', 'ENCIENDE_SIN_IMAGEN', 'NO_ENCIENDE']
export const CATEGORIAS_EQUIPO_VALUES = ['COMPUTADORA', 'CELULAR', 'TABLET', 'OTRO']
export const OPERADORAS_VALUES = ['CLARO', 'TIGO']
export const FORMAS_PAGO_VALUES = ['CREDITO', 'CONTADO']
export const TIPOS_REPUESTO = ['Original', 'AAA+', 'Compatible']
export const TIPOS_SERVICIO_VALUES = ['DIAGNOSTICO', 'MANTENIMIENTO_BASICO', 'MANTENIMIENTO_PREVENTIVO', 'MANTENIMIENTO_FULL', 'REPARACION', 'REPARACION_BISAGRA', 'CONFIGURACION', 'DESBLOQUEO', 'FLASHEO', 'REINGRESO', 'OTRO']
export const COMO_SUPO_VALUES = ['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'LINKEDIN', 'SMS', 'RADIO', 'EMAIL', 'REFERIDO', 'MANTA_ROTULO', 'GOOGLE', 'RECURRENTE', 'OTRO']
export const SIMBOLO = { USD: 'US$', NIO: 'C$' }

// <input type="datetime-local"> exige "YYYY-MM-DDTHH:mm" sin offset — el
// ISO 8601 que manda DRF ya viene en hora local (TIME_ZONE del backend),
// así que basta con recortarlo; al guardar, ese mismo string naive se
// interpreta en esa misma zona horaria del servidor.
const aInputDatetimeLocal = (iso) => (iso ? iso.slice(0, 16) : '')

export const DETALLE_COM_VACIO = {
  tipo_equipo: 'LAPTOP', procesador_generacion: '', comprado_nuevo: null, estado_fisico: {},
  ram_tipo: '', ram_frecuencia: '', ram_slots: '', disco_capacidad: '', tipo_almacenamiento: '',
  marca_disco: '', serial_disco: '', tipo_conector: '', componentes: {}, accesorios_detalle: [],
  empresa_controla_software: null, primera_vez: null, respaldo_solicitado: null,
  bitlocker_activo: null, bitlocker_clave: '', software: {}, checklist_entrada: {},
  tecnico_recibe: '', tecnico_entrega: '',
}

export const ORDEN_VACIA = {
  // El número real (consecutivo COM-#### o CCA-####) lo asigna el backend
  // al guardar — ver Configuracion.siguiente_numero_orden.
  numero: '',
  equipo: '', categoria_equipo: 'COMPUTADORA', estado: 'RECIBIDO',
  marca: '', modelo: '', color: '', capacidad: '', estado_general: '', no_serie: '',
  imei1: '', imei2: '', numero_chip: '', sistema_operativo: '', operadora_equipo: '',
  encendido: '', bateria_original: null, camara_funciona: null,
  accesorios: '', contrasena_equipo: '', sin_contrasena: false, patron_desbloqueo: [], danos_visibles: [], especificaciones: {},
  estado_equipo_notas: '', comentarios: '', problema_reportado: '', como_supo: '',
  fecha_hora_recepcion: '', tiempo_reparacion_estimado: '',
  checklist_entrada: {}, checklist_salida: {}, equipo_apagado_recepcion: false,
  tipos_servicio: [], tipos_servicio_otro: '',
  diagnostico: '', recomendaciones: '', repuestos: [], necesita_repuestos: false, repuesto_inmediato: false, forma_pago: '',
  servicios_realizados: [], descuento: 0, impuestos: 0, moneda: 'USD',
  fecha_entrega_estimada: '', recibe: '', aceptacion_cliente: false, firma_cliente: '', firma_cliente_entrega: '', firma_tecnico: '',
  observaciones: '', tecnico: '', asesor: '', detalle_com: DETALLE_COM_VACIO,
}

const Section = ({ n, title, children }) => (
  <section className="orden-tw mb-6 rounded-xl border border-line bg-surface shadow-sm">
    <div className="border-b border-line bg-subtle px-5 py-3 rounded-t-xl">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink">{n}.- {title}</h2>
    </div>
    <div className="p-5">{children}</div>
  </section>
)

export const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
    {children}
  </label>
)

export const inputCls = "w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand-500"

export function TriEstado({ label, value, onChange, textoSi, textoNo }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        {[[textoSi, true], [textoNo, false]].map(([txt, v]) => (
          <button key={txt} type="button" onClick={() => onChange(v)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${value === v ? 'border-brand bg-tint text-brand font-semibold' : 'border-line text-muted'}`}>
            {txt}
          </button>
        ))}
      </div>
    </Field>
  )
}

function OrdenTrabajo() {
  const { t } = useTranslation(['ordenes', 'checklist', 'common'])
  const { id } = useParams()
  const esNuevo = id === 'nueva'
  const navigate = useNavigate()
  const { user } = useAuth()
  const esAdmin = user?.is_superuser || user?.rol === 'ADMIN'
  const sinAccesoCliente = esRolSinAccesoCliente(user?.rol)
  const [orden, setOrden] = useState(esNuevo ? ORDEN_VACIA : null)
  const [cliente, setCliente] = useState(null)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [clienteEmpresaId, setClienteEmpresaId] = useState('')
  const [clientesExistentes, setClientesExistentes] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [empresaModal, setEmpresaModal] = useState(false)
  const [empresaForm, setEmpresaForm] = useState({ nombre: '', ruc: '', telefono: '', email: '' })
  const [tecnicos, setTecnicos] = useState([])
  const [asesores, setAsesores] = useState([])
  const [marcasCatalogo, setMarcasCatalogo] = useState([])
  const [modelosCatalogo, setModelosCatalogo] = useState([])
  const [loading, setLoading] = useState(!esNuevo)
  const [guardando, setGuardando] = useState(false)
  const [tasa, setTasa] = useState(36.62)
  const [error, setError] = useState('')
  const [previewAbierto, setPreviewAbierto] = useState(false)

  const ESTADOS = Object.keys(ESTADOS_COLOR).map((value) => ({
    value, label: t(`estadosOrden.${value}`, { ns: 'common' }), color: ESTADOS_COLOR[value],
  }))
  const ESTADO_EQUIPO = ESTADO_EQUIPO_VALUES.map((v) => ({ v, l: t(`estadoEquipo.${v}`) }))
  const ESTADOS_ENCENDIDO = ESTADOS_ENCENDIDO_VALUES.map((v) => ({ v, l: t(`estadoEncendido.${v}`) }))
  const CATEGORIAS_EQUIPO = CATEGORIAS_EQUIPO_VALUES.map((v) => ({ v, l: t(`categoriaEquipo.${v}`, { ns: 'common' }) }))
  const OPERADORAS = OPERADORAS_VALUES.map((v) => ({ v, l: t(`operadora.${v}`) }))
  const FORMAS_PAGO = FORMAS_PAGO_VALUES.map((v) => ({ v, l: t(`formaPago.${v}`) }))
  const TIPOS_SERVICIO = TIPOS_SERVICIO_VALUES.map((v) => ({ v, l: t(`tipoServicio.${v}`) }))

  const cargar = useCallback(() => {
    inventarioApi.marcas().then((r) => setMarcasCatalogo(r.data))
    inventarioApi.modelos().then((r) => setModelosCatalogo(r.data))
    if (esNuevo) {
      if (sinAccesoCliente) return
      rrhhApi.empleados().then((t) => {
        setTecnicos(t.data.filter((e) => (e.areas || []).includes('TALLER')))
        setAsesores(t.data.filter((e) => (e.areas || []).includes('VENTAS')))
      })
      ventasApi.clientes().then((c) => setClientesExistentes(c.data))
      ventasApi.empresas().then((r) => setEmpresas(r.data))
      return
    }
    setLoading(true)
    Promise.all([tallerApi.orden(id), rrhhApi.empleados()]).then(([o, t]) => {
      setOrden(o.data)
      setTecnicos(t.data.filter((e) => (e.areas || []).includes('TALLER')))
      setAsesores(t.data.filter((e) => (e.areas || []).includes('VENTAS')))
      if (o.data.cliente && !sinAccesoCliente) {
        ventasApi.cliente(o.data.cliente).then((r) => setCliente(r.data))
        ventasApi.empresas().then((r) => setEmpresas(r.data))
      }
    }).finally(() => setLoading(false))
  }, [id, esNuevo, sinAccesoCliente])

  useEffect(() => { cargar() }, [cargar])

  // Taller/Pasante no pueden crear órdenes (solo trabajan equipo ya
  // recibido) — si llegan directo a /ordenes/nueva, se les regresa al listado.
  useEffect(() => {
    if (esNuevo && sinAccesoCliente) navigate('/ordenes', { replace: true })
  }, [esNuevo, sinAccesoCliente, navigate])
  useEffect(() => { configApi.obtener().then((r) => setTasa(Number(r.data.tasa_cambio_usd))) }, [])

  const set = (patch) => setOrden((o) => ({ ...o, ...patch }))
  const setCli = (patch) => setCliente((c) => ({ ...c, ...patch }))
  const setDetalle = (patch) => setOrden((o) => ({ ...o, detalle_com: { ...(o.detalle_com || DETALLE_COM_VACIO), ...patch } }))

  // El número real (consecutivo COM-#### o CCA-####) lo asigna el backend
  // al guardar, según el tipo — acá solo se actualiza la categoría.
  const cambiarCategoriaEquipo = (categoria) => {
    setOrden((o) => ({
      ...o,
      categoria_equipo: categoria,
      detalle_com: tipoOrden(categoria) === 'COM' ? (o.detalle_com || DETALLE_COM_VACIO) : o.detalle_com,
    }))
  }

  // Selección explícita de flujo al crear: CCA (celular/tablet) o COM
  // (computadora/otro). Cambia la categoría de equipo a la opción por
  // defecto de ese flujo, lo que a su vez decide qué campos y checklist
  // se muestran más abajo.
  const elegirTipoOrden = (tipo) => {
    cambiarCategoriaEquipo(tipo === 'CCA' ? 'CELULAR' : 'COMPUTADORA')
  }

  const guardarEmpresaRapida = async (e) => {
    e.preventDefault()
    if (!empresaForm.nombre.trim()) return
    const res = await ventasApi.crearEmpresa(empresaForm)
    const r = await ventasApi.empresas()
    setEmpresas(r.data)
    if (esNuevo || !cliente) setClienteEmpresaId(res.data.id)
    else setCli({ empresa: res.data.id })
    setEmpresaForm({ nombre: '', ruc: '', telefono: '', email: '' })
    setEmpresaModal(false)
  }

  const resolverCliente = async (nombreEscrito) => {
    const nombre = nombreEscrito.trim()
    const existente = clientesExistentes.find((c) => c.nombre.trim().toLowerCase() === nombre.toLowerCase())
    if (existente) {
      // Si en esta orden se capturó correo/empresa y el cliente ya
      // existía sin esos datos, se aprovecha para completarlos — sin
      // borrar lo que ya tenía si esta vez se dejó en blanco.
      const patch = {}
      if (clienteEmail.trim() && !existente.email) patch.email = clienteEmail.trim()
      if (clienteEmpresaId && !existente.empresa) patch.empresa = clienteEmpresaId
      if (Object.keys(patch).length > 0) await ventasApi.actualizarCliente(existente.id, patch)
      return existente.id
    }
    const res = await ventasApi.crearCliente({ nombre, email: clienteEmail.trim(), empresa: clienteEmpresaId || null })
    return res.data.id
  }

  const sanitizar = (o) => ({
    ...o,
    fecha_entrega_estimada: o.fecha_entrega_estimada || null,
    fecha_entrega_real: o.fecha_entrega_real || null,
    fecha_hora_recepcion: o.fecha_hora_recepcion || null,
    tecnico: o.tecnico || null,
    detalle_com: tipoOrden(o.categoria_equipo) === 'COM' && o.detalle_com ? {
      ...o.detalle_com,
      tecnico_recibe: o.detalle_com.tecnico_recibe || null,
      tecnico_entrega: o.detalle_com.tecnico_entrega || null,
    } : null,
  })

  const extraerErrores = (err) => {
    const data = err?.response?.data
    if (!data || typeof data !== 'object') return t('errores.noSePudoGuardar')
    return Object.entries(data).map(([campo, msgs]) => `${campo}: ${Array.isArray(msgs) ? msgs.join(' ') : msgs}`).join(' · ')
  }

  const guardar = async () => {
    setError('')
    if (esNuevo && !clienteNombre.trim()) {
      setError(t('errores.nombreClienteObligatorio'))
      return
    }
    if (!orden.equipo || !orden.equipo.trim()) {
      setError(t('errores.equipoObligatorio'))
      return
    }
    setGuardando(true)
    try {
      if (esNuevo) {
        const clienteId = await resolverCliente(clienteNombre)
        const res = await tallerApi.crearOrden(sanitizar({ ...orden, cliente: clienteId }))
        navigate(`/ordenes/${res.data.id}`, { replace: true })
        return
      }
      if (cliente) await ventasApi.actualizarCliente(cliente.id, cliente)
      const res = await tallerApi.actualizarOrden(id, sanitizar(orden))
      setOrden(res.data)
      window.alert(t('mensajes.ordenGuardada'))
    } catch (err) {
      setError(extraerErrores(err))
    } finally {
      setGuardando(false)
    }
  }

  const cambiarEstado = async (estado) => {
    if (esNuevo) { set({ estado }); return }
    const res = await tallerApi.actualizarOrden(id, { estado })
    setOrden(res.data)
  }

  const [duplicando, setDuplicando] = useState(false)
  const duplicarOrden = async () => {
    setDuplicando(true)
    try {
      const res = await tallerApi.duplicarOrden(id)
      navigate(`/ordenes/${res.data.id}`)
    } finally {
      setDuplicando(false)
    }
  }

  const [eliminando, setEliminando] = useState(false)
  const eliminarOrden = async () => {
    if (!window.confirm(t('mensajes.confirmarEliminar', { numero: orden.numero }))) return
    setEliminando(true)
    try {
      await tallerApi.eliminarOrden(id)
      navigate('/ordenes', { replace: true })
    } catch (err) {
      window.alert(extraerErrores(err))
      setEliminando(false)
    }
  }

  const [historialCliente, setHistorialCliente] = useState([])
  const [historialEquipo, setHistorialEquipo] = useState([])
  useEffect(() => {
    if (esNuevo || !orden) return
    if (orden.cliente) tallerApi.historialCliente(orden.cliente, id).then((r) => setHistorialCliente(r.data)).catch(() => {})
    if (orden.no_serie) tallerApi.historialSerie(orden.no_serie, id).then((r) => setHistorialEquipo(r.data)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esNuevo, id, orden?.cliente, orden?.no_serie])

  const toggleTipoServicio = (v) => {
    const actuales = orden.tipos_servicio || []
    set({ tipos_servicio: actuales.includes(v) ? actuales.filter((x) => x !== v) : [...actuales, v] })
  }

  const toggleChecklistSalida = (item) => {
    set({ checklist_salida: { ...(orden.checklist_salida || {}), [item]: !(orden.checklist_salida || {})[item] } })
  }

  const toggleChecklistEntrada = (item) => {
    set({ checklist_entrada: { ...(orden.checklist_entrada || {}), [item]: !(orden.checklist_entrada || {})[item] } })
  }

  // --- tablas dinámicas ---
  const addRepuesto = () => set({ repuestos: [...(orden.repuestos || []), { descripcion: '', tipo: 'Original', precio: 0 }] })
  const updRepuesto = (i, patch) => {
    const arr = [...orden.repuestos]; arr[i] = { ...arr[i], ...patch }; set({ repuestos: arr })
  }
  const delRepuesto = (i) => set({ repuestos: orden.repuestos.filter((_, idx) => idx !== i) })

  const addServicio = () => set({ servicios_realizados: [...(orden.servicios_realizados || []), { descripcion: '', precio: 0 }] })
  const updServicio = (i, patch) => {
    const arr = [...orden.servicios_realizados]; arr[i] = { ...arr[i], ...patch }; set({ servicios_realizados: arr })
  }
  const delServicio = (i) => set({ servicios_realizados: orden.servicios_realizados.filter((_, idx) => idx !== i) })

  const totalRepuestos = (orden?.repuestos || []).reduce((s, r) => s + Number(r.precio || 0), 0)
  const totalServicios = (orden?.servicios_realizados || []).reduce((s, r) => s + Number(r.precio || 0), 0)
  const baseTotal = (totalRepuestos + totalServicios) > 0 ? (totalRepuestos + totalServicios) : Number(orden?.costo_estimado || 0)
  const totalFinal = baseTotal - Number(orden?.descuento || 0) + Number(orden?.impuestos || 0)
  const simbolo = SIMBOLO[orden?.moneda] || 'US$'
  const totalUSD = orden?.moneda === 'NIO' ? totalFinal / tasa : totalFinal
  const totalNIO = orden?.moneda === 'USD' ? totalFinal * tasa : totalFinal
  // Siempre se muestra la conversión a la otra moneda junto al monto
  // principal — si se vende en córdobas, igual debe verse cuánto es en
  // dólares (y viceversa), no solo en el total final sino en cada subtotal.
  const otroSimbolo = orden?.moneda === 'USD' ? 'C$' : 'US$'
  const aOtraMoneda = (monto) => orden?.moneda === 'USD' ? Number(monto) * tasa : Number(monto) / tasa
  const conConversion = (monto) => `${simbolo}${Number(monto).toLocaleString()} (${otroSimbolo}${aOtraMoneda(monto).toLocaleString(undefined, { maximumFractionDigits: 2 })})`

  const handleFoto = (e, momento) => {
    const file = e.target.files[0]
    if (!file) return
    tallerApi.subirFoto(id, momento, file).then(() => cargar())
  }

  if (loading || !orden) return <div className="p-10 text-center text-muted">{t('mensajes.cargandoOrden')}</div>

  const estadoInfo = ESTADOS.find((e) => e.value === orden.estado) || ESTADOS[0]
  // "cliente_nombre" es un campo que solo trae el serializer completo
  // (Backoffice/Ventas/Admin); el de Taller/Pasante nunca lo incluye. No
  // usamos "vendedor_nombre" para esto: ese campo desaparece cuando la
  // orden simplemente no tiene vendedor asignado, aun en el serializer
  // completo, y daba falsos positivos.
  const esTecnicoLimitado = !esNuevo && (sinAccesoCliente || !('cliente_nombre' in orden))
  // Los datos de la orden ya creada solo los edita Gerencia — el resto de
  // roles puede seguir viéndola (útil para consultar detalles) pero el
  // formulario queda deshabilitado; el estado, técnico, checklist de salida
  // y notas se siguen cambiando desde el tablero de Taller, no desde aquí.
  const soloLectura = !esNuevo && !esAdmin
  // Backoffice analiza procesos: ve la orden completa (técnico, asesor,
  // cliente, factura) pero no la edita ni la elimina — a diferencia de
  // Taller/Ventas, que sí cambian el estado desde acá en la práctica.
  const esBackoffice = user?.rol === 'BACKOFFICE'
  const esCelular = esCCA(orden.categoria_equipo)
  const tipo = tipoOrden(orden.categoria_equipo)
  const checklistSalidaItems = checklistSalidaPara(orden.categoria_equipo)
  const checklistNs = esCelular ? 'ordenes' : 'checklist'
  const checklistPrefix = esCelular ? 'checklistSalida' : 'items'
  const categoriasDelTipo = (esCelular ? CATEGORIAS_CCA : CATEGORIAS_COM)
  const CATEGORIAS_EQUIPO_FILTRADAS = CATEGORIAS_EQUIPO.filter((o) => categoriasDelTipo.includes(o.v))
  const detalle = orden.detalle_com || DETALLE_COM_VACIO
  const COMO_SUPO = COMO_SUPO_VALUES.map((v) => ({ v, l: t(`com.comoSupo.${v}`) }))

  return (
    <div className="orden-tw">
      <div className="min-h-screen bg-subtle pb-16">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-6 py-3 shadow-sm">
        <button onClick={() => navigate('/ordenes')} className="text-sm text-muted hover:text-ink">← {t('header.volver')}</button>
        <div className="flex flex-wrap items-center gap-2">
          <select value={orden.estado} onChange={(e) => cambiarEstado(e.target.value)} disabled={esBackoffice}
            className={`rounded-full border-0 px-3 py-1.5 text-xs font-semibold ${estadoInfo.color} ${esBackoffice ? 'opacity-80' : ''}`}>
            {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          {!esNuevo && <button onClick={() => setPreviewAbierto(true)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-subtle">{t('header.imprimirPdf')}</button>}
          {!esNuevo && !sinAccesoCliente && !esBackoffice && <button onClick={duplicarOrden} disabled={duplicando} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-subtle disabled:opacity-50">{duplicando ? t('botones.guardando', { ns: 'common' }) : t('header.duplicarOrden')}</button>}
          {!esNuevo && esAdmin && (
            <button onClick={eliminarOrden} disabled={eliminando} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
              {eliminando ? t('botones.guardando', { ns: 'common' }) : t('header.eliminarOrden')}
            </button>
          )}
          {!soloLectura && (
            <button onClick={guardar} disabled={guardando}
              className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {guardando ? t('botones.guardando', { ns: 'common' }) : esNuevo ? t('header.crearOrden') : t('header.guardarCambios')}
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 print:max-w-none">
        {soloLectura && (
          <div className="no-print mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t('mensajes.soloAdminEdita')}
          </div>
        )}
        <div className="mb-6 flex items-center gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
          <img src={logo} alt="RCP" className="h-14 w-auto" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-ink">{esNuevo ? t('titulo.nuevo') : t('titulo.existente')}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${esCelular ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>{tipo}</span>
            </div>
            {esNuevo ? (
              <p className="mt-1 text-sm text-muted">{t('titulo.numeroAlGuardar')}</p>
            ) : esAdmin ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-muted">{t('titulo.otNo')}</span>
                <input
                  className="w-36 rounded-md border border-line px-2 py-0.5 text-sm font-semibold text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand-500"
                  value={orden.numero} onChange={(e) => set({ numero: e.target.value })}
                  title={t('titulo.numeroEditarAyuda')}
                />
                <span className="text-sm text-muted">· {t('titulo.recibidoLabel')} {orden.fecha_ingreso}</span>
              </div>
            ) : (
              <p className="text-sm text-muted">{t('titulo.otNo')} <strong>{orden.numero}</strong> · {t('titulo.recibidoLabel')} {orden.fecha_ingreso}</p>
            )}
            {orden.factura_numero && (
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className="text-muted">{t('titulo.facturaLabel')}</span>
                <strong className="text-ink">{orden.factura_numero}</strong>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${orden.factura_estado === 'PAGADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {t(`titulo.estadosFactura.${orden.factura_estado}`, { defaultValue: orden.factura_estado })}
                </span>
                {Number(orden.factura_saldo_pendiente) > 0 && (
                  <span className="text-xs text-amber-700">{t('titulo.saldoPendiente', { monto: Number(orden.factura_saldo_pendiente).toLocaleString(undefined, { maximumFractionDigits: 2 }) })}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <fieldset disabled={soloLectura} className="m-0 min-w-0 border-0 p-0">
        {esNuevo && (
          <div className="mb-6 rounded-xl border-2 border-line bg-surface p-5 shadow-sm">
            <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted">{t('tipoOrden.titulo')}</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => elegirTipoOrden('CCA')}
                className={`rounded-xl border-2 px-4 py-3 text-left transition ${tipo === 'CCA' ? 'border-violet-500 bg-violet-50' : 'border-line hover:border-line'}`}>
                <div className={`text-xl font-extrabold ${tipo === 'CCA' ? 'text-violet-700' : 'text-ink'}`}>CCA</div>
                <div className="text-xs text-muted">{t('tipoOrden.ccaDescripcion')}</div>
              </button>
              <button type="button" onClick={() => elegirTipoOrden('COM')}
                className={`rounded-xl border-2 px-4 py-3 text-left transition ${tipo === 'COM' ? 'border-sky-500 bg-sky-50' : 'border-line hover:border-line'}`}>
                <div className={`text-xl font-extrabold ${tipo === 'COM' ? 'text-sky-700' : 'text-ink'}`}>COM</div>
                <div className="text-xs text-muted">{t('tipoOrden.comDescripcion')}</div>
              </button>
            </div>
          </div>
        )}

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

        {!esTecnicoLimitado && (
        <Section n="1" title={t('secciones.datosCliente')}>
          {!esNuevo && orden.cliente_problematico && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              <span>🚩</span>
              <div>
                <p className="font-semibold">{t('banderaRoja.avisoTitulo', { ns: 'clientes' })}</p>
                <p>{orden.cliente_motivo_problematico || t('banderaRoja.avisoSinMotivo', { ns: 'clientes' })}</p>
              </div>
            </div>
          )}
          {esNuevo ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t('campos.clienteNombreCompleto')}>
                <input className={inputCls} list="clientes-existentes" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} placeholder={t('campos.clienteNombrePlaceholder')} />
                <datalist id="clientes-existentes">
                  {clientesExistentes.map((c) => <option key={c.id} value={c.nombre} />)}
                </datalist>
                <span className="mt-1 block text-xs text-muted">{t('campos.ayudaClienteExistente')}</span>
              </Field>
              <Field label={t('campos.correoElectronico')}>
                <input type="email" className={inputCls} value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} />
              </Field>
              <Field label={t('campos.empresa')}>
                <div className="flex gap-2">
                  <select className={inputCls} value={clienteEmpresaId} onChange={(e) => setClienteEmpresaId(e.target.value)}>
                    <option value="">{t('campos.sinEmpresa')}</option>
                    {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                  </select>
                  <button type="button" onClick={() => setEmpresaModal(true)} className="rounded-lg border border-line px-3 text-sm text-muted hover:bg-subtle">+</button>
                </div>
              </Field>
            </div>
          ) : cliente ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t('campos.cliente')}><input className={inputCls} value={cliente.nombre || ''} onChange={(e) => setCli({ nombre: e.target.value })} /></Field>
              <Field label={t('campos.cedula')}><input className={inputCls} value={cliente.cedula || ''} onChange={(e) => setCli({ cedula: e.target.value })} /></Field>
              <Field label={t('campos.ruc')}><input className={inputCls} value={cliente.documento || ''} onChange={(e) => setCli({ documento: e.target.value })} /></Field>
              <Field label={t('campos.correoElectronico')}><input type="email" className={inputCls} value={cliente.email || ''} onChange={(e) => setCli({ email: e.target.value })} /></Field>
              <Field label={t('campos.telefono')}><input className={inputCls} value={cliente.telefono || ''} onChange={(e) => setCli({ telefono: e.target.value })} /></Field>
              <Field label={t('campos.telefonoAlterno')}><input className={inputCls} value={cliente.telefono2 || ''} onChange={(e) => setCli({ telefono2: e.target.value })} /></Field>
              <Field label={t('campos.operadora')}>
                <select className={inputCls} value={cliente.operadora || ''} onChange={(e) => setCli({ operadora: e.target.value })}>
                  <option value="">—</option>
                  {OPERADORAS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </Field>
              <Field label={t('campos.direccion')}><input className={inputCls} value={cliente.direccion || ''} onChange={(e) => setCli({ direccion: e.target.value })} /></Field>
              <Field label={t('campos.direccionEntrega')}><input className={inputCls} value={cliente.direccion_entrega || ''} onChange={(e) => setCli({ direccion_entrega: e.target.value })} /></Field>
              <Field label={t('com.comoSupoLabel')}>
                <select className={inputCls} value={orden.como_supo || ''} onChange={(e) => set({ como_supo: e.target.value })}>
                  <option value="">—</option>
                  {COMO_SUPO.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </Field>
              <Field label={t('campos.empresa')}>
                <div className="flex gap-2">
                  <select className={inputCls} value={cliente.empresa || ''} onChange={(e) => setCli({ empresa: e.target.value || null })}>
                    <option value="">{t('campos.sinEmpresa')}</option>
                    {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                  </select>
                  <button type="button" onClick={() => setEmpresaModal(true)} className="rounded-lg border border-line px-3 text-sm text-muted hover:bg-subtle">+</button>
                </div>
              </Field>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" checked={!!cliente.whatsapp} onChange={(e) => setCli({ whatsapp: e.target.checked })} /> WhatsApp
                </label>
              </div>
            </div>
          ) : <p className="text-sm text-muted">{t('mensajes.sinDatosCliente')}</p>}
        </Section>
        )}


        <Section n="2" title={t('secciones.detallesRecepcion')}>
          <h3 className="mb-3 text-xs font-semibold uppercase text-muted">{t('subtitulos.infoEquipo')}</h3>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t('campos.equipoRecibido')}><input className={inputCls} value={orden.equipo || ''} onChange={(e) => set({ equipo: e.target.value })} /></Field>
            {esCelular && (
              <Field label={t('campos.tipoEquipo')}>
                <select className={inputCls} value={orden.categoria_equipo || 'COMPUTADORA'} onChange={(e) => cambiarCategoriaEquipo(e.target.value)}>
                  {CATEGORIAS_EQUIPO_FILTRADAS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </Field>
            )}
            <Field label={t('campos.marca')}>
              <input className={inputCls} list="marcas-catalogo" value={orden.marca || ''} onChange={(e) => set({ marca: e.target.value })} />
              <datalist id="marcas-catalogo">
                {marcasCatalogo.map((m) => <option key={m.id} value={m.nombre} />)}
              </datalist>
            </Field>
            <Field label={t('campos.modelo')}>
              <input className={inputCls} list="modelos-catalogo" value={orden.modelo || ''} onChange={(e) => set({ modelo: e.target.value })} />
              <datalist id="modelos-catalogo">
                {modelosCatalogo.filter((mo) => !orden.marca || mo.marca_nombre === orden.marca).map((mo) => <option key={mo.id} value={mo.nombre} />)}
              </datalist>
            </Field>
            <Field label={t('campos.color')}><input className={inputCls} value={orden.color || ''} onChange={(e) => set({ color: e.target.value })} /></Field>
            <Field label={t('campos.capacidad')}><input className={inputCls} value={orden.capacidad || ''} onChange={(e) => set({ capacidad: e.target.value })} /></Field>
          </div>

          {esCelular && (
            // Solo CCA: las computadoras (COM) ya tienen el desglose
            // detallado en "Estado físico" más abajo — mostrar ambos aquí
            // era preguntar lo mismo dos veces con las mismas palabras.
            <div className="mb-5">
              <Field label={t('campos.estadoEquipo')}>
                <div className="flex flex-wrap gap-2">
                  {ESTADO_EQUIPO.map((o) => (
                    <button key={o.v} type="button" onClick={() => set({ estado_general: o.v })}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium ${orden.estado_general === o.v ? 'border-brand bg-tint text-brand' : 'border-line text-muted hover:border-line'}`}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          <h3 className="mb-3 text-xs font-semibold uppercase text-muted">{t('subtitulos.infoTecnica')}</h3>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t('campos.fechaHoraRecepcion')}>
              <input type="datetime-local" className={inputCls} value={aInputDatetimeLocal(orden.fecha_hora_recepcion)} onChange={(e) => set({ fecha_hora_recepcion: e.target.value || null })} />
            </Field>
            <Field label={t('campos.tiempoReparacionEstimado')}>
              <input className={inputCls} placeholder={t('campos.tiempoReparacionPlaceholder')} value={orden.tiempo_reparacion_estimado || ''} onChange={(e) => set({ tiempo_reparacion_estimado: e.target.value })} />
            </Field>
            <Field label={t('campos.encendido')}>
              <select className={inputCls} value={orden.encendido || ''} onChange={(e) => set({ encendido: e.target.value })}>
                <option value="">—</option>
                {ESTADOS_ENCENDIDO.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </Field>
            {esCelular ? (
              <>
                <Field label={t('campos.imei1')}><input className={inputCls} value={orden.imei1 || ''} onChange={(e) => set({ imei1: e.target.value })} /></Field>
                <Field label={t('campos.imei2')}><input className={inputCls} value={orden.imei2 || ''} onChange={(e) => set({ imei2: e.target.value })} /></Field>
                <Field label={t('campos.numeroChip')}><input className={inputCls} value={orden.numero_chip || ''} onChange={(e) => set({ numero_chip: e.target.value })} /></Field>
                <Field label={t('campos.operadora')}>
                  <select className={inputCls} value={orden.operadora_equipo || ''} onChange={(e) => set({ operadora_equipo: e.target.value })}>
                    <option value="">—</option>
                    {OPERADORAS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </Field>
                <TriEstado label={t('campos.bateriaOriginal')} value={orden.bateria_original} onChange={(v) => set({ bateria_original: v })} textoSi={t('triEstado.si')} textoNo={t('triEstado.no')} />
                <TriEstado label={t('campos.camaraFunciona')} value={orden.camara_funciona} onChange={(v) => set({ camara_funciona: v })} textoSi={t('triEstado.si')} textoNo={t('triEstado.no')} />
              </>
            ) : (
              <Field label={t('campos.numeroSerie')}><input className={inputCls} value={orden.no_serie || ''} onChange={(e) => set({ no_serie: e.target.value })} /></Field>
            )}
          </div>

          {!esCelular && (
            <div className="mb-6 border-t border-line pt-5">
              <SeccionComputadora orden={orden} set={set} detalle={detalle} setDetalle={setDetalle} esNuevo={esNuevo} />
              <div className="mt-5 rounded-lg border border-line bg-subtle p-4 text-xs leading-relaxed text-muted">
                <strong className="mb-1 block text-ink">{t('com.advertenciasTitulo')}</strong>
                {t('com.advertenciasTexto')}
              </div>
              <div className="mt-5 rounded-lg border border-line bg-subtle p-4 text-xs leading-relaxed text-muted">
                <strong className="mb-1 block text-ink">{t('com.infoDiagnosticoTitulo')}</strong>
                {t('com.infoDiagnosticoTexto')}
              </div>
            </div>
          )}

          {esCelular && (
            <>
              <h3 className="mb-3 text-xs font-semibold uppercase text-muted">{t('subtitulos.accesoriosRecibidos')}</h3>
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => {
                  const lista = (orden.accesorios || '').split(',').map((s) => s.trim())
                  return (
                    <input key={i} className={inputCls} placeholder={t('campos.accesorioPlaceholder', { n: i + 1 })} value={lista[i] || ''}
                      onChange={(e) => { const l = [...lista]; l[i] = e.target.value; set({ accesorios: l.filter(Boolean).join(', ') }) }} />
                  )
                })}
              </div>
              <div className="mb-5 rounded-lg border border-line bg-subtle p-4 text-xs leading-relaxed text-muted">
                <strong className="mb-1 block text-ink">{t('com.infoDiagnosticoTitulo')}</strong>
                {t('com.infoDiagnosticoTexto')}
              </div>
            </>
          )}

          <div className="mb-5">
            <Field label={t('campos.comentarios')}><textarea rows={3} className={inputCls} value={orden.comentarios || ''} onChange={(e) => set({ comentarios: e.target.value })} /></Field>
          </div>
          <div className="mb-5">
            <Field label={t('campos.fallaReportada')}><textarea rows={3} className={inputCls} value={orden.problema_reportado || ''} onChange={(e) => set({ problema_reportado: e.target.value })} /></Field>
          </div>
          <div className="mb-5">
            <Field label={t('campos.instruccionesAsesor')}>
              <textarea rows={3} className={inputCls} placeholder={t('campos.instruccionesAsesorPlaceholder')}
                value={orden.instrucciones_asesor || ''} onChange={(e) => set({ instrucciones_asesor: e.target.value })} />
            </Field>
          </div>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('campos.contrasena')}>
              <input className={inputCls} value={orden.contrasena_equipo || ''} disabled={!!orden.sin_contrasena}
                onChange={(e) => set({ contrasena_equipo: e.target.value })} />
            </Field>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={!!orden.sin_contrasena}
                  onChange={(e) => set({ sin_contrasena: e.target.checked, contrasena_equipo: e.target.checked ? '' : orden.contrasena_equipo })} />
                {t('campos.sinContrasena')}
              </label>
            </div>
          </div>

          <div className={`mb-5 grid grid-cols-1 gap-6 ${esCelular ? 'sm:grid-cols-2' : ''}`}>
            {esCelular && (
              <div>
                <span className="mb-2 block text-xs font-medium text-muted">{t('campos.patronDesbloqueo')}</span>
                <PatronDesbloqueo value={orden.patron_desbloqueo} onChange={(v) => set({ patron_desbloqueo: v })} />
              </div>
            )}
            <div>
              <span className="mb-2 block text-xs font-medium text-muted">{t('campos.danosVisibles')}</span>
              <DanosVisibles value={orden.danos_visibles} onChange={(v) => set({ danos_visibles: v })} tipo={tipo} />
            </div>
          </div>

          {esNuevo ? (
            <div className="mb-2 rounded-lg border border-dashed border-line p-4 text-center text-xs text-muted">
              {t('mensajes.fotosDespuesDeCrear')}
            </div>
          ) : (
            <div className="mb-2">
              <span className="mb-2 block text-xs font-medium text-muted">{t('campos.fotosEquipo')}</span>
              <div className="flex flex-wrap gap-3">
                {(orden.fotos || []).map((f) => (
                  <img key={f.id} src={f.imagen.startsWith('http') ? f.imagen : `${MEDIA_BASE_URL}${f.imagen}`} alt="" className="h-20 w-20 rounded-lg object-cover border border-line" />
                ))}
                <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-line text-xs text-muted hover:bg-subtle">
                  + {t('botones.subir')}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFoto(e, 'RECEPCION')} />
                </label>
              </div>
            </div>
          )}

          <div className="mt-5">
            <span className="mb-2 block text-xs font-medium text-muted">{t('campos.tipoServicio')}</span>
            <div className="flex flex-wrap gap-2">
              {TIPOS_SERVICIO.map((ts) => (
                <label key={ts.v} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs ${(orden.tipos_servicio || []).includes(ts.v) ? 'border-brand bg-tint text-brand font-semibold' : 'border-line text-muted'}`}>
                  <input type="checkbox" className="hidden" checked={(orden.tipos_servicio || []).includes(ts.v)} onChange={() => toggleTipoServicio(ts.v)} />
                  {ts.l}
                </label>
              ))}
            </div>
            {(orden.tipos_servicio || []).includes('OTRO') && (
              <input className={`${inputCls} mt-2 max-w-sm`} placeholder={t('campos.especificarPlaceholder')} value={orden.tipos_servicio_otro || ''} onChange={(e) => set({ tipos_servicio_otro: e.target.value })} />
            )}
          </div>

          <div className="mt-5">
            <label className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              <input type="checkbox" checked={!!orden.equipo_apagado_recepcion}
                onChange={(e) => set({ equipo_apagado_recepcion: e.target.checked })} />
              {t('campos.equipoVinoApagado')}
            </label>
            <span className="mb-2 block text-xs font-semibold uppercase text-muted">{t('subtitulos.checklistEntrada')}</span>
            <div className={`grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 ${orden.equipo_apagado_recepcion ? 'pointer-events-none opacity-40' : ''}`}>
              {checklistSalidaItems.map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" disabled={!!orden.equipo_apagado_recepcion}
                    checked={!!(orden.checklist_entrada || {})[item]} onChange={() => toggleChecklistEntrada(item)} />
                  {t(`${checklistPrefix}.${item}`, { ns: checklistNs })}
                </label>
              ))}
            </div>
            {orden.equipo_apagado_recepcion && (
              <p className="mt-2 text-xs text-muted">{t('campos.checklistNoAplicaApagado')}</p>
            )}
          </div>
        </Section>

        <Section n="3" title={t('secciones.diagnosticoPresupuesto')}>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('campos.diagnostico')}><textarea rows={3} className={inputCls} value={orden.diagnostico || ''} onChange={(e) => set({ diagnostico: e.target.value })} /></Field>
            <Field label={t('campos.recomendaciones')}><textarea rows={3} className={inputCls} value={orden.recomendaciones || ''} onChange={(e) => set({ recomendaciones: e.target.value })} /></Field>
          </div>

          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted">{t('subtitulos.repuestos')}</span>
              <button type="button" onClick={addRepuesto} className="text-xs font-medium text-brand hover:underline">+ {t('botones.agregarFila')}</button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="bg-subtle text-xs uppercase text-muted">
                  <tr><th className="px-3 py-2 text-left">{t('tabla.descripcion')}</th><th className="px-3 py-2 text-left">{t('tabla.tipo')}</th><th className="px-3 py-2 text-right">{t('tabla.precio')}</th><th></th></tr>
                </thead>
                <tbody>
                  {(orden.repuestos || []).map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-2"><input className={inputCls} value={r.descripcion} onChange={(e) => updRepuesto(i, { descripcion: e.target.value })} /></td>
                      <td className="px-3 py-2">
                        <select className={inputCls} value={r.tipo} onChange={(e) => updRepuesto(i, { tipo: e.target.value })}>
                          {TIPOS_REPUESTO.map((tr) => <option key={tr} value={tr}>{t(`tipoRepuesto.${tr}`)}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2"><input type="number" className={`${inputCls} text-right`} value={r.precio} onChange={(e) => updRepuesto(i, { precio: e.target.value })} /></td>
                      <td className="px-3 py-2"><button onClick={() => delRepuesto(i)} className="text-red-500 hover:underline">✕</button></td>
                    </tr>
                  ))}
                  {(!orden.repuestos || orden.repuestos.length === 0) && <tr><td colSpan={4} className="px-3 py-4 text-center text-muted">{t('mensajes.sinRepuestos')}</td></tr>}
                </tbody>
                <tfoot><tr className="border-t border-line bg-subtle font-semibold"><td colSpan={2} className="px-3 py-2 text-right">{t('tabla.totalRepuestos')}</td><td className="px-3 py-2 text-right">{conConversion(totalRepuestos)}</td><td></td></tr></tfoot>
              </table>
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={!!orden.necesita_repuestos} onChange={(e) => set({ necesita_repuestos: e.target.checked })} /> {t('campos.necesitaRepuestos')}
            </label>
            {orden.necesita_repuestos && (
              <label className="mt-1 flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={!!orden.repuesto_inmediato} onChange={(e) => set({ repuesto_inmediato: e.target.checked })} /> {t('campos.repuestoInmediato')}
              </label>
            )}
          </div>

          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted">{t('subtitulos.serviciosRealizados')}</span>
              <button type="button" onClick={addServicio} className="text-xs font-medium text-brand hover:underline">+ {t('botones.agregarFila')}</button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="bg-subtle text-xs uppercase text-muted">
                  <tr><th className="px-3 py-2 text-left">{t('tabla.descripcion')}</th><th className="px-3 py-2 text-right">{t('tabla.precio')}</th><th></th></tr>
                </thead>
                <tbody>
                  {(orden.servicios_realizados || []).map((s, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-2"><input className={inputCls} value={s.descripcion} onChange={(e) => updServicio(i, { descripcion: e.target.value })} /></td>
                      <td className="px-3 py-2"><input type="number" className={`${inputCls} text-right`} value={s.precio} onChange={(e) => updServicio(i, { precio: e.target.value })} /></td>
                      <td className="px-3 py-2"><button onClick={() => delServicio(i)} className="text-red-500 hover:underline">✕</button></td>
                    </tr>
                  ))}
                  {(!orden.servicios_realizados || orden.servicios_realizados.length === 0) && <tr><td colSpan={3} className="px-3 py-4 text-center text-muted">{t('mensajes.sinServicios')}</td></tr>}
                </tbody>
                <tfoot><tr className="border-t border-line bg-subtle font-semibold"><td className="px-3 py-2 text-right">{t('tabla.totalServicios')}</td><td className="px-3 py-2 text-right">{conConversion(totalServicios)}</td><td></td></tr></tfoot>
              </table>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('campos.formaPago')}>
              <div className="flex gap-2">
                {FORMAS_PAGO.map((f) => (
                  <button key={f.v} type="button" onClick={() => set({ forma_pago: f.v })}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm ${orden.forma_pago === f.v ? 'border-brand bg-tint text-brand font-semibold' : 'border-line text-muted'}`}>{f.l}</button>
                ))}
              </div>
            </Field>
            <Field label={t('campos.moneda')}>
              <select className={inputCls} value={orden.moneda} onChange={(e) => set({ moneda: e.target.value })}>
                <option value="USD">{t('opciones.monedaUSD')}</option>
                <option value="NIO">{t('opciones.monedaNIO')}</option>
              </select>
            </Field>
            <Field label={t('campos.descuento')}><input type="number" className={inputCls} value={orden.descuento || 0} onChange={(e) => set({ descuento: e.target.value })} /></Field>
            <Field label={t('campos.impuestos')}><input type="number" className={inputCls} value={orden.impuestos || 0} onChange={(e) => set({ impuestos: e.target.value })} /></Field>
          </div>

          {!esNuevo && (
            // Checklist de salida: solo aplica al retirar el equipo ya
            // reparado, no tiene sentido verlo al ingresar la orden.
            <div className="mb-6">
              <span className="mb-2 block text-xs font-semibold uppercase text-muted">{t('subtitulos.checklistSalida')}</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                {checklistSalidaItems.map((item) => (
                  <label key={item} className="flex items-center gap-2 text-sm text-muted">
                    <input type="checkbox" checked={!!(orden.checklist_salida || {})[item]} onChange={() => toggleChecklistSalida(item)} />
                    {t(`${checklistPrefix}.${item}`, { ns: checklistNs })}
                  </label>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section n="4" title={t('secciones.entrega')}>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t('campos.fechaEstimada')}><input type="date" className={inputCls} value={orden.fecha_entrega_estimada || ''} onChange={(e) => set({ fecha_entrega_estimada: e.target.value })} /></Field>
            <Field label={t('campos.tecnicoAsignado')}>
              <select className={inputCls} value={orden.tecnico || ''} onChange={(e) => set({ tecnico: e.target.value || null })}>
                <option value="">{t('opciones.sinAsignar')}</option>
                {tecnicos.map((tec) => (
                  <option key={tec.id} value={tec.id}>
                    {/* Solo Ventas ve la carga de trabajo al asignar: le ayuda
                        a repartir entre técnicos en vez de recargar siempre
                        al mismo. */}
                    {user?.rol === 'VENTAS' ? t('opciones.tecnicoConCarga', { nombre: tec.nombre, n: tec.ordenes_activas_count ?? 0 }) : tec.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('campos.asesorAsignado')}>
              <select className={inputCls} value={orden.asesor || ''} onChange={(e) => set({ asesor: e.target.value || null })}>
                <option value="">{t('opciones.sinAsignar')}</option>
                {asesores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </Field>
            {!esNuevo && !esTecnicoLimitado && <Field label={t('campos.recibe')}><input className={inputCls} value={orden.recibe || ''} onChange={(e) => set({ recibe: e.target.value })} /></Field>}
          </div>
          {!esTecnicoLimitado && (
            // Las dos firmas del cliente van juntas al final de la orden:
            // "leí y entendí" (recepción, acepta los términos) y "recibí
            // conforme" (al retirar el equipo ya reparado) — no tiene
            // sentido pedir la primera firma en medio de los datos del
            // cliente, en la Sección 1, antes de que exista diagnóstico
            // ni presupuesto que el cliente pueda leer y aceptar.
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-line p-3">
                <label className="mb-3 flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" checked={!!orden.aceptacion_cliente} onChange={(e) => set({ aceptacion_cliente: e.target.checked })} /> {t('campos.aceptacionCliente')}
                </label>
                <FirmaDigital label={t('campos.firmaClienteRecepcion')} value={orden.firma_cliente} onChange={(v) => set({ firma_cliente: v })} />
              </div>
              {!esNuevo && (
                <div className="rounded-lg border border-line p-3">
                  <FirmaDigital label={t('campos.firmaClienteEntrega')} value={orden.firma_cliente_entrega} onChange={(v) => set({ firma_cliente_entrega: v })} />
                </div>
              )}
            </div>
          )}
        </Section>

        <Section n="5" title={t('secciones.observaciones')}>
          <textarea rows={4} className={inputCls} value={orden.observaciones || ''} onChange={(e) => set({ observaciones: e.target.value })} placeholder={t('campos.notasAdicionalesPlaceholder')} />
          {/* Texto legal exacto proporcionado por Gerencia — no parafrasear
              ni resumir, se muestra igual para CCA y COM. */}
          <div className="mt-5 rounded-lg border border-line bg-subtle p-4 text-xs leading-relaxed text-muted">
            <strong className="mb-1 block text-ink">{t('legal.diagnosticoTitulo', { ns: 'checklist' })}</strong>
            <p className="mb-1">{t('legal.diagnosticoA', { ns: 'checklist' })}</p>
            <p className="mb-1">{t('legal.diagnosticoB', { ns: 'checklist' })}</p>
            <p className="mb-3">{t('legal.diagnosticoC', { ns: 'checklist' })}</p>

            <strong className="mb-1 block text-ink">{t('legal.ingresoTitulo', { ns: 'checklist' })}</strong>
            <p className="mb-1">{t('legal.ingreso', { ns: 'checklist' })}</p>
            <p className="mb-1">{t('legal.ingreso2', { ns: 'checklist' })}</p>
            <p className="mb-1">{t('legal.ingreso3', { ns: 'checklist' })}</p>
            <p className="mb-3">{t('legal.ingresoNota', { ns: 'checklist' })}</p>

            <strong className="mb-1 block text-ink">{t('legal.notasTitulo', { ns: 'checklist' })}</strong>
            <p className="mb-1">{t('legal.notasContrasena', { ns: 'checklist' })}</p>
            <p className="mb-1">{t('legal.notasFallasOcultas', { ns: 'checklist' })}</p>
            <p className="mb-1">{t('legal.notasRespaldos', { ns: 'checklist' })}</p>
            <p className="mb-3">{t('legal.notasSoftware', { ns: 'checklist' })}</p>

            <strong className="mb-1 block text-ink">{t('legal.garantiaTitulo', { ns: 'checklist' })}</strong>
            <p className="mb-1">{t('legal.garantia', { ns: 'checklist' })}</p>
            <p className="mb-1">{t('legal.garantia2', { ns: 'checklist' })}</p>
            <p className="mb-1">{t('legal.garantia3', { ns: 'checklist' })}</p>
            <p>{t('legal.garantiaNota', { ns: 'checklist' })}</p>
          </div>
        </Section>
        </fieldset>

        <div className="orden-tw mb-6 rounded-xl bg-slate-800 p-4 text-white shadow-sm">
          <div className="flex justify-between text-sm opacity-80"><span>{t('tabla.totalRepuestos')}</span><span>{conConversion(totalRepuestos)}</span></div>
          <div className="flex justify-between text-sm opacity-80"><span>{t('tabla.totalServicios')}</span><span>{conConversion(totalServicios)}</span></div>
          <div className="flex justify-between text-sm opacity-80"><span>{t('resumen.descuentoImpuestos')}</span><span>-{conConversion(orden.descuento || 0)} / +{conConversion(orden.impuestos || 0)}</span></div>
          <div className="mt-2 flex justify-between border-t border-white/20 pt-2 text-lg font-bold"><span>{t('resumen.totalCordobas')}</span><span>C${totalNIO.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
          <div className="flex justify-between text-lg font-bold"><span>{t('resumen.totalDolares')}</span><span>US${totalUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
        </div>

        {!esNuevo && (orden.expediente?.length > 0 || historialCliente.length > 0 || historialEquipo.length > 0) && (
          <Section n="•" title={t('com.historialReparacionesTitulo')}>
            {orden.expediente?.length > 0 && (
              <div className="mb-4">
                <span className="mb-2 block text-xs font-semibold uppercase text-muted">
                  {t('com.expedienteEquipo')}
                  {(orden.equipo_marca || orden.equipo_modelo) && ` — ${[orden.equipo_marca, orden.equipo_modelo].filter(Boolean).join(' ')}`}
                </span>
                <ul className="space-y-1 text-sm">
                  {orden.expediente.map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => navigate(`/ordenes/${o.id}`)} className="text-brand hover:underline">{o.numero}</button>
                      <span className="text-muted"> · {o.problema_reportado || '—'} · {o.fecha_ingreso} · {o.estado_display}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {historialCliente.length > 0 && (
              <div className="mb-4">
                <span className="mb-2 block text-xs font-semibold uppercase text-muted">{t('com.historialCliente')}</span>
                <ul className="space-y-1 text-sm">
                  {historialCliente.map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => navigate(`/ordenes/${o.id}`)} className="text-brand hover:underline">{o.numero}</button>
                      <span className="text-muted"> · {o.equipo} · {o.fecha_ingreso} · {o.estado_display}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {historialEquipo.length > 0 && (
              <div>
                <span className="mb-2 block text-xs font-semibold uppercase text-muted">{t('com.historialEquipo')}</span>
                <ul className="space-y-1 text-sm">
                  {historialEquipo.map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => navigate(`/ordenes/${o.id}`)} className="text-brand hover:underline">{o.numero}</button>
                      <span className="text-muted"> · {!sinAccesoCliente && `${o.cliente_nombre} · `}{o.fecha_ingreso} · {o.estado_display}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        )}

        {!esNuevo && !esTecnicoLimitado && orden.historial && orden.historial.length > 0 && (
          <Section n="•" title={t('secciones.historial')}>
            <ul className="space-y-2 text-sm">
              {orden.historial.map((h) => (
                <li key={h.id} className="flex justify-between border-b border-line pb-2 text-muted">
                  <span>{h.estado_anterior_display || t('historial.creada')} → <strong>{h.estado_nuevo_display}</strong></span>
                  <span className="text-muted">{h.usuario_nombre} · {new Date(h.fecha).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {empresaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.4)' }} onClick={() => setEmpresaModal(false)}>
          <div className="w-full max-w-sm rounded-xl bg-surface p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-bold text-ink">{t('campos.nuevaEmpresa')}</h3>
            <form onSubmit={guardarEmpresaRapida} className="space-y-3">
              <input autoFocus className={inputCls} placeholder={t('campos.empresaNombre')} value={empresaForm.nombre} onChange={(e) => setEmpresaForm({ ...empresaForm, nombre: e.target.value })} />
              <input className={inputCls} placeholder={t('campos.empresaRuc')} value={empresaForm.ruc} onChange={(e) => setEmpresaForm({ ...empresaForm, ruc: e.target.value })} />
              <input className={inputCls} placeholder={t('campos.empresaCorreo')} value={empresaForm.email} onChange={(e) => setEmpresaForm({ ...empresaForm, email: e.target.value })} />
              <input className={inputCls} placeholder={t('campos.telefono')} value={empresaForm.telefono} onChange={(e) => setEmpresaForm({ ...empresaForm, telefono: e.target.value })} />
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">{t('botones.guardar', { ns: 'common' })}</button>
                <button type="button" onClick={() => setEmpresaModal(false)} className="rounded-lg border border-line px-4 py-2 text-sm text-muted">{t('botones.cancelar', { ns: 'common' })}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewAbierto && (
        <OrdenPreview
          orden={orden}
          cliente={cliente}
          empresaNombre={empresas.find((e) => e.id === cliente?.empresa)?.nombre}
          onClose={() => setPreviewAbierto(false)}
        />
      )}
      </div>
    </div>
  )
}

export default OrdenTrabajo
