import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ventasApi, tallerApi } from '../api.js'
import { capitalizarTexto } from '../textUtils.js'
import Pagination from '../components/Pagination.jsx'
import '../orden-tailwind.css'

const PAGE_SIZE = 15

const emptyEmpresa = {
  nombre: '', ruc: '', telefono: '', direccion: '', email: '',
  contacto_nombre: '', contacto_puesto: '', contacto_email: '', contacto_telefono: '',
}

function Clientes() {
  const { t } = useTranslation('clientes')
  const navigate = useNavigate()
  const [vista, setVista] = useState('clientes')

  const [clientes, setClientes] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')

  const [empresaSel, setEmpresaSel] = useState(null)
  const [empresaFormPanel, setEmpresaFormPanel] = useState(emptyEmpresa)
  const [empresaNuevoPanel, setEmpresaNuevoPanel] = useState(false)
  const [paginaClientes, setPaginaClientes] = useState(1)
  const [paginaEmpresas, setPaginaEmpresas] = useState(1)

  const cargar = () => {
    setLoading(true)
    Promise.all([ventasApi.clientes(), tallerApi.ordenes(), ventasApi.empresas()])
      .then(([c, o, e]) => { setClientes(c.data); setOrdenes(o.data); setEmpresas(e.data) })
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const eliminar = (id) => {
    ventasApi.eliminarCliente(id).then(cargar)
  }

  const visiblesTotal = buscar
    ? clientes.filter((c) => [c.nombre, c.telefono, c.email, c.cedula].filter(Boolean).some((v) => v.toLowerCase().includes(buscar.toLowerCase())))
    : clientes
  useEffect(() => { setPaginaClientes(1) }, [buscar])
  const visibles = visiblesTotal.slice((paginaClientes - 1) * PAGE_SIZE, paginaClientes * PAGE_SIZE)

  const ordenesDe = (clienteId) => ordenes.filter((o) => o.cliente === clienteId)

  const esFrecuente = (c) => c.frecuente === true

  // --- Empresas ---
  const abrirEmpresa = (emp) => { setEmpresaSel(emp); setEmpresaFormPanel(emp); setEmpresaNuevoPanel(false) }
  const abrirEmpresaNueva = () => { setEmpresaSel(null); setEmpresaFormPanel(emptyEmpresa); setEmpresaNuevoPanel(true) }
  const guardarEmpresaPanel = async (e) => {
    e.preventDefault()
    if (!empresaFormPanel.nombre.trim()) return
    const payload = { ...empresaFormPanel, nombre: capitalizarTexto(empresaFormPanel.nombre.trim()) }
    if (empresaNuevoPanel) await ventasApi.crearEmpresa(payload)
    else await ventasApi.actualizarEmpresa(empresaSel.id, payload)
    setEmpresaSel(null); setEmpresaNuevoPanel(false); setEmpresaFormPanel(emptyEmpresa)
    cargar()
  }
  const eliminarEmpresa = (id) => ventasApi.eliminarEmpresa(id).then(cargar)

  return (
    <div className="orden-tw">
      <div className="min-h-screen bg-canvas p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-ink">{t('titulo')}</h1>
            <p className="text-sm text-muted">{t('subtitulo')}</p>
          </div>
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-line bg-surface p-0.5 text-sm">
              <button onClick={() => setVista('clientes')} className={`rounded-md px-3 py-1.5 font-medium ${vista === 'clientes' ? 'bg-brand text-white' : 'text-muted'}`}>{t('tabs.clientes')}</button>
              <button onClick={() => setVista('empresas')} className={`rounded-md px-3 py-1.5 font-medium ${vista === 'empresas' ? 'bg-brand text-white' : 'text-muted'}`}>{t('tabs.empresas')}</button>
            </div>
            {vista === 'clientes' && <button onClick={() => navigate('/clientes/nuevo')} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">{t('botonNuevo')}</button>}
            {vista === 'empresas' && <button onClick={abrirEmpresaNueva} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">{t('botonNuevaEmpresa')}</button>}
          </div>
        </div>

        {vista === 'clientes' && (
          <>
            <input
              value={buscar} onChange={(e) => setBuscar(e.target.value)}
              placeholder={t('buscarPlaceholder')}
              className="mb-4 w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />

            <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
              {loading && <div className="p-8 text-center text-muted">{t('mensajes.cargando', { ns: 'common' })}</div>}
              {!loading && visibles.length === 0 && <div className="p-8 text-center text-muted">{t('sinResultados')}</div>}
              {!loading && visibles.length > 0 && (
                <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead className="bg-subtle text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3 text-left">{t('tabla.nombre')}</th>
                      <th className="px-4 py-3 text-left">{t('tabla.telefono')}</th>
                      <th className="px-4 py-3 text-left">{t('tabla.correo')}</th>
                      <th className="px-4 py-3 text-left">{t('tabla.ordenes')}</th>
                      <th className="px-4 py-3 text-left">{t('tabla.frecuente')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((c) => (
                      <tr key={c.id} className="cursor-pointer border-t border-line hover:bg-tint" onClick={() => navigate(`/clientes/${c.id}`)}>
                        <td className="px-4 py-3 font-medium text-ink">
                          {c.es_problematico && <span title={c.motivo_problematico || t('banderaRoja.avisoTitulo')} className="mr-1.5">🚩</span>}
                          {c.nombre}
                        </td>
                        <td className="px-4 py-3 text-muted">{c.telefono || '—'}</td>
                        <td className="px-4 py-3 text-muted">{c.email || '—'}</td>
                        <td className="px-4 py-3 text-muted">{ordenesDe(c.id).length}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${esFrecuente(c) ? 'bg-emerald-500' : 'bg-red-400'}`} title={esFrecuente(c) ? t('frecuenteSi') : t('frecuenteNo')} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={(e) => { e.stopPropagation(); eliminar(c.id) }} className="text-red-500 hover:underline">{t('botones.eliminar', { ns: 'common' })}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
              {!loading && visiblesTotal.length > 0 && (
                <div className="px-4 py-2">
                  <Pagination page={paginaClientes} totalItems={visiblesTotal.length} pageSize={PAGE_SIZE} onPageChange={setPaginaClientes} />
                </div>
              )}
            </div>
          </>
        )}

        {vista === 'empresas' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card lg:col-span-2">
              {loading && <div className="p-8 text-center text-muted">{t('mensajes.cargando', { ns: 'common' })}</div>}
              {!loading && empresas.length === 0 && <div className="p-8 text-center text-muted">{t('empresas.sinResultados')}</div>}
              {!loading && empresas.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="bg-subtle text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3 text-left">{t('empresas.tabla.nombre')}</th>
                      <th className="px-4 py-3 text-left">{t('empresas.tabla.ruc')}</th>
                      <th className="px-4 py-3 text-left">{t('empresas.tabla.contactos')}</th>
                      <th className="px-4 py-3 text-left">{t('empresas.tabla.equipos')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {empresas.slice((paginaEmpresas - 1) * PAGE_SIZE, paginaEmpresas * PAGE_SIZE).map((emp) => (
                      <tr key={emp.id} className={`cursor-pointer border-t border-line hover:bg-tint ${empresaSel?.id === emp.id ? 'bg-tint' : ''}`} onClick={() => abrirEmpresa(emp)}>
                        <td className="px-4 py-3 font-medium text-ink">{emp.nombre}</td>
                        <td className="px-4 py-3 text-muted">{emp.ruc || '—'}</td>
                        <td className="px-4 py-3 text-muted">{emp.cantidad_contactos}</td>
                        <td className="px-4 py-3 text-muted">{emp.cantidad_equipos}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={(e) => { e.stopPropagation(); eliminarEmpresa(emp.id) }} className="text-red-500 hover:underline">{t('botones.eliminar', { ns: 'common' })}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!loading && empresas.length > 0 && (
                <div className="px-4 py-2">
                  <Pagination page={paginaEmpresas} totalItems={empresas.length} pageSize={PAGE_SIZE} onPageChange={setPaginaEmpresas} />
                </div>
              )}
            </div>

            <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
              {(empresaSel || empresaNuevoPanel) ? (
                <>
                  <h3 className="mb-3 text-sm font-bold text-ink">{empresaNuevoPanel ? t('empresas.tituloNuevo') : t('empresas.tituloEditar')}</h3>
                  <form onSubmit={guardarEmpresaPanel} className="space-y-3">
                    <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('empresas.form.nombre')} value={empresaFormPanel.nombre} onChange={(e) => setEmpresaFormPanel({ ...empresaFormPanel, nombre: e.target.value })} onBlur={(e) => setEmpresaFormPanel((p) => ({ ...p, nombre: capitalizarTexto(e.target.value) }))} />
                    <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('empresas.form.ruc')} value={empresaFormPanel.ruc || ''} onChange={(e) => setEmpresaFormPanel({ ...empresaFormPanel, ruc: e.target.value })} />
                    <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('empresas.form.telefono')} value={empresaFormPanel.telefono || ''} onChange={(e) => setEmpresaFormPanel({ ...empresaFormPanel, telefono: e.target.value })} />
                    <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('empresas.form.correo')} value={empresaFormPanel.email || ''} onChange={(e) => setEmpresaFormPanel({ ...empresaFormPanel, email: e.target.value })} />
                    <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('empresas.form.direccion')} value={empresaFormPanel.direccion || ''} onChange={(e) => setEmpresaFormPanel({ ...empresaFormPanel, direccion: e.target.value })} />

                    <p className="pt-1 text-xs font-semibold uppercase text-muted">{t('empresas.form.contactoTitulo')}</p>
                    <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('empresas.form.contactoNombre')} value={empresaFormPanel.contacto_nombre || ''} onChange={(e) => setEmpresaFormPanel({ ...empresaFormPanel, contacto_nombre: e.target.value })} onBlur={(e) => setEmpresaFormPanel((p) => ({ ...p, contacto_nombre: capitalizarTexto(e.target.value) }))} />
                    <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('empresas.form.contactoPuesto')} value={empresaFormPanel.contacto_puesto || ''} onChange={(e) => setEmpresaFormPanel({ ...empresaFormPanel, contacto_puesto: e.target.value })} />
                    <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('empresas.form.contactoCorreo')} value={empresaFormPanel.contacto_email || ''} onChange={(e) => setEmpresaFormPanel({ ...empresaFormPanel, contacto_email: e.target.value })} />
                    <input className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink" placeholder={t('empresas.form.contactoTelefono')} value={empresaFormPanel.contacto_telefono || ''} onChange={(e) => setEmpresaFormPanel({ ...empresaFormPanel, contacto_telefono: e.target.value })} />

                    <div className="flex gap-2 pt-2">
                      <button type="submit" className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">{t('botones.guardar', { ns: 'common' })}</button>
                      <button type="button" onClick={() => { setEmpresaSel(null); setEmpresaNuevoPanel(false) }} className="rounded-lg border border-line px-4 py-2 text-sm text-muted">{t('botones.cancelar', { ns: 'common' })}</button>
                    </div>
                  </form>

                  {empresaSel && !empresaNuevoPanel && (
                    <div className="mt-5 border-t border-line pt-4">
                      <h4 className="mb-2 text-xs font-semibold uppercase text-muted">{t('empresas.contactosTitulo')}</h4>
                      {clientes.filter((c) => c.empresa === empresaSel.id).length === 0 && <p className="text-sm text-muted">{t('empresas.sinContactos')}</p>}
                      <ul className="space-y-1 text-sm text-ink">
                        {clientes.filter((c) => c.empresa === empresaSel.id).map((c) => (
                          <li key={c.id}>{c.nombre} {c.telefono && `— ${c.telefono}`}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : <p className="text-sm text-muted">{t('empresas.seleccionaEmpresa')}</p>}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

export default Clientes
