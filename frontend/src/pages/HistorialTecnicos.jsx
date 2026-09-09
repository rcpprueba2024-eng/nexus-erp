import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History } from 'lucide-react'
import { tallerApi, rrhhApi } from '../api.js'
import Avatar from '../components/Avatar.jsx'
import Pagination from '../components/Pagination.jsx'

const PAGE_SIZE = 15

function HistorialTecnicos() {
  const { t } = useTranslation(['historialTecnicos', 'common'])
  const [personal, setPersonal] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  // Un contador de página por técnico — cada tabla se pagina aparte.
  const [paginaPorTecnico, setPaginaPorTecnico] = useState({})

  useEffect(() => {
    setLoading(true)
    Promise.all([rrhhApi.empleados(), tallerApi.ordenes()])
      .then(([p, o]) => {
        setPersonal(p.data.filter((e) => (e.areas || []).some((a) => a === 'TALLER' || a === 'PASANTE')))
        setOrdenes(o.data)
      })
      .finally(() => setLoading(false))
  }, [])

  // El trabajo del técnico está hecho en cuanto el equipo queda reparado
  // (LISTO_ENTREGA), sin importar si luego lo retiran, sigue esperando o
  // termina abandonado — las 3 cuentan como una reparación suya.
  const ESTADOS_REPARADO = ['LISTO_ENTREGA', 'ENTREGADO', 'ABANDONADO']
  const reparadas = useMemo(() => ordenes.filter((o) => ESTADOS_REPARADO.includes(o.estado)), [ordenes])

  const estadoBadge = (estado) => {
    if (estado === 'ENTREGADO') return <span className="badge ok">{t(`estadosOrden.${estado}`, { ns: 'common' })}</span>
    if (estado === 'LISTO_ENTREGA') return <span className="badge pending">{t(`estadosOrden.${estado}`, { ns: 'common' })}</span>
    return <span className="badge off">{t(`estadosOrden.${estado}`, { ns: 'common' })}</span>
  }

  const q = buscar.trim().toLowerCase()

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      <div className="form-row">
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder={t('buscarPlaceholder')} style={{ flex: '1 1 320px', maxWidth: 420 }} />
      </div>

      {loading && <div className="card"><div className="loading">{t('mensajes.cargando', { ns: 'common' })}</div></div>}

      {!loading && personal.length === 0 && <div className="card"><div className="empty">{t('sinTecnicos')}</div></div>}

      {!loading && personal.map((p) => {
        const suyas = reparadas
          .filter((o) => o.tecnico === p.id)
          .filter((o) => !q || o.numero.toLowerCase().includes(q) || (o.cliente_nombre || '').toLowerCase().includes(q))
          .sort((a, b) => (b.fecha_entrega_real || b.fecha_listo || '').localeCompare(a.fecha_entrega_real || a.fecha_listo || ''))

        if (q && suyas.length === 0) return null

        const pagina = paginaPorTecnico[p.id] || 1
        const visibles = suyas.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE)
        const cambiarPagina = (np) => setPaginaPorTecnico((prev) => ({ ...prev, [p.id]: np }))

        return (
          <div key={p.id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <Avatar nombre={p.nombre} foto={p.foto} color={p.avatar_color} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-h)' }}>{p.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--text)' }}>{(p.puestos || []).join(' · ')}</div>
              </div>
              <span className="badge ok"><History size={12} style={{ marginRight: 3 }} />{t('reparados', { n: suyas.length })}</span>
            </div>
            {suyas.length === 0 ? (
              <div className="empty">{t('sinReparaciones')}</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{t('tabla.numero')}</th>
                    <th>{t('tabla.cliente')}</th>
                    <th>{t('tabla.equipo')}</th>
                    <th>{t('tabla.fechaEntrega')}</th>
                    <th>{t('tabla.estado')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((o) => (
                    <tr key={o.id}>
                      <td>{o.numero}</td>
                      <td>{o.cliente_nombre}</td>
                      <td>{o.equipo}</td>
                      <td>{o.fecha_entrega_real || o.fecha_listo || '—'}</td>
                      <td>{estadoBadge(o.estado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {suyas.length > 0 && (
              <Pagination page={pagina} totalItems={suyas.length} pageSize={PAGE_SIZE} onPageChange={cambiarPagina} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default HistorialTecnicos
