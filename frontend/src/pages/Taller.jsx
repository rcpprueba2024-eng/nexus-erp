import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Camera, X } from 'lucide-react'
import { tallerApi, rrhhApi, inventarioApi, MEDIA_BASE_URL } from '../api.js'
import { esCCA, tipoOrden, checklistSalidaPara, estadoSimplificado } from '../ordenTipo.js'
import Avatar from '../components/Avatar.jsx'
import { useAuth, esRolSinAccesoCliente } from '../AuthContext.jsx'
import Pagination from '../components/Pagination.jsx'

const PAGE_SIZE = 15
const MAX_FOTOS_DIAGNOSTICO = 100
const emptyInsumo = { orden: '', producto: '', cantidad: 1 }
const ESTADO_SIMPLE_COLOR = { EN_ESPERA: 'off', EN_PROCESO: 'pending', TERMINADO: 'ok' }

// Estados que ya no cuentan como "carga de trabajo" del técnico: una vez
// reparado (LISTO_ENTREGA) el trabajo del técnico terminó — lo que sigue
// (que el cliente lo retire, o que se abandone) ya es responsabilidad de
// Equipos Listos / Equipos en Abandono, no del técnico. Antes el equipo
// seguía "pegado" al técnico en su tablero aunque llevara semanas listo.
const ESTADOS_FUERA_DEL_TECNICO = ['ENTREGADO', 'CANCELADO', 'LISTO_ENTREGA', 'ABANDONADO']

function TableroTecnicos({ personal, ordenes, onSubirFoto, t }) {
  // Antes cada tarjeta mostraba de una vez la lista completa de órdenes del
  // técnico — con alguien con 20+ equipos, su tarjeta se disparaba en altura
  // muy por encima de las demás y la cuadrícula se veía despareja, y esa
  // lista no traía ni el motivo del ingreso ni las instrucciones del asesor.
  // Ahora las tarjetas solo muestran el resumen (conteos); tocar una tarjeta
  // lleva a una vista aparte (TecnicoDetalle) con el detalle completo.
  const navigate = useNavigate()
  const ordenesActivas = ordenes.filter((o) => !ESTADOS_FUERA_DEL_TECNICO.includes(o.estado))

  return (
    <div className="card">
      <h3>{t('tablero.titulo')}</h3>
      {personal.length === 0 && <div className="empty">{t('tablero.sinPersonal')}</div>}
      <div className="tablero-tecnicos">
        {personal.map((p) => {
          const suyas = ordenesActivas.filter((o) => o.tecnico === p.id)
          const enEspera = suyas.filter((o) => estadoSimplificado(o.estado) === 'EN_ESPERA').length
          const enProceso = suyas.filter((o) => estadoSimplificado(o.estado) === 'EN_PROCESO').length
          const irADetalle = () => navigate(`/taller/tecnico/${p.id}`)
          return (
            <div
              key={p.id}
              className="tecnico-card"
              role="button"
              tabIndex={0}
              onClick={irADetalle}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irADetalle() } }}
            >
              <div className="tecnico-card-header">
                {/* stopPropagation: cambiar la foto no debe también seleccionar/deseleccionar la tarjeta */}
                <span onClick={(e) => e.stopPropagation()}>
                  <Avatar nombre={p.nombre} foto={p.foto} color={p.avatar_color} size={48} editable onSubirFoto={(file) => onSubirFoto(p.id, file)} />
                </span>
                <div className="tecnico-card-info">
                  <div className="tecnico-card-nombre">{p.nombre}</div>
                  <div className="tecnico-card-rol">{(p.areas || []).map((a) => t(`roles.${a}`, { ns: 'common', defaultValue: a })).join(' · ')}</div>
                </div>
                <span className="badge pending tecnico-card-badge">{t('tablero.equiposCount', { n: suyas.length })}</span>
              </div>
              <div className="tecnico-card-resumen">
                <span className={`badge ${ESTADO_SIMPLE_COLOR.EN_ESPERA}`}>{t('tablero.estados.EN_ESPERA')} ({enEspera})</span>
                <span className={`badge ${ESTADO_SIMPLE_COLOR.EN_PROCESO}`}>{t('tablero.estados.EN_PROCESO')} ({enProceso})</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Taller() {
  const { t } = useTranslation('taller')
  const { user } = useAuth()
  const sinCliente = esRolSinAccesoCliente(user?.rol)
  const [ordenes, setOrdenes] = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [insumosDisp, setInsumosDisp] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [pagina, setPagina] = useState(1)
  const [insumoForm, setInsumoForm] = useState(emptyInsumo)
  const [seleccionada, setSeleccionada] = useState(null)
  const [checklistSalida, setChecklistSalida] = useState({})
  // Un equipo puede acumular varios diagnósticos en el tiempo (no se
  // sobrescribe el anterior) — cada uno con sus propias fotos, hasta
  // MAX_FOTOS_DIAGNOSTICO por diagnóstico.
  const [nuevoDiagnosticoTexto, setNuevoDiagnosticoTexto] = useState('')
  const [nuevoDiagnosticoFotos, setNuevoDiagnosticoFotos] = useState([])
  const [agregandoDiagnostico, setAgregandoDiagnostico] = useState(false)

  // "Entregado" ya no aparece aquí: una vez el equipo está reparado, la
  // entrega y el cobro los maneja Ventas (ver Equipos Listos) — Taller no
  // debe poder marcar ni filtrar por esa transición.
  const ESTADOS = [
    { value: '', label: t('filtro.todas') },
    { value: 'RECIBIDO', label: t('estadosOrden.RECIBIDO', { ns: 'common' }) },
    { value: 'EN_REPARACION', label: t('estadosOrden.EN_REPARACION', { ns: 'common' }) },
    { value: 'IMPORTACION', label: t('estadosOrden.IMPORTACION', { ns: 'common' }) },
    { value: 'LISTO_ENTREGA', label: t('estadosOrden.LISTO_ENTREGA', { ns: 'common' }) },
  ]

  const load = () => {
    setLoading(true)
    Promise.all([
      tallerApi.ordenes(),
      rrhhApi.empleados(),
      inventarioApi.productos(),
    ])
      .then(([o, t, p]) => {
        setOrdenes(o.data)
        setTecnicos(t.data.filter((e) => (e.areas || []).some((a) => a === 'TALLER' || a === 'PASANTE')))
        setInsumosDisp(p.data.filter((x) => x.subgrupo === 'INSUMO_TALLER'))
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleSubirFoto = (empleadoId, file) => {
    rrhhApi.subirFotoEmpleado(empleadoId, file).then(load)
  }

  const handleEstado = (orden, estado) => {
    tallerApi.actualizarOrden(orden.id, { estado }).then(load)
  }

  const handleTecnico = (orden, tecnico) => {
    tallerApi.actualizarOrden(orden.id, { tecnico: tecnico || null }).then(load)
  }

  const handleInsumoSubmit = (e) => {
    e.preventDefault()
    if (!insumoForm.orden || !insumoForm.producto) return
    tallerApi.crearInsumo(insumoForm).then(() => {
      setInsumoForm(emptyInsumo)
      load()
    })
  }

  const abrirFicha = (orden) => {
    setSeleccionada(orden)
    setChecklistSalida(orden.checklist_salida || {})
    setNuevoDiagnosticoTexto('')
    setNuevoDiagnosticoFotos([])
  }

  const guardarChecklistSalida = () => {
    tallerApi.actualizarOrden(seleccionada.id, { checklist_salida: checklistSalida }).then(() => {
      load()
      setSeleccionada(null)
    })
  }

  const elegirFotosDiagnostico = (e) => {
    const elegidas = Array.from(e.target.files || [])
    // Tope de 100 por diagnóstico — si eligen más, se quedan las primeras
    // 100 en vez de rechazar todo el intento.
    setNuevoDiagnosticoFotos((prev) => [...prev, ...elegidas].slice(0, MAX_FOTOS_DIAGNOSTICO))
    e.target.value = ''
  }

  const quitarFotoPendiente = (idx) => {
    setNuevoDiagnosticoFotos((prev) => prev.filter((_, i) => i !== idx))
  }

  // Un diagnóstico nuevo se agrega aparte, sin tocar los que ya existían —
  // sus fotos (si eligió alguna) se suben una por una ligadas a ese
  // diagnóstico en particular, no sueltas en la orden.
  const agregarDiagnostico = async () => {
    if (!nuevoDiagnosticoTexto.trim()) return
    setAgregandoDiagnostico(true)
    try {
      const res = await tallerApi.crearDiagnostico(seleccionada.id, nuevoDiagnosticoTexto.trim())
      const diagnosticoId = res.data.id
      for (const file of nuevoDiagnosticoFotos) {
        await tallerApi.subirFoto(seleccionada.id, 'DIAGNOSTICO', file, diagnosticoId)
      }
      const actualizada = await tallerApi.orden(seleccionada.id)
      setSeleccionada(actualizada.data)
      setNuevoDiagnosticoTexto('')
      setNuevoDiagnosticoFotos([])
      load()
    } finally {
      setAgregandoDiagnostico(false)
    }
  }

  const handleEliminarFoto = (fotoId) => {
    tallerApi.eliminarFoto(fotoId).then(() => tallerApi.orden(seleccionada.id)).then((r) => { setSeleccionada(r.data); load() })
  }

  const BADGE_POR_ESTADO = {
    ENTREGADO: 'ok', LISTO_ENTREGA: 'ok', EN_REPARACION: 'pending',
    IMPORTACION: 'pending', RECIBIDO: 'off',
  }
  const estadoBadge = (estado) => (
    <span className={`badge ${BADGE_POR_ESTADO[estado] || 'off'}`}>{t(`estadosOrden.${estado}`, { ns: 'common', defaultValue: estado })}</span>
  )

  // Con meses/años de historial esto puede ser miles de filas — en vez de
  // cortar a las N más recientes sin forma de ver el resto, se pagina de a
  // 15 (igual que el resto del sistema); el conteo de las pestañas de
  // arriba sigue contando todo, no solo la página visible.
  const visiblesTotal = filtro ? ordenes.filter((o) => o.estado === filtro) : ordenes
  const visibles = visiblesTotal.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)

  useEffect(() => { setPagina(1) }, [filtro])

  const esCelularSeleccionada = seleccionada ? esCCA(seleccionada.categoria_equipo) : false
  const checklistItemsSeleccionada = seleccionada ? checklistSalidaPara(seleccionada.categoria_equipo) : []
  const checklistNsSeleccionada = esCelularSeleccionada ? 'ordenes' : 'checklist'
  const checklistPrefixSeleccionada = esCelularSeleccionada ? 'checklistSalida' : 'items'

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      <TableroTecnicos personal={tecnicos} ordenes={ordenes} onSubirFoto={handleSubirFoto} t={t} />

      <div className="card">
        <h3>{t('insumo.titulo')}</h3>
        <form onSubmit={handleInsumoSubmit}>
          <div className="form-row">
            <select value={insumoForm.orden} onChange={(e) => setInsumoForm({ ...insumoForm, orden: e.target.value })}>
              <option value="">{t('insumo.ordenDefault')}</option>
              {ordenes.map((o) => <option key={o.id} value={o.id}>{o.numero} — {o.equipo}</option>)}
            </select>
            <select value={insumoForm.producto} onChange={(e) => setInsumoForm({ ...insumoForm, producto: e.target.value })}>
              <option value="">{t('insumo.insumoDefault')}</option>
              {insumosDisp.map((p) => <option key={p.id} value={p.id}>{p.nombre} {t('insumo.stock', { stock: p.stock_actual })}</option>)}
            </select>
            <input type="number" min="1" placeholder={t('insumo.cantidad')} value={insumoForm.cantidad} onChange={(e) => setInsumoForm({ ...insumoForm, cantidad: e.target.value })} />
            <button type="submit">{t('insumo.registrar')}</button>
          </div>
        </form>
      </div>

      <div className="tabs">
        {ESTADOS.map((s) => (
          <button key={s.value || 'todas'} className={filtro === s.value ? 'tab active' : 'tab'} onClick={() => setFiltro(s.value)}>
            {s.label} {s.value && `(${ordenes.filter((o) => o.estado === s.value).length})`}
          </button>
        ))}
      </div>

      <div className="card">
        {loading && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
        {!loading && visibles.length === 0 && <div className="empty">{t('vacio')}</div>}
        {!loading && visibles.length > 0 && (
          <table>
            <thead><tr><th>{t('tabla.numero')}</th>{!sinCliente && <th>{t('tabla.cliente')}</th>}{!sinCliente && <th>{t('tabla.asesor')}</th>}<th>{t('tabla.equipo')}</th><th>{t('tabla.tecnico')}</th><th>{t('tabla.ingreso')}</th><th>{t('tabla.estado')}</th><th>{t('tabla.asignar')}</th><th>{t('tabla.cambiarEstado')}</th></tr></thead>
            <tbody>
              {visibles.map((o) => (
                <tr key={o.id}>
                  <td><button className="detail-link" onClick={() => abrirFicha(o)}>{o.numero}</button></td>
                  {!sinCliente && <td>{o.cliente_nombre}</td>}
                  {!sinCliente && <td>{o.asesor_nombre || '—'}</td>}
                  <td>{o.equipo}</td>
                  <td>{o.tecnico_nombre || '—'}</td>
                  <td>{o.fecha_ingreso}</td>
                  <td>{estadoBadge(o.estado)}</td>
                  <td>
                    <select value={o.tecnico || ''} onChange={(e) => handleTecnico(o, e.target.value)}>
                      <option value="">{t('tabla.sinAsignar')}</option>
                      {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre} ({t.ordenes_activas_count ?? 0})</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={o.estado} onChange={(e) => handleEstado(o, e.target.value)}>
                      {ESTADOS.filter((s) => s.value).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && visiblesTotal.length > 0 && (
          <Pagination page={pagina} totalItems={visiblesTotal.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />
        )}
      </div>

      {seleccionada && (
        <div className="modal-backdrop" onClick={() => setSeleccionada(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h2>{seleccionada.numero}</h2>
            <p style={{ color: 'var(--text)', marginBottom: 16 }}>
              <strong>{tipoOrden(seleccionada.categoria_equipo)}</strong>
              {' · '}{t(`categoriaEquipo.${seleccionada.categoria_equipo}`, { ns: 'common', defaultValue: seleccionada.categoria_equipo })} — {seleccionada.equipo}
              {seleccionada.tipo_servicio && ` · ${t(`servicios.${seleccionada.tipo_servicio}`, { defaultValue: seleccionada.tipo_servicio_display })}`}
            </p>

            {'cliente_nombre' in seleccionada && (
              <table style={{ marginBottom: 14 }}>
                <tbody>
                  <tr><td><strong>{t('ficha.cliente')}</strong></td><td>{seleccionada.cliente_nombre}</td></tr>
                  <tr><td><strong>{t('ficha.asesorAsignado')}</strong></td><td>{seleccionada.asesor_nombre || '—'}</td></tr>
                  {seleccionada.vendedor_nombre && <tr><td><strong>{t('ficha.recibidoPor')}</strong></td><td>{seleccionada.vendedor_nombre}</td></tr>}
                  {seleccionada.costo_estimado !== undefined && <tr><td><strong>{t('ficha.valor')}</strong></td><td>${Number(seleccionada.costo_estimado).toLocaleString()}</td></tr>}
                  {seleccionada.adelanto !== undefined && <tr><td><strong>{t('ficha.adelanto')}</strong></td><td>${Number(seleccionada.adelanto).toLocaleString()}</td></tr>}
                </tbody>
              </table>
            )}

            <table style={{ marginBottom: 14 }}>
              <tbody>
                {seleccionada.fecha_hora_recepcion && <tr><td><strong>{t('ficha.fechaHoraRecepcion')}</strong></td><td>{new Date(seleccionada.fecha_hora_recepcion).toLocaleString()}</td></tr>}
                {seleccionada.tiempo_reparacion_estimado && <tr><td><strong>{t('ficha.tiempoReparacionEstimado')}</strong></td><td>{seleccionada.tiempo_reparacion_estimado}</td></tr>}
                <tr><td><strong>{t('ficha.marcaModelo')}</strong></td><td>{seleccionada.marca || '—'} {seleccionada.modelo || ''}</td></tr>
                <tr><td><strong>{t('ficha.color')}</strong></td><td>{seleccionada.color || '—'}</td></tr>
                {esCelularSeleccionada ? (
                  <tr><td><strong>{t('ficha.imei')}</strong></td><td>{seleccionada.imei1 || '—'} {seleccionada.imei2 || ''}</td></tr>
                ) : (
                  <tr><td><strong>{t('ficha.numeroSerie')}</strong></td><td>{seleccionada.no_serie || '—'}</td></tr>
                )}
                <tr><td><strong>{t('ficha.accesorios')}</strong></td><td>{seleccionada.accesorios || '—'}</td></tr>
                <tr><td><strong>{t('ficha.contrasenaEquipo')}</strong></td><td>{seleccionada.contrasena_equipo || '—'}</td></tr>
                {!esCelularSeleccionada && <tr><td><strong>{t('ficha.especificaciones')}</strong></td><td>{seleccionada.especificaciones?.notas || '—'}</td></tr>}
                <tr><td><strong>{t('ficha.fallaReportada')}</strong></td><td>{seleccionada.problema_reportado || '—'}</td></tr>
              </tbody>
            </table>

            <div style={{ marginBottom: 16 }}>
              <strong>{t('ficha.diagnosticoTitulo')}</strong>

              {(seleccionada.diagnosticos || []).length === 0 ? (
                <p style={{ color: 'var(--text)', fontSize: 13, marginTop: 6 }}>{t('ficha.diagnosticoVacio')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  {seleccionada.diagnosticos.map((d) => (
                    <div key={d.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4 }}>
                        {new Date(d.creado_en).toLocaleString()}{d.tecnico_nombre ? ` · ${d.tecnico_nombre}` : ''}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{d.texto}</div>
                      {(d.fotos || []).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                          {d.fotos.map((f) => (
                            <div key={f.id} style={{ position: 'relative' }}>
                              <img src={f.imagen.startsWith('http') ? f.imagen : `${MEDIA_BASE_URL}${f.imagen}`} alt=""
                                style={{ width: 64, height: 64, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }} />
                              <button type="button" onClick={() => handleEliminarFoto(f.id)}
                                style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                className="danger" title={t('botones.eliminar', { ns: 'common' })}>
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
                <textarea rows={3} style={{ width: '100%' }} placeholder={t('ficha.diagnosticoPlaceholder')}
                  value={nuevoDiagnosticoTexto} onChange={(e) => setNuevoDiagnosticoTexto(e.target.value)} />

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                  {nuevoDiagnosticoFotos.map((file, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img src={URL.createObjectURL(file)} alt=""
                        style={{ width: 64, height: 64, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }} />
                      <button type="button" onClick={() => quitarFotoPendiente(idx)}
                        style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        className="danger" title={t('botones.eliminar', { ns: 'common' })}>
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  {nuevoDiagnosticoFotos.length < MAX_FOTOS_DIAGNOSTICO && (
                    <label style={{ width: 64, height: 64, borderRadius: 6, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)' }}>
                      <Camera size={18} />
                      <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={elegirFotosDiagnostico} />
                    </label>
                  )}
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text)', opacity: 0.75, marginTop: 4 }}>
                  {t('ficha.diagnosticoFotosAyuda', { n: nuevoDiagnosticoFotos.length, max: MAX_FOTOS_DIAGNOSTICO })}
                </p>

                <button type="button" className="secondary" style={{ marginTop: 6 }} disabled={agregandoDiagnostico || !nuevoDiagnosticoTexto.trim()} onClick={agregarDiagnostico}>
                  {agregandoDiagnostico ? t('botones.guardando', { ns: 'common' }) : t('ficha.agregarDiagnostico')}
                </button>
              </div>
            </div>

            {seleccionada.checklist_entrada && Object.keys(seleccionada.checklist_entrada).length > 0 && (
              <>
                <strong>{t('ficha.checklistEntrada')}</strong>
                <div className="orden-checklist" style={{ margin: '8px 0 14px' }}>
                  {checklistItemsSeleccionada.filter((i) => i in seleccionada.checklist_entrada).map((item) => (
                    <div key={item} className={seleccionada.checklist_entrada[item] ? 'check-ok' : 'check-off'}>
                      {seleccionada.checklist_entrada[item] ? '✔' : '✘'} {t(`${checklistPrefixSeleccionada}.${item}`, { ns: checklistNsSeleccionada })}
                    </div>
                  ))}
                </div>
              </>
            )}

            <strong>{t('ficha.checklistSalida')}</strong>
            <div className="checklist-grid" style={{ margin: '8px 0 14px' }}>
              {checklistItemsSeleccionada.map((item) => (
                <label key={item} className="checklist-item">
                  <input type="checkbox" checked={!!checklistSalida[item]} onChange={() => setChecklistSalida((c) => ({ ...c, [item]: !c[item] }))} />
                  {t(`${checklistPrefixSeleccionada}.${item}`, { ns: checklistNsSeleccionada })}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={guardarChecklistSalida}>{t('ficha.guardarChecklistSalida')}</button>
              <button className="secondary" onClick={() => setSeleccionada(null)}>{t('botones.cerrar', { ns: 'common' })}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Taller
