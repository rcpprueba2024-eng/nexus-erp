import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../AuthContext.jsx'
import { IDIOMAS } from '../i18n/index.js'

function Login() {
  const { t, i18n } = useTranslation('login')
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      // El destino real lo decide la ruta "/login" en App.jsx (con base en
      // el rol ya guardado en el contexto); acá solo dejamos el formulario.
    } catch {
      setError(t('error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand" style={{ padding: 0, marginBottom: 24, justifyContent: 'center' }}>
          <span className="brand-mark" style={{ color: 'var(--text-h)' }}>RCP</span>
          <span className="brand-sub">ERP</span>
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: 20 }}>{t('titulo')}</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input placeholder={t('usuario')} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            <input placeholder={t('contrasena')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
            <button type="submit" disabled={loading}>{loading ? t('ingresando') : t('ingresar')}</button>
          </div>
        </form>
        <select
          value={i18n.resolvedLanguage || i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          style={{ marginTop: 18, width: '100%' }}
        >
          {IDIOMAS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </div>
    </div>
  )
}

export default Login
