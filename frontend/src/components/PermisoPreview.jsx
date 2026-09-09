import { Printer } from 'lucide-react'
import logo from '../assets/rcp-logo.png'

// Comprobante imprimible de un permiso o de vacaciones tomadas — mismo
// patrón que OrdenPreview.jsx/ReciboPreview.jsx (documento aparte con sus
// propias clases .permiso-print, visible solo al imprimir vía @media
// print), con espacio de firma física para que el trabajador firme como
// constancia, igual que el checklist de entrega de equipos.
function PermisoPreview({ permiso, empleadoNombre, t, onClose }) {
  if (!permiso) return null

  const esFijo = permiso.tipo === 'FIJO'
  const esPorHora = permiso.tipo === 'POR_HORA'
  const tipoLabel = esFijo ? t('permisos.tipoFijo', { ns: 'rrhh' }) : esPorHora ? t('permisos.tipoPorHora', { ns: 'rrhh' }) : t('permisos.tipoMomentaneo', { ns: 'rrhh' })
  const vigencia = esFijo
    ? t(`horario.dias.${permiso.dia_semana}`, { ns: 'rrhh' })
    : esPorHora
      ? permiso.fecha_inicio
      : `${permiso.fecha_inicio} — ${permiso.fecha_fin}`
  const horario = esFijo
    ? (!permiso.hora_entrada && !permiso.hora_salida ? t('permisos.libreTodoElDia', { ns: 'rrhh' }) : `${permiso.hora_entrada} - ${permiso.hora_salida}`)
    : esPorHora
      ? `${permiso.hora_entrada} - ${permiso.hora_salida}`
      : '—'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="permiso-print">
          <div className="orden-print-header">
            <img src={logo} alt="RCP" />
            <div className="orden-print-header-titulo">
              <h2>{t('permisos.comprobanteTitulo', { ns: 'rrhh' })}</h2>
              <div className="orden-print-header-meta">{t('permisos.empleado', { ns: 'rrhh' })}: <strong>{empleadoNombre}</strong></div>
            </div>
          </div>

          <div className="permiso-print-campo"><span className="lbl">{t('permisos.tipo', { ns: 'rrhh' })}</span><span className="val">{tipoLabel}</span></div>
          <div className="permiso-print-campo"><span className="lbl">{t('permisos.columnaVigencia', { ns: 'rrhh' })}</span><span className="val">{vigencia}</span></div>
          <div className="permiso-print-campo"><span className="lbl">{t('permisos.columnaHorario', { ns: 'rrhh' })}</span><span className="val">{horario}</span></div>
          <div className="permiso-print-campo"><span className="lbl">{t('permisos.motivo', { ns: 'rrhh' })}</span><span className="val">{permiso.motivo || '—'}</span></div>
          <div className="permiso-print-campo"><span className="lbl">{t('permisos.fechaEmision', { ns: 'rrhh' })}</span><span className="val">{new Date().toLocaleDateString()}</span></div>

          <div className="orden-print-firmas" style={{ marginTop: 46 }}>
            <div className="orden-print-firma-box">
              <div className="orden-print-firma-espacio" />
              <div className="orden-print-firma-linea">{t('permisos.firmaTrabajador', { ns: 'rrhh' })}</div>
            </div>
            <div className="orden-print-firma-box">
              <div className="orden-print-firma-espacio" />
              <div className="orden-print-firma-linea">{t('permisos.firmaRrhh', { ns: 'rrhh' })}</div>
            </div>
          </div>
        </div>

        <div className="form-row no-print" style={{ marginTop: 16 }}>
          <button onClick={() => window.print()} style={{ flex: 1 }}><Printer size={15} /> {t('botones.imprimir', { ns: 'common' })}</button>
          <button className="secondary" onClick={onClose}>{t('botones.cerrar', { ns: 'common' })}</button>
        </div>
      </div>
    </div>
  )
}

export default PermisoPreview
