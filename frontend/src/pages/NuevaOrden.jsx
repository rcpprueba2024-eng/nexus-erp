import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Laptop, Smartphone, ArrowLeft, ArrowRight, Lock } from 'lucide-react'
import { tallerApi, ventasApi, rrhhApi, inventarioApi, configApi } from '../api.js'
import { useAuth, esRolSinAccesoCliente } from '../AuthContext.jsx'
import DanosVisibles from '../components/orden/DanosVisibles.jsx'
import PatronDesbloqueo from '../components/orden/PatronDesbloqueo.jsx'
import ReciboPreview from '../components/ReciboPreview.jsx'
import OrdenPreview from '../components/OrdenPreview.jsx'
import logo from '../assets/rcp-logo.png'
import { checklistSalidaPara } from '../ordenTipo.js'
import {
  DETALLE_COM_VACIO, ORDEN_VACIA, Field, inputCls,
  OPERADORAS_VALUES, TIPOS_SERVICIO_VALUES, ESTADO_EQUIPO_VALUES, ESTADOS_ENCENDIDO_VALUES, COMO_SUPO_VALUES,
} from './OrdenTrabajo.jsx'
import '../orden-tailwind.css'

const TIPO_ALMACENAMIENTO_VALUES = ['HDD', 'SSD', 'NVME']
const TIPO_CONECTOR_VALUES = ['SATA', 'NVME']

const cardCls = (activo) =>
  `rounded-lg border-2 px-3 py-2.5 text-left text-sm font-medium transition ${activo ? 'border-brand bg-tint text-brand' : 'border-line text-muted hover:border-line'}`

function NuevaOrden() {
  const { t } = useTranslation(['ordenes', 'common'])
  const navigate = useNavigate()
  const { user } = useAuth()
  const sinAccesoCliente = esRolSinAccesoCliente(user?.rol)

  const [paso, setPaso] = useState(0)
  const [tipo, setTipo] = useState(null)
  const [orden, setOrden] = useState(ORDEN_VACIA)
  // Próximo consecutivo (COM / CCA) para mostrar el número que tendrá la orden.
  const [proximoNumero, setProximoNumero] = useState(null)

  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteCedula, setClienteCedula] = useState('')
  const [clienteRuc, setClienteRuc] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [clienteTelefono2, setClienteTelefono2] = useState('')
  const [clienteOperadora, setClienteOperadora] = useState('')
  const [clienteWhatsapp, setClienteWhatsapp] = useState(false)
  const [clienteTipo, setClienteTipo] = useState('')
  const [clientesExistentes, setClientesExistentes] = useState([])
  const [clienteProblematico, setClienteProblematico] = useState(false)
  const [clienteMotivoProblematico, setClienteMotivoProblematico] = useState('')

  const [tecnicos, setTecnicos] = useState([])
  const [asesores, setAsesores] = useState([])
  const [marcasCatalogo, setMarcasCatalogo] = useState([])
  const [modelosCatalogo, setModelosCatalogo] = useState([])
  const [estadoPago, setEstadoPago] = useState('SIN_ADELANTO')
  const [metodoPago, setMetodoPago] = useState('EFECTIVO')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [eligiendoImpresion, setEligiendoImpresion] = useState(null)
  const [reciboFactura, setReciboFactura] = useState(null)
  const [pdfOrden, setPdfOrden] = useState(null)

  useEffect(() => {
    if (sinAccesoCliente) { navigate('/ordenes', { replace: true }); return }
    rrhhApi.empleados().then((r) => {
      setTecnicos(r.data.filter((e) => (e.areas || []).includes('TALLER')))
      setAsesores(r.data.filter((e) => (e.areas || []).includes('VENTAS')))
    })
    ventasApi.clientes().then((r) => setClientesExistentes(r.data))
    inventarioApi.marcas().then((r) => setMarcasCatalogo(r.data))
    inventarioApi.modelos().then((r) => setModelosCatalogo(r.data))
    configApi.obtener().then((r) => setProximoNumero({
      COM: r.data.siguiente_numero_com,
      CCA: r.data.siguiente_numero_cca,
    })).catch(() => {})
  }, [sinAccesoCliente, navigate])

  const set = (patch) => setOrden((o) => ({ ...o, ...patch }))
  const setDetalle = (patch) => setOrden((o) => ({ ...o, detalle_com: { ...(o.detalle_com || DETALLE_COM_VACIO), ...patch } }))

  // Hora real de recepción — antes esto era solo un texto de "hoy",
  // decorativo, que nunca se guardaba en la orden.
  useEffect(() => {
    const ahora = new Date()
    ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset())
    set({ fecha_hora_recepcion: ahora.toISOString().slice(0, 16) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const detalle = orden.detalle_com || DETALLE_COM_VACIO
  const esCelular = tipo === 'CCA'
  // Vista previa del consecutivo: "COM-1234" / "CCA-1234". El backend fija el
  // número definitivo al guardar (puede variar si entra otra orden en el medio).
  const numeroPreview = tipo && proximoNumero?.[tipo] != null ? `${tipo}-${proximoNumero[tipo]}` : null

  const TIPOS_SERVICIO = TIPOS_SERVICIO_VALUES.map((v) => ({ v, l: t(`tipoServicio.${v}`) }))
  const OPERADORAS = OPERADORAS_VALUES.map((v) => ({ v, l: t(`operadora.${v}`) }))
  const ESTADO_EQUIPO = ESTADO_EQUIPO_VALUES.map((v) => ({ v, l: t(`estadoEquipo.${v}`) }))
  const ESTADOS_ENCENDIDO = ESTADOS_ENCENDIDO_VALUES.map((v) => ({ v, l: t(`estadoEncendido.${v}`) }))
  const COMO_SUPO = COMO_SUPO_VALUES.map((v) => ({ v, l: t(`com.comoSupo.${v}`) }))
  const checklistEntradaItems = checklistSalidaPara(orden.categoria_equipo)
  const checklistNs = esCelular ? 'ordenes' : 'checklist'
  const checklistPrefix = esCelular ? 'checklistSalida' : 'items'
  const toggleChecklistEntrada = (item) =>
    set({ checklist_entrada: { ...(orden.checklist_entrada || {}), [item]: !(orden.checklist_entrada || {})[item] } })

  const elegirTipo = (val) => {
    const categoria = val === 'CCA' ? 'CELULAR' : 'COMPUTADORA'
    setTipo(val)
    // El número real (consecutivo COM-#### o CCA-####) lo asigna el
    // backend al guardar — no se genera ni se muestra en el asistente.
    set({ categoria_equipo: categoria })
    setPaso(1)
  }

  const seleccionarCliente = (nombre) => {
    setClienteNombre(nombre)
    const existente = clientesExistentes.find((c) => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())
    setClienteProblematico(!!existente?.es_problematico)
    setClienteMotivoProblematico(existente?.motivo_problematico || '')
    if (!existente) return
    setClienteCedula(existente.cedula || '')
    setClienteRuc(existente.documento || '')
    setClienteEmail(existente.email || '')
    setClienteTelefono(existente.telefono || '')
    setClienteTelefono2(existente.telefono2 || '')
    setClienteOperadora(existente.operadora || '')
    setClienteWhatsapp(!!existente.whatsapp)
    setClienteTipo(existente.tipo_cliente === 'EMPRESA' ? 'EMPRESA' : existente.tipo_cliente ? 'PARTICULAR' : '')
  }

  const toggleTipoServicio = (v) => {
    const actuales = orden.tipos_servicio || []
    set({ tipos_servicio: actuales.includes(v) ? actuales.filter((x) => x !== v) : [...actuales, v] })
  }

  const elegirEstadoPago = (v) => {
    setEstadoPago(v)
    if (v === 'SIN_ADELANTO') set({ adelanto: 0 })
    if (v === 'PAGADO_COMPLETO') set({ adelanto: orden.costo_estimado || 0 })
  }

  const resolverCliente = async () => {
    const nombre = clienteNombre.trim()
    const datos = {
      email: clienteEmail.trim(), telefono: clienteTelefono.trim(), telefono2: clienteTelefono2.trim(), operadora: clienteOperadora,
      whatsapp: clienteWhatsapp, tipo_cliente: clienteTipo,
    }
    if (clienteTipo === 'EMPRESA') datos.documento = clienteRuc.trim()
    else if (clienteTipo === 'PARTICULAR') datos.cedula = clienteCedula.trim()

    const existente = clientesExistentes.find((c) => c.nombre.trim().toLowerCase() === nombre.toLowerCase())
    if (existente) {
      await ventasApi.actualizarCliente(existente.id, datos)
      return existente.id
    }
    const res = await ventasApi.crearCliente({ nombre, ...datos })
    return res.data.id
  }

  const extraerErrores = (err) => {
    const data = err?.response?.data
    if (!data || typeof data !== 'object') return t('errores.noSePudoGuardar')
    return Object.entries(data).map(([campo, msgs]) => `${campo}: ${Array.isArray(msgs) ? msgs.join(' ') : msgs}`).join(' · ')
  }

  const registrarOrden = async () => {
    setError('')
    if (!clienteNombre.trim()) { setError(t('errores.nombreClienteObligatorio')); return }
    if (!orden.equipo || !orden.equipo.trim()) { setError(t('errores.equipoObligatorio')); return }
    setGuardando(true)
    try {
      const clienteId = await resolverCliente()
      const { _traeAccesorios, ...ordenLimpia } = orden
      const payload = {
        ...ordenLimpia,
        cliente: clienteId,
        tecnico: orden.tecnico || null,
        asesor: orden.asesor || null,
        fecha_entrega_estimada: orden.fecha_entrega_estimada || null,
        fecha_hora_recepcion: orden.fecha_hora_recepcion || null,
        detalle_com: tipo === 'COM' ? { ...detalle, tecnico_recibe: null, tecnico_entrega: null } : null,
      }
      const res = await tallerApi.crearOrden(payload)
      // Si el cliente ya pagó de un solo al crear la orden, se factura de
      // inmediato — el equipo igual entra a taller para repararse, solo
      // que ya no hay que cobrarle nada al entregarlo (ver Equipos Listos).
      if (estadoPago === 'PAGADO_COMPLETO') {
        const nuevaOrdenId = res.data.id
        const monto = Number(orden.costo_estimado || 0)
        try {
          const facRes = await tallerApi.facturarOrden(nuevaOrdenId, {
            moneda: orden.moneda || 'USD',
            monto,
            pagos: [{ metodo: metodoPago, monto, monto_recibido: null }],
          })
          setEligiendoImpresion({ factura: facRes.data, ordenId: nuevaOrdenId })
          return
        } catch (errFactura) {
          setError(extraerErrores(errFactura))
          navigate('/taller')
          return
        }
      }
      navigate('/taller')
    } catch (err) {
      setError(extraerErrores(err))
    } finally {
      setGuardando(false)
    }
  }

  const elegirImprimirTicket = () => {
    setReciboFactura(eligiendoImpresion.factura)
    ventasApi.imprimirFactura(eligiendoImpresion.factura.id).catch(() => {})
    setEligiendoImpresion(null)
  }

  const elegirImprimirPdf = async () => {
    const { ordenId } = eligiendoImpresion
    setEligiendoImpresion(null)
    try {
      const ordenRes = await tallerApi.orden(ordenId)
      const ordenCompleta = ordenRes.data
      let clienteData = null
      let empresaNombre = ''
      if (ordenCompleta.cliente) {
        const cRes = await ventasApi.cliente(ordenCompleta.cliente)
        clienteData = cRes.data
        if (clienteData?.empresa) {
          const eRes = await ventasApi.empresas()
          empresaNombre = eRes.data.find((e) => e.id === clienteData.empresa)?.nombre || ''
        }
      }
      setPdfOrden({ orden: ordenCompleta, cliente: clienteData, empresaNombre })
    } catch {
      setError(t('errores.noSePudoGuardar'))
    }
  }

  const Siguiente = ({ onClick, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
      {t('wizard.siguiente')} <ArrowRight size={15} />
    </button>
  )
  const Atras = ({ onClick }) => (
    <button type="button" onClick={onClick} className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-muted hover:bg-subtle">
      <ArrowLeft size={15} /> {t('wizard.atras')}
    </button>
  )

  const PASOS = [t('wizard.paso1'), t('wizard.paso2'), t('wizard.paso3')]

  return (
    <div className="orden-tw">
      <div className="min-h-screen bg-subtle pb-16">
        <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-6 py-3 shadow-sm">
          <button onClick={() => navigate('/ordenes')} className="text-sm text-muted hover:text-ink">← {t('header.volver')}</button>
          <div className="flex items-center gap-2">
            <img src={logo} alt="RCP" className="h-8 w-auto" />
            <span className="text-sm font-bold text-ink">{t('titulo.nuevo')}</span>
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-6">
          {paso > 0 && (
            <div className="mb-6 flex items-center justify-center gap-2">
              {PASOS.map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${paso === i + 1 ? 'bg-brand text-white' : paso > i + 1 ? 'bg-emerald-500 text-white' : 'bg-subtle text-muted'}`}>
                    {i + 1}
                  </div>
                  <span className={`text-xs font-medium ${paso === i + 1 ? 'text-ink' : 'text-muted'}`}>{label}</span>
                  {i < PASOS.length - 1 && <div className="mx-1 h-px w-8 bg-line" />}
                </div>
              ))}
            </div>
          )}

          {paso > 0 && numeroPreview && (
            <div className="mb-6 flex items-center justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-sm shadow-sm">
                <span className="font-semibold uppercase tracking-wide text-muted">{t('wizard.numeroOrden')}</span>
                <span className="text-base font-extrabold" style={{ color: tipo === 'CCA' ? '#7c3aed' : '#0284c7' }}>{numeroPreview}</span>
                <span className="text-xs font-normal text-muted">{t('wizard.numeroOrdenAyuda')}</span>
              </span>
            </div>
          )}

          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

          {paso === 0 && (
            <div className="rounded-2xl border border-line bg-surface p-7 shadow-card">
              <span className="mb-5 block text-xs font-semibold uppercase tracking-wide text-muted">{t('tipoOrden.titulo')}</span>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button type="button" onClick={() => elegirTipo('CCA')}
                  className="group flex flex-col items-start gap-3 rounded-2xl border border-line p-6 text-left transition hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-pop"
                  style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.07), transparent 60%)' }}>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(124,58,237,0.14)' }}>
                    <Smartphone size={26} style={{ color: '#7c3aed' }} />
                  </div>
                  <div className="text-2xl font-extrabold" style={{ color: '#7c3aed' }}>CCA</div>
                  <div className="text-xs text-muted">{t('tipoOrden.ccaDescripcion')}</div>
                </button>
                <button type="button" onClick={() => elegirTipo('COM')}
                  className="group flex flex-col items-start gap-3 rounded-2xl border border-line p-6 text-left transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-pop"
                  style={{ background: 'linear-gradient(135deg, rgba(2,132,199,0.07), transparent 60%)' }}>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(2,132,199,0.14)' }}>
                    <Laptop size={26} style={{ color: '#0284c7' }} />
                  </div>
                  <div className="text-2xl font-extrabold" style={{ color: '#0284c7' }}>COM</div>
                  <div className="text-xs text-muted">{t('tipoOrden.comDescripcion')}</div>
                </button>
              </div>
            </div>
          )}

          {paso === 1 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink">{t('wizard.datosCliente')}</h2>
                {clienteProblematico && (
                  <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                    <span>🚩</span>
                    <div>
                      <p className="font-semibold">{t('banderaRoja.avisoTitulo', { ns: 'clientes' })}</p>
                      <p>{clienteMotivoProblematico || t('banderaRoja.avisoSinMotivo', { ns: 'clientes' })}</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label={t('campos.clienteNombreCompleto')}>
                    <input className={inputCls} list="clientes-existentes" value={clienteNombre} onChange={(e) => seleccionarCliente(e.target.value)} placeholder={t('campos.clienteNombrePlaceholder')} />
                    <datalist id="clientes-existentes">
                      {clientesExistentes.map((c) => <option key={c.id} value={c.nombre} />)}
                    </datalist>
                  </Field>
                  <Field label={t('campos.correoElectronico')}>
                    <input type="email" className={inputCls} value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} />
                  </Field>
                  <Field label={t('campos.telefono')}>
                    <input className={inputCls} value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} />
                  </Field>
                  <Field label={t('campos.telefonoAlterno')}>
                    <input className={inputCls} value={clienteTelefono2} onChange={(e) => setClienteTelefono2(e.target.value)} />
                  </Field>
                  <Field label={t('campos.operadora')}>
                    <select className={inputCls} value={clienteOperadora} onChange={(e) => setClienteOperadora(e.target.value)}>
                      <option value="">—</option>
                      {OPERADORAS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </Field>
                  <Field label={t('com.comoSupoLabel')}>
                    <select className={inputCls} value={orden.como_supo || ''} onChange={(e) => set({ como_supo: e.target.value })}>
                      <option value="">—</option>
                      {COMO_SUPO.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </Field>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-sm text-muted">
                      <input type="checkbox" checked={clienteWhatsapp} onChange={(e) => setClienteWhatsapp(e.target.checked)} /> WhatsApp
                    </label>
                  </div>
                  <Field label={t('campos.fechaHoraRecepcion')}>
                    <input type="datetime-local" className={inputCls} value={orden.fecha_hora_recepcion || ''} onChange={(e) => set({ fecha_hora_recepcion: e.target.value })} />
                  </Field>
                  <Field label={t('campos.tiempoReparacionEstimado')}>
                    <input className={inputCls} placeholder={t('campos.tiempoReparacionPlaceholder')} value={orden.tiempo_reparacion_estimado || ''} onChange={(e) => set({ tiempo_reparacion_estimado: e.target.value })} />
                  </Field>
                </div>

                <div className="mt-5 border-t border-line pt-5">
                  <span className="mb-2 block text-xs font-medium text-muted">{t('wizard.tipoCliente')}</span>
                  <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-xs">
                    <button type="button" onClick={() => setClienteTipo('PARTICULAR')} className={cardCls(clienteTipo === 'PARTICULAR')}>{t('wizard.particular')}</button>
                    <button type="button" onClick={() => setClienteTipo('EMPRESA')} className={cardCls(clienteTipo === 'EMPRESA')}>{t('wizard.empresa')}</button>
                  </div>
                  {clienteTipo === 'PARTICULAR' && (
                    <Field label={t('campos.cedula')}><input className={`${inputCls} sm:max-w-xs`} value={clienteCedula} onChange={(e) => setClienteCedula(e.target.value)} /></Field>
                  )}
                  {clienteTipo === 'EMPRESA' && (
                    <Field label={t('campos.ruc')}><input className={`${inputCls} sm:max-w-xs`} value={clienteRuc} onChange={(e) => setClienteRuc(e.target.value)} /></Field>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink">{t('wizard.servicio')}</h2>
                <span className="mb-2 block text-xs font-medium text-muted">{t('wizard.tipoServicioLabel')}</span>
                <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {TIPOS_SERVICIO.map((o) => (
                    <button key={o.v} type="button" onClick={() => toggleTipoServicio(o.v)} className={cardCls((orden.tipos_servicio || []).includes(o.v))}>
                      {o.l}
                    </button>
                  ))}
                </div>

                <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t('wizard.valorServicio')}>
                    <input type="number" min="0" step="0.01" className={inputCls} value={orden.costo_estimado || ''}
                      onChange={(e) => set({ costo_estimado: e.target.value })} />
                  </Field>
                </div>

                <span className="mb-2 block text-xs font-medium text-muted">{t('wizard.estadoPagoLabel')}</span>
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button type="button" onClick={() => elegirEstadoPago('SIN_ADELANTO')} className={cardCls(estadoPago === 'SIN_ADELANTO')}>{t('wizard.sinAdelanto')}</button>
                  <button type="button" onClick={() => elegirEstadoPago('CON_ADELANTO')} className={cardCls(estadoPago === 'CON_ADELANTO')}>{t('wizard.conAdelanto')}</button>
                  <button type="button" onClick={() => elegirEstadoPago('PAGADO_COMPLETO')} className={cardCls(estadoPago === 'PAGADO_COMPLETO')}>{t('wizard.pagadoCompleto')}</button>
                </div>
                {estadoPago === 'CON_ADELANTO' && (
                  <Field label={t('wizard.montoAdelanto')}>
                    <input type="number" min="0" step="0.01" className={`${inputCls} sm:max-w-xs`} value={orden.adelanto || ''} onChange={(e) => set({ adelanto: e.target.value })} />
                  </Field>
                )}
                {estadoPago === 'PAGADO_COMPLETO' && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <span className="mb-2 block text-xs font-medium text-emerald-800">{t('wizard.metodoPagoLabel')}</span>
                    <div className="flex gap-2 sm:max-w-xs">
                      <button type="button" onClick={() => setMetodoPago('EFECTIVO')} className={cardCls(metodoPago === 'EFECTIVO')}>{t('modal.efectivo', { ns: 'facturarOts' })}</button>
                      <button type="button" onClick={() => setMetodoPago('TARJETA')} className={cardCls(metodoPago === 'TARJETA')}>{t('modal.tarjeta', { ns: 'facturarOts' })}</button>
                    </div>
                    <p className="mt-2 text-xs text-emerald-700">{t('wizard.pagadoCompletoAyuda')}</p>
                  </div>
                )}

                <div className="mt-5">
                  <Field label={t('wizard.notaDiagnostico')}>
                    <textarea rows={3} className={inputCls} value={orden.notas || ''} onChange={(e) => set({ notas: e.target.value })} />
                  </Field>
                </div>
              </div>

              <div className="flex justify-between">
                <Atras onClick={() => setPaso(0)} />
                <Siguiente onClick={() => setPaso(2)} />
              </div>
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink">{t('secciones.detallesRecepcion')}</h2>

                {!esCelular && (
                  <div className="mb-5">
                    <label className="flex items-center gap-2 text-sm text-muted">
                      <input type="checkbox" checked={!!detalle.bitlocker_activo} onChange={(e) => setDetalle({ bitlocker_activo: e.target.checked })} />
                      {t('com.bitlockerEstado')}
                    </label>
                    {detalle.bitlocker_activo && (
                      <Field label={t('com.bitlockerClave')}>
                        <input className={`${inputCls} mt-2 sm:max-w-xs`} value={detalle.bitlocker_clave || ''} onChange={(e) => setDetalle({ bitlocker_clave: e.target.value })} />
                      </Field>
                    )}
                  </div>
                )}

                {!esCelular && (
                  <div className="mb-5 grid grid-cols-1 gap-4 border-b border-line pb-5 sm:grid-cols-3">
                    <div>
                      <span className="mb-2 block text-xs font-medium text-muted">{t('com.empresaControlaSoftware')}</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[[t('triEstado.si'), true], [t('triEstado.no'), false]].map(([txt, v]) => (
                          <button key={txt} type="button" onClick={() => setDetalle({ empresa_controla_software: v })} className={cardCls(detalle.empresa_controla_software === v)}>{txt}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="mb-2 block text-xs font-medium text-muted">{t('com.primeraVez')}</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[[t('triEstado.si'), true], [t('triEstado.no'), false]].map(([txt, v]) => (
                          <button key={txt} type="button" onClick={() => setDetalle({ primera_vez: v })} className={cardCls(detalle.primera_vez === v)}>{txt}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="mb-2 block text-xs font-medium text-muted">{t('com.respaldoSolicitado')}</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[[t('triEstado.si'), true], [t('triEstado.no'), false]].map(([txt, v]) => (
                          <button key={txt} type="button" onClick={() => setDetalle({ respaldo_solicitado: v })} className={cardCls(detalle.respaldo_solicitado === v)}>{txt}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label={t('campos.equipoRecibido')}>
                    <input className={inputCls} value={orden.equipo || ''} onChange={(e) => set({ equipo: e.target.value })} />
                  </Field>
                  <Field label={t('campos.marca')}>
                    <input className={inputCls} list="marcas-catalogo" value={orden.marca || ''} onChange={(e) => set({ marca: e.target.value })} />
                    <datalist id="marcas-catalogo">{marcasCatalogo.map((m) => <option key={m.id} value={m.nombre} />)}</datalist>
                  </Field>
                  <Field label={t('campos.modelo')}>
                    <input className={inputCls} list="modelos-catalogo" value={orden.modelo || ''} onChange={(e) => set({ modelo: e.target.value })} />
                    <datalist id="modelos-catalogo">{modelosCatalogo.filter((mo) => !orden.marca || mo.marca_nombre === orden.marca).map((mo) => <option key={mo.id} value={mo.nombre} />)}</datalist>
                  </Field>
                  {!esCelular && (
                    <Field label={t('com.procesador')}>
                      <input className={inputCls} placeholder={t('com.procesadorPlaceholder')} value={detalle.procesador_generacion || ''} onChange={(e) => setDetalle({ procesador_generacion: e.target.value })} />
                    </Field>
                  )}
                  <Field label={t('campos.color')}><input className={inputCls} value={orden.color || ''} onChange={(e) => set({ color: e.target.value })} /></Field>
                  <Field label={esCelular ? t('campos.imei1') : t('campos.numeroSerie')}>
                    <input className={inputCls} value={esCelular ? (orden.imei1 || '') : (orden.no_serie || '')}
                      onChange={(e) => set(esCelular ? { imei1: e.target.value } : { no_serie: e.target.value })} />
                  </Field>
                </div>

                <div className="mb-5">
                  <Field label={t('campos.estadoEquipo')}>
                    <div className="flex flex-wrap gap-2">
                      {ESTADO_EQUIPO.filter((o) => o.v !== 'ENCIENDE_CON_FALLA').map((o) => (
                        <button key={o.v} type="button" onClick={() => set({ estado_general: o.v })} className={cardCls(orden.estado_general === o.v)}>{o.l}</button>
                      ))}
                    </div>
                  </Field>
                </div>

                <div className="mb-5">
                  <Field label={t('campos.encendido')}>
                    <div className="flex flex-wrap gap-2">
                      {ESTADOS_ENCENDIDO.map((o) => (
                        <button key={o.v} type="button" onClick={() => set({ encendido: o.v })} className={cardCls(orden.encendido === o.v)}>{o.l}</button>
                      ))}
                    </div>
                  </Field>
                </div>

                {!esCelular && (
                  <div className="mb-5 grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label={t('com.ramTipo')}><input className={inputCls} value={detalle.ram_tipo || ''} onChange={(e) => setDetalle({ ram_tipo: e.target.value })} /></Field>
                    <Field label={t('com.ramFrecuencia')}><input className={inputCls} value={detalle.ram_frecuencia || ''} onChange={(e) => setDetalle({ ram_frecuencia: e.target.value })} /></Field>
                    <Field label={t('com.discoCapacidad')}><input className={inputCls} value={detalle.disco_capacidad || ''} onChange={(e) => setDetalle({ disco_capacidad: e.target.value })} /></Field>
                    <Field label={t('com.tipoAlmacenamiento')}>
                      <select className={inputCls} value={detalle.tipo_almacenamiento || ''} onChange={(e) => setDetalle({ tipo_almacenamiento: e.target.value })}>
                        <option value="">—</option>
                        {TIPO_ALMACENAMIENTO_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </Field>
                    <Field label={t('com.marcaDisco')}><input className={inputCls} value={detalle.marca_disco || ''} onChange={(e) => setDetalle({ marca_disco: e.target.value })} /></Field>
                    <Field label={t('com.serialDisco')}><input className={inputCls} value={detalle.serial_disco || ''} onChange={(e) => setDetalle({ serial_disco: e.target.value })} /></Field>
                    <Field label={t('com.tipoConector')}>
                      <select className={inputCls} value={detalle.tipo_conector || ''} onChange={(e) => setDetalle({ tipo_conector: e.target.value })}>
                        <option value="">—</option>
                        {TIPO_CONECTOR_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </Field>
                  </div>
                )}

                <div className="mb-2 mt-5 border-t border-line pt-5">
                  <span className="mb-2 block text-xs font-medium text-muted">{t('wizard.traeAccesorios')}</span>
                  <div className="grid grid-cols-2 gap-3 sm:max-w-xs sm:grid-cols-2">
                    {[[t('triEstado.si'), true], [t('triEstado.no'), false]].map(([txt, v]) => (
                      <button key={txt} type="button" onClick={() => set({ _traeAccesorios: v })} className={cardCls(orden._traeAccesorios === v)}>{txt}</button>
                    ))}
                  </div>
                  {orden._traeAccesorios && esCelular && (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[0, 1, 2, 3].map((i) => {
                        const lista = (orden.accesorios || '').split(',').map((s) => s.trim())
                        return (
                          <input key={i} className={inputCls} placeholder={t('campos.accesorioPlaceholder', { n: i + 1 })} value={lista[i] || ''}
                            onChange={(e) => { const l = [...lista]; l[i] = e.target.value; set({ accesorios: l.filter(Boolean).join(', ') }) }} />
                        )
                      })}
                    </div>
                  )}
                  {orden._traeAccesorios && !esCelular && (
                    <div className="mt-3 overflow-x-auto rounded-lg border border-line">
                      <table className="w-full text-sm">
                        <thead className="bg-subtle text-xs uppercase text-muted">
                          <tr>
                            <th className="px-3 py-2 text-left">{t('com.accesorioNombre')}</th>
                            <th className="px-3 py-2 text-left">{t('com.accesorioEstado')}</th>
                            <th className="px-3 py-2 text-left">{t('com.accesorioSerial')}</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detalle.accesorios_detalle && detalle.accesorios_detalle.length > 0 ? detalle.accesorios_detalle : [{ nombre: '', estado: '', serial: '' }]).map((a, i) => {
                            const filas = detalle.accesorios_detalle && detalle.accesorios_detalle.length > 0 ? detalle.accesorios_detalle : []
                            const actualizarFila = (patch) => {
                              const arr = filas.length > 0 ? [...filas] : [{ nombre: '', estado: '', serial: '' }]
                              arr[i] = { ...arr[i], ...patch }
                              setDetalle({ accesorios_detalle: arr })
                            }
                            return (
                              <tr key={i} className="border-t border-line">
                                <td className="px-3 py-2"><input className={inputCls} placeholder={t('com.accesorioNombrePlaceholder')} value={a.nombre || ''} onChange={(e) => actualizarFila({ nombre: e.target.value })} /></td>
                                <td className="px-3 py-2"><input className={inputCls} placeholder={t('com.accesorioEstadoPlaceholder')} value={a.estado || ''} onChange={(e) => actualizarFila({ estado: e.target.value })} /></td>
                                <td className="px-3 py-2"><input className={inputCls} placeholder={t('com.accesorioSerialPlaceholder')} value={a.serial || ''} onChange={(e) => actualizarFila({ serial: e.target.value })} /></td>
                                <td className="px-3 py-2">{filas.length > 0 && <button type="button" onClick={() => setDetalle({ accesorios_detalle: filas.filter((_, idx) => idx !== i) })} className="text-red-500 hover:underline">✕</button>}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      <button type="button" onClick={() => setDetalle({ accesorios_detalle: [...(detalle.accesorios_detalle || []), { nombre: '', estado: '', serial: '' }] })}
                        className="w-full border-t border-line px-3 py-2 text-left text-xs font-semibold text-brand hover:bg-tint">+ {t('botones.agregarFila')}</button>
                    </div>
                  )}
                </div>

                <div className="mb-5 rounded-lg border border-line bg-subtle p-4 text-xs leading-relaxed text-muted">
                  <strong className="mb-1 block text-ink">{t('com.infoDiagnosticoTitulo')}</strong>
                  {t('com.infoDiagnosticoTexto')}
                </div>

                <div className="mt-5">
                  <Field label={t('wizard.notasIngreso')}>
                    <textarea rows={3} className={inputCls} value={orden.comentarios || ''} onChange={(e) => set({ comentarios: e.target.value })} />
                  </Field>
                </div>
              </div>

              <div className="flex justify-between">
                <Atras onClick={() => setPaso(1)} />
                <Siguiente onClick={() => setPaso(3)} />
              </div>
            </div>
          )}

          {paso === 3 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink">{t('wizard.estadoFisico')}</h2>

                <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t('campos.contrasena')}>
                    <input className={inputCls} value={orden.contrasena_equipo || ''} disabled={!!orden.sin_contrasena}
                      onChange={(e) => set({ contrasena_equipo: e.target.value })} />
                  </Field>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-sm text-muted">
                      <input type="checkbox" checked={!!orden.sin_contrasena}
                        onChange={(e) => set({ sin_contrasena: e.target.checked, contrasena_equipo: e.target.checked ? '' : orden.contrasena_equipo })} />
                      <Lock size={13} /> {t('campos.sinContrasena')}
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

                <div className="mb-5">
                  <label className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                    <input type="checkbox" checked={!!orden.equipo_apagado_recepcion}
                      onChange={(e) => set({ equipo_apagado_recepcion: e.target.checked })} />
                    {t('campos.equipoVinoApagado')}
                  </label>
                  <span className="mb-2 block text-xs font-semibold uppercase text-muted">{t('subtitulos.checklistEntrada')}</span>
                  <div className={`grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 ${orden.equipo_apagado_recepcion ? 'pointer-events-none opacity-40' : ''}`}>
                    {checklistEntradaItems.map((item) => (
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

                <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                  {t('wizard.notaContrasenaImportante')}
                </div>

                <div className="mb-5">
                  <Field label={t('campos.fallaReportada')}>
                    <textarea rows={3} className={inputCls} value={orden.problema_reportado || ''} onChange={(e) => set({ problema_reportado: e.target.value })} />
                  </Field>
                </div>
                <div className="mb-5">
                  <Field label={t('campos.instruccionesAsesor')}>
                    <textarea rows={3} className={inputCls} placeholder={t('campos.instruccionesAsesorPlaceholder')}
                      value={orden.instrucciones_asesor || ''} onChange={(e) => set({ instrucciones_asesor: e.target.value })} />
                  </Field>
                </div>
                <div className="mb-5">
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input type="checkbox" checked={!!orden.necesita_repuestos} onChange={(e) => set({ necesita_repuestos: e.target.checked })} />
                    {t('campos.necesitaRepuestos')}
                  </label>
                  {orden.necesita_repuestos && (
                    <label className="mt-1 flex items-center gap-2 text-sm text-muted">
                      <input type="checkbox" checked={!!orden.repuesto_inmediato} onChange={(e) => set({ repuesto_inmediato: e.target.checked })} />
                      {t('campos.repuestoInmediato')}
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-2">
                  <Field label={t('wizard.tecnicoAsignado')}>
                    <select className={inputCls} value={orden.tecnico || ''} onChange={(e) => set({ tecnico: e.target.value })}>
                      <option value="">{t('wizard.sinAsignar')}</option>
                      {tecnicos.map((tc) => <option key={tc.id} value={tc.id}>{tc.nombre}</option>)}
                    </select>
                  </Field>
                  <Field label={t('wizard.asesorAsignado')}>
                    <select className={inputCls} value={orden.asesor || ''} onChange={(e) => set({ asesor: e.target.value })}>
                      <option value="">{t('wizard.sinAsignar')}</option>
                      {asesores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              <div className="flex justify-between">
                <Atras onClick={() => setPaso(2)} />
                <button type="button" onClick={registrarOrden} disabled={guardando}
                  className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {guardando ? t('botones.guardando', { ns: 'common' }) : t('wizard.registrarOrden')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {reciboFactura && <ReciboPreview factura={reciboFactura} onClose={() => { setReciboFactura(null); navigate('/taller') }} />}
      {pdfOrden && (
        <OrdenPreview orden={pdfOrden.orden} cliente={pdfOrden.cliente} empresaNombre={pdfOrden.empresaNombre}
          onClose={() => { setPdfOrden(null); navigate('/taller') }} />
      )}

      {eligiendoImpresion && (
        <div className="modal-backdrop" onClick={() => { setEligiendoImpresion(null); navigate('/taller') }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3 className="mb-1 text-base font-semibold text-ink">{t('modal.eligeImpresionTitulo', { ns: 'facturarOts' })}</h3>
            <p className="mb-4 text-sm text-muted">{t('modal.eligeImpresionTexto', { ns: 'facturarOts' })}</p>
            <div className="mb-2 flex flex-col gap-2">
              <button onClick={elegirImprimirPdf} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                {t('modal.imprimirPdf', { ns: 'facturarOts' })}
              </button>
              <button onClick={elegirImprimirTicket} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-subtle">
                {t('modal.imprimirTicket', { ns: 'facturarOts' })}
              </button>
              <button onClick={() => { setEligiendoImpresion(null); navigate('/taller') }} className="rounded-lg px-4 py-2 text-sm text-muted hover:underline">
                {t('modal.omitirImpresion', { ns: 'facturarOts' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NuevaOrden
