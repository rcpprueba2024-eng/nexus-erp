import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PackageCheck, Clock, DollarSign, AlertTriangle } from 'lucide-react'
import { tallerApi } from '../api.js'
import { useAuth, esRolSinAccesoCliente } from '../AuthContext.jsx'
import { checklistSalidaPara } from '../ordenTipo.js'
import FirmaDigital from '../components/orden/FirmaDigital.jsx'
import Pagination from '../components/Pagination.jsx'
import '../orden-tailwind.css'

const PAGE_SIZE = 15

function EquiposListos() {
  const { t } = useTranslation(['equiposListos', 'common', 'facturarOts'])
  const navigate = useNavigate()
  const { user } = useAuth()
  // Taller/Pasante no tienen acceso al módulo de Ventas — no les sirve de
  // nada un botón que los manda a /ventas/facturar-ots, esa ruta ni
  // siquiera existe para ellos.
  const puedeFacturar = !esRolSinAccesoCliente(user?.rol)
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [entregando, setEntregando] = useState(null)
  const [checklistSalida, setChecklistSalida] = useState({})
  const [firmaEntrega, setFirmaEntrega] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [pagina, setPagina] = useState(1)

  const cargar = () => {
    setLoading(true)
    tallerApi.ordenes().then((r) => setOrdenes(r.data)).finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const listos = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return ordenes
      .filter((o) => o.estado === 'LISTO_ENTREGA')
      .filter((o) => !q || o.numero.toLowerCase().includes(q) || (o.cliente_nombre || '').toLowerCase().includes(q))
      .sort((a, b) => (b.dias_en_espera || 0) - (a.dias_en_espera || 0))
  }, [ordenes, buscar])

  useEffect(() => { setPagina(1) }, [buscar])
  const visibles = listos.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)

  const stats = useMemo(() => ({
    total: listos.length,
    conCobro: listos.filter((o) => Number(o.cargo_resguardo) > 0).length,
    porVencer: listos.filter((o) => (o.dias_en_espera || 0) >= 60).length,
  }), [listos])

  const estadoPlazo = (o) => {
    const dias = o.dias_en_espera || 0
    if (dias >= 60) return { key: 'porVencer', cls: 'badge off' }
    if (dias > 45) return { key: 'cobrando', cls: 'badge pending' }
    return { key: 'normal', cls: 'badge ok' }
  }

  const estaPagado = (o) => !!o.factura_numero

  const abrirEntrega = (orden) => {
    setEntregando(orden)
    setChecklistSalida(orden.checklist_salida || {})
    setFirmaEntrega(orden.firma_cliente_entrega || '')
  }

  const confirmarEntrega = async () => {
    setGuardando(true)
    try {
      await tallerApi.actualizarOrden(entregando.id, {
        checklist_salida: checklistSalida, firma_cliente_entrega: firmaEntrega, estado: 'ENTREGADO',
      })
      setEntregando(null)
      cargar()
    } finally {
      setGuardando(false)
    }
  }

  const checklistItems = entregando ? checklistSalidaPara(entregando.categoria_equipo) : []
  const checklistNs = entregando && ['CELULAR', 'TABLET'].includes(entregando.categoria_equipo) ? 'ordenes' : 'checklist'
  const checklistPrefix = entregando && ['CELULAR', 'TABLET'].includes(entregando.categoria_equipo) ? 'checklistSalida' : 'items'

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      <div className="card-grid" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="stat-icon"><PackageCheck /></div>
          <div className="stat-label">{t('stats.total')}</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat">
          <div className="stat-icon" style={stats.conCobro > 0 ? { background: 'rgba(217, 119, 6, 0.14)', color: '#d97706' } : undefined}><DollarSign /></div>
          <div className="stat-label">{t('stats.conCobro')}</div>
          <div className="stat-value">{stats.conCobro}</div>
        </div>
        <div className="stat">
          <div className="stat-icon" style={stats.porVencer > 0 ? { background: 'rgba(220, 38, 38, 0.12)', color: 'var(--danger)' } : undefined}><AlertTriangle /></div>
          <div className="stat-label">{t('stats.porVencer')}</div>
          <div className="stat-value" style={{ color: stats.porVencer > 0 ? 'var(--danger)' : 'inherit' }}>{stats.porVencer}</div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Clock /></div>
          <div className="stat-label">{t('stats.plazoGracia')}</div>
          <div className="stat-value">45 {t('stats.dias')}</div>
        </div>
      </div>

      <div className="form-row">
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder={t('buscarPlaceholder')} style={{ flex: '1 1 320px', maxWidth: 420 }} />
      </div>

      <div className="card">
        {loading && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
        {!loading && listos.length === 0 && <div className="empty">{t('sinResultados')}</div>}
        {!loading && listos.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>{t('tabla.numero')}</th>
                <th>{t('tabla.cliente')}</th>
                <th>{t('tabla.tecnico')}</th>
                <th>{t('tabla.equipo')}</th>
                <th>{t('tabla.fechaListo')}</th>
                <th>{t('tabla.dias')}</th>
                <th>{t('tabla.pagado')}</th>
                <th>{t('tabla.plazo')}</th>
                <th>{t('tabla.accion')}</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((o) => {
                const plazo = estadoPlazo(o)
                const pagado = estaPagado(o)
                return (
                  <tr key={o.id}>
                    <td>{o.numero}</td>
                    <td>{o.cliente_nombre}</td>
                    <td>{o.tecnico_nombre || '—'}</td>
                    <td>{o.equipo}</td>
                    <td>{o.fecha_listo || '—'}</td>
                    <td>{o.dias_en_espera ?? '—'}</td>
                    <td>
                      {pagado
                        ? <span className="badge ok">{t('tabla.siPagado', { numero: o.factura_numero })}</span>
                        : <span className="badge off">{t('tabla.noPagado')}</span>}
                    </td>
                    <td><span className={plazo.cls}>{t(`plazo.${plazo.key}`)}</span></td>
                    <td>
                      {pagado ? (
                        <button type="button" className="secondary" onClick={() => abrirEntrega(o)}>{t('tabla.entregar')}</button>
                      ) : puedeFacturar ? (
                        <button type="button" className="secondary" onClick={() => navigate('/ventas/facturar-ots')}>{t('botonFacturar', { ns: 'facturarOts' })}</button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {!loading && listos.length > 0 && (
          <Pagination page={pagina} totalItems={listos.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />
        )}
      </div>

      {entregando && (
        <div className="modal-backdrop" onClick={() => setEntregando(null)}>
          <div className="modal orden-tw" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 className="mb-1 text-base font-semibold text-ink">{t('entrega.titulo', { numero: entregando.numero })}</h3>
            <p className="mb-4 text-sm text-muted">{entregando.cliente_nombre} — {entregando.equipo}</p>

            <div className="mb-2 text-xs font-semibold uppercase text-muted">{t('modal.checklistSalida', { ns: 'facturarOts' })}</div>
            <div className="mb-4 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
              {checklistItems.map((item) => (
                <label key={item} className="flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={!!checklistSalida[item]} onChange={() => setChecklistSalida((c) => ({ ...c, [item]: !c[item] }))} />
                  {t(`${checklistPrefix}.${item}`, { ns: checklistNs })}
                </label>
              ))}
            </div>

            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase text-muted">{t('modal.firmaEntrega', { ns: 'facturarOts' })}</div>
              <div className="rounded-lg border border-line p-2">
                <FirmaDigital value={firmaEntrega} onChange={setFirmaEntrega} label={t('modal.firmaEntregaLabel', { ns: 'facturarOts' })} />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={confirmarEntrega} disabled={guardando} className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {guardando ? t('botones.guardando', { ns: 'common' }) : t('entrega.confirmar')}
              </button>
              <button onClick={() => setEntregando(null)} className="rounded-lg border border-line px-4 py-2 text-sm text-muted">{t('botones.cancelar', { ns: 'common' })}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EquiposListos
