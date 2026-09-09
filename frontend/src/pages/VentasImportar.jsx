import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { inventarioApi } from '../api.js'

function VentasImportar() {
  const { t } = useTranslation('ventasImportar')
  const [importFile, setImportFile] = useState(null)
  const [importResultado, setImportResultado] = useState(null)
  const [importando, setImportando] = useState(false)

  const handleImport = (e) => {
    e.preventDefault()
    if (!importFile) return
    setImportando(true)
    setImportResultado(null)
    inventarioApi.importarMasivo(importFile)
      .then((res) => setImportResultado(res.data))
      .catch((err) => setImportResultado({ error: err.response?.data?.detail || t('errorGenerico') }))
      .finally(() => setImportando(false))
  }

  return (
    <div>
      <div className="page-header">
        <h1>{t('titulo')}</h1>
        <p>{t('subtitulo')}</p>
      </div>

      <div className="card">
        <p style={{ marginBottom: 14 }}>
          <Trans t={t} i18nKey="descripcion" components={{ strong: <strong />, code: <code /> }} />
        </p>
        <form onSubmit={handleImport}>
          <label className="dropzone">
            {importFile ? importFile.name : t('dropzoneText')}
            <input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={(e) => setImportFile(e.target.files[0])} />
          </label>
          <div style={{ marginTop: 14 }}>
            <button type="submit" disabled={!importFile || importando}>{importando ? t('importando') : t('boton')}</button>
          </div>
        </form>

        {importResultado && (
          importResultado.error ? (
            <div className="empty" style={{ color: 'var(--danger)', marginTop: 14 }}>{importResultado.error}</div>
          ) : (
            <div className="import-summary">
              <div className="stat"><div className="stat-label">{t('resultados.creados')}</div><div className="stat-value">{importResultado.creados}</div></div>
              <div className="stat"><div className="stat-label">{t('resultados.actualizados')}</div><div className="stat-value">{importResultado.actualizados}</div></div>
              <div className="stat"><div className="stat-label">{t('resultados.errores')}</div><div className="stat-value">{importResultado.errores.length}</div></div>
              {importResultado.errores.length > 0 && (
                <div style={{ flex: '1 1 100%', fontSize: 13, color: 'var(--danger)' }}>
                  {importResultado.errores.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default VentasImportar
