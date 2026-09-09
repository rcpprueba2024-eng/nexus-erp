import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { reportesApi } from '../api.js'

function ReporteFinanciero() {
  const { t } = useTranslation('backoffice')
  const [ventasMensual, setVentasMensual] = useState(null)
  const [gastosInsumos, setGastosInsumos] = useState(null)
  const [gastosPersonal, setGastosPersonal] = useState(null)
  const [cuentasCobrar, setCuentasCobrar] = useState(null)

  useEffect(() => {
    reportesApi.ventasPeriodo('mensual').then((r) => setVentasMensual(r.data))
    reportesApi.gastosInsumos().then((r) => setGastosInsumos(r.data))
    reportesApi.gastosPersonal().then((r) => setGastosPersonal(r.data))
    reportesApi.cuentasPorCobrar().then((r) => setCuentasCobrar(r.data))
  }, [])

  const cargando = !ventasMensual || !gastosInsumos || !gastosPersonal || !cuentasCobrar

  const totalVentasMes = ventasMensual ? ventasMensual.reduce((s, v) => s + Number(v.total || 0), 0) : 0
  const ventaDelMesActual = ventasMensual && ventasMensual.length > 0 ? Number(ventasMensual[ventasMensual.length - 1].total || 0) : 0
  const totalGastos = (gastosInsumos?.total_gastado || 0) + (gastosPersonal?.total_planilla || 0)
  const utilidadNeta = ventaDelMesActual - totalGastos
  const totalPorCobrar = cuentasCobrar ? cuentasCobrar.reduce((s, c) => s + Number(c.monto || 0), 0) : 0

  return (
    <div>
      <div className="page-header">
        <h1>{t('financiero.titulo')}</h1>
        <p>{t('financiero.subtitulo')}</p>
      </div>

      {cargando ? (
        <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>
      ) : (
        <>
          <div className="card-grid">
            <div className="stat">
              <div className="stat-label">{t('financiero.ventasMes')}</div>
              <div className="stat-value">${ventaDelMesActual.toLocaleString()}</div>
            </div>
            <div className="stat">
              <div className="stat-label">{t('financiero.gastosMes')}</div>
              <div className="stat-value">${totalGastos.toLocaleString()}</div>
            </div>
            <div className="stat">
              <div className="stat-label">{t('financiero.utilidadNeta')}</div>
              <div className="stat-value" style={{ color: utilidadNeta >= 0 ? 'var(--success)' : 'var(--danger)' }}>${utilidadNeta.toLocaleString()}</div>
            </div>
            <div className="stat">
              <div className="stat-label">{t('financiero.porCobrar')}</div>
              <div className="stat-value">${totalPorCobrar.toLocaleString()}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-head-row">
              <h3>{t('financiero.ventasPorMesTitulo')}</h3>
              <button className="export-btn" onClick={() => reportesApi.exportarVentasPeriodo('mensual')}>⬇ {t('botones.exportarExcel', { ns: 'common' })}</button>
            </div>
            <table>
              <thead><tr><th>{t('financiero.periodo')}</th><th>{t('financiero.total')}</th></tr></thead>
              <tbody>
                {ventasMensual.map((v, i) => <tr key={i}><td>{v.periodo}</td><td>${Number(v.total).toLocaleString()}</td></tr>)}
              </tbody>
              <tfoot><tr><td><strong>{t('financiero.acumulado')}</strong></td><td><strong>${totalVentasMes.toLocaleString()}</strong></td></tr></tfoot>
            </table>
          </div>

          <div className="card">
            <div className="card-head-row">
              <h3>{t('financiero.gastosTitulo')}</h3>
              <button className="export-btn" onClick={() => reportesApi.exportarGastos()}>⬇ {t('botones.exportarExcel', { ns: 'common' })}</button>
            </div>
            <p>{t('financiero.gastosInsumos')} <strong>${gastosInsumos.total_gastado.toLocaleString()}</strong></p>
            <p>{t('financiero.gastosPersonal')} <strong>${gastosPersonal.total_planilla.toLocaleString()}</strong></p>
          </div>

          <div className="card">
            <div className="card-head-row">
              <h3>{t('financiero.porCobrarTitulo')}</h3>
              <button className="export-btn" onClick={() => reportesApi.exportarCuentasPorCobrar()}>⬇ {t('botones.exportarExcel', { ns: 'common' })}</button>
            </div>
            {cuentasCobrar.length === 0 ? <div className="empty">{t('financiero.sinPorCobrar')}</div> : (
              <table>
                <thead><tr><th>{t('financiero.cliente')}</th><th>{t('financiero.monto')}</th><th>{t('financiero.vencimiento')}</th></tr></thead>
                <tbody>
                  {cuentasCobrar.map((c, i) => <tr key={i}><td>{c.cliente}</td><td>${Number(c.monto).toLocaleString()}</td><td>{c.fecha_vencimiento}</td></tr>)}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ReporteFinanciero
