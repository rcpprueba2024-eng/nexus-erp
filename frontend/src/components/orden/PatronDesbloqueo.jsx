import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const POS = [
  [0, 0], [1, 0], [2, 0],
  [0, 1], [1, 1], [2, 1],
  [0, 2], [1, 2], [2, 2],
]

function PatronDesbloqueo({ value = [], onChange, readOnly = false }) {
  const { t } = useTranslation('ordenes')
  const [dragging, setDragging] = useState(false)
  const secuenciaRef = useRef(value || [])
  const [, forceRender] = useState(0)

  // Mantiene la referencia sincronizada si el padre resetea el valor (ej. "Limpiar" o carga inicial)
  useEffect(() => {
    secuenciaRef.current = value || []
    forceRender((n) => n + 1)
  }, [value])

  const secuencia = secuenciaRef.current

  const coord = (i) => ({ x: POS[i][0] * 60 + 30, y: POS[i][1] * 60 + 30 })

  const agregarPunto = (i) => {
    if (readOnly || secuenciaRef.current.includes(i)) return
    secuenciaRef.current = [...secuenciaRef.current, i]
    forceRender((n) => n + 1)
    onChange(secuenciaRef.current)
  }

  const limpiar = () => {
    secuenciaRef.current = []
    forceRender((n) => n + 1)
    onChange([])
  }

  return (
    <div className="orden-tw">
      <svg
        width="180" height="180" viewBox="0 0 180 180"
        className="touch-none select-none rounded-lg border border-line bg-subtle"
        onMouseDown={() => setDragging(true)}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
      >
        {secuencia.slice(1).map((i, idx) => {
          const a = coord(secuencia[idx])
          const b = coord(i)
          return <line key={idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" />
        })}
        {POS.map((_, i) => {
          const { x, y } = coord(i)
          const activo = secuencia.includes(i)
          return (
            <circle
              key={i} cx={x} cy={y} r="12"
              fill={activo ? '#4f46e5' : '#fff'}
              stroke={activo ? '#4338ca' : '#94a3b8'}
              strokeWidth="2"
              className={readOnly ? '' : 'cursor-pointer'}
              onMouseDown={() => agregarPunto(i)}
              onMouseEnter={() => dragging && agregarPunto(i)}
            />
          )
        })}
      </svg>
      {!readOnly && (
        <button type="button" onClick={limpiar} className="mt-2 text-xs text-muted underline">
          {t('widgets.patron.limpiar')}
        </button>
      )}
    </div>
  )
}

export default PatronDesbloqueo
