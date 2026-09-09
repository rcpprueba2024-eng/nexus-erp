import { useTranslation } from 'react-i18next'
import { IDIOMAS } from '../i18n/index.js'
import { authApi } from '../api.js'

function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  const cambiar = (e) => {
    const idioma = e.target.value
    i18n.changeLanguage(idioma)
    authApi.actualizarIdioma(idioma).catch(() => {})
  }

  return (
    <select
      value={i18n.resolvedLanguage || i18n.language}
      onChange={cambiar}
      className="language-switcher"
      aria-label={t('idioma.selector')}
      title={t('idioma.selector')}
    >
      {IDIOMAS.map((l) => (
        <option key={l.value} value={l.value}>{l.label}</option>
      ))}
    </select>
  )
}

export default LanguageSwitcher
