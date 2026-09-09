import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClipboardList, ShoppingBag } from 'lucide-react'

function Facturacion() {
  const { t } = useTranslation('facturacion')
  const navigate = useNavigate()

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      <div className="area-selector-grid">
        <button className="area-selector-card" onClick={() => navigate('/ventas/facturar-ots')}>
          <div className="area-selector-icon"><ClipboardList /></div>
          <h3>{t('opciones.ots.titulo')}</h3>
          <p>{t('opciones.ots.descripcion')}</p>
        </button>
        <button className="area-selector-card" onClick={() => navigate('/pos')}>
          <div className="area-selector-icon"><ShoppingBag /></div>
          <h3>{t('opciones.productos.titulo')}</h3>
          <p>{t('opciones.productos.descripcion')}</p>
        </button>
      </div>
    </div>
  )
}

export default Facturacion
