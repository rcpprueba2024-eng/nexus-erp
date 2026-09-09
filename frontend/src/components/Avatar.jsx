import { useRef } from 'react'
import { MEDIA_BASE_URL } from '../api.js'

const iniciales = (nombre = '') => nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?'

/** Avatar de empleado: foto subida, o iniciales sobre el color asignado
 * por el backend (avatar_color, fijo por empleado). onSubirFoto es opcional
 * — cuando se pasa, se muestra un botón de cámara para reemplazar la foto. */
function Avatar({ nombre, foto, color = '#4338ca', size = 44, onSubirFoto, editable = false }) {
  const inputRef = useRef(null)
  const src = foto ? (foto.startsWith('http') ? foto : `${MEDIA_BASE_URL}${foto}`) : null

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (file && onSubirFoto) onSubirFoto(file)
    e.target.value = ''
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {src ? (
        <img
          src={src} alt={nombre}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--panel)', boxShadow: '0 0 0 1px var(--border)' }}
        />
      ) : (
        <div
          style={{
            width: size, height: size, borderRadius: '50%', background: color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.38, fontWeight: 700, border: '2px solid var(--panel)', boxShadow: '0 0 0 1px var(--border)',
          }}
        >
          {iniciales(nombre)}
        </div>
      )}
      {editable && (
        <>
          <button
            type="button" onClick={() => inputRef.current?.click()}
            title="Cambiar foto"
            style={{
              position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%',
              background: 'var(--accent)', color: '#fff', border: '2px solid var(--panel)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, lineHeight: 1, cursor: 'pointer', padding: 0,
            }}
          >
            📷
          </button>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </>
      )}
    </div>
  )
}

export default Avatar
