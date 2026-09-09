import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Receipt, Wrench, Package, CreditCard, Eye } from 'lucide-react'
import { ventasApi } from '../api.js'
import ReciboPreview from '../components/ReciboPreview.jsx'
import Pagination from '../components/Pagination.jsx'

const PAGE_SIZE = 15

function esFacturaOt(f) {
  return (f.detalles || []).some((d) => d.orden_taller_numero)
}

function RegistroFacturas() {
  const { t } = useTranslation(['registroFacturas', 'common'])
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [reciboFactura, setReciboFactura] = useState(null)
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    setLoading(true)
    ventasApi.facturas().then((r) => setFacturas(r.data)).finally(() => setLoading(false))
  }, [])

  const conTipo = useMemo(() => facturas.map((f) => ({ ...f, _tipo: esFacturaOt(f) ? 'OT' : 'PRODUCTO' })), [facturas])

  const stats = useMemo(() => ({
    totalFacturado: conTipo.filter((f) => f.estado !== 'ANULADA').reduce((s, f) => s + Number(f.total_usd ?? f.total), 0),
    facturasOt: conTipo.filter((f) => f._tipo === 'OT').length,
    facturasProducto: conTipo.filter((f) => f._tipo === 'PRODUCTO').length,
    aCredito: conTipo.filter((f) => f.estado === 'PENDIENTE').length,
  }), [conTipo])

  const q = buscar.trim().toLowerCase()
  const visiblesTotal = conTipo.filter((f) => {
    if (filtroTipo && f._tipo !== filtroTipo) return false
    if (filtroEstado && f.estado !== filtroEstado) return false
    if (q && !(f.numero.toLowerCase().includes(q) || (f.cliente_nombre || '').toLowerCase().includes(q))) return false
    return true
  })
  const visibles = visiblesTotal.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)

  useEffect(() => { setPagina(1) }, [filtroTipo, filtroEstado, buscar])

  const estadoBadge = (estado) => {
    if (estado === 'PAGADA') return <span className="badge ok">{t('estado.PAGADA')}</span>
    if (estado === 'ANULADA') return <span className="badge off">{t('estado.ANULADA')}</span>
    return <span className="badge pending">{t('estado.PENDIENTE')}</span>
  }

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      <div className="card-grid" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="stat-icon"><Receipt /></div>
          <div className="stat-label">{t('stats.totalFacturado')}</div>
          <div className="stat-value">${stats.totalFacturado.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Wrench /></div>
          <div className="stat-label">{t('stats.facturasOt')}</div>
          <div className="stat-value">{stats.facturasOt}</div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Package /></div>
          <div className="stat-label">{t('stats.facturasProducto')}</div>
          <div className="stat-value">{stats.facturasProducto}</div>
        </div>
        <div className="stat">
          <div className="stat-icon" style={stats.aCredito > 0 ? { background: 'rgba(217, 119, 6, 0.14)', color: '#d97706' } : undefined}><CreditCard /></div>
          <div className="stat-label">{t('stats.aCredito')}</div>
          <div className="stat-value">{stats.aCredito}</div>
        </div>
      </div>

      <div className="form-row">
        <input
          value={buscar} onChange={(e) => setBuscar(e.target.value)}
          placeholder={t('buscarPlaceholder')}
          style={{ flex: '1 1 320px', maxWidth: 420 }}
        />
      </div>

      <div className="tabs">
        {['', 'OT', 'PRODUCTO'].map((v) => (
          <button key={v || 'todas'} className={filtroTipo === v ? 'tab active' : 'tab'} onClick={() => setFiltroTipo(v)}>
            {t(`filtros.tipo${v === '' ? 'Todas' : v === 'OT' ? 'Ot' : 'Producto'}`)}
          </button>
        ))}
        {['', 'PAGADA', 'PENDIENTE', 'ANULADA'].map((v) => (
          <button key={v || 'todos'} className={filtroEstado === v ? 'tab active' : 'tab'} onClick={() => setFiltroEstado(v)}>
            {t(`filtros.estado${v === '' ? 'Todas' : v.charAt(0) + v.slice(1).toLowerCase()}`)}
          </button>
        ))}
      </div>

      <div className="card">
        {loading && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
        {!loading && visibles.length === 0 && <div className="empty">{t('sinResultados')}</div>}
        {!loading && visibles.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>{t('tabla.numero')}</th>
                <th>{t('tabla.fecha')}</th>
                <th>{t('tabla.cliente')}</th>
                <th>{t('tabla.tipo')}</th>
                <th>{t('tabla.total')}</th>
                <th>{t('tabla.saldo')}</th>
                <th>{t('tabla.estado')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.id}>
                  <td>{f.numero}</td>
                  <td>{f.fecha}</td>
                  <td>{f.cliente_nombre}</td>
                  <td>{f._tipo === 'OT' ? t('tipo.OT') : t('tipo.PRODUCTO')}</td>
                  <td>{f.moneda === 'NIO' ? 'C$' : '$'}{Number(f.total).toLocaleString()}</td>
                  <td>{Number(f.saldo_pendiente) > 0 ? <span style={{ color: '#d97706', fontWeight: 600 }}>{f.moneda === 'NIO' ? 'C$' : '$'}{Number(f.saldo_pendiente).toLocaleString()}</span> : '—'}</td>
                  <td>{estadoBadge(f.estado)}</td>
                  <td className="actions">
                    <button className="secondary" onClick={() => setReciboFactura(f)}><Eye size={14} /> {t('tabla.verRecibo')}</button>
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

      {reciboFactura && <ReciboPreview factura={reciboFactura} onClose={() => setReciboFactura(null)} />}
    </div>
  )
}

export default RegistroFacturas
