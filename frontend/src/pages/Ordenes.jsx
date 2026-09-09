import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { tallerApi } from '../api.js'
import { tipoOrden } from '../ordenTipo.js'
import { useAuth, esRolSinAccesoCliente } from '../AuthContext.jsx'
import Pagination from '../components/Pagination.jsx'
import '../orden-tailwind.css'

const PAGE_SIZE = 15

const ESTADOS_COLOR = {
  RECIBIDO: 'bg-slate-200 text-slate-700',
  DIAGNOSTICO: 'bg-amber-100 text-amber-700',
  EN_REPARACION: 'bg-blue-100 text-blue-700',
  IMPORTACION: 'bg-cyan-100 text-cyan-700',
  LISTO_ENTREGA: 'bg-emerald-100 text-emerald-700',
  ENTREGADO: 'bg-emerald-600 text-white',
}

function Ordenes() {
  const { t } = useTranslation(['ordenes', 'common'])
  const navigate = useNavigate()
  const { user } = useAuth()
  const sinCliente = esRolSinAccesoCliente(user?.rol)
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [filtro, setFiltro] = useState('')
  const [pagina, setPagina] = useState(1)

  const ESTADOS = [
    { value: '', label: t('listado.filtroTodas') },
    ...Object.keys(ESTADOS_COLOR).map((value) => ({
      value,
      label: t(`estadosOrden.${value}`, { ns: 'common' }),
      color: ESTADOS_COLOR[value],
    })),
  ]

  const cargar = (q) => {
    setLoading(true)
    tallerApi.ordenes(q).then((r) => setOrdenes(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { cargar('') }, [])

  useEffect(() => {
    const timeout = setTimeout(() => cargar(buscar), 350)
    return () => clearTimeout(timeout)
  }, [buscar])

  // Al cambiar de filtro o busqueda, la ventana de la pagina anterior ya no
  // tiene sentido (podria quedar vacia) — se vuelve a la primera pagina.
  useEffect(() => { setPagina(1) }, [filtro, buscar])

  const visiblesTotal = filtro ? ordenes.filter((o) => o.estado === filtro) : ordenes
  const visibles = visiblesTotal.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)
  const estadoInfo = (v) => ESTADOS.find((e) => e.value === v) || ESTADOS[1]

  return (
    <div className="orden-tw min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{t('listado.titulo')}</h1>
            <p className="text-sm text-slate-500">{t('listado.subtitulo')}</p>
          </div>
          <div className="flex gap-2">
            {!sinCliente && <button onClick={() => tallerApi.exportarOrdenes()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">⬇ {t('botones.exportarExcel', { ns: 'common' })}</button>}
            {!sinCliente && <button onClick={() => navigate('/ordenes/nueva')} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">+ {t('botones.nuevaOrden')}</button>}
          </div>
        </div>

        <div className="mb-4">
          <input
            value={buscar} onChange={(e) => setBuscar(e.target.value)}
            placeholder={t('listado.buscarPlaceholder')}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {ESTADOS.map((e) => (
            <button key={e.value || 'todas'} onClick={() => setFiltro(e.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${filtro === e.value ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
              {e.label} {e.value && `(${ordenes.filter((o) => o.estado === e.value).length})`}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading && <div className="p-8 text-center text-slate-400">{t('mensajes.cargando', { ns: 'common' })}</div>}
          {!loading && visibles.length === 0 && <div className="p-8 text-center text-slate-400">{t('listado.sinCoincidencias')}</div>}
          {!loading && visibles.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">{t('listado.tabla.numeroOrden')}</th>
                  <th className="px-4 py-3 text-left">{t('listado.tabla.tipo')}</th>
                  {!sinCliente && <th className="px-4 py-3 text-left">{t('listado.tabla.cliente')}</th>}
                  <th className="px-4 py-3 text-left">{t('listado.tabla.equipo')}</th>
                  <th className="px-4 py-3 text-left">{t('listado.tabla.tecnico')}</th>
                  <th className="px-4 py-3 text-left">{t('listado.tabla.ingreso')}</th>
                  <th className="px-4 py-3 text-left">{t('listado.tabla.salida')}</th>
                  <th className="px-4 py-3 text-left">{t('listado.tabla.estado')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((o) => {
                  const info = estadoInfo(o.estado)
                  const tipo = tipoOrden(o.categoria_equipo)
                  return (
                    <tr key={o.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => navigate(`/ordenes/${o.id}`)}>
                      <td className="px-4 py-3 font-medium text-slate-700">{o.numero}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tipo === 'CCA' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>{tipo}</span></td>
                      {!sinCliente && <td className="px-4 py-3">{o.cliente_nombre}</td>}
                      <td className="px-4 py-3">{o.equipo}</td>
                      <td className="px-4 py-3">{o.tecnico_nombre || '—'}</td>
                      <td className="px-4 py-3">{o.fecha_hora_recepcion ? new Date(o.fecha_hora_recepcion).toLocaleString() : o.fecha_ingreso}</td>
                      <td className="px-4 py-3">{o.fecha_hora_entrega_real ? new Date(o.fecha_hora_entrega_real).toLocaleString() : (o.fecha_entrega_real || '—')}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${info.color}`}>{info.label}</span></td>
                      <td className="px-4 py-3 text-right text-brand-600">{t('listado.ver')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={pagina} totalItems={visiblesTotal.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />
      </div>
    </div>
  )
}

export default Ordenes
