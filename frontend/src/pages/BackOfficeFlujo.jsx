import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogIn, LogOut, DollarSign, AlertTriangle, Wrench, Boxes } from 'lucide-react'
import { tallerApi, inventarioApi, ventasApi } from '../api.js'

function hoy() {
  return new Date().toISOString().slice(0, 10)
}

function BackOfficeFlujo() {
  const { t } = useTranslation('backoffice')
  const [ordenes, setOrdenes] = useState(null)
  const [productos, setProductos] = useState(null)
  const [facturas, setFacturas] = useState(null)

  useEffect(() => {
    tallerApi.ordenes().then((r) => setOrdenes(r.data))
    inventarioApi.productos().then((r) => setProductos(r.data))
    ventasApi.facturas().then((r) => setFacturas(r.data))
  }, [])

  const cargando = !ordenes || !productos || !facturas
  const hoyStr = hoy()

  const entradasHoy = cargando ? [] : ordenes.filter((o) => o.fecha_ingreso === hoyStr)
  const entregasHoy = cargando ? [] : ordenes.filter((o) => o.fecha_entrega_real === hoyStr)
  const bajoStock = cargando ? [] : productos.filter((p) => Number(p.stock_actual) <= Number(p.stock_minimo))
  const ventasHoy = cargando ? [] : facturas.filter((f) => f.fecha === hoyStr)
  const totalVentasHoy = ventasHoy.reduce((s, f) => s + Number(f.total_usd ?? f.total ?? 0), 0)
  const ordenesActivas = cargando ? [] : ordenes.filter((o) => o.estado !== 'ENTREGADO' && o.estado !== 'CANCELADO')
  const valorEnTaller = ordenesActivas.reduce((s, o) => s + Number(o.costo_estimado || 0), 0)

  return (
    <div>
      <div className="page-header">
        <h1>{t('flujo.titulo')}</h1>
        <p>{t('flujo.subtitulo')}</p>
      </div>

      {cargando ? (
        <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>
      ) : (
        <>
          <div className="card-grid">
            <div className="stat">
              <div className="stat-icon"><LogIn /></div>
              <div className="stat-label">{t('flujo.entradasHoy')}</div>
              <div className="stat-value">{entradasHoy.length}</div>
            </div>
            <div className="stat">
              <div className="stat-icon"><LogOut /></div>
              <div className="stat-label">{t('flujo.entregasHoy')}</div>
              <div className="stat-value">{entregasHoy.length}</div>
            </div>
            <div className="stat">
              <div className="stat-icon"><DollarSign /></div>
              <div className="stat-label">{t('flujo.ventasHoy')}</div>
              <div className="stat-value">${totalVentasHoy.toLocaleString()}</div>
            </div>
            <div className="stat">
              <div className="stat-icon" style={bajoStock.length > 0 ? { background: 'rgba(220, 38, 38, 0.12)', color: 'var(--danger)' } : undefined}><AlertTriangle /></div>
              <div className="stat-label">{t('flujo.bajoStock')}</div>
              <div className="stat-value" style={{ color: bajoStock.length > 0 ? 'var(--danger)' : 'var(--text-h)' }}>{bajoStock.length}</div>
            </div>
            <div className="stat">
              <div className="stat-icon"><Wrench /></div>
              <div className="stat-label">{t('flujo.ordenesActivas')}</div>
              <div className="stat-value">{ordenesActivas.length}</div>
            </div>
            <div className="stat">
              <div className="stat-icon"><Boxes /></div>
              <div className="stat-label">{t('flujo.valorEnTaller')}</div>
              <div className="stat-value">${valorEnTaller.toLocaleString()}</div>
            </div>
          </div>

          <div className="charts-row">
            <div className="chart-card">
              <h3>{t('flujo.entradasHoyTitulo')}</h3>
              {entradasHoy.length === 0 ? <div className="empty">{t('flujo.sinEntradas')}</div> : (
                <table>
                  <thead><tr><th>{t('flujo.tabla.numero')}</th><th>{t('flujo.tabla.equipo')}</th><th>{t('flujo.tabla.cliente')}</th></tr></thead>
                  <tbody>
                    {entradasHoy.map((o) => (
                      <tr key={o.id}><td><Link to={`/ordenes/${o.id}`}>{o.numero}</Link></td><td>{o.equipo}</td><td>{o.cliente_nombre}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="chart-card">
              <h3>{t('flujo.entregasHoyTitulo')}</h3>
              {entregasHoy.length === 0 ? <div className="empty">{t('flujo.sinEntregas')}</div> : (
                <table>
                  <thead><tr><th>{t('flujo.tabla.numero')}</th><th>{t('flujo.tabla.equipo')}</th><th>{t('flujo.tabla.cliente')}</th></tr></thead>
                  <tbody>
                    {entregasHoy.map((o) => (
                      <tr key={o.id}><td><Link to={`/ordenes/${o.id}`}>{o.numero}</Link></td><td>{o.equipo}</td><td>{o.cliente_nombre}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <h3>{t('flujo.bajoStockTitulo')}</h3>
            {bajoStock.length === 0 ? <div className="empty">{t('flujo.sinBajoStock')}</div> : (
              <table>
                <thead><tr><th>{t('flujo.tabla.producto')}</th><th>{t('flujo.tabla.stockActual')}</th><th>{t('flujo.tabla.stockMinimo')}</th></tr></thead>
                <tbody>
                  {bajoStock.map((p) => (
                    <tr key={p.id}><td>{p.nombre}</td><td><span className="badge off">{p.stock_actual}</span></td><td>{p.stock_minimo}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h3>{t('flujo.accesosTitulo')}</h3>
            <div className="chip-list">
              <Link to="/inventario" className="chip">{t('flujo.irInventario')}</Link>
              <Link to="/reportes" className="chip">{t('flujo.irReportes')}</Link>
              <Link to="/backoffice/financiero" className="chip">{t('flujo.irFinanciero')}</Link>
              <Link to="/ordenes" className="chip">{t('flujo.irOrdenes')}</Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default BackOfficeFlujo
