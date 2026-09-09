import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Scale, Percent, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Building2 } from 'lucide-react'
import { contabilidadApi, reportesApi } from '../api.js'

const TABS = ['resultados', 'ventas', 'gastos', 'cuentas']
const COLORS = ['#1d4ed8', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4338ca']

function Contabilidad() {
  const { t } = useTranslation(['contabilidad', 'common'])
  const [tab, setTab] = useState('resultados')

  const [resultados, setResultados] = useState(null)
  const [ventasDia, setVentasDia] = useState(null)
  const [ventasVendedor, setVentasVendedor] = useState(null)
  const [gastosProveedor, setGastosProveedor] = useState(null)
  const [gastosDia, setGastosDia] = useState(null)
  const [porCobrar, setPorCobrar] = useState(null)
  const [porPagar, setPorPagar] = useState(null)

  useEffect(() => {
    if (tab === 'resultados' && !resultados) reportesApi.estadoResultados().then((r) => setResultados(r.data))
    if (tab === 'ventas') {
      if (!ventasDia) reportesApi.ventasPeriodo('diario').then((r) => setVentasDia(r.data))
      if (!ventasVendedor) reportesApi.ventasVendedores().then((r) => setVentasVendedor(r.data))
    }
    if (tab === 'gastos') {
      if (!gastosProveedor) reportesApi.gastosProveedor().then((r) => setGastosProveedor(r.data))
      if (!gastosDia) reportesApi.gastosDia().then((r) => setGastosDia(r.data))
    }
    if (tab === 'cuentas' && !porCobrar) {
      Promise.all([contabilidadApi.cuentasPorCobrar(), contabilidadApi.cuentasPorPagar()])
        .then(([c, p]) => { setPorCobrar(c.data); setPorPagar(p.data) })
    }
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const conceptoKey = (c) => ({ 'Insumos de taller': 'insumos', 'Planilla': 'planilla', 'Compras a proveedores': 'compras' }[c])

  const cobrarPendiente = (porCobrar || []).filter((c) => c.estado !== 'PAGADO')
  const pagarPendiente = (porPagar || []).filter((c) => c.estado !== 'PAGADO')
  const totalPorCobrar = cobrarPendiente.reduce((s, c) => s + Number(c.monto), 0)
  const totalPorPagar = pagarPendiente.reduce((s, c) => s + Number(c.monto), 0)
  const hoy = new Date().toISOString().slice(0, 10)
  const cobrarVencidas = cobrarPendiente.filter((c) => c.fecha_vencimiento && c.fecha_vencimiento < hoy).length
  const pagarVencidas = pagarPendiente.filter((c) => c.fecha_vencimiento && c.fecha_vencimiento < hoy).length

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      <div className="tabs">
        {TABS.map((tb) => (
          <button key={tb} className={tab === tb ? 'tab active' : 'tab'} onClick={() => setTab(tb)}>{t(`tabs.${tb}`)}</button>
        ))}
      </div>

      {tab === 'resultados' && (
        <>
          {!resultados ? <div className="card"><div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div></div> : (
            <>
              <div className="card-grid" style={{ marginBottom: 20 }}>
                <div className="stat">
                  <div className="stat-icon"><TrendingUp /></div>
                  <div className="stat-label">{t('resultados.ingresos')}</div>
                  <div className="stat-value">${resultados.ingresos.toLocaleString()}</div>
                </div>
                <div className="stat">
                  <div className="stat-icon"><TrendingDown /></div>
                  <div className="stat-label">{t('resultados.totalGastos')}</div>
                  <div className="stat-value">${resultados.total_gastos.toLocaleString()}</div>
                </div>
                <div className="stat">
                  <div className="stat-icon"><Scale /></div>
                  <div className="stat-label">{t('resultados.utilidadNeta')}</div>
                  <div className="stat-value" style={{ color: resultados.utilidad_neta >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    ${resultados.utilidad_neta.toLocaleString()}
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-icon"><Percent /></div>
                  <div className="stat-label">{t('resultados.margenNeto')}</div>
                  <div className="stat-value">{resultados.margen_neto}%</div>
                </div>
              </div>

              <div className="charts-row">
                <div className="chart-card">
                  <h3>{t('resultados.gastosTitulo')}</h3>
                  {resultados.gastos.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={resultados.gastos.map((g) => ({ ...g, label: t(`resultados.conceptos.${conceptoKey(g.concepto)}`) }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                        <Bar dataKey="monto" radius={[4, 4, 0, 0]}>
                          {resultados.gastos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="empty">{t('gastos.vacio')}</div>}
                </div>

                <div className="card" style={{ margin: 0 }}>
                  <h3 style={{ marginBottom: 14 }}>{t('resultados.gastosTitulo')}</h3>
                  <table>
                    <tbody>
                      {resultados.gastos.map((g) => (
                        <tr key={g.concepto}>
                          <td>{t(`resultados.conceptos.${conceptoKey(g.concepto)}`)}</td>
                          <td style={{ textAlign: 'right' }}>${g.monto.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'ventas' && (
        <>
          <div className="card">
            <div className="card-head-row">
              <h3>{t('ventas.porDiaTitulo')}</h3>
              <button className="secondary export-btn" onClick={() => reportesApi.exportarVentasPeriodo('diario')}>{t('botones.exportarExcel', { ns: 'common' })}</button>
            </div>
            {!ventasDia ? <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div> : ventasDia.length === 0 ? (
              <div className="empty">{t('ventas.vacio')}</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ventasDia} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="periodo" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={55} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                    <Bar dataKey="total" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <table style={{ marginTop: 14 }}>
                  <thead><tr><th>{t('ventas.columnas.periodo')}</th><th>{t('ventas.columnas.total')}</th><th>{t('ventas.columnas.facturas')}</th></tr></thead>
                  <tbody>
                    {ventasDia.map((v) => (
                      <tr key={v.periodo}><td>{v.periodo}</td><td>${v.total.toLocaleString()}</td><td>{v.cantidad_facturas}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-head-row">
              <h3>{t('ventas.porVendedorTitulo')}</h3>
              <button className="secondary export-btn" onClick={() => reportesApi.exportarVentasVendedores()}>{t('botones.exportarExcel', { ns: 'common' })}</button>
            </div>
            {!ventasVendedor ? <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div> : ventasVendedor.length === 0 ? (
              <div className="empty">{t('ventas.vacio')}</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ventasVendedor} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="vendedor" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                    <Bar dataKey="total_vendido" radius={[4, 4, 0, 0]}>
                      {ventasVendedor.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <table style={{ marginTop: 14 }}>
                  <thead><tr><th>{t('ventas.columnas.vendedor')}</th><th>{t('ventas.columnas.total')}</th><th>{t('ventas.columnas.facturas')}</th><th>{t('ventas.columnas.promedio')}</th></tr></thead>
                  <tbody>
                    {ventasVendedor.map((v) => (
                      <tr key={v.vendedor}><td>{v.vendedor}</td><td>${v.total_vendido.toLocaleString()}</td><td>{v.cantidad_facturas}</td><td>${v.promedio_por_venta.toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}

      {tab === 'gastos' && (
        <>
          <div className="card">
            <div className="card-head-row">
              <h3>{t('gastos.porProveedorTitulo')}</h3>
              <button className="secondary export-btn" onClick={() => reportesApi.exportarGastosProveedor()}>{t('botones.exportarExcel', { ns: 'common' })}</button>
            </div>
            {!gastosProveedor ? <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div> : gastosProveedor.detalle.length === 0 ? (
              <div className="empty">{t('gastos.vacio')}</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={gastosProveedor.detalle} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="proveedor" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                    <Bar dataKey="total_pagado" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <table style={{ marginTop: 14 }}>
                  <thead><tr><th>{t('gastos.columnas.proveedor')}</th><th>{t('gastos.columnas.ordenes')}</th><th>{t('gastos.columnas.total')}</th></tr></thead>
                  <tbody>
                    {gastosProveedor.detalle.map((g) => (
                      <tr key={g.proveedor}><td>{g.proveedor}</td><td>{g.cantidad_ordenes}</td><td>${g.total_pagado.toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          <div className="card">
            <h3>{t('gastos.porDiaTitulo')}</h3>
            {!gastosDia ? <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div> : gastosDia.length === 0 ? (
              <div className="empty">{t('gastos.vacio')}</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={gastosDia} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={55} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="compras_proveedores" name={t('gastos.columnas.compras')} stackId="g" fill="#d97706" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="insumos_taller" name={t('gastos.columnas.insumos')} stackId="g" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <table style={{ marginTop: 14 }}>
                  <thead><tr><th>{t('gastos.columnas.fecha')}</th><th>{t('gastos.columnas.compras')}</th><th>{t('gastos.columnas.insumos')}</th><th>{t('ventas.columnas.total')}</th></tr></thead>
                  <tbody>
                    {gastosDia.map((g) => (
                      <tr key={g.fecha}>
                        <td>{g.fecha}</td>
                        <td>${g.compras_proveedores.toLocaleString()}</td>
                        <td>${g.insumos_taller.toLocaleString()}</td>
                        <td>${g.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}

      {tab === 'cuentas' && (
        <>
          {(!porCobrar || !porPagar) ? <div className="card"><div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div></div> : (
            <div className="card-grid" style={{ marginBottom: 20 }}>
              <div className="stat">
                <div className="stat-icon"><ArrowDownCircle /></div>
                <div className="stat-label">{t('porCobrar.titulo')}</div>
                <div className="stat-value">${totalPorCobrar.toLocaleString()}</div>
              </div>
              <div className="stat">
                <div className="stat-icon"><ArrowUpCircle /></div>
                <div className="stat-label">{t('porPagar.titulo')}</div>
                <div className="stat-value">${totalPorPagar.toLocaleString()}</div>
              </div>
              <div className="stat">
                <div className="stat-icon" style={cobrarVencidas > 0 ? { background: 'rgba(220, 38, 38, 0.12)', color: 'var(--danger)' } : undefined}><AlertTriangle /></div>
                <div className="stat-label">{t('cuentas.vencidasCobrar')}</div>
                <div className="stat-value" style={{ color: cobrarVencidas > 0 ? 'var(--danger)' : 'inherit' }}>{cobrarVencidas}</div>
              </div>
              <div className="stat">
                <div className="stat-icon" style={pagarVencidas > 0 ? { background: 'rgba(220, 38, 38, 0.12)', color: 'var(--danger)' } : undefined}><Building2 /></div>
                <div className="stat-label">{t('cuentas.vencidasPagar')}</div>
                <div className="stat-value" style={{ color: pagarVencidas > 0 ? 'var(--danger)' : 'inherit' }}>{pagarVencidas}</div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-head-row">
              <h3>{t('porCobrar.titulo')}</h3>
              <button className="secondary export-btn" onClick={() => reportesApi.exportarCuentasPorCobrar()}>{t('botones.exportarExcel', { ns: 'common' })}</button>
            </div>
            {!porCobrar ? <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div> : porCobrar.length === 0 ? (
              <div className="empty">{t('porCobrar.vacio')}</div>
            ) : (
              <table>
                <thead><tr><th>{t('porCobrar.columnas.cliente')}</th><th>{t('porCobrar.columnas.monto')}</th><th>{t('porCobrar.columnas.vencimiento')}</th><th>{t('porCobrar.columnas.asesor')}</th><th>{t('porCobrar.columnas.referenciaOts')}</th><th>{t('porCobrar.columnas.estado')}</th></tr></thead>
                <tbody>
                  {porCobrar.map((c) => (
                    <tr key={c.id}>
                      <td>{c.cliente_nombre}</td>
                      <td>${Number(c.monto).toLocaleString()}</td>
                      <td>{c.fecha_vencimiento}</td>
                      <td>{c.asesor || '—'}</td>
                      <td>{c.referencia_ots || '—'}</td>
                      <td>{c.estado === 'PAGADO' ? <span className="badge ok">{t('estado.pagada', { ns: 'common' })}</span> : <span className="badge pending">{t('estado.pendiente', { ns: 'common' })}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h3>{t('porPagar.titulo')}</h3>
            {!porPagar ? <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div> : porPagar.length === 0 ? (
              <div className="empty">{t('porPagar.vacio')}</div>
            ) : (
              <table>
                <thead><tr><th>{t('porPagar.columnas.proveedor')}</th><th>{t('porPagar.columnas.monto')}</th><th>{t('porPagar.columnas.vencimiento')}</th><th>{t('porPagar.columnas.estado')}</th></tr></thead>
                <tbody>
                  {porPagar.map((c) => (
                    <tr key={c.id}>
                      <td>{c.proveedor_nombre}</td>
                      <td>${Number(c.monto).toLocaleString()}</td>
                      <td>{c.fecha_vencimiento}</td>
                      <td>{c.estado === 'PAGADO' ? <span className="badge ok">{t('estado.pagada', { ns: 'common' })}</span> : <span className="badge pending">{t('estado.pendiente', { ns: 'common' })}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default Contabilidad
