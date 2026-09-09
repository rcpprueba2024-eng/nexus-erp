import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { useTranslation } from 'react-i18next'
import { reportesApi } from '../api.js'
import { useAuth } from '../AuthContext.jsx'

function can(user, roles) {
  return user.is_superuser || roles.includes(user.rol)
}

const COLORS = ['#1d4ed8', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4338ca']

// El backend de reportes de gastos de personal devuelve el área ya traducida
// al español (get_area_display()), sin el código crudo. La mapeamos de vuelta
// al código de rol para poder traducirla con las claves de "roles" comunes.
const AREA_DISPLAY_A_ROL = {
  Taller: 'TALLER',
  Ventas: 'VENTAS',
  'Recursos Humanos': 'RRHH',
  'Backoffice / Contabilidad': 'BACKOFFICE',
  'Gerencia General': 'ADMIN',
}

function Reportes() {
  const { t } = useTranslation('reportes')
  const { user } = useAuth()

  const TABS = [
    { key: 'ventas', label: t('tabs.ventas'), roles: ['VENTAS', 'BACKOFFICE'] },
    { key: 'gastos', label: t('tabs.gastos'), roles: ['TALLER', 'BACKOFFICE', 'RRHH'] },
    { key: 'inventario', label: t('tabs.inventario'), roles: ['TALLER', 'BACKOFFICE', 'VENTAS'] },
    { key: 'cobrar', label: t('tabs.cobrar'), roles: ['BACKOFFICE'] },
    { key: 'taller', label: t('tabs.taller'), roles: ['TALLER', 'BACKOFFICE'] },
    { key: 'clientes', label: t('tabs.clientes'), roles: ['VENTAS', 'BACKOFFICE'] },
  ].filter((tab) => can(user, tab.roles))

  const AGRUPACIONES = [
    { value: 'diario', label: t('agrupacion.diario') },
    { value: 'semanal', label: t('agrupacion.semanal') },
    { value: 'quincenal', label: t('agrupacion.quincenal') },
    { value: 'mensual', label: t('agrupacion.mensual') },
  ]

  const [tab, setTab] = useState(TABS[0]?.key)
  const [agrupacion, setAgrupacion] = useState('diario')

  const [ventasPeriodo, setVentasPeriodo] = useState(null)
  const [ventasVendedores, setVentasVendedores] = useState(null)
  const [gastosInsumos, setGastosInsumos] = useState(null)
  const [gastosPersonal, setGastosPersonal] = useState(null)
  const [inventarioMov, setInventarioMov] = useState(null)
  const [cuentasCobrar, setCuentasCobrar] = useState(null)
  const [tallerEficiencia, setTallerEficiencia] = useState(null)
  const [clientesEmpresas, setClientesEmpresas] = useState(null)

  useEffect(() => {
    if (tab === 'ventas' && can(user, ['VENTAS', 'BACKOFFICE'])) {
      reportesApi.ventasPeriodo(agrupacion).then((r) => setVentasPeriodo(r.data))
      reportesApi.ventasVendedores().then((r) => setVentasVendedores(r.data))
    }
    if (tab === 'gastos') {
      if (can(user, ['TALLER', 'BACKOFFICE'])) reportesApi.gastosInsumos().then((r) => setGastosInsumos(r.data))
      if (can(user, ['RRHH', 'BACKOFFICE'])) reportesApi.gastosPersonal().then((r) => setGastosPersonal(r.data))
    }
    if (tab === 'inventario' && can(user, ['TALLER', 'BACKOFFICE', 'VENTAS'])) {
      reportesApi.inventarioMovimiento().then((r) => setInventarioMov(r.data))
    }
    if (tab === 'cobrar' && can(user, ['BACKOFFICE'])) {
      reportesApi.cuentasPorCobrar().then((r) => setCuentasCobrar(r.data))
    }
    if (tab === 'taller' && can(user, ['TALLER', 'BACKOFFICE'])) {
      reportesApi.tallerEficiencia().then((r) => setTallerEficiencia(r.data))
    }
    if (tab === 'clientes' && can(user, ['VENTAS', 'BACKOFFICE'])) {
      reportesApi.clientesEmpresas().then((r) => setClientesEmpresas(r.data))
    }
  }, [tab, agrupacion, user])

  if (TABS.length === 0) {
    return (
      <div>
        <div className="page-header"><h1>{t('titulo')}</h1></div>
        <div className="card">{t('sinAcceso')}</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      <div className="tabs">
        {TABS.map((tb) => (
          <button key={tb.key} className={tab === tb.key ? 'tab active' : 'tab'} onClick={() => setTab(tb.key)}>{tb.label}</button>
        ))}
      </div>

      {tab === 'ventas' && (
        <>
          <div className="card">
            <div className="form-row" style={{ marginBottom: 0 }}>
              <h3 style={{ margin: 0, flex: '0 0 auto' }}>{t('ventas.porPeriodoTitulo')}</h3>
              <select value={agrupacion} onChange={(e) => setAgrupacion(e.target.value)} style={{ maxWidth: 160 }}>
                {AGRUPACIONES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <button className="export-btn" onClick={() => reportesApi.exportarVentasPeriodo(agrupacion)}>⬇ {t('botones.exportarExcel', { ns: 'common' })}</button>
              <button className="export-btn" onClick={() => reportesApi.exportarVentasPeriodoPdf(agrupacion)}>⬇ {t('botones.exportarPdf', { ns: 'common' })}</button>
            </div>
            {!ventasPeriodo && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
            {ventasPeriodo && ventasPeriodo.length === 0 && <div className="empty">{t('ventas.sinVentas')}</div>}
            {ventasPeriodo && ventasPeriodo.length > 0 && (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ventasPeriodo} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                  <Bar dataKey="total" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <div className="card-head-row">
              <h3>{t('ventas.vendedoresTitulo')}</h3>
              <button className="export-btn" onClick={() => reportesApi.exportarVentasVendedores()}>⬇ {t('botones.exportarExcel', { ns: 'common' })}</button>
              <button className="export-btn" onClick={() => reportesApi.exportarVentasVendedoresPdf()}>⬇ {t('botones.exportarPdf', { ns: 'common' })}</button>
            </div>
            {!ventasVendedores && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
            {ventasVendedores && ventasVendedores.length > 0 && (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={ventasVendedores} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="vendedor" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                  <Bar dataKey="total_vendido" radius={[4, 4, 0, 0]}>
                    {ventasVendedores.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {ventasVendedores && ventasVendedores.length > 0 && (
              <table style={{ marginTop: 14 }}>
                <thead><tr><th>{t('ventas.tabla.numero')}</th><th>{t('ventas.tabla.vendedor')}</th><th>{t('ventas.tabla.facturas')}</th><th>{t('ventas.tabla.totalVendido')}</th></tr></thead>
                <tbody>
                  {ventasVendedores.map((v, i) => (
                    <tr key={v.vendedor + i}>
                      <td>{i === 0 ? '🏆' : i + 1}</td>
                      <td>{v.vendedor}</td>
                      <td>{v.cantidad_facturas}</td>
                      <td>${v.total_vendido.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'gastos' && (
        <>
          {(gastosInsumos || gastosPersonal) && (
            <div className="card-head-row" style={{ marginBottom: -6 }}>
              <span />
              <button className="export-btn" onClick={() => reportesApi.exportarGastos()}>⬇ {t('botones.exportarExcel', { ns: 'common' })} {t('gastos.exportarSufijo')}</button>
              <button className="export-btn" onClick={() => reportesApi.exportarGastosPdf()}>⬇ {t('botones.exportarPdf', { ns: 'common' })} {t('gastos.exportarSufijo')}</button>
            </div>
          )}
          {gastosInsumos && (
            <div className="card">
              <h3>{t('gastos.insumosTitulo')}</h3>
              <p style={{ marginBottom: 10 }}>{t('gastos.totalGastado')} <strong>${gastosInsumos.total_gastado.toLocaleString()}</strong></p>
              {gastosInsumos.detalle.length === 0 ? <div className="empty">{t('gastos.sinConsumo')}</div> : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={gastosInsumos.detalle.slice(0, 8)} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="producto" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                      <Bar dataKey="costo_total" fill="#d97706" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                <table>
                  <thead><tr><th>{t('gastos.tablaInsumos.insumo')}</th><th>{t('gastos.tablaInsumos.cantidadUsada')}</th><th>{t('gastos.tablaInsumos.costoTotal')}</th></tr></thead>
                  <tbody>
                    {gastosInsumos.detalle.slice(0, 30).map((d, i) => (
                      <tr key={i}><td>{d.producto}</td><td>{d.cantidad_usada}</td><td>${d.costo_total.toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                  </table>
                  {gastosInsumos.detalle.length > 30 && (
                    <p style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text)' }}>
                      {t('gastos.mostrandoTop', { n: 30, total: gastosInsumos.detalle.length })}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {gastosPersonal && (
            <div className="card">
              <h3>{t('gastos.personalTitulo')}</h3>
              <p style={{ marginBottom: 10 }}>{t('gastos.totalPlanilla')} <strong>${gastosPersonal.total_planilla.toLocaleString()}</strong></p>
              {gastosPersonal.detalle.length > 0 && (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={Object.entries(
                      gastosPersonal.detalle.reduce((acc, d) => {
                        acc[d.area] = (acc[d.area] || 0) + d.salario
                        return acc
                      }, {})
                    ).map(([area, total]) => ({ area: t(`roles.${AREA_DISPLAY_A_ROL[area] || ''}`, { ns: 'common', defaultValue: area }), total }))}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="area" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                    <Bar dataKey="total" fill="#4338ca" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <table>
                <thead><tr><th>{t('gastos.tablaPersonal.empleado')}</th><th>{t('gastos.tablaPersonal.puesto')}</th><th>{t('gastos.tablaPersonal.area')}</th><th>{t('gastos.tablaPersonal.salario')}</th></tr></thead>
                <tbody>
                  {gastosPersonal.detalle.map((d, i) => (
                    <tr key={i}><td>{d.empleado}</td><td>{d.puesto}</td><td>{t(`roles.${AREA_DISPLAY_A_ROL[d.area] || ''}`, { ns: 'common', defaultValue: d.area })}</td><td>${d.salario.toLocaleString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!gastosInsumos && !gastosPersonal && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
        </>
      )}

      {tab === 'inventario' && (
        <>
          <div className="card-head-row" style={{ marginBottom: 12 }}>
            <span />
            <button className="export-btn" onClick={() => reportesApi.exportarInventarioMovimiento()}>⬇ {t('botones.exportarExcel', { ns: 'common' })}</button>
            <button className="export-btn" onClick={() => reportesApi.exportarInventarioMovimientoPdf()}>⬇ {t('botones.exportarPdf', { ns: 'common' })}</button>
          </div>
          <div className="charts-row">
          <div className="chart-card">
            <h3>{t('inventario.masMovidosTitulo')}</h3>
            {!inventarioMov && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
            {inventarioMov && (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={inventarioMov.mas_movidos} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="producto" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total_movido" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <table>
                  <thead><tr><th>{t('inventario.tabla.producto')}</th><th>{t('inventario.tabla.movimientos')}</th></tr></thead>
                  <tbody>
                    {inventarioMov.mas_movidos.map((p, i) => (
                      <tr key={i}><td>{p.producto}</td><td>{p.total_movido}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
          <div className="chart-card">
            <h3>{t('inventario.menosMovidosTitulo')}</h3>
            {!inventarioMov && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
            {inventarioMov && (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={inventarioMov.menos_movidos} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="producto" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total_movido" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <table>
                  <thead><tr><th>{t('inventario.tabla.producto')}</th><th>{t('inventario.tabla.movimientos')}</th></tr></thead>
                  <tbody>
                    {inventarioMov.menos_movidos.map((p, i) => (
                      <tr key={i}><td>{p.producto}</td><td>{p.total_movido}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
          </div>
        </>
      )}

      {tab === 'cobrar' && (
        <div className="card">
          <div className="card-head-row">
            <h3>{t('cobrar.titulo')}</h3>
            <button className="export-btn" onClick={() => reportesApi.exportarCuentasPorCobrar()}>⬇ {t('botones.exportarExcel', { ns: 'common' })}</button>
            <button className="export-btn" onClick={() => reportesApi.exportarCuentasPorCobrarPdf()}>⬇ {t('botones.exportarPdf', { ns: 'common' })}</button>
          </div>
          {!cuentasCobrar && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
          {cuentasCobrar && cuentasCobrar.length === 0 && <div className="empty">{t('cobrar.sinCuentas')}</div>}
          {cuentasCobrar && cuentasCobrar.length > 0 && (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cuentasCobrar} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="cliente" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                  <Bar dataKey="monto" fill="#0891b2" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            <table>
              <thead><tr><th>{t('cobrar.tabla.cliente')}</th><th>{t('cobrar.tabla.monto')}</th><th>{t('cobrar.tabla.vencimiento')}</th><th>{t('cobrar.tabla.equipo')}</th></tr></thead>
              <tbody>
                {cuentasCobrar.map((c, i) => (
                  <tr key={i}>
                    <td>{c.cliente}</td>
                    <td>${c.monto.toLocaleString()}</td>
                    <td>{c.fecha_vencimiento}</td>
                    <td>{c.equipo_pendiente_retiro ? <span className="badge off">{t('cobrar.faltaRetirar')}</span> : <span className="badge ok">{t('cobrar.sinPendiente')}</span>}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {tab === 'taller' && (
        <>
          <div className="card">
            <div className="card-head-row">
              <h3>{t('taller.eficienciaTitulo')}</h3>
              <button className="export-btn" onClick={() => reportesApi.exportarTallerEficiencia()}>⬇ {t('botones.exportarExcel', { ns: 'common' })}</button>
              <button className="export-btn" onClick={() => reportesApi.exportarTallerEficienciaPdf()}>⬇ {t('botones.exportarPdf', { ns: 'common' })}</button>
            </div>
            {!tallerEficiencia && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
            {tallerEficiencia && (
              <table>
                <thead><tr><th>{t('taller.tabla.numero')}</th><th>{t('taller.tabla.tecnico')}</th><th>{t('taller.tabla.reparadas')}</th><th>{t('taller.tabla.activas')}</th><th>{t('taller.tabla.promedioDias')}</th></tr></thead>
                <tbody>
                  {tallerEficiencia.map((tc, i) => (
                    <tr key={i}>
                      <td>{i === 0 && tc.ordenes_completadas > 0 ? '⚡' : i + 1}</td>
                      <td>{tc.tecnico}</td>
                      <td>{tc.ordenes_completadas}</td>
                      <td>{tc.ordenes_activas}</td>
                      <td>{tc.promedio_dias ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {tallerEficiencia && tallerEficiencia.some((tc) => tc.ordenes_completadas > 0) && (
            <div className="chart-card">
              <h3>{t('taller.chartTitulo')}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={tallerEficiencia} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="tecnico" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="ordenes_completadas" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {tab === 'clientes' && (
        <>
          {!clientesEmpresas && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
          {clientesEmpresas && (
            <>
              <div className="charts-row" style={{ marginBottom: 14 }}>
                <div className="chart-card" style={{ flex: '0 1 220px' }}>
                  <h3 style={{ marginBottom: 4 }}>{t('clientes.totalClientes')}</h3>
                  <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{clientesEmpresas.total_clientes}</p>
                </div>
                <div className="chart-card" style={{ flex: '0 1 220px' }}>
                  <h3 style={{ marginBottom: 4 }}>{t('clientes.totalEmpresas')}</h3>
                  <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{clientesEmpresas.total_empresas}</p>
                </div>
                <div className="chart-card" style={{ flex: '0 1 220px' }}>
                  <h3 style={{ marginBottom: 4 }}>{t('clientes.totalFrecuentes')}</h3>
                  <p style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--success, #16a34a)' }}>{clientesEmpresas.total_frecuentes}</p>
                </div>
              </div>

              <div className="card">
                <h3>{t('clientes.equiposPorEmpresaTitulo')}</h3>
                {clientesEmpresas.equipos_por_empresa.length === 0 ? <div className="empty">{t('clientes.sinEmpresas')}</div> : (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={clientesEmpresas.equipos_por_empresa} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="empresa" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={90} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="equipos" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <table>
                      <thead><tr><th>{t('clientes.tabla.empresa')}</th><th>{t('clientes.tabla.contactos')}</th><th>{t('clientes.tabla.equipos')}</th></tr></thead>
                      <tbody>
                        {clientesEmpresas.equipos_por_empresa.map((e, i) => (
                          <tr key={i}><td>{e.empresa}</td><td>{e.contactos}</td><td>{e.equipos}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>

              <div className="card">
                <h3>{t('clientes.topClientesTitulo')}</h3>
                {clientesEmpresas.top_clientes.length === 0 ? <div className="empty">{t('clientes.sinActividad')}</div> : (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={clientesEmpresas.top_clientes} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="cliente" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={90} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="actividad" radius={[4, 4, 0, 0]}>
                          {clientesEmpresas.top_clientes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <table>
                      <thead><tr><th>{t('clientes.tabla.cliente')}</th><th>{t('clientes.tabla.actividad')}</th><th>{t('clientes.tabla.frecuente')}</th></tr></thead>
                      <tbody>
                        {clientesEmpresas.top_clientes.map((c, i) => (
                          <tr key={i}>
                            <td>{c.cliente}</td>
                            <td>{c.actividad}</td>
                            <td>{c.frecuente ? <span className="badge ok">{t('clientes.frecuenteSi')}</span> : <span className="badge off">{t('clientes.frecuenteNo')}</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Reportes
