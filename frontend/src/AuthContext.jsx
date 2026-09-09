import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { authApi } from './api.js'
import { useTheme } from './ThemeContext.jsx'

const AuthContext = createContext(null)

const ROLE_LABELS = {
  ADMIN: 'Gerencia General',
  TALLER: 'Taller',
  PASANTE: 'Pasante de taller',
  VENTAS: 'Ventas',
  RRHH: 'Recursos Humanos',
  BACKOFFICE: 'Backoffice',
}

export function AuthProvider({ children }) {
  const { i18n } = useTranslation()
  const { setTema } = useTheme()
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('rcp_user')
    return stored ? JSON.parse(stored) : null
  })

  useEffect(() => {
    if (user?.idioma && !localStorage.getItem('rcp_idioma')) {
      i18n.changeLanguage(user.idioma)
    }
    if (user?.tema && !localStorage.getItem('rcp_tema')) {
      setTema(user.tema, { persistir: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // El rol y los módulos permitidos quedan guardados en localStorage desde
  // el login y de ahí no se vuelven a tocar solos — si Gerencia le cambia
  // algo a este usuario desde otra computadora, esta sesión sigue viendo la
  // foto vieja hasta que alguien cierre sesión y vuelva a entrar. Por eso al
  // abrir la app se refresca una vez contra el servidor: si el token ya no
  // sirve (cuenta desactivada/eliminada), se cierra sesión sola.
  useEffect(() => {
    if (!localStorage.getItem('rcp_token')) return
    authApi.me()
      .then((res) => {
        const data = { ...res.data, token: localStorage.getItem('rcp_token') }
        localStorage.setItem('rcp_user', JSON.stringify(data))
        setUser(data)
      })
      .catch(() => {
        localStorage.removeItem('rcp_token')
        localStorage.removeItem('rcp_user')
        setUser(null)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await authApi.login(username, password)
    const data = res.data
    localStorage.setItem('rcp_token', data.token)
    localStorage.setItem('rcp_user', JSON.stringify(data))
    setUser(data)
    if (data.idioma && !localStorage.getItem('rcp_idioma')) {
      i18n.changeLanguage(data.idioma)
    }
    if (data.tema && !localStorage.getItem('rcp_tema')) {
      setTema(data.tema, { persistir: false })
    }
    return data
  }, [i18n, setTema])

  const logout = useCallback(() => {
    localStorage.removeItem('rcp_token')
    localStorage.removeItem('rcp_user')
    setUser(null)
  }, [])

  // Para reflejar de inmediato cambios hechos sobre la propia cuenta (p.ej.
  // subir su foto desde Configuración) sin tener que cerrar sesión.
  const refrescarUsuario = useCallback(async () => {
    const res = await authApi.me()
    const data = { ...res.data, token: localStorage.getItem('rcp_token') }
    localStorage.setItem('rcp_user', JSON.stringify(data))
    setUser(data)
    return data
  }, [])

  const roleLabel = user ? (ROLE_LABELS[user.rol] || user.rol) : ''

  return (
    <AuthContext.Provider value={{ user, login, logout, roleLabel, refrescarUsuario }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

// Taller y Pasante no tienen acceso a datos de clientes ni pueden crear
// órdenes (solo trabajan el equipo ya recibido). Ver backend
// taller.serializers.OrdenTallerTecnicoSerializer / ventas.views.ClienteViewSet.
export const ROLES_SIN_ACCESO_CLIENTE = ['TALLER', 'PASANTE']
export const esRolSinAccesoCliente = (rol) => ROLES_SIN_ACCESO_CLIENTE.includes(rol)

export { ROLE_LABELS }
