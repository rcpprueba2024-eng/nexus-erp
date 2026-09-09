import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { authApi } from './api.js'

const ThemeContext = createContext(null)

export const TEMAS = [
  { value: 'auto', label: 'Automático', descripcion: 'Sigue el modo claro/oscuro del sistema', swatch: ['#f3f4f6', '#0b0d12'], accent: '#1d4ed8' },
  { value: 'claro', label: 'Claro', descripcion: 'Azul clásico, siempre claro', swatch: ['#f3f4f6', '#ffffff'], accent: '#1d4ed8' },
  { value: 'oscuro', label: 'Oscuro', descripcion: 'Azul clásico, siempre oscuro', swatch: ['#161922', '#0b0d12'], accent: '#60a5fa' },
  { value: 'medianoche', label: 'Medianoche', descripcion: 'Negro azulado profundo con acento índigo', swatch: ['#14142b', '#0a0a17'], accent: '#818cf8' },
  { value: 'esmeralda', label: 'Esmeralda', descripcion: 'Claro fresco con acento verde', swatch: ['#f0f7f3', '#ffffff'], accent: '#059669' },
  { value: 'ambar', label: 'Ámbar', descripcion: 'Chocolate cálido e industrial de taller', swatch: ['#241a0d', '#1a1207'], accent: '#f59e0b' },
  { value: 'blanco', label: 'Blanco y negro', descripcion: 'Todo blanco, letras negras — sin color, incluido el menú', swatch: ['#ffffff', '#ffffff'], accent: '#111827' },
]

function aplicarTema(tema) {
  if (!tema || tema === 'auto') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', tema)
  }
}

export function ThemeProvider({ children }) {
  const [tema, setTemaState] = useState(() => localStorage.getItem('rcp_tema') || 'auto')

  useEffect(() => {
    aplicarTema(tema)
  }, [tema])

  const setTema = useCallback((nuevo, { persistir = true } = {}) => {
    setTemaState(nuevo)
    localStorage.setItem('rcp_tema', nuevo)
    if (persistir) {
      authApi.actualizarTema(nuevo).catch(() => {})
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ tema, setTema }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
