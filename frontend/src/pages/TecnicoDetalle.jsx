import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { tallerApi, rrhhApi } from '../api.js'
import { estadoSimplificado } from '../ordenTipo.js'
import Avatar from '../components/Avatar.jsx'
import Pagination from '../components/Pagination.jsx'

const PAGE_SIZE = 15

// Reemplaza el panel que antes se desplegaba dentro de la misma tarjeta del
// técnico en el Tablero (Taller.jsx) — con 20+ equipos esa lista quedaba muy
// apretada y sin espacio para mostrar el porqué de cada ingreso. Esta vista
// aparte sí tiene lugar para el detalle completo: tipo de servicio, falla
// reportada por el cliente y las instrucciones que el asesor dejó para el
// técnico — toda la información que necesita antes de tocar el equipo.
const ESTADOS_FUERA_DEL_TECNICO = ['ENTREGADO', 'CANCELADO', 'LISTO_ENTREGA', 'ABANDONADO']

function diasEnTaller(fechaIngreso) {
  if (!fechaIngreso) return null
  const ms = Date.now() - new Date(`${fechaIngreso}T00:00:00`).getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}

function TecnicoDetalle() {
  const { t } = useTranslation(['tecnicoDetalle', 'common', 'taller'])
  const { id } = useParams()
  const navigate = useNavigate()
  const [personal, setPersonal] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    setLoading(true)
    Promise.all([rrhhApi.empleados(), tallerApi.ordenes()])
      .then(([p, o]) => { setPersonal(p.data); setOrdenes(o.data) })
      .finally(() => setLoading(false))
  }, [id])

  const tecnico = personal.find((p) => String(p.id) === String(id)) || null

  const q = buscar.trim().toLowerCase()
  const suyas = useMemo(() => {
    return ordenes
      .filter((o) => String(o.tecnico) === String(id) && !ESTADOS_FUERA_DEL_TECNICO.includes(o.estado))
      .filter((o) => !q
        || o.numero.toLowerCase().includes(q)
        || (o.equipo || '').toLowerCase().includes(q)
        || (o.problema_reportado || '').toLowerCase().includes(q))
      .sort((a, b) => (a.fecha_ingreso || '').localeCompare(b.fecha_ingreso || ''))
  }, [ordenes, id, q])

  const visibles = suyas.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)

  const estadoBadge = (estado) => {
    const simple = estadoSimplificado(estado)
    const clase = simple === 'EN_PROCESO' ? 'pending' : 'off'
    return <span className={`badge ${clase}`}>{t(`estadosOrden.${estado}`, { ns: 'common' })}</span>
  }

  return (
    <div>
      <div className="page-header">
        <button type="button" className="secondary" style={{ marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => navigate('/taller')}>
          <ArrowLeft size={14} /> {t('volver')}
        </button>
        {tecnico && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar nombre={tecnico.nombre} foto={tecnico.foto} color={tecnico.avatar_color} size={44} />
            <div>
              <h1 style={{ marginBottom: 2 }}>{tecnico.nombre}</h1>
              <p style={{ margin: 0 }}>{(tecnico.puestos || []).join(' · ')}</p>
            </div>
          </div>
        )}
        {!tecnico && !loading && <h1>{t('tecnicoNoEncontrado')}</h1>}
      </div>

      {loading && <div className="card"><div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div></div>}

      {!loading && tecnico && (
        <div className="card">
          <div className="form-row" style={{ alignItems: 'center', marginBottom: 12 }}>
            <input value={buscar} onChange={(e) => { setBuscar(e.target.value); setPagina(1) }} placeholder={t('buscarPlaceholder')} style={{ flex: '1 1 320px', maxWidth: 420 }} />
            <span className="badge pending">{t('totalEquipos', { n: suyas.length })}</span>
          </div>

          {suyas.length === 0 ? (
            <div className="empty">{t('sinEquipos')}</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t('tabla.numero')}</th>
                      <th>{t('tabla.equipo')}</th>
                      <th>{t('tabla.tipoServicio')}</th>
                      <th>{t('tabla.problemaReportado')}</th>
                      <th>{t('tabla.instruccionesAsesor')}</th>
                      <th>{t('tabla.ingreso')}</th>
                      <th>{t('tabla.diasEnTaller')}</th>
                      <th>{t('tabla.estado')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((o) => (
                      <tr key={o.id}>
                        <td>{o.numero}</td>
                        <td>{o.equipo}</td>
                        <td>{o.tipo_servicio_display || t('tabla.sinDato')}</td>
                        <td style={{ maxWidth: 220, whiteSpace: 'pre-wrap' }}>{o.problema_reportado || t('tabla.sinDato')}</td>
                        <td style={{ maxWidth: 220, whiteSpace: 'pre-wrap' }}>{o.instrucciones_asesor || t('tabla.sinDato')}</td>
                        <td>{o.fecha_ingreso}</td>
                        <td>{t('diasCantidad', { n: diasEnTaller(o.fecha_ingreso) })}</td>
                        <td>{estadoBadge(o.estado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={pagina} totalItems={suyas.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default TecnicoDetalle
