import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Archive, Wrench } from 'lucide-react'
import { tallerApi } from '../api.js'
import Pagination from '../components/Pagination.jsx'

const PAGE_SIZE = 15

function EquiposAbandonados() {
  const { t } = useTranslation(['equiposAbandonados', 'common'])
  const navigate = useNavigate()
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [repuestos, setRepuestos] = useState({})
  const [guardandoId, setGuardandoId] = useState(null)
  const [pagina, setPagina] = useState(1)

  const cargar = () => {
    setLoading(true)
    tallerApi.ordenes().then((r) => {
      setOrdenes(r.data)
      const iniciales = {}
      // Campo propio (repuestos_extraidos_abandono), separado de `notas`
      // — `notas` ya trae el historial real de recepción/diagnóstico de la
      // orden en muchos casos, y antes se pisaba con esto por error.
      r.data.forEach((o) => { if (o.estado === 'ABANDONADO') iniciales[o.id] = o.repuestos_extraidos_abandono || '' })
      setRepuestos(iniciales)
    }).finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const abandonados = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return ordenes
      .filter((o) => o.estado === 'ABANDONADO')
      .filter((o) => !q || o.numero.toLowerCase().includes(q) || (o.cliente_nombre || '').toLowerCase().includes(q))
  }, [ordenes, buscar])

  useEffect(() => { setPagina(1) }, [buscar])
  const visibles = abandonados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)

  const guardarRepuestos = (id) => {
    setGuardandoId(id)
    tallerApi.actualizarOrden(id, { repuestos_extraidos_abandono: repuestos[id] || '' }).finally(() => setGuardandoId(null))
  }

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      <div className="card-grid" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="stat-icon"><Archive /></div>
          <div className="stat-label">{t('stats.total')}</div>
          <div className="stat-value">{abandonados.length}</div>
        </div>
      </div>

      <div className="form-row">
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder={t('buscarPlaceholder')} style={{ flex: '1 1 320px', maxWidth: 420 }} />
      </div>

      <div className="card">
        {loading && <div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div>}
        {!loading && abandonados.length === 0 && (
          <div className="empty">
            <div className="empty-icon"><Archive /></div>
            {t('sinResultados')}
          </div>
        )}
        {!loading && abandonados.length > 0 && (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('tabla.numero')}</th>
                <th>{t('tabla.cliente')}</th>
                <th>{t('tabla.telefono')}</th>
                <th>{t('tabla.equipo')}</th>
                <th>{t('tabla.marcaModelo')}</th>
                <th>{t('tabla.fechaIngreso')}</th>
                <th>{t('tabla.recibidoPor')}</th>
                <th>{t('tabla.tecnico')}</th>
                <th>{t('tabla.asesor')}</th>
                <th>{t('tabla.diasListo')}</th>
                <th>{t('tabla.repuestosExtraidos')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((o) => (
                <tr key={o.id}>
                  <td><button className="detail-link" onClick={() => navigate(`/ordenes/${o.id}`)} title={t('tabla.verOrden')}>{o.numero}</button></td>
                  <td>{o.cliente_nombre}</td>
                  <td>{o.cliente_telefono || '—'}</td>
                  <td>{o.equipo}</td>
                  <td>{[o.marca, o.modelo].filter(Boolean).join(' ') || '—'}</td>
                  <td>{o.fecha_ingreso || '—'}</td>
                  <td>{o.recibe || '—'}</td>
                  <td>{o.tecnico_nombre || '—'}</td>
                  <td>{o.asesor_nombre || '—'}</td>
                  <td>{o.dias_en_espera ?? '—'}</td>
                  <td>
                    <input
                      value={repuestos[o.id] ?? ''}
                      onChange={(e) => setRepuestos((prev) => ({ ...prev, [o.id]: e.target.value }))}
                      placeholder={t('tabla.repuestosPlaceholder')}
                      style={{ minWidth: 220 }}
                    />
                  </td>
                  <td className="actions">
                    <button className="secondary" disabled={guardandoId === o.id} onClick={() => guardarRepuestos(o.id)}>
                      <Wrench size={14} /> {t('botones.guardar', { ns: 'common' })}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {!loading && abandonados.length > 0 && (
          <Pagination page={pagina} totalItems={abandonados.length} pageSize={PAGE_SIZE} onPageChange={setPagina} />
        )}
      </div>
    </div>
  )
}

export default EquiposAbandonados
