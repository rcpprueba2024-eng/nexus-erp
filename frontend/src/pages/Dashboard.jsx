import { useEffect, useState } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useTranslation } from 'react-i18next'
import { Wrench, CheckCircle2, Package, AlertTriangle, ShoppingCart, Users, ArrowDownCircle, ArrowUpCircle, Clock } from 'lucide-react'
import { inventarioApi, ventasApi, comprasApi, contabilidadApi, rrhhApi, tallerApi, configApi } from '../api.js'
import { useAuth } from '../AuthContext.jsx'

const SUBGRUPO_KEYS = {
  ABANDONADA: 'abandonadas',
  EN_TALLER: 'enTaller',
  USO_PERSONAL: 'usoPersonal',
  REPUESTO: 'repuestos',
  INSUMO_TALLER: 'insumosTaller',
  LISTO_ENTREGA: 'listasEntrega',
}

const ESTADO_TALLER_KEYS = {
  RECIBIDO: 'recibido',
  EN_REPARACION: 'enReparacion',
  LISTO_ENTREGA: 'listoEntrega',
  ENTREGADO: 'entregado',
}

const COLORS = ['#1d4ed8', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

function can(user, modulo) {
  return user.is_superuser || user.rol === 'ADMIN' || (user.modulos_permitidos || []).includes(modulo)
}

function Dashboard() {
  const { t } = useTranslation('dashboard')
  const { user } = useAuth()
  const [data, setData] = useState({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const jobs = {}
    if (can(user, 'inventario')) jobs.productos = inventarioApi.productos()
    if (can(user, 'taller')) jobs.ordenesTaller = tallerApi.ordenes()
    if (can(user, 'ventas')) {
      jobs.facturas = ventasApi.facturas()
      jobs.config = configApi.obtener()
    }
    if (can(user, 'compras')) jobs.ordenesCompra = comprasApi.ordenes()
    if (can(user, 'rrhh')) jobs.empleados = rrhhApi.empleados()
    if (can(user, 'contabilidad')) {
      jobs.porCobrar = contabilidadApi.cuentasPorCobrar()
      jobs.porPagar = contabilidadApi.cuentasPorPagar()
    }

    const keys = Object.keys(jobs)
    Promise.allSettled(Object.values(jobs)).then((results) => {
      const out = {}
      results.forEach((r, i) => {
        out[keys[i]] = r.status === 'fulfilled' ? r.value.data : []
      })
      setData(out)
      setReady(true)
    })
  }, [user])

  if (!ready) return <div className="loading">{t('cargando')}</div>

  const productos = data.productos || []
  const ordenesTaller = data.ordenesTaller || []
  const facturas = data.facturas || []
  const ordenesCompra = data.ordenesCompra || []
  const empleados = data.empleados || []
  const porCobrar = data.porCobrar || []
  const porPagar = data.porPagar || []
  const tasaCambio = Number(data.config?.tasa_cambio_usd) || 0

  const bajoStock = productos.filter((p) => Number(p.stock_actual) <= Number(p.stock_minimo))
  // Cada factura queda guardada en la moneda con la que pagó el cliente:
  // se desglosa lo cobrado en dólares y en córdobas por separado (números
  // reales de caja), y aparte se consolida todo a US$ usando total_usd
  // (la tasa congelada al momento de cada venta) para tener un solo total.
  const facturasNoAnuladas = facturas.filter((f) => f.estado !== 'ANULADA')
  const ventasUsd = facturasNoAnuladas.filter((f) => f.moneda !== 'NIO').reduce((acc, f) => acc + Number(f.total), 0)
  const ventasNio = facturasNoAnuladas.filter((f) => f.moneda === 'NIO').reduce((acc, f) => acc + Number(f.total), 0)
  const ventasTotal = facturasNoAnuladas.reduce((acc, f) => acc + Number(f.total_usd ?? f.total), 0)
  const cobrarTotal = porCobrar.filter((c) => c.estado === 'PENDIENTE').reduce((acc, c) => acc + Number(c.monto), 0)
  const pagarTotal = porPagar.filter((c) => c.estado === 'PENDIENTE').reduce((acc, c) => acc + Number(c.monto), 0)

  const subgrupoData = Object.keys(SUBGRUPO_KEYS).map((key) => ({
    name: t(`subgrupos.${SUBGRUPO_KEYS[key]}`),
    cantidad: productos.filter((p) => p.subgrupo === key).length,
  }))

  const tallerEstadoData = Object.keys(ESTADO_TALLER_KEYS).map((key) => ({
    name: t(`estadoTaller.${ESTADO_TALLER_KEYS[key]}`),
    value: ordenesTaller.filter((o) => o.estado === key).length,
  })).filter((d) => d.value > 0)

  // Cuánto tarda cada equipo desde que entra hasta que sale — para que
  // Backoffice (y quien más tenga el módulo de taller) pueda ver de un
  // vistazo si los tiempos de reparación se están alargando, no solo
  // cuántas OTs hay por estado.
  const diasDeReparacion = (o) => Math.max(0, Math.round((new Date(o.fecha_entrega_real) - new Date(o.fecha_ingreso)) / 86400000))
  const ordenesConTiempo = ordenesTaller.filter((o) => o.fecha_entrega_real && o.fecha_ingreso)
  const BUCKETS_TIEMPO = [
    { key: 'bucket01', test: (d) => d <= 1 },
    { key: 'bucket23', test: (d) => d >= 2 && d <= 3 },
    { key: 'bucket47', test: (d) => d >= 4 && d <= 7 },
    { key: 'bucket8mas', test: (d) => d >= 8 },
  ]
  const tiempoReparacionData = BUCKETS_TIEMPO.map((b) => ({
    name: t(`charts.${b.key}`),
    cantidad: ordenesConTiempo.filter((o) => b.test(diasDeReparacion(o))).length,
  }))

  // Ingresos y margen por tipo de venta (contado / tarjeta / crédito).
  // El margen solo se puede calcular con certeza para líneas de PRODUCTO
  // (Producto.precio_compra es un costo real de inventario); las líneas de
  // SERVICIO de una OT no traen un costo registrado en el sistema, así que
  // se excluyen del margen para no inventar una cifra — el ingreso de
  // servicios sí se cuenta, pero su margen no.
  const productosPorId = Object.fromEntries(productos.map((p) => [p.id, p]))
  const tipoVenta = (f) => {
    if (Number(f.saldo_pendiente) > 0) return 'credito'
    if ((f.pagos || []).some((p) => p.metodo === 'TARJETA')) return 'tarjeta'
    return 'contado'
  }
  const ventasPorTipo = facturasNoAnuladas.reduce((acc, f) => {
    const tipo = tipoVenta(f)
    acc[tipo].ingreso += Number(f.total_usd ?? f.total)
    // precio_unitario queda en la moneda de la factura (córdobas si
    // moneda==='NIO'), pero Producto.precio_compra siempre está en US$ —
    // hay que convertir a la misma moneda antes de restar, si no el
    // margen sale inflado para ventas en córdobas.
    const tasa = Number(f.tasa_cambio_aplicada) || 1
    for (const d of f.detalles || []) {
      if (d.tipo === 'PRODUCTO' && d.producto) {
        const prod = productosPorId[d.producto]
        if (prod) {
          const unitarioUsd = f.moneda === 'NIO' ? Number(d.precio_unitario) / tasa : Number(d.precio_unitario)
          acc[tipo].margen += (unitarioUsd - Number(prod.precio_compra)) * Number(d.cantidad)
        }
      }
    }
    return acc
  }, { contado: { ingreso: 0, margen: 0 }, tarjeta: { ingreso: 0, margen: 0 }, credito: { ingreso: 0, margen: 0 } })

  const ventasPorTipoData = ['contado', 'tarjeta', 'credito']
    .map((tipo) => ({
      name: t(`tiposPago.${tipo}`),
      ingreso: Math.round(ventasPorTipo[tipo].ingreso * 100) / 100,
      margen: Math.round(ventasPorTipo[tipo].margen * 100) / 100,
    }))
    .filter((d) => d.ingreso > 0)

  const ventasPorTipoTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12.5 }}>
        <strong>{d.name}</strong>
        <div>{t('charts.ingresos')}: ${d.ingreso.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        <div>{t('charts.margen')}: ${d.margen.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
      </div>
    )
  }

  // Equipos ya reparados que el cliente aún no retira: cuánto se ha
  // acumulado en cobro de resguardo (ver OrdenTaller.cargo_resguardo).
  const equiposListos = ordenesTaller.filter((o) => o.estado === 'LISTO_ENTREGA')
  const resguardoAcumulado = equiposListos.reduce((acc, o) => acc + Number(o.cargo_resguardo || 0), 0)

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      {data.facturas && (
        <section className="dash-seccion">
          <h2 className="dash-seccion-titulo">{t('secciones.ingresos')}</h2>
          <div className="dash-ingresos">
            <div className="dash-ingresos-total">
              <span className="dash-ingresos-label">{t('stats.totalConsolidado')}</span>
              <span className="dash-ingresos-valor">${ventasTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              {tasaCambio > 0 && <span className="dash-ingresos-tasa">{t('tasaCambio', { monto: tasaCambio.toLocaleString() })}</span>}
            </div>
            <div className="dash-ingresos-desglose">
              <div className="dash-moneda-item">
                <span className="dash-moneda-chip usd">US$</span>
                <div>
                  <div className="dash-moneda-label">{t('stats.cobradoUsd')}</div>
                  <div className="dash-moneda-valor">${ventasUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                </div>
              </div>
              <div className="dash-moneda-item">
                <span className="dash-moneda-chip nio">C$</span>
                <div>
                  <div className="dash-moneda-label">{t('stats.cobradoNio')}</div>
                  <div className="dash-moneda-valor">C${ventasNio.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                </div>
              </div>
              <div className="dash-moneda-item">
                <span className="dash-moneda-chip neutro">#</span>
                <div>
                  <div className="dash-moneda-label">{t('stats.facturasEmitidas')}</div>
                  <div className="dash-moneda-valor">{facturas.length}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="charts-row charts-row-hero">
        {data.productos && (
          <div className="chart-card">
            <h3>{t('charts.inventarioPorSubgrupo')}</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={subgrupoData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="cantidad" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {data.ordenesTaller && (
          <div className="chart-card">
            <h3>{t('charts.ordenesPorEstado')}</h3>
            {tallerEstadoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={tallerEstadoData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={105} label>
                    {tallerEstadoData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty" style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t('charts.sinOrdenes')}
              </div>
            )}
          </div>
        )}

        {data.ordenesTaller && (
          <div className="chart-card">
            <h3>{t('charts.tiempoReparacion')}</h3>
            {ordenesConTiempo.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={tiempoReparacionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty" style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t('charts.sinTiempoReparacion')}
              </div>
            )}
          </div>
        )}

        {data.facturas && (
          <div className="chart-card">
            <h3>{t('charts.ventasPorTipo')}</h3>
            {ventasPorTipoData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={ventasPorTipoData} dataKey="ingreso" nameKey="name" cx="50%" cy="50%" outerRadius={95} label>
                      {ventasPorTipoData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={ventasPorTipoTooltip} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <p className="dash-nota">{t('charts.equiposListos', { n: equiposListos.length, monto: resguardoAcumulado.toLocaleString(undefined, { maximumFractionDigits: 2 }) })}</p>
                <p className="dash-nota">{t('notaMargen')}</p>
              </>
            ) : (
              <div className="empty" style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t('charts.sinVentas')}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card-grid">
        {data.ordenesTaller && (
          <div className="stat">
            <div className="stat-icon blue"><Wrench /></div>
            <div className="stat-label">{t('stats.ordenesEnTaller')}</div>
            <div className="stat-value">{ordenesTaller.filter((o) => o.estado !== 'ENTREGADO').length}</div>
          </div>
        )}
        {data.ordenesTaller && (
          <div className="stat">
            <div className="stat-icon green"><CheckCircle2 /></div>
            <div className="stat-label">{t('stats.listasParaEntrega')}</div>
            <div className="stat-value">{ordenesTaller.filter((o) => o.estado === 'LISTO_ENTREGA').length}</div>
          </div>
        )}
        {data.productos && (
          <div className="stat">
            <div className="stat-icon purple"><Package /></div>
            <div className="stat-label">{t('stats.productos')}</div>
            <div className="stat-value">{productos.length}</div>
          </div>
        )}
        {data.productos && (
          <div className="stat">
            <div className={`stat-icon ${bajoStock.length > 0 ? 'red' : 'amber'}`}><AlertTriangle /></div>
            <div className="stat-label">{t('stats.bajoStock')}</div>
            <div className="stat-value" style={{ color: bajoStock.length > 0 ? 'var(--danger)' : 'inherit' }}>{bajoStock.length}</div>
          </div>
        )}
        {data.ordenesCompra && (
          <div className="stat">
            <div className="stat-icon cyan"><ShoppingCart /></div>
            <div className="stat-label">{t('stats.ordenesCompra')}</div>
            <div className="stat-value">{ordenesCompra.length}</div>
          </div>
        )}
        {data.empleados && (
          <div className="stat">
            <div className="stat-icon pink"><Users /></div>
            <div className="stat-label">{t('stats.empleadosActivos')}</div>
            <div className="stat-value">{empleados.filter((e) => e.activo).length}</div>
          </div>
        )}
        {data.porCobrar && (
          <div className="stat">
            <div className="stat-icon green"><ArrowDownCircle /></div>
            <div className="stat-label">{t('stats.porCobrar')}</div>
            <div className="stat-value">${cobrarTotal.toLocaleString()}</div>
          </div>
        )}
        {data.porPagar && (
          <div className="stat">
            <div className="stat-icon amber"><ArrowUpCircle /></div>
            <div className="stat-label">{t('stats.porPagar')}</div>
            <div className="stat-value">${pagarTotal.toLocaleString()}</div>
          </div>
        )}
        {data.ordenesTaller && (
          <div className="stat">
            <div className="stat-icon purple"><Clock /></div>
            <div className="stat-label">{t('stats.resguardoAcumulado')}</div>
            <div className="stat-value">C${resguardoAcumulado.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
